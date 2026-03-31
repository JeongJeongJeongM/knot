"""
EXODIA v2 — 한국어 어휘 은행 (Vocabulary Bank).
17축 각 값 범위에 대한 한국어 표현 매핑.
"""

from __future__ import annotations

# ═══════════ 강도축 어휘맵 (Intensity Axes) ═══════════
# 각 축 → 4개 구간 (very_low, low, high, very_high)
# 각 구간 → 복수 후보 어휘 (첫 번째가 기본)

INTENSITY_VOCAB: dict[str, dict[str, list[str]]] = {
    "A1": {  # Engagement (관여도)
        "very_low":  ["무관심적", "소극적", "거리감있는"],
        "low":       ["신중한", "선별적"],
        "high":      ["적극적", "몰입적"],
        "very_high": ["몰두적", "강렬한", "자기중심적"],
    },
    "A2": {  # Warmth (온기)
        "very_low":  ["냉담한", "거리감있는", "공정한"],
        "low":       ["예의바른", "절제된"],
        "high":      ["친절한", "따뜻한", "배려하는"],
        "very_high": ["감정적", "포용하는", "공감하는"],
    },
    "A3": {  # Conflict (갈등성향)
        "very_low":  ["평화추구적", "조화지향적"],
        "low":       ["분노억제적", "수용적"],
        "high":      ["도전적", "직설적"],
        "very_high": ["대항적", "맞서는", "격한"],
    },
    "A4": {  # Power (권력지향)
        "very_low":  ["겸손한", "평등지향적"],
        "low":       ["성취지향적"],
        "high":      ["영향력있는", "주도적"],
        "very_high": ["지배적", "패권적", "지배욕강한"],
    },
    "A5": {  # Vulnerability (취약성)
        "very_low":  ["강건한", "자기보호적"],
        "low":       ["신중한", "선별적개방"],
        "high":      ["개방적", "노출된"],
        "very_high": ["내적취약성높은", "노출된"],
    },
    "A6": {  # Stability (안정성)
        "very_low":  ["변동성높은", "불안정한"],
        "low":       ["변동적인", "기분변화있는"],
        "high":      ["일관된", "예측가능한"],
        "very_high": ["지극히안정적", "변하지않는"],
    },
    "A12": {  # Attunement (조율민감성)
        "very_low":  ["둔감한", "타인인식낮은"],
        "low":       ["선별적인식"],
        "high":      ["민감한", "반응적"],
        "very_high": ["초민감한", "예민한", "카멜레온적"],
    },
    "A14": {  # Conflict Resolution (갈등해소력)
        "very_low":  ["갈등고착적", "미해결경향"],
        "low":       ["회피경향적"],
        "high":      ["중재능력있는"],
        "very_high": ["뛰어난중재자", "조정자"],
    },
}

# ═══════════ 구조축 어휘맵 (Structural Axes) ═══════════
# 각 축 → dominant type → 복수 후보 어휘

STRUCTURAL_VOCAB: dict[str, dict[str, list[str]]] = {
    "A7": {  # Orientation (방향성)
        "initiator": ["주도적", "선도하는", "개척하는"],
        "responder": ["반응적", "수용적", "적응하는"],
        "balanced":  ["균형잡힌", "유연한", "상황대응적"],
    },
    "A8": {  # Conflict Regulation (갈등조절)
        "confrontational": ["직면적", "정면대항하는"],
        "avoidant":        ["회피적", "물러나는", "우회하는"],
        "collaborative":   ["협력적", "함께하는", "문제해결적"],
        "accommodating":   ["양보적", "수용하는", "맞춰주는"],
    },
    "A9": {  # Disclosure (공개도)
        "selective":    ["선별적", "경계하는", "신중한"],
        "progressive":  ["관계심화적", "점진적신뢰구축"],
        "broadcast":    ["공개적", "개방적", "투명한"],
        "guarded":      ["폐쇄적", "방어적", "비밀스러운"],
    },
    "A10": {  # Influence (영향력 스타일)
        "logical":        ["논리기반", "설득력있는"],
        "emotional":      ["감정기반", "호소력있는"],
        "positional":     ["지위기반", "권위적"],
        "collaborative":  ["협동기반", "함께만드는"],
    },
    "A11": {  # Boundary (경계)
        "rigid":    ["경직된", "거리감있는", "단호한"],
        "flexible": ["유연한", "적응적", "열린"],
        "porous":   ["다공성", "침투가능한", "경계약한"],
    },
    "A13": {  # Feedback Response (피드백 반응)
        "growth":      ["성장추구적", "개선지향적"],
        "defensive":   ["방어적", "거부하는"],
        "avoidant":    ["회피적", "무시하는"],
        "absorptive":  ["자기비판적", "내재화하는"],
    },
    "A15": {  # Investment (투자도)
        "active_investor":     ["능동적", "주입하는", "헌신적"],
        "passive_maintainer":  ["수동적", "관찰하는"],
        "disengaged":          ["단절된", "무관심한", "거리감있는"],
    },
    "A16": {  # Cognition (인지방식)
        "analytical": ["분석적", "세부지향적", "논리적"],
        "pragmatic":  ["실용적", "효율지향적"],
        "binary":     ["이분법적", "절대적", "양극단적"],
    },
    "A17": {  # Humor (유머)
        "tension_breaker": ["긴장해소형", "웃음유발"],
        "bonding":         ["결속형", "친밀감조성"],
        "deflective":      ["회피형", "화제전환"],
        "aggressive":      ["공격형", "풍자적", "날카로운"],
        "minimal":         ["최소형", "유머거의없음"],
    },
}

# ═══════════ 축 가중치 (Psychological Weights) ═══════════

AXIS_WEIGHTS: dict[str, float] = {
    # 높은 가중치 (0.8-1.0): 관계의 핵심 축
    "A1": 0.9,   # Engagement
    "A3": 0.85,  # Conflict
    "A4": 0.9,   # Power
    "A7": 0.85,  # Orientation
    "A8": 0.8,   # Conflict Reg
    # 중간 가중치 (0.5-0.7)
    "A2": 0.7,   # Warmth
    "A6": 0.65,  # Stability
    "A14": 0.6,  # Conflict Resolution
    "A10": 0.6,  # Influence
    "A11": 0.6,  # Boundary
    "A12": 0.65, # Attunement
    # 낮은 가중치 (0.3-0.5)
    "A5": 0.45,  # Vulnerability
    "A9": 0.4,   # Disclosure
    "A13": 0.4,  # Feedback
    "A15": 0.4,  # Investment
    "A16": 0.35, # Cognition
    "A17": 0.3,  # Humor
}

# ═══════════ 인구통계 기본값 (Population Defaults) ═══════════
# 초기값: 모든 축 평균 0.5, 표준편차 0.2 (실제 데이터 수집 후 갱신)

POPULATION_DEFAULTS: dict[str, dict[str, float]] = {
    axis: {"mean": 0.5, "std": 0.2}
    for axis in ["A1", "A2", "A3", "A4", "A5", "A6", "A12", "A14"]
}


def get_intensity_band(value: float) -> str:
    """0-1 값을 4개 구간 중 하나로 매핑."""
    if value < 0.2:
        return "very_low"
    elif value < 0.4:
        return "low"
    elif value < 0.6:
        return "mid"  # 특이하지 않은 중간 구간
    elif value < 0.8:
        return "high"
    else:
        return "very_high"


def get_intensity_word(axis: str, value: float, exclude: set[str] | None = None) -> str | None:
    """강도축 값에 해당하는 한국어 어휘 반환. 중복 방지를 위해 exclude 집합 지원."""
    band = get_intensity_band(value)
    if band == "mid":
        return None  # 중간 구간은 특이하지 않으므로 어휘 없음
    candidates = INTENSITY_VOCAB.get(axis, {}).get(band, [])
    if not candidates:
        return None
    exclude = exclude or set()
    for word in candidates:
        if word not in exclude:
            return word
    return candidates[0]  # 모두 중복이면 첫 번째 반환


def get_structural_word(axis: str, dominant: str, exclude: set[str] | None = None) -> str | None:
    """구조축 dominant 값에 해당하는 한국어 어휘 반환."""
    candidates = STRUCTURAL_VOCAB.get(axis, {}).get(dominant, [])
    if not candidates:
        return None
    exclude = exclude or set()
    for word in candidates:
        if word not in exclude:
            return word
    return candidates[0]
