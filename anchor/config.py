"""
ANCHOR config.py — 모든 상수/가중치/임계값.
Runtime immutable. 매직 넘버 금지.
"""
from typing import Final

# ═══════════════════════════════════════════════════════════════
# 엔진 메타
# ═══════════════════════════════════════════════════════════════

ENGINE_NAME: Final[str] = "ANCHOR"
ENGINE_VERSION: Final[str] = "1.0.0"
SPEC_VERSION: Final[str] = "1.0"

# ═══════════════════════════════════════════════════════════════
# R1. Attachment Signal — 애착 신호 설정
# ═══════════════════════════════════════════════════════════════

# 경향성 라벨 (진단 라벨이 아닌 행동 기술)
ATTACHMENT_TENDENCIES: Final[tuple] = (
    "leans_secure",
    "leans_anxious",
    "leans_avoidant",
    "leans_disorganized",
)

# 스트레스 시 변화 패턴
STRESS_SHIFT_PATTERNS: Final[tuple] = (
    "stable_under_pressure",
    "mild_anxious_under_pressure",
    "withdrawal_under_pressure",
    "escalation_under_pressure",
    "inconsistent_under_pressure",
)

# 확인 요구 빈도 임계값
REASSURANCE_SEEKING_HIGH: Final[float] = 0.15   # 전체 발화 중 15% 이상
EMOTIONAL_AVOIDANCE_HIGH: Final[float] = 0.20    # 감정 주제 전환 20% 이상

# ═══════════════════════════════════════════════════════════════
# R2. Conflict Navigation — 갈등 항법 설정
# ═══════════════════════════════════════════════════════════════

CONFLICT_MODES: Final[tuple] = (
    "direct_engagement",       # 문제를 바로 꺼내서 논의
    "diplomatic_approach",     # 돌려서 접근, 상대 감정 먼저 고려
    "strategic_withdrawal",    # 일단 물러났다가 정리 후 재접근
    "avoidance",              # 주제 전환, 무시, 냉전
    "escalation",             # 감정적 확대, 과거 끌어오기
)

RECOVERY_SPEED_LABELS: Final[tuple] = (
    "fast",
    "moderate",
    "slow",
)

PATTERN_FLEXIBILITY_LABELS: Final[tuple] = (
    "rigid",
    "medium",
    "flexible",
)

# ═══════════════════════════════════════════════════════════════
# R3. Emotional Availability — 정서적 가용성 설정
# ═══════════════════════════════════════════════════════════════

RECOGNITION_SPEED_LABELS: Final[tuple] = (
    "slow",
    "moderate",
    "quick",
)

RESPONSE_STYLES: Final[tuple] = (
    "dismissive",              # 감정 무시/최소화
    "acknowledging",           # 인정하지만 깊이 안 들어감
    "supportive",              # 지지적 반응
    "empathic_exploration",    # 공감적 탐색
)

SOLUTION_VS_SPACE_LABELS: Final[tuple] = (
    "solution_focused",
    "balanced",
    "space_holding",
)

SELF_DISCLOSURE_LABELS: Final[tuple] = (
    "minimal",
    "moderate",
    "open",
)

# ═══════════════════════════════════════════════════════════════
# R4. Growth Orientation — 성장 지향성 설정
# ═══════════════════════════════════════════════════════════════

GROWTH_ORIENTATIONS: Final[tuple] = (
    "active_growth",          # 지속적 자기 개선, 새로운 시도
    "reflective_growth",      # 경험에서 배우지만 급격한 변화는 피함
    "stability_oriented",     # 안정 선호, 현재 상태 유지
    "externally_driven",      # 외부 자극에 의해서만 변화
)

CHANGE_TOLERANCE_LABELS: Final[tuple] = (
    "low",
    "moderate",
    "high",
)

IMPROVEMENT_FREQUENCY_LABELS: Final[tuple] = (
    "rare",
    "periodic",
    "frequent",
)

# ═══════════════════════════════════════════════════════════════
# 매칭 가중치
# ═══════════════════════════════════════════════════════════════

MATCH_WEIGHT_ATTACHMENT: Final[float] = 0.30
MATCH_WEIGHT_CONFLICT: Final[float] = 0.25
MATCH_WEIGHT_EMOTIONAL: Final[float] = 0.25
MATCH_WEIGHT_GROWTH: Final[float] = 0.20

# 애착 경향 호환성 매트릭스 (1.0 = 최적, 0.0 = 최악)
# 행: person_a 경향, 열: person_b 경향
# ⚠️ 이건 점수가 아닌 관계 건강성 위험도 추정치
ATTACHMENT_COMPATIBILITY: Final[dict] = {
    ("leans_secure", "leans_secure"): 0.90,
    ("leans_secure", "leans_anxious"): 0.65,
    ("leans_secure", "leans_avoidant"): 0.60,
    ("leans_secure", "leans_disorganized"): 0.40,
    ("leans_anxious", "leans_secure"): 0.65,
    ("leans_anxious", "leans_anxious"): 0.50,
    ("leans_anxious", "leans_avoidant"): 0.20,   # 전형적 독성 조합
    ("leans_anxious", "leans_disorganized"): 0.15,
    ("leans_avoidant", "leans_secure"): 0.60,
    ("leans_avoidant", "leans_anxious"): 0.20,   # 전형적 독성 조합
    ("leans_avoidant", "leans_avoidant"): 0.35,
    ("leans_avoidant", "leans_disorganized"): 0.15,
    ("leans_disorganized", "leans_secure"): 0.40,
    ("leans_disorganized", "leans_anxious"): 0.15,
    ("leans_disorganized", "leans_avoidant"): 0.15,
    ("leans_disorganized", "leans_disorganized"): 0.10,
}

# ═══════════════════════════════════════════════════════════════
# 파이프라인 제약
# ═══════════════════════════════════════════════════════════════

MIN_TURNS_FOR_ANALYSIS: Final[int] = 10   # ANCHOR는 더 많은 맥락 필요
MAX_TURNS_PER_SESSION: Final[int] = 1000
EPSILON: Final[float] = 1e-12
JSON_ROUND_DIGITS: Final[int] = 4
