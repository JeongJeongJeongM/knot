"""
EXODIA v4.0 LOCKED Constants — byte-identical literal from spec.
DO NOT reformat, reorder, or optimize. Change only via spec errata procedure.
"""

import math

# ═══════════ Engine-wide Determinism ═══════════
EPSILON = 1e-12
LSM_EPSILON = 1e-6  # v4.0 NEW — LSM division safety
NORMALIZE_EPSILON = 1e-12
STD_DDOF = 0
MAX_TURNS_PER_SESSION = 1000
VALID_SPEAKERS = {"user", "partner"}
SMOOTHING_ALPHA = 0.1
MIN_EFFECTIVE_TRANSITIONS = 9
SHORT_WINDOW = 5
LONG_WINDOW_MIN = 5
JSON_ROUND_DIGITS = 4
EVIDENCE_SPAN_MAX_CHARS = 24

# ═══════════ L2.5 Label Sets ═══════════
ALLOWED_LABEL_ID_SET_FULL = {
    0,
    100, 101, 102, 103, 104, 105, 106, 107, 108,
    120, 121, 122, 123, 124, 125, 126, 127, 128,
    140, 141, 142, 143, 144, 145, 146, 147,
    160, 161, 162, 163, 164, 165, 166, 167, 168, 169,
    180, 181, 182, 183, 184, 185,
    200, 201, 202, 203, 204, 205, 206, 207,
    220, 221, 222, 223, 224, 225, 226, 227,
    240, 241, 242, 243, 244, 245, 246,
    260, 261, 262, 263, 264, 265, 266, 267, 268, 269,
    300, 301, 302, 303, 304, 305, 306, 307, 308, 309,
}
assert len(ALLOWED_LABEL_ID_SET_FULL) == 86

ALLOWED_LABEL_ID_SET_MATRIX = ALLOWED_LABEL_ID_SET_FULL - {0}
assert len(ALLOWED_LABEL_ID_SET_MATRIX) == 85

K = len(ALLOWED_LABEL_ID_SET_MATRIX)  # = 85

ALLOWED_LABEL_IDS_MATRIX = sorted(ALLOWED_LABEL_ID_SET_MATRIX)

LABEL_TO_INDEX = {lid: idx for idx, lid in enumerate(ALLOWED_LABEL_IDS_MATRIX)}
INDEX_TO_LABEL = {idx: lid for idx, lid in enumerate(ALLOWED_LABEL_IDS_MATRIX)}
assert len(LABEL_TO_INDEX) == 85

# ═══════════ L2.5 Label ID → Name Mapping ═══════════
LABEL_ID_TO_NAME = {
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

LABEL_NAME_TO_ID = {v: k for k, v in LABEL_ID_TO_NAME.items()}

# ═══════════ L2.5 Secondary Whitelist ═══════════
SECONDARY_WHITELIST = {
    160: [260, 261],
    161: [260, 261],
    307: [260, 261],
    200: [304],
    201: [182],
    202: [181],
    300: [302],
    303: [304],
    140: [146],
    220: [304],
}

# ═══════════ L3 Rate Label Mapping ═══════════
RATE_LABEL_MAP = {
    "interest_rate": 300,
    "disinterest_rate": 301,
    "sharing_rate": 303,
    "empathy_rate": 304,
    "task_assign_rate": 307,
    "status_update_rate": 308,
}

EXTENDED_RATE_MAP = {
    "smalltalk_rate": 302,
    "feedback_pos_rate": 305,
    "feedback_neg_rate": 306,
    "availability_rate": 309,
}

DERIVED_RATE_MAP = {
    "hostile_rate": 222,
    "distress_rate": 225,
}

BOUNDARY_LABEL_IDS = [260, 204]

# ═══════════ L3 Timeseries ═══════════
VOLATILITY_SERIES_SET = [
    "hostile_rate_short",
    "hostile_rate_long",
    "distress_rate_short",
    "distress_rate_long",
]

# ═══════════ L4 Intensity Axes ═══════════
L3_WEIGHTS = {
    "A1_engagement": {
        "interest_rate": 0.35,
        "sharing_rate": 0.30,
        "norm_turn_count": 0.20,
        "1_minus_self_loop_all": 0.15,
    },
    "A2_receptivity": {
        "empathy_rate": 0.40,
        "feedback_pos_rate": 0.30,
        "1_minus_disinterest_rate": 0.30,
    },
    "A3_assertiveness": {
        "task_assign_rate": 0.30,
        "feedback_neg_rate": 0.25,
        "boundary_rate": 0.25,
        "1_minus_availability_rate": 0.20,
    },
    "A4_emotional_expression": {
        "hostile_rate": 0.25,
        "distress_rate": 0.25,
        "sharing_rate": 0.25,
        "1_minus_status_update_rate": 0.25,
    },
    "A5_collaboration": {
        "feedback_pos_rate": 0.30,
        "status_update_rate": 0.25,
        "empathy_rate": 0.25,
        "availability_rate": 0.20,
    },
    "A6_stability": {
        "1_minus_volatility": 0.40,
        "self_loop_all": 0.30,
        "1_minus_norm_change_points": 0.30,
    },
}

L3_LEVEL_THRESHOLDS = {
    "low": (0.00, 0.33),
    "medium": (0.34, 0.66),
    "high": (0.67, 1.00),
}

A6_ENTROPY_WEIGHT = 0.5

# ═══════════ L4 Structural Axes ═══════════
A7_THRESHOLD = 0.1

A8_WEIGHTS = {
    "confrontational": {"hostile_rate": 0.6, "feedback_neg_rate": 0.4},
    "boundary": {"boundary_rate": 0.5, "feedback_neg_rate": 0.3, "1_minus_hostile": 0.2},
    "avoidant": {"disinterest_rate": 0.5, "1_minus_hostile": 0.3, "1_minus_boundary": 0.2},
    "repair": {"empathy_rate": 0.4, "sharing_rate": 0.3, "1_minus_hostile": 0.3},
}

A9_WEIGHTS = {
    "expressive": {"distress_rate": 0.4, "sharing_rate": 0.4, "1_minus_task_assign": 0.2},
    "analytical": {"feedback_neg_rate": 0.3, "task_assign_rate": 0.3, "1_minus_distress": 0.4},
    "suppressive": {"1_minus_distress": 0.3, "1_minus_hostile": 0.3, "1_minus_sharing": 0.4},
    "externalized": {"hostile_rate": 0.5, "1_minus_sharing": 0.3, "disinterest_rate": 0.2},
}

A10_THRESHOLDS = {
    "slow_burn": {"gradient_min": 0.05, "early_max": 0.25},   # v5.0: 0.2→0.25
    "fast_opener": {"early_min": 0.25},                        # v5.0: 0.3→0.25
    "surface_locked": {"late_max": 0.15, "abs_gradient_max": 0.05},
    "depth_seeker": {"sharing_gradient_min": 0.05, "empathy_gradient_min": 0.05},
}

A11_THRESHOLDS = {
    "giver": {"ratio_min": 0.55},
    "taker": {"ratio_max": 0.45},
}

# ═══════════ L5 PCR Expected Values ═══════════
PCR_EXPECTATIONS = {
    "P.CASUAL": {"A1": 0.50, "A2": 0.60, "A3": 0.30, "A4": 0.40, "A5": 0.40, "A6": 0.70},
    "P.TASK": {"A1": 0.70, "A2": 0.50, "A3": 0.60, "A4": 0.20, "A5": 0.70, "A6": 0.80},
    "P.CONFLICT": {"A1": 0.60, "A2": 0.40, "A3": 0.70, "A4": 0.60, "A5": 0.50, "A6": 0.50},
    "P.EMOTIONAL": {"A1": 0.70, "A2": 0.80, "A3": 0.20, "A4": 0.80, "A5": 0.60, "A6": 0.60},
    "P.DECISION": {"A1": 0.80, "A2": 0.50, "A3": 0.70, "A4": 0.30, "A5": 0.60, "A6": 0.70},
    "P.EXPLORE": {"A1": 0.70, "A2": 0.60, "A3": 0.50, "A4": 0.30, "A5": 0.50, "A6": 0.60},
}

# ═══════════ L6 Conflict Matrices ═══════════
CONFLICT_A7 = {
    "initiator": {"initiator": 0.4, "responder": 0.1, "balanced": 0.2},
    "responder": {"initiator": 0.1, "responder": 0.5, "balanced": 0.3},
    "balanced": {"initiator": 0.2, "responder": 0.3, "balanced": 0.2},
}

CONFLICT_A8 = {
    "confrontational": {"confrontational": 0.3, "boundary": 0.4, "avoidant": 0.7, "repair": 0.2},
    "boundary": {"confrontational": 0.4, "boundary": 0.1, "avoidant": 0.5, "repair": 0.1},
    "avoidant": {"confrontational": 0.7, "boundary": 0.5, "avoidant": 0.4, "repair": 0.3},
    "repair": {"confrontational": 0.2, "boundary": 0.1, "avoidant": 0.3, "repair": 0.1},
}

CONFLICT_A9 = {
    "expressive": {"expressive": 0.2, "analytical": 0.5, "suppressive": 0.6, "externalized": 0.4},
    "analytical": {"expressive": 0.5, "analytical": 0.1, "suppressive": 0.3, "externalized": 0.5},
    "suppressive": {"expressive": 0.6, "analytical": 0.3, "suppressive": 0.3, "externalized": 0.5},
    "externalized": {"expressive": 0.4, "analytical": 0.5, "suppressive": 0.5, "externalized": 0.7},
}

CONFLICT_A10 = {
    "slow_burn": {"slow_burn": 0.1, "fast_opener": 0.4, "surface_locked": 0.5, "depth_seeker": 0.3},
    "fast_opener": {"slow_burn": 0.4, "fast_opener": 0.2, "surface_locked": 0.7, "depth_seeker": 0.1},
    "surface_locked": {"slow_burn": 0.5, "fast_opener": 0.7, "surface_locked": 0.3, "depth_seeker": 0.6},
    "depth_seeker": {"slow_burn": 0.3, "fast_opener": 0.1, "surface_locked": 0.6, "depth_seeker": 0.2},
}

CONFLICT_A11 = {
    "giver": {"giver": 0.2, "taker": 0.5, "balanced": 0.1},
    "taker": {"giver": 0.5, "taker": 0.7, "balanced": 0.4},
    "balanced": {"giver": 0.1, "taker": 0.4, "balanced": 0.25},
}

# v4.0: L6 3-way friction weights (configurable, initial 1/3 each)
L6_ALPHA = 1 / 3  # intensity friction weight
L6_BETA = 1 / 3   # structural friction weight
L6_GAMMA = 1 / 3  # LSM friction weight (v4.0 NEW)

FRICTION_SIGNIFICANT = 0.05  # v4.0: moved to named constant

# Legacy aliases (v3.2 compat — DO NOT USE in new code)
L5_ALPHA = L6_ALPHA
L5_BETA = L6_BETA

# ═══════════ Integrity Layer ═══════════
INTEGRITY_STAGE1_WEIGHTS = {
    "IF01_chars_per_second": 0.30,
    "IF02_paste_event": 0.25,
    "IF03_backspace_ratio": 0.15,
    "IF04_paragraph_structure": 0.10,
    "IF05_edit_count": 0.10,
    "IF06_input_rhythm_variance": 0.10,
}

INTEGRITY_STAGE2_WEIGHTS = {
    "CR01_reference_carry": 0.30,
    "CR02_qa_directness": 0.25,
    "CR03_latency_consistency": 0.20,
    "CR04_tone_shift_absence": 0.15,
    "CR05_formulaic_pattern": 0.10,
}

INTEGRITY_INTEGRATION = {
    "stage1_weight": 0.45,
    "stage2_weight": 0.55,
}

TRUST_LEVELS = {
    "TRUSTED": (0.80, 1.00),
    "CAUTIOUS": (0.50, 0.79),
    "SUSPICIOUS": (0.20, 0.49),
    "UNTRUSTED": (0.00, 0.19),
}

# ═══════════ Operations ═══════════
CONFIDENCE_MIN_TURNS = 30
INSUFFICIENT_THRESHOLD = 0.5
MIN_TURNS_FOR_ANALYSIS = 12
PRE_CALIBRATION_PAIRS = 100
FULL_CALIBRATION_PAIRS = 1000

# ═══════════ Risk Flags ═══════════
RISK_SEVERITY_SCORES = {"LOW": 0.10, "MED": 0.25, "HIGH": 0.45, "BLOCK": 0.90}

RISK_LEVEL_THRESHOLDS = {
    "OK": (0.00, 0.25),
    "CAUTION": (0.25, 0.50),
    "HIGH": (0.50, 0.75),
    "BLOCK": (0.75, 1.00),
}

RISK_CONFIDENCE_MIN = 0.35

# ═══════════ L3.5 Consistency Layer ═══════════
C1_INTENSITY_WEIGHT = 0.6
C1_STRUCTURAL_WEIGHT = 0.4
C1_NORMALIZATION_CEILING = 0.35

C2_COMPARISON_PAIRS = [
    ("empathy_rate", "positive"),
    ("feedback_pos_rate", "positive"),
    ("feedback_neg_rate", "negative"),
    ("hostile_rate", "negative"),
]
C2_NORMALIZATION_CEILING = 0.3

C3_MIN_VALUE_DECLARATIONS = 3
C3_NORMALIZATION_CEILING = 0.25

VALUE_TO_BEHAVIOR_MAP = {
    "empathy_values": {
        "declaration_labels": [304],
        "expected_behavior": [304, 305, 303],
    },
    "fairness_values": {
        "declaration_labels": [200, 202],
        "expected_behavior": [200, 202, 304],
    },
    "accountability_values": {
        "declaration_labels": [240, 241],
        "expected_behavior": [240, 241, 242],
    },
    "respect_values": {
        "declaration_labels": [309, 305],
        "expected_behavior": [309, 305, 304],
    },
}

C4_WITHIN_WEIGHT = 0.5
C4_CROSS_WEIGHT = 0.5
C4_WITHIN_CEILING = 0.2
C4_CROSS_CEILING = 0.15

CONSISTENCY_WEIGHTS = {
    "C1_pvi": 0.20,
    "C2_soai": 0.35,
    "C3_pag": 0.25,
    "C4_et": 0.20,
}

CONSISTENCY_RISK_LEVELS = {
    "LOW": (0.00, 0.30),
    "MED": (0.31, 0.60),
    "HIGH": (0.61, 1.00),
}

MIN_SESSIONS_FOR_L35 = 3
MIN_SESSIONS_FOR_HIGH = 10
STABILITY_BONUS_CAP = 0.05

# ═══════════ Cross-Validation (PART 14) ═══════════
MAX_STD_3 = math.sqrt(2.0 / 9.0)  # ≈ 0.4714
DIVERGENT_PATH_THRESHOLD = 0.2
AXIS_CONFIDENCE_TURN_THRESHOLD = CONFIDENCE_MIN_TURNS

CV_ADAPTIVE_WEIGHTS = {
    "paste_suspected": {"a": 0.35, "b": 0.25, "c": 0.40},
    "short_session": {"a": 0.30, "b": 0.30, "c": 0.40},
    "short_answer": {"a": 0.20, "b": 0.45, "c": 0.35},
    "long_text": {"a": 0.40, "b": 0.30, "c": 0.30},
    "default": {"a": 0.33, "b": 0.33, "c": 0.34},
}

PATH_A_WEIGHTS = {
    "A1_engagement": {"1_minus_fcr": 0.40, "utr": 0.30, "asl_norm": 0.30},
    "A2_receptivity": {"hon_norm": 0.40, "hdg_norm": 0.35, "1_minus_fcr": 0.25},
    "A3_assertiveness": {"1_minus_hdg_norm": 0.35, "int_norm": 0.35, "1_minus_mr": 0.30},
    "A4_emotional_expression": {"int_norm": 0.35, "asl_norm": 0.35, "td_norm": 0.30},
    "A5_collaboration": {"mr": 0.35, "int_norm": 0.30, "td_norm": 0.20, "oov_x5": 0.15},
    "A6_stability": {"1_minus_fvar_x3": 0.40, "1_minus_rep_x3": 0.30, "1_minus_rlt": 0.30},
}

# ═══════════ L2.5 Performance Preservation (PART 12) ═══════════
GOLDEN_SET_INITIAL = 500
GOLDEN_SET_TARGET = 2000
RELEASE_GATE_MACRO_F1 = 0.90
RELEASE_GATE_TOP1_ACC = 0.90
CONFUSION_PAIR_F1_WARN = 0.85
CACHE_HIT_RATE_WARN = 0.70
CONFIDENCE_06_RATIO_WARN = 0.20
FROZEN_MODEL_ID = "claude-sonnet-4-20250514"
FROZEN_PROMPT_HASH = None

# ═══════════ ENGINE_ERROR_CODES ═══════════
ENGINE_ERROR_CODES = [
    "INVARIANT_VIOLATION",
    "INVALID_INPUT",
    "L1_TIMEOUT",
    "L1_INVALID_RESPONSE",
    "INSUFFICIENT_TURNS",
    "COMPUTATION_ERROR",
]

# ═══════════ L2.5 Worker ═══════════
MAX_LLM_RETRIES_429 = 5
MAX_LLM_RETRIES_500 = 3
MAX_LLM_RETRIES_TIMEOUT = 2
LLM_TIMEOUT_SECONDS = 30
CIRCUIT_BREAKER = {
    "failure_threshold": 0.5,
    "window_seconds": 300,
    "cooldown_seconds": 30,
    "min_requests": 10,
}

# ═══════════ LSM Engine (v4.0 NEW) ═══════════
LSM_CATEGORIES = [
    "pronouns",        # 대명사
    "articles",        # 조사/관형사 (한국어 기능어 대체)
    "prepositions",    # 부사/후치사
    "auxiliary_verbs",  # 보조용언
    "negations",       # 부정 표현
    "conjunctions",    # 접속사
    "quantifiers",     # 수량사
    "interjections",   # 감탄사
    "formality",       # 경어/반말 비율
]
LSM_CATEGORY_COUNT = 9

# ═══════════ LSM Engine (v5.0 NEW — Korean-optimized) ═══════════
LSM_CATEGORIES_V5 = [
    "pronouns",              # 1. NP — 대명사
    "particles",             # 2. JK* — 조사 (v4.0: "articles")
    "adverbs",               # 3. MAG — 부사 (v4.0: included MAJ double-map)
    "auxiliary_verbs",       # 4. VX — 보조용언
    "negations",             # 5. pragmatics negation — 부정 표현
    "conjunctions",          # 6. MAJ — 접속사 (v4.0: conflated with adverbs)
    "quantifiers",           # 7. NR, SN — 수량사
    "interjections",         # 8. IC — 감탄사
    "formality",             # 9. L2 formality_level — 경어/반말 비율
    "sentence_endings",      # 10. [NEW] EF — 종결어미 (declarative, interrogative, imperative, exclamatory)
    "connective_endings",    # 11. [NEW] EC — 연결어미 (causal, contrastive, concessive, selective)
    "emotional_markers",     # 12. [NEW] ㅋㅋ, ㅠㅠ, emoji — 감정 마커
]
LSM_CATEGORY_COUNT_V5 = 12

# ═══════════ L7 Gap Analysis (v4.0 NEW — PROVISIONAL) ═══════════
L7_THRESHOLDS = {
    "normal": 0.25,
    "elevated": 0.45,
    "high": 0.65,
}  # CALIBRATION TARGET — MVP initial values

L7_RISK_PATTERNS = {
    "conflict_expression_shift": {
        "A4_bias": 0.3,
        "A8_cold": ["repair", "boundary"],
        "A8_real": "confrontational",
    },
    "closeness_gradient_nonlinearity": {
        "A10_cold": "slow_burn",
        "A10_real": "fast_opener",
    },
    "empathy_context_dependent": {
        "A2_bias": -0.35,
    },
    "reciprocity_pattern_shift": {
        "A11_cold": ["balanced", "giver"],
        "A11_real": "taker",
        "A3_bias": 0.25,
    },
}

L7_INAUTHENTICITY_THRESHOLDS = {
    "total_gap": 0.65,
    "conf_asymmetry": 0.3,
    "style_shifts_min": 3,
    "formality_gap": 0.5,
    "stability_gap": 0.4,
    "multi_axis_gap": 0.3,
    "multi_axis_min": 4,
}

L7_INAUTHENTICITY_LEVELS = {
    "normal": (0, 1),
    "noteworthy": (2, 3),
    "significant": (4, 5),
    "extreme": (6, 6),
}

# v4.0 Legacy aliases (DO NOT USE in new code)
_L7_LEGACY_RISK_PATTERN_MAP = {
    "aggression_masking": "conflict_expression_shift",
    "intimacy_acceleration": "closeness_gradient_nonlinearity",
    "receptivity_facade": "empathy_context_dependent",
    "dominance_shift": "reciprocity_pattern_shift",
}

_L7_LEGACY_INAUTHENTICITY_LEVEL_MAP = {
    "suspicious": "noteworthy",
    "likely_inauthentic": "significant",
    "highly_likely_inauthentic": "extreme",
}

# ═══════════ L0-Norm Fullwidth Map ═══════════
FULLWIDTH_MAP = str.maketrans("？！，．：；", "?!,.:;")
