"""
PRISM v1.0 pipeline.py — 전체 파이프라인 오케스트레이션.

2가지 주요 기능:
1. analyze_session() — 단일 세션 분석 → PrismSessionProfile
2. match_users() — 두 PrismUserProfile → PrismMatchResult

EXODIA 패턴 준수:
- DI (Dependency Injection)
- 해시 기반 입력 추적
- 에러 핸들링 패턴
"""
import hashlib
import time
from datetime import datetime, timezone
from typing import Optional

from prism.config import (
    ENGINE_VERSION,
    SPEC_VERSION,
    MIN_TURNS_FOR_ANALYSIS,
    MAX_TURNS_PER_SESSION,
    MATCH_WEIGHT_TOPIC_OVERLAP,
    MATCH_WEIGHT_DEPTH_COMPAT,
    MATCH_WEIGHT_COMPLEMENTARY,
    MATCH_WEIGHT_CURIOSITY_SYNC,
)
from prism.layers.p1_topic import P1TopicAnalyzer
from prism.layers.p2_depth import P2DepthAnalyzer
from prism.layers.p3_vocabulary import P3VocabularyAnalyzer
from prism.layers.p4_curiosity import P4CuriosityAnalyzer
from prism.schemas import (
    PrismError,
    PrismMatchDimension,
    PrismMatchResult,
    PrismMetadata,
    PrismSession,
    PrismSessionProfile,
    PrismUserProfile,
)


def _compute_hash(data: str) -> str:
    return hashlib.sha256(data.encode('utf-8')).hexdigest()


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _make_metadata(input_hash: str = "", turn_count: int = 0) -> PrismMetadata:
    return PrismMetadata(
        engine_version=ENGINE_VERSION,
        spec_version=SPEC_VERSION,
        computed_at=_now_iso(),
        input_hash=input_hash,
        turn_count=turn_count,
    )


class PrismPipeline:
    """PRISM v1.0 파이프라인.

    Pipeline:
    - analyze_session: PrismSession → PrismSessionProfile
    - build_user_profile: PrismSessionProfile[] → PrismUserProfile
    - match_users: PrismUserProfile × 2 → PrismMatchResult
    """

    def __init__(
        self,
        topic_analyzer: Optional[P1TopicAnalyzer] = None,
        depth_analyzer: Optional[P2DepthAnalyzer] = None,
        vocabulary_analyzer: Optional[P3VocabularyAnalyzer] = None,
        curiosity_analyzer: Optional[P4CuriosityAnalyzer] = None,
    ):
        self.p1 = topic_analyzer or P1TopicAnalyzer()
        self.p2 = depth_analyzer or P2DepthAnalyzer()
        self.p3 = vocabulary_analyzer or P3VocabularyAnalyzer()
        self.p4 = curiosity_analyzer or P4CuriosityAnalyzer()

    def analyze_session(
        self,
        session: PrismSession,
        user_id: str = "",
    ) -> PrismSessionProfile | PrismError:
        """단일 세션 분석.

        PrismSession → P1(Topic) → P2(Depth) → P3(Vocab) → P4(Curiosity)
        → PrismSessionProfile
        """
        try:
            # 유저 턴만 필터링
            user_turns = [t for t in session.turns if t.speaker == "user"]

            if len(user_turns) > MAX_TURNS_PER_SESSION:
                user_turns = user_turns[-MAX_TURNS_PER_SESSION:]

            texts = [t.raw_text for t in user_turns]
            input_hash = _compute_hash("||".join(texts))

            if len(texts) < MIN_TURNS_FOR_ANALYSIS:
                return PrismError(
                    error_code="INSUFFICIENT_TURNS",
                    error_stage="PIPELINE",
                    message=f"Need at least {MIN_TURNS_FOR_ANALYSIS} turns, got {len(texts)}",
                    engine_version=ENGINE_VERSION,
                )

            # P1: Topic Distribution
            topic_dist = self.p1.analyze(
                texts,
                self_reported_interests=session.self_reported_interests,
            )

            # P2: Engagement Depth
            engagement = self.p2.analyze(texts, topic_dist)

            # P2 결과를 P1에 반영 (주제별 깊이 업데이트)
            for cat, entry in topic_dist.topics.items():
                if cat in engagement.depth_by_topic:
                    entry.depth = engagement.depth_by_topic[cat]

            # P3: Vocabulary Landscape
            vocabulary = self.p3.analyze(texts)

            # P4: Curiosity Signature
            curiosity = self.p4.analyze(texts)

            return PrismSessionProfile(
                session_id=session.session_id,
                user_id=user_id,
                topic_distribution=topic_dist,
                engagement=engagement,
                vocabulary=vocabulary,
                curiosity=curiosity,
                metadata=_make_metadata(input_hash, len(texts)),
            )

        except Exception as e:
            return PrismError(
                error_code="COMPUTATION_ERROR",
                error_stage="PIPELINE",
                message=str(e),
                engine_version=ENGINE_VERSION,
            )

    def build_user_profile(
        self,
        user_id: str,
        session_profiles: list[PrismSessionProfile],
    ) -> PrismUserProfile:
        """복수 세션 → PrismUserProfile.

        최신 세션에 가중치를 두고 집계한다.
        """
        if not session_profiles:
            return PrismUserProfile(user_id=user_id, status="INSUFFICIENT")

        # 최신 세션 우선 집계 (단순: 마지막 세션 기준)
        latest = session_profiles[-1]
        session_count = len(session_profiles)

        if session_count >= 3:
            status = "PROFILED"
        elif session_count >= 1:
            status = "PARTIAL"
        else:
            status = "INSUFFICIENT"

        return PrismUserProfile(
            user_id=user_id,
            topic_distribution=latest.topic_distribution,
            engagement=latest.engagement,
            vocabulary=latest.vocabulary,
            curiosity=latest.curiosity,
            session_count=session_count,
            status=status,
            metadata=_make_metadata(
                _compute_hash(user_id), sum(sp.metadata.turn_count for sp in session_profiles)
            ),
        )

    def match_users(
        self,
        profile_a: PrismUserProfile,
        profile_b: PrismUserProfile,
    ) -> PrismMatchResult:
        """두 PrismUserProfile → PrismMatchResult.

        패턴 호환성 분석 (점수 비교 아님).
        """
        pair_id = f"{profile_a.user_id}:{profile_b.user_id}"
        dimensions: list[PrismMatchDimension] = []

        # 1. Topic Overlap
        topic_dim = self._compare_topics(profile_a, profile_b)
        dimensions.append(topic_dim)

        # 2. Depth Compatibility
        depth_dim = self._compare_depth(profile_a, profile_b)
        dimensions.append(depth_dim)

        # 3. Complementary Range
        comp_dim = self._compare_complementary(profile_a, profile_b)
        dimensions.append(comp_dim)

        # 4. Curiosity Sync
        curiosity_dim = self._compare_curiosity(profile_a, profile_b)
        dimensions.append(curiosity_dim)

        # 종합
        compat_scores = {"high": 3, "moderate": 2, "low": 1}
        weights = [
            MATCH_WEIGHT_TOPIC_OVERLAP,
            MATCH_WEIGHT_DEPTH_COMPAT,
            MATCH_WEIGHT_COMPLEMENTARY,
            MATCH_WEIGHT_CURIOSITY_SYNC,
        ]
        weighted_sum = sum(
            compat_scores.get(d.compatibility, 2) * w
            for d, w in zip(dimensions, weights)
        )

        if weighted_sum >= 2.5:
            overall = "high"
        elif weighted_sum >= 1.5:
            overall = "moderate"
        else:
            overall = "low"

        return PrismMatchResult(
            pair_id=pair_id,
            person_a_id=profile_a.user_id,
            person_b_id=profile_b.user_id,
            dimensions=dimensions,
            overall_compatibility=overall,
            narrative=self._generate_narrative(dimensions, overall),
            metadata=_make_metadata(_compute_hash(pair_id)),
        )

    def _compare_topics(
        self, a: PrismUserProfile, b: PrismUserProfile,
    ) -> PrismMatchDimension:
        """토픽 겹침 분석."""
        topics_a = set(a.topic_distribution.topics.keys())
        topics_b = set(b.topic_distribution.topics.keys())
        overlap = topics_a & topics_b
        union = topics_a | topics_b

        if not union:
            return PrismMatchDimension(
                dimension="topic_overlap",
                compatibility="moderate",
                narrative="충분한 토픽 데이터가 없습니다.",
            )

        overlap_ratio = len(overlap) / len(union)

        if overlap_ratio >= 0.4:
            compat = "high"
            narrative = f"공통 관심 영역이 {len(overlap)}개로 충분한 대화 소재가 있습니다."
        elif overlap_ratio >= 0.2:
            compat = "moderate"
            narrative = f"일부 공통 관심사({len(overlap)}개)가 있으며, 서로 다른 영역에서 새로운 자극이 가능합니다."
        else:
            compat = "low"
            narrative = "관심 영역의 겹침이 적어 공통 대화 소재를 찾는 데 노력이 필요합니다."

        return PrismMatchDimension(
            dimension="topic_overlap",
            compatibility=compat,
            narrative=narrative,
        )

    def _compare_depth(
        self, a: PrismUserProfile, b: PrismUserProfile,
    ) -> PrismMatchDimension:
        """참여 깊이 호환성."""
        depth_order = {"surface": 0, "casual": 1, "analytical": 2, "exploratory": 3, "creative": 4}
        da = depth_order.get(a.engagement.overall_depth, 1)
        db = depth_order.get(b.engagement.overall_depth, 1)
        gap = abs(da - db)

        if gap <= 1:
            return PrismMatchDimension(
                dimension="depth_compatibility",
                compatibility="high",
                narrative="비슷한 수준의 대화 깊이를 선호합니다.",
            )
        elif gap <= 2:
            return PrismMatchDimension(
                dimension="depth_compatibility",
                compatibility="moderate",
                narrative="대화 깊이에 약간의 차이가 있으나 조율이 가능합니다.",
            )
        else:
            return PrismMatchDimension(
                dimension="depth_compatibility",
                compatibility="low",
                narrative="선호하는 대화의 깊이에 상당한 차이가 있어 한쪽이 피로를 느낄 수 있습니다.",
            )

    def _compare_complementary(
        self, a: PrismUserProfile, b: PrismUserProfile,
    ) -> PrismMatchDimension:
        """상호 보완 범위."""
        topics_a = set(a.topic_distribution.topics.keys())
        topics_b = set(b.topic_distribution.topics.keys())
        unique_a = topics_a - topics_b
        unique_b = topics_b - topics_a

        complement_count = len(unique_a) + len(unique_b)

        if complement_count >= 4:
            return PrismMatchDimension(
                dimension="complementary_range",
                compatibility="high",
                narrative="서로 다른 관심 영역이 풍부하여 상호 자극 가능성이 높습니다.",
            )
        elif complement_count >= 2:
            return PrismMatchDimension(
                dimension="complementary_range",
                compatibility="moderate",
                narrative="적절한 수준의 상호 보완적 관심사가 있습니다.",
            )
        else:
            return PrismMatchDimension(
                dimension="complementary_range",
                compatibility="low",
                narrative="관심 영역이 비슷하여 새로운 자극보다는 공감대 중심의 대화가 예상됩니다.",
            )

    def _compare_curiosity(
        self, a: PrismUserProfile, b: PrismUserProfile,
    ) -> PrismMatchDimension:
        """호기심 패턴 호환성."""
        # depth_vs_breadth 호환
        dvb_a = a.curiosity.depth_vs_breadth
        dvb_b = b.curiosity.depth_vs_breadth

        same_style = dvb_a == dvb_b
        complementary = (
            (dvb_a == "deep_diver" and dvb_b == "wide_scanner") or
            (dvb_a == "wide_scanner" and dvb_b == "deep_diver")
        )

        # 질문 비율 유사도
        q_diff = abs(a.curiosity.question_ratio - b.curiosity.question_ratio)

        if same_style and q_diff < 0.15:
            return PrismMatchDimension(
                dimension="curiosity_sync",
                compatibility="high",
                narrative="호기심의 방향과 패턴이 유사하여 대화 리듬이 자연스럽게 맞습니다.",
            )
        elif complementary or q_diff < 0.25:
            return PrismMatchDimension(
                dimension="curiosity_sync",
                compatibility="moderate",
                narrative="탐구 스타일은 다르지만 상호 보완적인 대화가 가능합니다.",
            )
        else:
            return PrismMatchDimension(
                dimension="curiosity_sync",
                compatibility="low",
                narrative="호기심의 방향과 패턴이 달라 대화 리듬 조율이 필요합니다.",
            )

    def _generate_narrative(
        self,
        dimensions: list[PrismMatchDimension],
        overall: str,
    ) -> str:
        """종합 서술 생성."""
        narratives = [d.narrative for d in dimensions if d.narrative]
        summary_map = {
            "high": "콘텐츠와 관심사 측면에서 높은 호환성을 보입니다.",
            "moderate": "콘텐츠와 관심사 측면에서 적절한 호환성을 보이며, 일부 조율이 도움이 됩니다.",
            "low": "콘텐츠와 관심사 측면에서 상당한 차이가 있어 의식적인 노력이 필요합니다.",
        }
        return summary_map.get(overall, "")
