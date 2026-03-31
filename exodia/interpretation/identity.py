"""
Identity naming system for EXODIA profiles.

Maps engine axis combinations to symbolic identity names and emojis.
No engine internals (axis numbers, raw scores) are exposed in output.
"""

from dataclasses import dataclass
from typing import Dict, List, Optional, Tuple


@dataclass
class Identity:
    """Generated identity for a profile."""
    name: str          # e.g. "얼어붙은 화산"
    emoji: str         # e.g. "🌋"
    code: str          # e.g. "E-VF"
    tagline: str       # one-line description
    summary: str       # 2-3 sentence personality summary


# ─── Axis helpers (internal only) ────────────────────────────────

def _h(v: float) -> bool:
    """High: value >= 0.6"""
    return v >= 0.6

def _l(v: float) -> bool:
    """Low: value < 0.4"""
    return v < 0.4

def _dom(axis_data: dict) -> str:
    """Get dominant type from structural axis data."""
    if "dominant" in axis_data:
        return axis_data["dominant"]
    if "mix" in axis_data:
        return max(axis_data["mix"], key=axis_data["mix"].get)
    return ""


# ─── Individual Identity Map ─────────────────────────────────────
# Keys: (emotion_intensity_high, emotion_expression_high, confidence_high,
#         intimacy_comfort_high, attachment_dominant, conflict_dominant)
# Simplified to major archetype groups

_INDIVIDUAL_ARCHETYPES: List[dict] = [
    # High intensity + Low expression + High confidence → Frozen Volcano
    {
        "match": lambda d: _h(d["A1"]) and _l(d["A3"]) and _h(d["A4"]),
        "name": "얼어붙은 화산",
        "emoji": "🌋",
        "code": "E-VF",
        "tagline": "안에서 들끓지만 밖으로는 차가운, 통제된 격렬함의 소유자",
    },
    # High intensity + High expression + High social → Storm Conductor
    {
        "match": lambda d: _h(d["A1"]) and _h(d["A3"]) and _h(d["A5"]),
        "name": "폭풍의 지휘자",
        "emoji": "⚡",
        "code": "E-SC",
        "tagline": "감정의 폭풍을 에너지로 바꾸는, 주도적인 격렬함의 소유자",
    },
    # High empathy + High expression + Low conflict (avoidant) → Fog Lantern
    {
        "match": lambda d: _h(d["A3"]) and _dom(d.get("A15", {})) == "정서적공감형" and _dom(d.get("A7", {})) == "회피형",
        "name": "안개 속의 등불",
        "emoji": "🏮",
        "code": "E-LM",
        "tagline": "따뜻하게 비추지만 스스로는 흔들리는, 부드러운 공감의 소유자",
    },
    # High confidence + Low authority + High social → Pathbreaker
    {
        "match": lambda d: _h(d["A4"]) and _l(d["A6"]) and _h(d["A5"]),
        "name": "길 없는 개척자",
        "emoji": "🗡️",
        "code": "E-PB",
        "tagline": "기존 질서를 따르지 않는, 자기 길을 만드는 확신의 소유자",
    },
    # Low intensity + Low expression + Low social → Silent Observer
    {
        "match": lambda d: _l(d["A1"]) and _l(d["A3"]) and _l(d["A5"]),
        "name": "고요한 관찰자",
        "emoji": "🌑",
        "code": "E-SO",
        "tagline": "조용히 세상을 읽는, 낮은 온도의 깊은 사유자",
    },
    # High intimacy + High expression + Secure attachment → Warm Harbor
    {
        "match": lambda d: _h(d.get("A12", 0.5)) and _h(d["A3"]) and _dom(d.get("A9", {})) == "안정형",
        "name": "따뜻한 항구",
        "emoji": "🏖️",
        "code": "E-WH",
        "tagline": "사람들이 쉬어가는, 안정적이고 개방적인 존재",
    },
    # High intensity + High expression + Anxious attachment → Deep Current
    {
        "match": lambda d: _h(d["A1"]) and _h(d["A3"]) and _dom(d.get("A9", {})) == "불안형",
        "name": "심연의 해류",
        "emoji": "🌊",
        "code": "E-DC",
        "tagline": "감정의 깊이가 바닥을 모르는, 격렬하고 불안한 열정의 소유자",
    },
    # High logic + High confidence + Low emotion expression → Iron Compass
    {
        "match": lambda d: _dom(d.get("A10", {})) == "논리형" and _h(d["A4"]) and _l(d["A3"]),
        "name": "쇠로 된 나침반",
        "emoji": "🧭",
        "code": "E-IC",
        "tagline": "감정이 아닌 논리로 방향을 잡는, 흔들리지 않는 판단의 소유자",
    },
    # High change acceptance + Low boundary rigidity → Free Wind
    {
        "match": lambda d: _h(d.get("A14", 0.5)) and _dom(d.get("A17", {})) == "유연형",
        "name": "자유로운 바람",
        "emoji": "🍃",
        "code": "E-FW",
        "tagline": "경계를 넘나들며 변화를 즐기는, 유연한 적응의 소유자",
    },
    # High intensity + Avoidant attachment + High boundary rigidity → Armored Heart
    {
        "match": lambda d: _h(d["A1"]) and _dom(d.get("A9", {})) == "회피형" and _dom(d.get("A17", {})) == "경직형",
        "name": "갑옷 입은 심장",
        "emoji": "🛡️",
        "code": "E-AH",
        "tagline": "뜨거운 심장 위에 차가운 갑옷을 두른, 자기 보호의 전문가",
    },
    # Self-deprecating humor + High empathy + Anxious → Broken Mirror
    {
        "match": lambda d: _dom(d.get("A8", {})) == "자기비하형" and _h(d["A1"]) and _dom(d.get("A9", {})) == "불안형",
        "name": "금 간 거울",
        "emoji": "🪞",
        "code": "E-BM",
        "tagline": "자기를 웃음으로 감추는, 상처 위의 유머리스트",
    },
    # Default fallback
    {
        "match": lambda d: True,
        "name": "미지의 윤곽",
        "emoji": "🔮",
        "code": "E-XX",
        "tagline": "하나의 유형에 담기지 않는, 복합적인 존재",
    },
]


def generate_identity(profile_data: Dict) -> Identity:
    """
    Generate symbolic identity from profile axis data.

    Args:
        profile_data: dict with axis keys (A1-A17) mapping to values.
            Intensity axes: float 0-1
            Structural axes: dict with 'dominant' and/or 'mix'

    Returns:
        Identity with name, emoji, code, tagline, summary
    """
    # Normalize: extract float values for intensity axes
    flat = {}
    for key, val in profile_data.items():
        if isinstance(val, (int, float)):
            flat[key] = float(val)
        elif isinstance(val, dict):
            flat[key] = val  # keep structural axes as-is
            if "value" in val:
                flat[key] = float(val["value"])

    # Find matching archetype
    for arch in _INDIVIDUAL_ARCHETYPES:
        try:
            if arch["match"](flat):
                summary = _generate_identity_summary(flat, arch["name"])
                return Identity(
                    name=arch["name"],
                    emoji=arch["emoji"],
                    code=arch["code"],
                    tagline=arch["tagline"],
                    summary=summary,
                )
        except (KeyError, TypeError):
            continue

    # Fallback (should not reach due to default)
    fallback = _INDIVIDUAL_ARCHETYPES[-1]
    return Identity(
        name=fallback["name"],
        emoji=fallback["emoji"],
        code=fallback["code"],
        tagline=fallback["tagline"],
        summary="이 프로필은 단일 유형으로 분류되지 않는 복합적 특성을 보입니다.",
    )


def _generate_identity_summary(data: Dict, name: str) -> str:
    """Generate a short personality summary without engine terms."""
    parts = []

    # Emotion intensity + expression
    a1 = data.get("A1", 0.5)
    a3 = data.get("A3", 0.5)
    if _h(a1) and _l(a3):
        parts.append("감정을 살짝 느끼는 법이 없지만, 그걸 밖으로 내보내는 일은 거의 없다.")
    elif _h(a1) and _h(a3):
        parts.append("감정을 숨기지 않고 솔직하게 표현하며, 그 강도가 주변에 에너지를 준다.")
    elif _l(a1):
        parts.append("내면이 고요한 편이며, 감정의 진폭이 크지 않다.")

    # Relationship style
    a9 = data.get("A9", {})
    a12 = data.get("A12", 0.5)
    dom_a9 = _dom(a9) if isinstance(a9, dict) else ""
    if dom_a9 == "회피형":
        parts.append("관계에서 거리를 유지하려는 경향이 있고, 친밀해지는 것을 불편해한다.")
    elif dom_a9 == "불안형":
        parts.append("관계에서 확인받고 싶은 욕구가 강하고, 감정적 연결을 깊게 추구한다.")
    elif dom_a9 == "안정형":
        parts.append("관계에서 안정적이고, 가까워지는 것을 자연스럽게 받아들인다.")

    # Decision style
    a10 = data.get("A10", {})
    dom_a10 = _dom(a10) if isinstance(a10, dict) else ""
    if dom_a10 == "논리형":
        parts.append("판단할 때 감정보다 논리가 먼저 작동한다.")
    elif dom_a10 == "감정형":
        parts.append("결정에서 감정과 직관의 비중이 크다.")

    return " ".join(parts) if parts else f"{name}의 특성을 가진 복합적 프로필입니다."


# ─── Matching Identity ───────────────────────────────────────────

@dataclass
class MatchIdentity:
    """Generated identity for a matched pair."""
    name: str          # e.g. "밀물과 썰물"
    emoji_a: str
    emoji_b: str
    code: str          # e.g. "E-VF × E-LM"
    tagline: str
    summary: str
    compatibility: int  # 0-100
    tension: str       # "낮음", "보통", "높음", "매우 높음"
    growth: str        # "낮음", "보통", "높음", "매우 높음"


_MATCH_ARCHETYPES: List[dict] = [
    # Avoidant × Anxious → Push-Pull
    {
        "match": lambda a, b: (
            (_dom(a.get("A9", {})) == "회피형" and _dom(b.get("A9", {})) == "불안형") or
            (_dom(a.get("A9", {})) == "불안형" and _dom(b.get("A9", {})) == "회피형")
        ),
        "name": "밀물과 썰물",
        "tagline": "다가가면 물러나고, 물러나면 다가오는 — 끝없는 파도의 관계",
        "tension": "높음",
        "growth": "매우 높음",
    },
    # Both high intensity → Fire meets Fire
    {
        "match": lambda a, b: _h(a.get("A1", 0.5)) and _h(b.get("A1", 0.5)),
        "name": "두 개의 불꽃",
        "tagline": "서로의 열기가 관계를 밝히기도, 태우기도 하는 — 격렬한 공명의 관계",
        "tension": "매우 높음",
        "growth": "높음",
    },
    # One logic + One emotion → Translator pair
    {
        "match": lambda a, b: (
            (_dom(a.get("A10", {})) == "논리형" and _dom(b.get("A10", {})) == "감정형") or
            (_dom(a.get("A10", {})) == "감정형" and _dom(b.get("A10", {})) == "논리형")
        ),
        "name": "번역이 필요한 대화",
        "tagline": "같은 말을 다른 언어로 하는 — 통역이 필요한 관계",
        "tension": "보통",
        "growth": "높음",
    },
    # High expression gap → Ice and Fire
    {
        "match": lambda a, b: abs(a.get("A3", 0.5) - b.get("A3", 0.5)) > 0.4,
        "name": "불과 얼음",
        "tagline": "한쪽은 타오르고 다른 쪽은 얼어있는 — 온도차가 만드는 긴장과 매력",
        "tension": "높음",
        "growth": "높음",
    },
    # Both stable + similar style → Calm Waters
    {
        "match": lambda a, b: (
            _dom(a.get("A9", {})) == "안정형" and _dom(b.get("A9", {})) == "안정형"
        ),
        "name": "잔잔한 호수",
        "tagline": "서로에게 기대도 흔들리지 않는 — 안정 위의 안정",
        "tension": "낮음",
        "growth": "보통",
    },
    # Both avoidant → Two Fortresses
    {
        "match": lambda a, b: (
            _dom(a.get("A9", {})) == "회피형" and _dom(b.get("A9", {})) == "회피형"
        ),
        "name": "마주 보는 성벽",
        "tagline": "서로의 벽을 인정하지만 넘지 못하는 — 안전하지만 외로운 거리",
        "tension": "보통",
        "growth": "낮음",
    },
    # Default
    {
        "match": lambda a, b: True,
        "name": "교차하는 궤도",
        "tagline": "서로 다른 궤도를 돌지만 주기적으로 만나는 — 복합적 역학의 관계",
        "tension": "보통",
        "growth": "보통",
    },
]


def generate_match_identity(
    profile_a: Dict, profile_b: Dict,
    identity_a: Identity, identity_b: Identity,
) -> MatchIdentity:
    """
    Generate symbolic identity for a matched pair.

    Args:
        profile_a, profile_b: axis data dicts
        identity_a, identity_b: individual identities
    """
    # Normalize
    flat_a = _flatten(profile_a)
    flat_b = _flatten(profile_b)

    # Find matching archetype
    for arch in _MATCH_ARCHETYPES:
        try:
            if arch["match"](flat_a, flat_b):
                compat = _calculate_compatibility(flat_a, flat_b)
                summary = _generate_match_summary(flat_a, flat_b, arch["name"])
                return MatchIdentity(
                    name=arch["name"],
                    emoji_a=identity_a.emoji,
                    emoji_b=identity_b.emoji,
                    code=f"{identity_a.code} × {identity_b.code}",
                    tagline=arch["tagline"],
                    summary=summary,
                    compatibility=compat,
                    tension=arch["tension"],
                    growth=arch["growth"],
                )
        except (KeyError, TypeError):
            continue

    fallback = _MATCH_ARCHETYPES[-1]
    return MatchIdentity(
        name=fallback["name"],
        emoji_a=identity_a.emoji,
        emoji_b=identity_b.emoji,
        code=f"{identity_a.code} × {identity_b.code}",
        tagline=fallback["tagline"],
        summary="이 조합은 단일 패턴으로 분류되지 않는 복합적 역학을 보입니다.",
        compatibility=50,
        tension=fallback["tension"],
        growth=fallback["growth"],
    )


def _flatten(data: Dict) -> Dict:
    """Extract float values, keep structural axes as dicts."""
    flat = {}
    for key, val in data.items():
        if isinstance(val, (int, float)):
            flat[key] = float(val)
        elif isinstance(val, dict):
            if "value" in val:
                flat[key] = float(val["value"])
            else:
                flat[key] = val
    return flat


def _calculate_compatibility(a: Dict, b: Dict) -> int:
    """
    Calculate compatibility score (0-100) based on complementarity and similarity.
    Higher is not always better — it means easier, not deeper.
    """
    score = 50  # baseline

    # Attachment compatibility
    dom_a9a = _dom(a.get("A9", {})) if isinstance(a.get("A9"), dict) else ""
    dom_a9b = _dom(b.get("A9", {})) if isinstance(b.get("A9"), dict) else ""

    if dom_a9a == "안정형" and dom_a9b == "안정형":
        score += 20
    elif dom_a9a == "안정형" or dom_a9b == "안정형":
        score += 10
    elif (dom_a9a == "회피형" and dom_a9b == "불안형") or (dom_a9a == "불안형" and dom_a9b == "회피형"):
        score -= 15
    elif dom_a9a == "회피형" and dom_a9b == "회피형":
        score -= 5

    # Expression compatibility
    a3a = a.get("A3", 0.5) if isinstance(a.get("A3"), (int, float)) else 0.5
    a3b = b.get("A3", 0.5) if isinstance(b.get("A3"), (int, float)) else 0.5
    gap = abs(a3a - a3b)
    if gap > 0.4:
        score -= 10
    elif gap < 0.2:
        score += 5

    # Conflict style compatibility
    dom_a7a = _dom(a.get("A7", {})) if isinstance(a.get("A7"), dict) else ""
    dom_a7b = _dom(b.get("A7", {})) if isinstance(b.get("A7"), dict) else ""
    if dom_a7a == "직면형" and dom_a7b == "회피형":
        score -= 10
    elif dom_a7a == "중재형" or dom_a7b == "중재형":
        score += 5

    # Decision style compatibility
    dom_a10a = _dom(a.get("A10", {})) if isinstance(a.get("A10"), dict) else ""
    dom_a10b = _dom(b.get("A10", {})) if isinstance(b.get("A10"), dict) else ""
    if dom_a10a == dom_a10b:
        score += 5

    return max(10, min(90, score))


def _generate_match_summary(a: Dict, b: Dict, name: str) -> str:
    """Generate short match summary."""
    dom_a9a = _dom(a.get("A9", {})) if isinstance(a.get("A9"), dict) else ""
    dom_a9b = _dom(b.get("A9", {})) if isinstance(b.get("A9"), dict) else ""

    if "밀물" in name:
        return "한쪽이 다가가면 다른 쪽이 물러나는 관계. 쉽지는 않다. 근데 서로가 서로의 가장 어려운 부분을 건드리는 사람이라, 성장의 재료가 전부 이 안에 있다."
    elif "불꽃" in name:
        return "둘 다 격렬하다. 함께 있으면 에너지가 증폭되는데, 그게 좋은 쪽으로 갈 수도 있고 폭발할 수도 있다. 서로의 강도를 감당할 수 있느냐가 관건."
    elif "번역" in name:
        return "같은 상황을 완전히 다른 방식으로 처리하는 두 사람. 서로의 언어를 배울 의지가 있으면 균형이 잡히고, 없으면 영원히 어긋난다."
    elif "불과 얼음" in name:
        return "감정 표현의 온도차가 극단적인 조합. 한쪽의 표현이 다른 쪽의 억제를 녹일 수 있지만, 그 과정이 순탄하지는 않다."
    elif "호수" in name:
        return "안정적이고 편안한 관계. 큰 파도는 없지만 지속 가능하다. 다만 자극이 부족해서 관계가 정체될 수 있다."
    elif "성벽" in name:
        return "서로의 공간을 존중하지만 깊이 들어가지 못하는 관계. 편안하지만 외로울 수 있다."
    else:
        return "단일 패턴으로 설명하기 어려운 복합적 역학. 여러 차원에서 다른 방식으로 작동하는 관계."
