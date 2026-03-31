"""
PRISM config.py — 모든 상수/가중치/임계값.
Runtime immutable. 매직 넘버 금지.
"""
from typing import Final

# ═══════════════════════════════════════════════════════════════
# 엔진 메타
# ═══════════════════════════════════════════════════════════════

ENGINE_NAME: Final[str] = "PRISM"
ENGINE_VERSION: Final[str] = "1.0.0"
SPEC_VERSION: Final[str] = "1.0"

# ═══════════════════════════════════════════════════════════════
# P1. Topic Distribution — 주제 분류 설정
# ═══════════════════════════════════════════════════════════════

# 기본 토픽 카테고리 (확장 가능)
TOPIC_CATEGORIES: Final[tuple] = (
    "technology",
    "relationships",
    "daily_life",
    "philosophy",
    "entertainment",
    "work",
    "health",
    "finance",
    "art_culture",
    "sports",
    "food",
    "travel",
    "education",
    "politics_society",
    "nature_science",
    "humor",
    "other",
)

# 자기신고 vs 실제 괴리 판단 임계값
SELF_REPORT_DISCREPANCY_THRESHOLD: Final[float] = 0.05  # 5% 미만이면 괴리 판정
TOPIC_MIN_RATIO_SIGNIFICANT: Final[float] = 0.03         # 3% 이상이어야 유의미 토픽

# ═══════════════════════════════════════════════════════════════
# P2. Engagement Depth — 참여 깊이 레벨
# ═══════════════════════════════════════════════════════════════

DEPTH_LEVELS: Final[tuple] = (
    "surface",       # 단순 언급, 반응
    "casual",        # 가벼운 의견 교환
    "analytical",    # 분석적 논의
    "exploratory",   # 탐구적 대화
    "creative",      # 독자적 사고 생산
)

DEPTH_LEVEL_WEIGHTS: Final[dict] = {
    "surface": 0.1,
    "casual": 0.25,
    "analytical": 0.5,
    "exploratory": 0.75,
    "creative": 1.0,
}

# ═══════════════════════════════════════════════════════════════
# P3. Vocabulary Landscape — 어휘 분석 설정
# ═══════════════════════════════════════════════════════════════

# TTR (Type-Token Ratio) 분류 임계값
TTR_LOW_THRESHOLD: Final[float] = 0.3
TTR_HIGH_THRESHOLD: Final[float] = 0.6

DIVERSITY_LABELS: Final[dict] = {
    "low": (0.0, TTR_LOW_THRESHOLD),
    "moderate": (TTR_LOW_THRESHOLD, TTR_HIGH_THRESHOLD),
    "high": (TTR_HIGH_THRESHOLD, 1.0),
}

# 추상어 비율 분류
ABSTRACTION_LABELS: Final[tuple] = (
    "leans_concrete",
    "balanced",
    "leans_abstract",
)

ABSTRACTION_THRESHOLD_ABSTRACT: Final[float] = 0.6
ABSTRACTION_THRESHOLD_CONCRETE: Final[float] = 0.4

# 레지스터 범위 분류
REGISTER_LABELS: Final[tuple] = (
    "narrow",
    "moderate",
    "wide",
)

# ═══════════════════════════════════════════════════════════════
# P4. Curiosity Signature — 호기심 시그니처 설정
# ═══════════════════════════════════════════════════════════════

QUESTION_TYPES: Final[tuple] = (
    "factual",        # 사실 확인형
    "opinion",        # 의견 탐색형
    "hypothesis",     # 가설 검증형
    "meta",           # 메타 질문
)

DEPTH_VS_BREADTH_LABELS: Final[tuple] = (
    "deep_diver",     # 한 주제를 깊게 파는 유형
    "balanced",       # 균형형
    "wide_scanner",   # 넓게 옮기는 유형
)

FOLLOW_UP_LABELS: Final[tuple] = (
    "low",
    "moderate",
    "high",
)

# ═══════════════════════════════════════════════════════════════
# 매칭 가중치
# ═══════════════════════════════════════════════════════════════

MATCH_WEIGHT_TOPIC_OVERLAP: Final[float] = 0.30
MATCH_WEIGHT_DEPTH_COMPAT: Final[float] = 0.30
MATCH_WEIGHT_COMPLEMENTARY: Final[float] = 0.20
MATCH_WEIGHT_CURIOSITY_SYNC: Final[float] = 0.20

# ═══════════════════════════════════════════════════════════════
# 파이프라인 제약
# ═══════════════════════════════════════════════════════════════

MIN_TURNS_FOR_ANALYSIS: Final[int] = 5
MAX_TURNS_PER_SESSION: Final[int] = 1000
EPSILON: Final[float] = 1e-12
JSON_ROUND_DIGITS: Final[int] = 4
