"""
ANCHOR schemas.py — 데이터 모델 정의.
모든 출력 타입은 이 파일에서 정의한다.

⚠️ 법적 안전 원칙:
- 애착 유형 라벨링 금지 ("불안형" → "확인 요구 증가 패턴")
- 점수화 금지 ("정서 지능: 72점" → "공감적 탐색 반응 패턴")
- 모든 출력은 행동 기술(behavioral description)만 허용
"""
from dataclasses import dataclass, field
from typing import Optional


# ═══════════════════════════════════════════════════════════════
# 입력 모델
# ═══════════════════════════════════════════════════════════════

@dataclass
class AnchorTurn:
    """분석 대상 단일 턴."""
    turn_id: str = ""
    raw_text: str = ""
    speaker: str = "user"
    timestamp: str = ""
    context_flags: list[str] = field(default_factory=list)  # conflict/emotional/casual 등


@dataclass
class AnchorSession:
    """분석 대상 세션."""
    session_id: str = ""
    turns: list[AnchorTurn] = field(default_factory=list)


# ═══════════════════════════════════════════════════════════════
# R1. Attachment Signal — 애착 신호
# ═══════════════════════════════════════════════════════════════

@dataclass
class AttachmentSignal:
    """R1 출력: 애착 경향성 (라벨이 아닌 행동 기술).

    ⚠️ "당신은 불안형입니다" ← 금지
       "감정적 압박 시 확인 요구가 증가하는 패턴이 관찰됩니다" ← 허용
    """
    primary_tendency: str = "leans_secure"
    stress_shift: str = "stable_under_pressure"
    narrative: str = ""                    # 행동 기술 서술
    reassurance_seeking_ratio: float = 0.0  # 확인 요구 발화 비율
    emotional_avoidance_ratio: float = 0.0  # 감정 회피 발화 비율


# ═══════════════════════════════════════════════════════════════
# R2. Conflict Navigation — 갈등 항법
# ═══════════════════════════════════════════════════════════════

@dataclass
class ConflictNavigation:
    """R2 출력: 갈등 상황 반응 패턴.

    EXODIA A3(갈등 직접성)과의 차이:
    - A3는 "얼마나 직접적인가"의 단일 축 점수
    - R2는 "어떤 전략을 쓰는가"의 패턴 분류 + 맥락별 변화
    """
    default_mode: str = "diplomatic_approach"
    under_pressure: str = "diplomatic_approach"
    recovery_speed: str = "moderate"       # fast/moderate/slow
    pattern_flexibility: str = "medium"    # rigid/medium/flexible
    narrative: str = ""


# ═══════════════════════════════════════════════════════════════
# R3. Emotional Availability — 정서적 가용성
# ═══════════════════════════════════════════════════════════════

@dataclass
class EmotionalAvailability:
    """R3 출력: 상대 감정에 대한 반응 패턴."""
    recognition: str = "moderate"          # slow/moderate/quick
    response_style: str = "supportive"     # dismissive/acknowledging/supportive/empathic_exploration
    solution_vs_space: str = "balanced"    # solution_focused/balanced/space_holding
    self_disclosure: str = "moderate"      # minimal/moderate/open
    narrative: str = ""


# ═══════════════════════════════════════════════════════════════
# R4. Growth Orientation — 성장 지향성
# ═══════════════════════════════════════════════════════════════

@dataclass
class GrowthOrientation:
    """R4 출력: 변화와 성장에 대한 태도."""
    orientation: str = "reflective_growth"
    change_tolerance: str = "moderate"     # low/moderate/high
    self_improvement_frequency: str = "periodic"  # rare/periodic/frequent
    narrative: str = ""


# ═══════════════════════════════════════════════════════════════
# 세션 프로파일 (통합 출력)
# ═══════════════════════════════════════════════════════════════

@dataclass
class AnchorMetadata:
    """파이프라인 메타데이터."""
    engine_version: str = ""
    spec_version: str = ""
    computed_at: str = ""
    input_hash: str = ""
    turn_count: int = 0


@dataclass
class AnchorSessionProfile:
    """단일 세션 ANCHOR 분석 결과."""
    session_id: str = ""
    user_id: str = ""
    attachment: AttachmentSignal = field(default_factory=AttachmentSignal)
    conflict: ConflictNavigation = field(default_factory=ConflictNavigation)
    emotional_availability: EmotionalAvailability = field(default_factory=EmotionalAvailability)
    growth: GrowthOrientation = field(default_factory=GrowthOrientation)
    metadata: AnchorMetadata = field(default_factory=AnchorMetadata)


@dataclass
class AnchorUserProfile:
    """복수 세션 집계 ANCHOR 프로파일."""
    user_id: str = ""
    attachment: AttachmentSignal = field(default_factory=AttachmentSignal)
    conflict: ConflictNavigation = field(default_factory=ConflictNavigation)
    emotional_availability: EmotionalAvailability = field(default_factory=EmotionalAvailability)
    growth: GrowthOrientation = field(default_factory=GrowthOrientation)
    session_count: int = 0
    status: str = "INSUFFICIENT"           # INSUFFICIENT/PARTIAL/PROFILED
    metadata: AnchorMetadata = field(default_factory=AnchorMetadata)


# ═══════════════════════════════════════════════════════════════
# 매칭 출력
# ═══════════════════════════════════════════════════════════════

@dataclass
class AnchorMatchDimension:
    """매칭 단일 차원 결과."""
    dimension: str = ""                    # attachment/conflict/emotional/growth
    compatibility: str = "moderate"        # low/moderate/high
    risk_flags: list[str] = field(default_factory=list)  # 위험 신호 목록
    narrative: str = ""                    # 서술형 설명


@dataclass
class AnchorMatchResult:
    """두 유저 ANCHOR 매칭 결과."""
    pair_id: str = ""
    person_a_id: str = ""
    person_b_id: str = ""
    dimensions: list[AnchorMatchDimension] = field(default_factory=list)
    overall_compatibility: str = "moderate"  # low/moderate/high
    risk_summary: str = ""                  # 위험 요소 요약 서술
    narrative: str = ""                     # 종합 서술
    metadata: AnchorMetadata = field(default_factory=AnchorMetadata)


# ═══════════════════════════════════════════════════════════════
# 에러
# ═══════════════════════════════════════════════════════════════

@dataclass
class AnchorError:
    """엔진 에러."""
    error_code: str = ""
    error_stage: str = ""
    message: str = ""
    engine_version: str = ""
