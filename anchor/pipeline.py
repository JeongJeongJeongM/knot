"""
ANCHOR v1.0 pipeline.py — 전체 파이프라인 오케스트레이션.

3가지 주요 기능:
1. analyze_session() — 단일 세션 분석 → AnchorSessionProfile
2. build_user_profile() — 복수 세션 → AnchorUserProfile
3. match_users() — 두 AnchorUserProfile → AnchorMatchResult
"""
import hashlib
from datetime import datetime, timezone
from typing import Optional

from anchor.config import (
    ENGINE_VERSION,
    SPEC_VERSION,
    MIN_TURNS_FOR_ANALYSIS,
    MAX_TURNS_PER_SESSION,
    MATCH_WEIGHT_ATTACHMENT,
    MATCH_WEIGHT_CONFLICT,
    MATCH_WEIGHT_EMOTIONAL,
    MATCH_WEIGHT_GROWTH,
    ATTACHMENT_COMPATIBILITY,
)
from anchor.layers.r1_attachment import R1AttachmentAnalyzer
from anchor.layers.r2_conflict import R2ConflictAnalyzer
from anchor.layers.r3_emotional import R3EmotionalAnalyzer
from anchor.layers.r4_growth import R4GrowthAnalyzer
from anchor.schemas import (
    AnchorError,
    AnchorMatchDimension,
    AnchorMatchResult,
    AnchorMetadata,
    AnchorSession,
    AnchorSessionProfile,
    AnchorUserProfile,
)


def _hash(data: str) -> str:
    return hashlib.sha256(data.encode('utf-8')).hexdigest()


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _meta(input_hash: str = "", turn_count: int = 0) -> AnchorMetadata:
    return AnchorMetadata(
        engine_version=ENGINE_VERSION,
        spec_version=SPEC_VERSION,
        computed_at=_now_iso(),
        input_hash=input_hash,
        turn_count=turn_count,
    )


class AnchorPipeline:
    """ANCHOR v1.0 파이프라인.

    Pipeline:
    - analyze_session: AnchorSession → AnchorSessionProfile
    - build_user_profile: AnchorSessionProfile[] → AnchorUserProfile
    - match_users: AnchorUserProfile × 2 → AnchorMatchResult
    """

    def __init__(
        self,
        attachment_analyzer: Optional[R1AttachmentAnalyzer] = None,
        conflict_analyzer: Optional[R2ConflictAnalyzer] = None,
        emotional_analyzer: Optional[R3EmotionalAnalyzer] = None,
        growth_analyzer: Optional[R4GrowthAnalyzer] = None,
    ):
        self.r1 = attachment_analyzer or R1AttachmentAnalyzer()
        self.r2 = conflict_analyzer or R2ConflictAnalyzer()
        self.r3 = emotional_analyzer or R3EmotionalAnalyzer()
        self.r4 = growth_analyzer or R4GrowthAnalyzer()

    def analyze_session(
        self,
        session: AnchorSession,
        user_id: str = "",
    ) -> AnchorSessionProfile | AnchorError:
        """단일 세션 분석.

        AnchorSession → R1(Attachment) → R2(Conflict) → R3(Emotional)
        → R4(Growth) → AnchorSessionProfile
        """
        try:
            user_turns = [t for t in session.turns if t.speaker == "user"]
            if len(user_turns) > MAX_TURNS_PER_SESSION:
                user_turns = user_turns[-MAX_TURNS_PER_SESSION:]

            texts = [t.raw_text for t in user_turns]
            input_hash = _hash("||".join(texts))

            if len(texts) < MIN_TURNS_FOR_ANALYSIS:
                return AnchorError(
                    error_code="INSUFFICIENT_TURNS",
                    error_stage="PIPELINE",
                    message=f"ANCHOR requires at least {MIN_TURNS_FOR_ANALYSIS} turns, got {len(texts)}",
                    engine_version=ENGINE_VERSION,
                )

            attachment = self.r1.analyze(texts)
            conflict = self.r2.analyze(texts)
            emotional = self.r3.analyze(texts)
            growth = self.r4.analyze(texts)

            return AnchorSessionProfile(
                session_id=session.session_id,
                user_id=user_id,
                attachment=attachment,
                conflict=conflict,
                emotional_availability=emotional,
                growth=growth,
                metadata=_meta(input_hash, len(texts)),
            )

        except Exception as e:
            return AnchorError(
                error_code="COMPUTATION_ERROR",
                error_stage="PIPELINE",
                message=str(e),
                engine_version=ENGINE_VERSION,
            )

    def build_user_profile(
        self,
        user_id: str,
        session_profiles: list[AnchorSessionProfile],
    ) -> AnchorUserProfile:
        """복수 세션 → AnchorUserProfile."""
        if not session_profiles:
            return AnchorUserProfile(user_id=user_id, status="INSUFFICIENT")

        latest = session_profiles[-1]
        n = len(session_profiles)

        status = "PROFILED" if n >= 3 else "PARTIAL" if n >= 1 else "INSUFFICIENT"

        return AnchorUserProfile(
            user_id=user_id,
            attachment=latest.attachment,
            conflict=latest.conflict,
            emotional_availability=latest.emotional_availability,
            growth=latest.growth,
            session_count=n,
            status=status,
            metadata=_meta(_hash(user_id), sum(sp.metadata.turn_count for sp in session_profiles)),
        )

    def match_users(
        self,
        profile_a: AnchorUserProfile,
        profile_b: AnchorUserProfile,
    ) -> AnchorMatchResult:
        """두 AnchorUserProfile → AnchorMatchResult."""
        pair_id = f"{profile_a.user_id}:{profile_b.user_id}"
        dimensions: list[AnchorMatchDimension] = []

        # R1: Attachment Compatibility
        dim_attach = self._match_attachment(profile_a, profile_b)
        dimensions.append(dim_attach)

        # R2: Conflict Style Mesh
        dim_conflict = self._match_conflict(profile_a, profile_b)
        dimensions.append(dim_conflict)

        # R3: Emotional Availability Balance
        dim_emotional = self._match_emotional(profile_a, profile_b)
        dimensions.append(dim_emotional)

        # R4: Growth Pace Alignment
        dim_growth = self._match_growth(profile_a, profile_b)
        dimensions.append(dim_growth)

        # 종합
        scores = {"high": 3, "moderate": 2, "low": 1}
        weights = [MATCH_WEIGHT_ATTACHMENT, MATCH_WEIGHT_CONFLICT,
                   MATCH_WEIGHT_EMOTIONAL, MATCH_WEIGHT_GROWTH]
        weighted = sum(
            scores.get(d.compatibility, 2) * w
            for d, w in zip(dimensions, weights)
        )

        overall = "high" if weighted >= 2.5 else "moderate" if weighted >= 1.5 else "low"

        # 위험 요소 수집
        all_risks = []
        for d in dimensions:
            all_risks.extend(d.risk_flags)
        risk_summary = "; ".join(all_risks) if all_risks else "특별한 위험 요소가 감지되지 않았습니다."

        return AnchorMatchResult(
            pair_id=pair_id,
            person_a_id=profile_a.user_id,
            person_b_id=profile_b.user_id,
            dimensions=dimensions,
            overall_compatibility=overall,
            risk_summary=risk_summary,
            narrative=self._overall_narrative(overall, all_risks),
            metadata=_meta(_hash(pair_id)),
        )

    def _match_attachment(self, a: AnchorUserProfile, b: AnchorUserProfile) -> AnchorMatchDimension:
        key = (a.attachment.primary_tendency, b.attachment.primary_tendency)
        score = ATTACHMENT_COMPATIBILITY.get(key, 0.5)
        risks = []

        if score <= 0.20:
            compat = "low"
            risks.append("애착 경향 조합에서 불균형 패턴이 발생할 가능성이 높습니다")
        elif score <= 0.50:
            compat = "moderate"
        else:
            compat = "high"

        return AnchorMatchDimension(
            dimension="attachment_compatibility",
            compatibility=compat,
            risk_flags=risks,
            narrative=f"관계 안정성 패턴의 호환성이 {'높습니다' if compat == 'high' else '보통입니다' if compat == 'moderate' else '주의가 필요합니다'}.",
        )

    def _match_conflict(self, a: AnchorUserProfile, b: AnchorUserProfile) -> AnchorMatchDimension:
        risks = []
        mode_a = a.conflict.default_mode
        mode_b = b.conflict.default_mode

        # 독성 조합 체크
        toxic_pairs = [
            ("escalation", "escalation"),
            ("escalation", "avoidance"),
            ("avoidance", "escalation"),
        ]
        if (mode_a, mode_b) in toxic_pairs:
            risks.append("갈등 상황에서 상호 악순환 패턴이 발생할 수 있습니다")
            return AnchorMatchDimension(
                dimension="conflict_style_mesh",
                compatibility="low",
                risk_flags=risks,
                narrative="갈등 대처 방식이 상충하여 갈등이 확대될 위험이 있습니다.",
            )

        # 보완적 조합
        good_pairs = [
            ("direct_engagement", "diplomatic_approach"),
            ("diplomatic_approach", "direct_engagement"),
            ("diplomatic_approach", "diplomatic_approach"),
        ]
        if (mode_a, mode_b) in good_pairs:
            return AnchorMatchDimension(
                dimension="conflict_style_mesh",
                compatibility="high",
                risk_flags=[],
                narrative="갈등 대처 방식이 상호 보완적입니다.",
            )

        return AnchorMatchDimension(
            dimension="conflict_style_mesh",
            compatibility="moderate",
            risk_flags=risks,
            narrative="갈등 대처 방식에 약간의 차이가 있으나 조율이 가능합니다.",
        )

    def _match_emotional(self, a: AnchorUserProfile, b: AnchorUserProfile) -> AnchorMatchDimension:
        risks = []
        style_a = a.emotional_availability.response_style
        style_b = b.emotional_availability.response_style

        # 한쪽만 주는 관계 감지
        style_rank = {"dismissive": 0, "acknowledging": 1, "supportive": 2, "empathic_exploration": 3}
        gap = abs(style_rank.get(style_a, 1) - style_rank.get(style_b, 1))

        if gap >= 3:
            risks.append("정서적 반응 수준에 큰 차이가 있어 한쪽이 불만족을 느낄 수 있습니다")
            compat = "low"
        elif gap >= 2:
            compat = "moderate"
        else:
            compat = "high"

        return AnchorMatchDimension(
            dimension="emotional_availability_balance",
            compatibility=compat,
            risk_flags=risks,
            narrative=f"정서적 가용성의 균형이 {'잘 맞습니다' if compat == 'high' else '조율이 필요합니다' if compat == 'moderate' else '상당한 차이가 있습니다'}.",
        )

    def _match_growth(self, a: AnchorUserProfile, b: AnchorUserProfile) -> AnchorMatchDimension:
        risks = []
        orient_a = a.growth.orientation
        orient_b = b.growth.orientation

        growth_rank = {"externally_driven": 0, "stability_oriented": 1, "reflective_growth": 2, "active_growth": 3}
        gap = abs(growth_rank.get(orient_a, 1) - growth_rank.get(orient_b, 1))

        if gap >= 3:
            risks.append("성장 속도와 방향의 차이가 커 한쪽은 답답함, 한쪽은 압박을 느낄 수 있습니다")
            compat = "low"
        elif gap >= 2:
            compat = "moderate"
        else:
            compat = "high"

        return AnchorMatchDimension(
            dimension="growth_pace_alignment",
            compatibility=compat,
            risk_flags=risks,
            narrative=f"성장 지향성이 {'호환됩니다' if compat == 'high' else '일부 조율이 필요합니다' if compat == 'moderate' else '상당한 차이가 있습니다'}.",
        )

    def _overall_narrative(self, overall: str, risks: list[str]) -> str:
        base = {
            "high": "관계 역학 측면에서 높은 호환성을 보입니다.",
            "moderate": "관계 역학 측면에서 적절한 호환성을 보이며, 일부 영역에서 의식적 노력이 도움이 됩니다.",
            "low": "관계 역학 측면에서 주의가 필요한 패턴이 감지되었습니다.",
        }
        return base.get(overall, "")
