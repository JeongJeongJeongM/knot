"""
EXODIA config.py — 모든 상수/가중치/임계값.
Runtime immutable. 매직 넘버 금지. 모든 수치는 이 파일에서만 관리.

각 상수 옆에 출처 주석 기재.
"""
from typing import Final

# ═══════════════════════════════════════════════════════════════
# [PART 10] 결정론 상수 (E-01 ~ E-12)
# ═══════════════════════════════════════════════════════════════

EPSILON: Final[float] = 1e-12                    # PART 10, E-02 — log(0) 방지
LSM_EPSILON: Final[float] = 1e-6                  # v4.0 NEW — LSM division safety
JSON_ROUND_DIGITS: Final[int] = 4                # PART 10, E-02 — JSON 소수점 4자리
MAX_TURNS_PER_SESSION: Final[int] = 1000          # PART 10, E-04 — 세션 최대 턴 수
FLOAT_DTYPE = float                               # PART 10, E-02 — Python float64
STD_DDOF: Final[int] = 0                          # PART 11, F-08 — population std (ddof=0)
NORMALIZE_EPSILON: Final[float] = 1e-12          # PART 11, F-09 — normalize zero division

# ═══════════════════════════════════════════════════════════════
# [PART 10, E-05] 화자 필터링
# ═══════════════════════════════════════════════════════════════

VALID_SPEAKERS: Final[frozenset] = frozenset({'user', 'partner'})  # PART 10, E-05

# ═══════════════════════════════════════════════════════════════
# [PART 10, E-10] LLM 결정론
# ═══════════════════════════════════════════════════════════════

LLM_TEMPERATURE: Final[float] = 0.0              # PART 10, E-10
LLM_TOP_P: Final[float] = 1.0                    # PART 10, E-10
LLM_MAX_TOKENS: Final[int] = 500                 # PART 6, §4.2.2

# ═══════════════════════════════════════════════════════════════
# [Appendix F + PART 11, F-01] 86개 라벨
# ═══════════════════════════════════════════════════════════════

# L1 검증용 (UNKNOWN 포함): 86개 — PART 11, F-01.1
ALLOWED_LABEL_ID_SET_FULL: Final[frozenset] = frozenset({
    0,                                                          # UNKNOWN
    100, 101, 102, 103, 104, 105, 106, 107, 108,               # A: Meta (9)
    120, 121, 122, 123, 124, 125, 126, 127, 128,               # B: Greeting (9)
    140, 141, 142, 143, 144, 145, 146, 147,                    # C: Information (8)
    160, 161, 162, 163, 164, 165, 166, 167, 168, 169,          # D: Request (10)
    180, 181, 182, 183, 184, 185,                              # E: Suggestion (6)
    200, 201, 202, 203, 204, 205, 206, 207,                    # F: Agreement (8)
    220, 221, 222, 223, 224, 225, 226, 227,                    # G: Emotion (8)
    240, 241, 242, 243, 244, 245, 246,                         # H: Repair (7)
    260, 261, 262, 263, 264, 265, 266, 267, 268, 269,          # I: Power (10)
    300, 301, 302, 303, 304, 305, 306, 307, 308, 309,          # K: Relationship (10)
})
# PART 11, F-01.1: 86개 라벨 검증 — len(ALLOWED_LABEL_ID_SET_FULL) == 86

# L2 전이행렬용 (UNKNOWN 제외): 85개 — PART 11, F-01.1
ALLOWED_LABEL_ID_SET_MATRIX: Final[frozenset] = ALLOWED_LABEL_ID_SET_FULL - {0}
# PART 11, F-01.1: 85개 라벨 검증 — len(ALLOWED_LABEL_ID_SET_MATRIX) == 85

# K는 전이행렬 차원 — PART 11, F-01
K: Final[int] = len(ALLOWED_LABEL_ID_SET_MATRIX)  # = 85

# 전이행렬 인덱싱용 정렬 리스트 — PART 11, F-01.2 + T-06
ALLOWED_LABEL_IDS_MATRIX: Final[tuple] = tuple(sorted(ALLOWED_LABEL_ID_SET_MATRIX))
LABEL_TO_INDEX: Final[dict] = {lid: idx for idx, lid in enumerate(ALLOWED_LABEL_IDS_MATRIX)}
INDEX_TO_LABEL: Final[dict] = {idx: lid for idx, lid in enumerate(ALLOWED_LABEL_IDS_MATRIX)}
# PART 11, F-01.2: 85개 인덱스 검증 — len(LABEL_TO_INDEX) == 85

# 라벨 ID → 이름 매핑 — Appendix F
LABEL_ID_TO_NAME: Final[dict] = {
    0: "UNKNOWN",
    100: "META_CLARIFY", 101: "META_REPHRASE", 102: "META_SUMMARY",
    103: "META_DETAIL", 104: "META_EXAMPLE", 105: "META_CONSTRAINT_ADD",
    106: "META_CONSTRAINT_REMOVE", 107: "META_TOPIC_CHANGE", 108: "META_TOPIC_RETURN",
    120: "GREET_OPEN", 121: "GREET_CLOSE", 122: "THANKS",
    123: "THANKS_RESPONSE", 124: "APOLOGY_SOCIAL", 125: "APOLOGY_RESPONSE",
    126: "COMPLIMENT", 127: "PRAISE", 128: "WELL_WISH",
    140: "QUESTION_FACT", 141: "QUESTION_HOW", 142: "QUESTION_WHY",
    143: "QUESTION_WHICH", 144: "CONFIRM_YN", 145: "CHECK_UNDERSTANDING",
    146: "ELICIT_OPINION", 147: "ASK_RECOMMENDATION",
    160: "REQUEST_ACTION", 161: "REQUEST_INFO", 162: "REQUEST_PERMISSION",
    163: "REQUEST_WAIT", 164: "REQUEST_REPEAT", 165: "REQUEST_CONFIRM",
    166: "REQUEST_HELP", 167: "REQUEST_STOP", 168: "REQUEST_CHANGE",
    169: "REQUEST_SCHEDULE",
    180: "SUGGESTION", 181: "ALTERNATIVE", 182: "RISK_POINT",
    183: "MITIGATION", 184: "ASSUMPTION_DECLARE", 185: "CONSTRAINT_DECLARE",
    200: "AGREE", 201: "DISAGREE", 202: "PARTIAL_AGREE",
    203: "ACKNOWLEDGE", 204: "REJECT_PROPOSAL", 205: "COMMIT",
    206: "DEFER", 207: "CONDITIONAL_AGREE",
    220: "EXPRESS_POSITIVE", 221: "EXPRESS_NEGATIVE", 222: "EXPRESS_HOSTILE",
    223: "EXPRESS_CONCERN", 224: "COMPLAIN", 225: "EXPRESS_DISTRESS",
    226: "LAUGHTER_MARKER", 227: "SWEAR_PROFANITY",
    240: "SELF_REPAIR", 241: "OTHER_REPAIR", 242: "CLARIFICATION_OFFER",
    243: "MISUNDERSTANDING_FLAG", 244: "CONTEXT_CORRECTION", 245: "RETRACTION",
    246: "ELABORATION",
    260: "DIRECTIVE_STRONG", 261: "DIRECTIVE_SOFT", 262: "PERMISSION_GRANT",
    263: "BOUNDARY_SET", 264: "CONCESSION", 265: "REFUSAL",
    266: "CHALLENGE", 267: "DEFLECTION", 268: "COMPLIANCE_SIGNAL",
    269: "ESCALATION",
    300: "INTEREST_SIGNAL", 301: "DISINTEREST_SIGNAL", 302: "SMALL_TALK",
    303: "SHARE_PERSONAL", 304: "EMPATHY", 305: "FEEDBACK_POSITIVE",
    306: "FEEDBACK_NEGATIVE", 307: "TASK_ASSIGN", 308: "STATUS_UPDATE",
    309: "AVAILABILITY_CHECK",
}
LABEL_NAME_TO_ID: Final[dict] = {v: k for k, v in LABEL_ID_TO_NAME.items()}

# 카테고리별 그룹핑 — Appendix F
LABEL_CATEGORIES: Final[dict] = {
    "A": list(range(100, 109)),    # Meta/Conversation Management
    "B": list(range(120, 129)),    # Greeting/Social Ritual
    "C": list(range(140, 148)),    # Information Query
    "D": list(range(160, 170)),    # Request/Directive
    "E": list(range(180, 186)),    # Suggestion/Reasoning
    "F": list(range(200, 208)),    # Agreement/Disagreement
    "G": list(range(220, 228)),    # Emotion/Attitude Surface
    "H": list(range(240, 247)),    # Repair/Correction
    "I": list(range(260, 270)),    # Interaction/Power
    "K": list(range(300, 310)),    # Relationship/Work
    "UNKNOWN": [0],
}

# ═══════════════════════════════════════════════════════════════
# [L1] Secondary Label 화이트리스트 — Appendix H
# ═══════════════════════════════════════════════════════════════

SECONDARY_WHITELIST: Final[dict] = {
    160: [260, 261],    # REQUEST_ACTION → DIRECTIVE_STRONG/SOFT
    161: [260, 261],    # REQUEST_INFO → DIRECTIVE_STRONG/SOFT
    307: [260, 261],    # TASK_ASSIGN → DIRECTIVE_STRONG/SOFT
    200: [304],         # AGREE → EMPATHY
    201: [182],         # DISAGREE → RISK_POINT
    202: [181],         # PARTIAL_AGREE → ALTERNATIVE
    300: [302],         # INTEREST_SIGNAL → SMALL_TALK
    303: [304],         # SHARE_PERSONAL → EMPATHY
    140: [146],         # QUESTION_FACT → ELICIT_OPINION
    220: [304],         # EXPRESS_POSITIVE → EMPATHY
}

# ═══════════════════════════════════════════════════════════════
# [L1] 모델/프롬프트 설정 — PART 6 §4.2.2 + PART 12 P-07
# ═══════════════════════════════════════════════════════════════

L1_MODEL_ID: Final[str] = "claude-sonnet-4-5-20250929"  # PART 6 §4.2.2 — FROZEN_MODEL_ID
L1_PROMPT_HASH: Final[str | None] = None               # PART 12, P-07 — Golden Set 통과 후 고정

# ═══════════════════════════════════════════════════════════════
# [PART 12] L1 성능 보존 정책
# ═══════════════════════════════════════════════════════════════

RELEASE_GATE_MACRO_F1: Final[float] = 0.90          # PART 12, P-01
RELEASE_GATE_TOP1_ACC: Final[float] = 0.90           # PART 12, P-01 (보조)
CONFUSION_PAIR_F1_WARN: Final[float] = 0.85          # PART 12, P-01
EVIDENCE_SPAN_MAX_CHARS: Final[int] = 24             # PART 12, P-03
CONFIDENCE_06_RATIO_WARN: Final[float] = 0.20        # PART 12, P-05
CACHE_HIT_RATE_WARN: Final[float] = 0.70             # PART 12, P-02
GOLDEN_SET_INITIAL: Final[int] = 500                 # PART 12, P-01
GOLDEN_SET_TARGET: Final[int] = 2000                 # PART 12, P-01

# Confidence 버킷 — Appendix H + PART 6 §4.2
ALLOWED_CONFIDENCE_BUCKETS: Final[tuple] = (1.0, 0.8, 0.6)
CONFIDENCE_UNKNOWN_THRESHOLD: Final[float] = 0.5     # < 0.5 → UNKNOWN 강제

# ═══════════════════════════════════════════════════════════════
# [PART 9] L2 Transition 패치 상수
# ═══════════════════════════════════════════════════════════════

SMOOTHING_ALPHA: Final[float] = 0.1                  # PART 9, T-03 — 라플라스 스무딩
MIN_EFFECTIVE_TRANSITIONS: Final[int] = 9             # PART 9, T-04 — 최소 유효 전이
CONFIDENCE_FILTER_THRESHOLD: Final[float] = 0.6       # PART 9, T-02 — confidence 필터

# [PART 9, T-08] Volatility 시리즈 세트
VOLATILITY_SERIES_SET: Final[tuple] = (
    'hostile_rate_short',
    'hostile_rate_long',
    'distress_rate_short',
    'distress_rate_long',
)  # PART 9, T-08

# [PART 9, T-10 + PART 11, F-02] Rolling Window
SHORT_WINDOW: Final[int] = 5                          # PART 9, T-10
LONG_WINDOW_MIN: Final[int] = 5                       # PART 11, F-02

# ═══════════════════════════════════════════════════════════════
# [PART 4] L3 강도 축 가중치 (Intensity Axes A1~A6)
# ═══════════════════════════════════════════════════════════════

INTENSITY_WEIGHTS: Final[dict] = {
    # A1: Engagement — PART 4, §2.3
    "A1": {
        "interest_rate": 0.35,
        "sharing_rate": 0.30,
        "turn_count_norm": 0.20,     # min-max: min=10, max=200
        "one_minus_self_loop": 0.15,
    },
    # A2: Receptivity — PART 4, §2.3
    "A2": {
        "empathy_rate": 0.40,
        "feedback_pos_rate": 0.30,
        "one_minus_disinterest_rate": 0.30,
    },
    # A3: Assertiveness — PART 4, §2.3
    "A3": {
        "task_assign_rate": 0.30,
        "feedback_neg_rate": 0.25,
        "boundary_rate": 0.25,
        "one_minus_availability_rate": 0.20,
    },
    # A4: Emotional Expression — PART 4, §2.3
    "A4": {
        "hostile_rate": 0.25,
        "distress_rate": 0.25,
        "sharing_rate": 0.25,
        "one_minus_status_update_rate": 0.25,
    },
    # A5: Collaboration — PART 4, §2.3
    "A5": {
        "feedback_pos_rate": 0.30,
        "status_update_rate": 0.25,
        "empathy_rate": 0.25,
        "availability_rate": 0.20,
    },
    # A6: Stability — PART 4, §2.3 + T-04 엔트로피 보강
    "A6": {
        "one_minus_volatility": 0.40,
        "self_loop_all": 0.30,
        "one_minus_change_point_norm": 0.30,  # min-max: min=0, max=10
    },
}

# A6 엔트로피 가중치 — PART 9, T-04
A6_ENTROPY_WEIGHT: Final[float] = 0.5  # PART 9, T-04

# A1 turn_count 정규화 범위
A1_TURN_COUNT_MIN: Final[int] = 10     # PART 4, §2.3
A1_TURN_COUNT_MAX: Final[int] = 200    # PART 4, §2.3

# A6 change_point_count 정규화 범위
A6_CHANGE_POINT_MIN: Final[int] = 0    # PART 4, §2.3
A6_CHANGE_POINT_MAX: Final[int] = 10   # PART 4, §2.3

# ═══════════════════════════════════════════════════════════════
# [PART 4] L3 구조 축 가중치 (Structural Axes A7~A11)
# ═══════════════════════════════════════════════════════════════

STRUCTURAL_WEIGHTS: Final[dict] = {
    # A7: Interaction Orientation — PART 4, §2.4
    "A7": {
        "styles": ["initiator", "responder", "balanced"],
        "threshold": 0.1,           # diff threshold
        "balanced_scale": 5,        # balanced mix 스케일링 상수
        "equal_weight": 0.5,        # initiative/response 동일 가중치
    },
    # A8: Conflict Regulation — PART 4, §2.4
    "A8": {
        "confrontational": {"hostile_rate": 0.6, "feedback_neg_rate": 0.4},
        "boundary": {"boundary_rate": 0.5, "feedback_neg_rate": 0.3, "one_minus_hostile_rate": 0.2},
        "avoidant": {"disinterest_rate": 0.5, "one_minus_hostile_rate": 0.3, "one_minus_boundary_rate": 0.2},
        "repair": {"empathy_rate": 0.4, "sharing_rate": 0.3, "one_minus_hostile_rate": 0.3},
    },
    # A9: Emotional Processing — PART 4, §2.4
    "A9": {
        "expressive": {"distress_rate": 0.4, "sharing_rate": 0.4, "one_minus_task_assign_rate": 0.2},
        "analytical": {"feedback_neg_rate": 0.3, "task_assign_rate": 0.3, "one_minus_distress_rate": 0.4},
        "suppressive": {"one_minus_distress_rate": 0.3, "one_minus_hostile_rate": 0.3, "one_minus_sharing_rate": 0.4},
        "externalized": {"hostile_rate": 0.5, "one_minus_sharing_rate": 0.3, "disinterest_rate": 0.2},
    },
    # A10: Intimacy Gradient — PART 4, §2.4 (threshold-based)
    "A10": {
        "styles": ["slow_burn", "fast_opener", "surface_locked", "depth_seeker"],
        "gradient_threshold": 0.05,          # sharing gradient 변화 감지 임계치
        "slow_burn_early_ceiling": 0.2,      # slow_burn 초기 공유율 상한
        "fast_opener_early_threshold": 0.3,  # fast_opener 초기 공유율 하한
        "surface_locked_late_ceiling": 0.15, # surface_locked 후기 공유율 상한
        "default_score": 0.5,                # 전부 0일 때 기본 점수
    },
    # A11: Reciprocity Pattern — PART 4, §2.4
    "A11": {
        "giver_threshold": 0.55,
        "taker_threshold": 0.45,
        "balanced_scale": 3,         # balanced mix 스케일링 상수
    },
}

# ═══════════════════════════════════════════════════════════════
# [PART 4] L4 PCR 기대치 테이블 — PART 4, §3.2
# ═══════════════════════════════════════════════════════════════

PCR_EXPECTATIONS: Final[dict] = {
    #                    A1    A2    A3    A4    A5    A6
    "P.CASUAL":     {"A1": 0.50, "A2": 0.60, "A3": 0.30, "A4": 0.40, "A5": 0.40, "A6": 0.70},
    "P.TASK":       {"A1": 0.70, "A2": 0.50, "A3": 0.60, "A4": 0.20, "A5": 0.70, "A6": 0.80},
    "P.CONFLICT":   {"A1": 0.60, "A2": 0.40, "A3": 0.70, "A4": 0.60, "A5": 0.50, "A6": 0.50},
    "P.EMOTIONAL":  {"A1": 0.70, "A2": 0.80, "A3": 0.20, "A4": 0.80, "A5": 0.60, "A6": 0.60},
    "P.DECISION":   {"A1": 0.80, "A2": 0.50, "A3": 0.70, "A4": 0.30, "A5": 0.60, "A6": 0.70},
    "P.EXPLORE":    {"A1": 0.70, "A2": 0.60, "A3": 0.50, "A4": 0.30, "A5": 0.50, "A6": 0.60},
}

# ═══════════════════════════════════════════════════════════════
# [PART 4] L5 충돌 매트릭스 — PART 4, §6
# ═══════════════════════════════════════════════════════════════

CONFLICT_MATRIX: Final[dict] = {
    # A7: Interaction Orientation — PART 4, §6.1
    "A7": {
        ("initiator", "initiator"): 0.4,
        ("initiator", "responder"): 0.1,
        ("initiator", "balanced"): 0.2,
        ("responder", "initiator"): 0.1,
        ("responder", "responder"): 0.5,
        ("responder", "balanced"): 0.3,
        ("balanced", "initiator"): 0.2,
        ("balanced", "responder"): 0.3,
        ("balanced", "balanced"): 0.2,
    },
    # A8: Conflict Regulation — PART 4, §4.3.2 + §6.2
    "A8": {
        ("confrontational", "confrontational"): 0.3,
        ("confrontational", "boundary"): 0.4,
        ("confrontational", "avoidant"): 0.7,
        ("confrontational", "repair"): 0.2,
        ("boundary", "confrontational"): 0.4,
        ("boundary", "boundary"): 0.1,
        ("boundary", "avoidant"): 0.5,
        ("boundary", "repair"): 0.1,
        ("avoidant", "confrontational"): 0.7,
        ("avoidant", "boundary"): 0.5,
        ("avoidant", "avoidant"): 0.4,
        ("avoidant", "repair"): 0.3,
        ("repair", "confrontational"): 0.2,
        ("repair", "boundary"): 0.1,
        ("repair", "avoidant"): 0.3,
        ("repair", "repair"): 0.1,
    },
    # A9: Emotional Processing — PART 4, §6.3
    "A9": {
        ("expressive", "expressive"): 0.2,
        ("expressive", "analytical"): 0.5,
        ("expressive", "suppressive"): 0.6,
        ("expressive", "externalized"): 0.4,
        ("analytical", "expressive"): 0.5,
        ("analytical", "analytical"): 0.1,
        ("analytical", "suppressive"): 0.3,
        ("analytical", "externalized"): 0.5,
        ("suppressive", "expressive"): 0.6,
        ("suppressive", "analytical"): 0.3,
        ("suppressive", "suppressive"): 0.3,
        ("suppressive", "externalized"): 0.5,
        ("externalized", "expressive"): 0.4,
        ("externalized", "analytical"): 0.5,
        ("externalized", "suppressive"): 0.5,
        ("externalized", "externalized"): 0.7,
    },
    # A10: Intimacy Gradient — PART 4, §6.4
    "A10": {
        ("slow_burn", "slow_burn"): 0.1,
        ("slow_burn", "fast_opener"): 0.4,
        ("slow_burn", "surface_locked"): 0.5,
        ("slow_burn", "depth_seeker"): 0.3,
        ("fast_opener", "slow_burn"): 0.4,
        ("fast_opener", "fast_opener"): 0.2,
        ("fast_opener", "surface_locked"): 0.7,
        ("fast_opener", "depth_seeker"): 0.1,
        ("surface_locked", "slow_burn"): 0.5,
        ("surface_locked", "fast_opener"): 0.7,
        ("surface_locked", "surface_locked"): 0.3,
        ("surface_locked", "depth_seeker"): 0.6,
        ("depth_seeker", "slow_burn"): 0.3,
        ("depth_seeker", "fast_opener"): 0.1,
        ("depth_seeker", "surface_locked"): 0.6,
        ("depth_seeker", "depth_seeker"): 0.2,
    },
    # A11: Reciprocity Pattern — PART 4, §6.5
    "A11": {
        ("giver", "giver"): 0.2,
        ("giver", "taker"): 0.5,
        ("giver", "balanced"): 0.1,
        ("taker", "giver"): 0.5,
        ("taker", "taker"): 0.7,
        ("taker", "balanced"): 0.4,
        ("balanced", "giver"): 0.1,
        ("balanced", "taker"): 0.4,
        ("balanced", "balanced"): 0.25,
    },
}

# v4.0: L6 3-way friction weights — Appendix A.7
L6_ALPHA: Final[float] = 1 / 3                        # intensity friction weight
L6_BETA: Final[float] = 1 / 3                         # structural friction weight
L6_GAMMA: Final[float] = 1 / 3                        # LSM friction weight (v4.0 NEW)
FRICTION_SIGNIFICANT: Final[float] = 0.05             # Appendix A.7

# Legacy aliases (v3.2 compat)
FRICTION_ALPHA: Final[float] = L6_ALPHA
FRICTION_BETA: Final[float] = L6_BETA

# ═══════════════════════════════════════════════════════════════
# [PART 5 + PART 7] Integrity Layer
# ═══════════════════════════════════════════════════════════════

# Trust Level 임계치 — PART 5, §4.2
TRUST_THRESHOLDS: Final[dict] = {
    "TRUSTED": (0.80, 1.00),
    "CAUTIOUS": (0.50, 0.79),
    "SUSPICIOUS": (0.20, 0.49),
    "UNTRUSTED": (0.00, 0.19),
}

# Stage 1 가중치 — PART 5, §2.3
STAGE1_WEIGHTS: Final[dict] = {
    "IF01_chars_per_second": 0.30,
    "IF02_paste_event": 0.25,
    "IF03_backspace_ratio": 0.15,
    "IF04_paragraph_structure": 0.10,
    "IF05_edit_count": 0.10,
    "IF06_input_rhythm_variance": 0.10,
}

# Stage 2 가중치 — PART 5, §3.3
STAGE2_WEIGHTS: Final[dict] = {
    "CR01": 0.30,
    "CR02": 0.25,
    "CR03": 0.20,
    "CR04": 0.15,
    "CR05": 0.10,
}

# Trust Score 합산 가중치 — PART 5, §4.1
STAGE1_TRUST_WEIGHT: Final[float] = 0.45              # PART 5, §4.1
STAGE2_TRUST_WEIGHT: Final[float] = 0.55              # PART 5, §4.1

# 최소 턴 수 — PART 6, §4.4
INTEGRITY_MIN_TURNS: Final[int] = 10                   # < 10턴 → UNKNOWN

# PART 7, PATCH-05: Stage2-only 신뢰도 상한
STAGE2_ONLY_MAX_TRUST_LEVEL: Final[str] = "CAUTIOUS"  # PART 7, PATCH-05
STAGE2_ONLY_MAX_TRUST_SCORE: Final[float] = 0.79      # PART 7, PATCH-05

# PART 7, PATCH-02: CR04 톤 전환 기대치
CR04_EXPECTED_TRANSITION_RATE: Final[float] = 0.40     # PART 7, PATCH-02

# ═══════════════════════════════════════════════════════════════
# [PART 8] L3.5 Consistency Audit
# ═══════════════════════════════════════════════════════════════

# C1 PVI — PART 8, §3.4 + Appendix F
C1_INTENSITY_WEIGHT: Final[float] = 0.6               # PART 8, Appendix F
C1_STRUCTURAL_WEIGHT: Final[float] = 0.4              # PART 8, Appendix F
C1_NORMALIZATION_CEILING: Final[float] = 0.35          # PART 8, Appendix F

# C2 SOAI — PART 8, §3.5 + Appendix F
C2_COMPARISON_PAIRS: Final[list] = [
    ('empathy_rate', 'positive'),
    ('feedback_pos_rate', 'positive'),
    ('feedback_neg_rate', 'negative'),
    ('hostile_rate', 'negative'),
]  # PART 8, Appendix F
C2_NORMALIZATION_CEILING: Final[float] = 0.3           # PART 8, Appendix F

# C3 PAG — PART 8, §3.6 + Appendix F
C3_MIN_VALUE_DECLARATIONS: Final[int] = 3              # PART 8, Appendix F
C3_NORMALIZATION_CEILING: Final[float] = 0.25          # PART 8, Appendix F

# C4 ET — PART 8, §3.7 + Appendix F
C4_WITHIN_WEIGHT: Final[float] = 0.5                  # PART 8, Appendix F
C4_CROSS_WEIGHT: Final[float] = 0.5                   # PART 8, Appendix F
C4_WITHIN_CEILING: Final[float] = 0.2                 # PART 8, Appendix F
C4_CROSS_CEILING: Final[float] = 0.15                 # PART 8, Appendix F

# C3 VALUE_TO_BEHAVIOR_MAP — PART 8, §3.6
VALUE_TO_BEHAVIOR_MAP: Final[dict] = {
    'empathy_values': {
        'declaration_labels': [304],
        'expected_behavior': [304, 305, 303],
    },
    'fairness_values': {
        'declaration_labels': [200, 202],
        'expected_behavior': [200, 202, 304],
    },
    'accountability_values': {
        'declaration_labels': [240, 241],
        'expected_behavior': [240, 241, 242],
    },
    'respect_values': {
        'declaration_labels': [309, 305],
        'expected_behavior': [309, 305, 304],
    },
}

# 리스크 가중치 — PART 8, §4.1
CONSISTENCY_WEIGHTS: Final[dict] = {
    'C1_pvi': 0.20,
    'C2_soai': 0.35,
    'C3_pag': 0.25,
    'C4_et': 0.20,
}  # PART 8, §4.1

# 리스크 등급 — PART 8, §4.2
RISK_LEVELS: Final[dict] = {
    'LOW': (0.00, 0.30),
    'MED': (0.31, 0.60),
    'HIGH': (0.61, 1.00),
}  # PART 8, §4.2

# 최소 세션 수 — PART 8, §3.2
MIN_SESSIONS_FOR_L35: Final[int] = 3                   # PART 8, §3.2
MIN_SESSIONS_FOR_HIGH: Final[int] = 10                 # PART 8, §3.2

# 안정성 보너스 상한 — PART 8, §6.2
STABILITY_BONUS_CAP: Final[float] = 0.05               # PART 8, §6.2

# L3 축 confidence 임계치 — PART 4, §2.6
AXIS_CONFIDENCE_THRESHOLD: Final[float] = 0.5          # PART 4, §2.6
AXIS_CONFIDENCE_TURN_THRESHOLD: Final[int] = 30        # PART 4, §2.6

# L3 Level 구간 — PART 4, §2.3
INTENSITY_LEVEL_BOUNDARIES: Final[dict] = {
    "low": (0.00, 0.33),
    "medium": (0.34, 0.66),
    "high": (0.67, 1.00),
}

# ═══════════════════════════════════════════════════════════════
# [PART 6, §4.2.3] L1 재시도 / Circuit Breaker
# ═══════════════════════════════════════════════════════════════

L1_RETRY_429_MAX: Final[int] = 5
L1_RETRY_500_MAX: Final[int] = 3
L1_RETRY_TIMEOUT_MAX: Final[int] = 2
L1_TIMEOUT_SECONDS: Final[int] = 30

CIRCUIT_BREAKER: Final[dict] = {
    'failure_threshold': 0.5,
    'window_seconds': 300,
    'cooldown_seconds': 30,
    'min_requests': 10,
}  # PART 6, §4.2.4

# ═══════════════════════════════════════════════════════════════
# [v4.0] LSM Engine
# ═══════════════════════════════════════════════════════════════

LSM_CATEGORIES: Final[tuple] = (
    "pronouns", "articles", "prepositions", "auxiliary_verbs",
    "negations", "conjunctions", "quantifiers", "interjections", "formality",
)
LSM_CATEGORY_COUNT: Final[int] = 9

# ═══════════════════════════════════════════════════════════════
# [v4.0] L7 Gap Analysis (PROVISIONAL — CALIBRATION TARGET)
# ═══════════════════════════════════════════════════════════════

L7_THRESHOLDS: Final[dict] = {
    "normal": 0.25, "elevated": 0.45, "high": 0.65,
}

L7_RISK_PATTERNS: Final[dict] = {
    "conflict_expression_shift": {"A4_bias": 0.3, "A8_cold": ["repair", "boundary"], "A8_real": "confrontational"},
    "closeness_gradient_nonlinearity": {"A10_cold": "slow_burn", "A10_real": "fast_opener"},
    "empathy_context_dependent": {"A2_bias": -0.35},
    "reciprocity_pattern_shift": {"A11_cold": ["balanced", "giver"], "A11_real": "taker", "A3_bias": 0.25},
}

L7_INAUTHENTICITY_THRESHOLDS: Final[dict] = {
    "total_gap": 0.65, "conf_asymmetry": 0.3, "style_shifts_min": 3,
    "formality_gap": 0.5, "stability_gap": 0.4, "multi_axis_gap": 0.3, "multi_axis_min": 4,
}

L7_INAUTHENTICITY_LEVELS: Final[dict] = {
    "normal": (0, 1), "noteworthy": (2, 3),
    "significant": (4, 5), "extreme": (6, 6),
}

# ═══════════════════════════════════════════════════════════════
# Engine metadata
# ═══════════════════════════════════════════════════════════════

ENGINE_VERSION: Final[str] = "5.0.0"
SPEC_VERSION: Final[str] = "5.0.0"

# ═══════════════════════════════════════════════════════════════
# [PART 11, F-05] ENGINE_ERROR 코드
# ═══════════════════════════════════════════════════════════════

# ═══════════════════════════════════════════════════════════════
# [PART 10, E-06] Config 무결성 해시
# ═══════════════════════════════════════════════════════════════

def _compute_config_hash() -> str:
    """config 상수 무결성 해시. 테스트에서 호출. — PART 10 E-06"""
    import hashlib, json
    snapshot = json.dumps({
        "L1_MODEL_ID": L1_MODEL_ID,
        "SMOOTHING_ALPHA": SMOOTHING_ALPHA,
        "K": K,
        "EPSILON": EPSILON,
        "LLM_TEMPERATURE": LLM_TEMPERATURE,
    }, sort_keys=True)
    return hashlib.sha256(snapshot.encode()).hexdigest()

CONFIG_HASH: Final[str] = _compute_config_hash()

# ═══════════════════════════════════════════════════════════════
# [PART 11, F-05] ENGINE_ERROR 코드
# ═══════════════════════════════════════════════════════════════

ENGINE_ERROR_CODES: Final[list] = [
    'INVARIANT_VIOLATION',    # E-07 assert 실패
    'INVALID_INPUT',          # 입력 데이터 검증 실패
    'L1_TIMEOUT',             # L1 LLM 호출 타임아웃
    'L1_INVALID_RESPONSE',    # L1 LLM 응답 파싱 실패
    'INSUFFICIENT_TURNS',     # 유효 턴 < 최소 요구
    'COMPUTATION_ERROR',      # 내부 계산 오류
]  # PART 11, F-05
