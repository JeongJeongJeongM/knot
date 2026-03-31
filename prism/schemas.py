"""
PRISM schemas.py — 데이터 모델 정의.
모든 출력 타입은 이 파일에서 정의한다.

⚠️ 점수화 금지 원칙: 지적 수준 등을 수치화하지 않고, 패턴 기술만 허용.
"""
from dataclasses import dataclass, field
from typing import Optional


# ═══════════════════════════════════════════════════════════════
# 입력 모델
# ═══════════════════════════════════════════════════════════════

@dataclass
class PrismTurn:
    """분석 대상 단일 턴."""
    turn_id: str = ""
    raw_text: str = ""
    speaker: str = "user"
    timestamp: str = ""


@dataclass
class PrismSession:
    """분석 대상 세션."""
    session_id: str = ""
    turns: list[PrismTurn] = field(default_factory=list)
    self_reported_interests: list[str] = field(default_factory=list)


# ═══════════════════════════════════════════════════════════════
# P1. Topic Distribution
# ═══════════════════════════════════════════════════════════════

@dataclass
class TopicEntry:
    """단일 토픽 분석 결과."""
    category: str = ""
    ratio: float = 0.0
    depth: str = "surface"          # surface/casual/analytical/exploratory/creative
    turn_count: int = 0


@dataclass
class TopicDistribution:
    """P1 출력: 주제 분포 맵."""
    topics: dict[str, TopicEntry] = field(default_factory=dict)
    dominant_topic: str = ""
    topic_diversity: float = 0.0     # Shannon entropy 기반
    self_report_gaps: list[str] = field(default_factory=list)  # 자기신고 괴리 토픽


# ═══════════════════════════════════════════════════════════════
# P2. Engagement Depth
# ═══════════════════════════════════════════════════════════════

@dataclass
class EngagementProfile:
    """P2 출력: 주제별 참여 깊이."""
    depth_by_topic: dict[str, str] = field(default_factory=dict)  # topic → depth level
    overall_depth: str = "surface"
    depth_consistency: str = "consistent"  # consistent/variable/topic_dependent


# ═══════════════════════════════════════════════════════════════
# P3. Vocabulary Landscape
# ═══════════════════════════════════════════════════════════════

@dataclass
class VocabularyLandscape:
    """P3 출력: 어휘 지형."""
    diversity: str = "moderate"              # low/moderate/high
    dominant_domains: list[str] = field(default_factory=list)
    abstraction: str = "balanced"            # leans_concrete/balanced/leans_abstract
    register_range: str = "moderate"         # narrow/moderate/wide
    lexical_diversity_raw: float = 0.0       # TTR 원시값 (내부용)


# ═══════════════════════════════════════════════════════════════
# P4. Curiosity Signature
# ═══════════════════════════════════════════════════════════════

@dataclass
class CuriositySignature:
    """P4 출력: 호기심 시그니처."""
    question_ratio: float = 0.0
    dominant_type: str = "factual"           # factual/opinion/hypothesis/meta
    depth_vs_breadth: str = "balanced"       # deep_diver/balanced/wide_scanner
    follow_up_tendency: str = "moderate"     # low/moderate/high
    question_type_distribution: dict[str, float] = field(default_factory=dict)


# ═══════════════════════════════════════════════════════════════
# 세션 프로파일 (통합 출력)
# ═══════════════════════════════════════════════════════════════

@dataclass
class PrismMetadata:
    """파이프라인 메타데이터."""
    engine_version: str = ""
    spec_version: str = ""
    computed_at: str = ""
    input_hash: str = ""
    turn_count: int = 0


@dataclass
class PrismSessionProfile:
    """단일 세션 PRISM 분석 결과."""
    session_id: str = ""
    user_id: str = ""
    topic_distribution: TopicDistribution = field(default_factory=TopicDistribution)
    engagement: EngagementProfile = field(default_factory=EngagementProfile)
    vocabulary: VocabularyLandscape = field(default_factory=VocabularyLandscape)
    curiosity: CuriositySignature = field(default_factory=CuriositySignature)
    metadata: PrismMetadata = field(default_factory=PrismMetadata)


@dataclass
class PrismUserProfile:
    """복수 세션 집계 PRISM 프로파일."""
    user_id: str = ""
    topic_distribution: TopicDistribution = field(default_factory=TopicDistribution)
    engagement: EngagementProfile = field(default_factory=EngagementProfile)
    vocabulary: VocabularyLandscape = field(default_factory=VocabularyLandscape)
    curiosity: CuriositySignature = field(default_factory=CuriositySignature)
    session_count: int = 0
    status: str = "INSUFFICIENT"             # INSUFFICIENT/PARTIAL/PROFILED
    metadata: PrismMetadata = field(default_factory=PrismMetadata)


# ═══════════════════════════════════════════════════════════════
# 매칭 출력
# ═══════════════════════════════════════════════════════════════

@dataclass
class PrismMatchDimension:
    """매칭 단일 차원 결과."""
    dimension: str = ""                      # topic_overlap/depth_compat/complementary/curiosity_sync
    compatibility: str = "moderate"          # low/moderate/high
    narrative: str = ""                      # 서술형 설명


@dataclass
class PrismMatchResult:
    """두 유저 PRISM 매칭 결과."""
    pair_id: str = ""
    person_a_id: str = ""
    person_b_id: str = ""
    dimensions: list[PrismMatchDimension] = field(default_factory=list)
    overall_compatibility: str = "moderate"  # low/moderate/high
    narrative: str = ""                      # 종합 서술
    metadata: PrismMetadata = field(default_factory=PrismMetadata)


# ═══════════════════════════════════════════════════════════════
# 에러
# ═══════════════════════════════════════════════════════════════

@dataclass
class PrismError:
    """엔진 에러."""
    error_code: str = ""
    error_stage: str = ""
    message: str = ""
    engine_version: str = ""
