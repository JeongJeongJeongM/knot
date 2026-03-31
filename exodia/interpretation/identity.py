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

# ── Engine axis reference (DO NOT expose to users) ──────────
# Intensity: A1=engagement, A2=receptivity, A3=assertiveness,
#            A4=emotional_expression, A5=collaboration, A6=stability
# Structural: A7=orientation(initiator/responder/balanced),
#   A8=conflict(confrontational/avoidant/boundary/repair),
#   A9=emotion_reg(expressive/analytical/suppressive/externalized),
#   A10=intimacy(slow_burn/fast_opener/surface_locked/depth_seeker),
#   A11=balance(giver/taker), A13=feedback(growth/defensive/avoidant/absorptive),
#   A15=investment(active_investor/passive_maintainer/disengaged),
#   A16=cognition(analytical/pragmatic/binary),
#   A17=humor(tension_breaker/bonding/deflective/aggressive/minimal)

_INDIVIDUAL_ARCHETYPES: List[dict] = [
    # High engagement + Low expression + Suppressive → internally alive but externally cold
    {
        "match": lambda d: _h(d["A1"]) and _l(d["A4"]) and _dom(d.get("A9", {})) == "suppressive",
        "name": "얼어붙은 화산",
        "emoji": "🌋",
        "code": "E-VF",
        "tagline": "안에서 들끓지만 밖으로는 차가운, 통제된 격렬함의 소유자",
    },
    # High engagement + High assertiveness + Confrontational conflict → bold leader
    {
        "match": lambda d: _h(d["A1"]) and _h(d["A3"]) and _dom(d.get("A8", {})) == "confrontational",
        "name": "폭풍의 지휘자",
        "emoji": "⚡",
        "code": "E-SC",
        "tagline": "감정의 폭풍을 에너지로 바꾸는, 주도적인 격렬함의 소유자",
    },
    # High receptivity + Low assertiveness + High expression → empathetic but yielding
    {
        "match": lambda d: _h(d["A2"]) and _l(d["A3"]) and _h(d["A4"]),
        "name": "안개 속의 등불",
        "emoji": "🏮",
        "code": "E-LM",
        "tagline": "따뜻하게 비추지만 스스로는 흔들리는, 부드러운 공감의 소유자",
    },
    # High engagement + High assertiveness + Initiator → trailblazer
    {
        "match": lambda d: _h(d["A1"]) and _h(d["A3"]) and _dom(d.get("A7", {})) == "initiator",
        "name": "길 없는 개척자",
        "emoji": "🗡️",
        "code": "E-PB",
        "tagline": "기존 질서를 따르지 않는, 자기 길을 만드는 확신의 소유자",
    },
    # Low engagement + Low assertiveness + Low expression → quiet observer
    {
        "match": lambda d: _l(d["A1"]) and _l(d["A3"]) and _l(d["A4"]),
        "name": "고요한 관찰자",
        "emoji": "🌑",
        "code": "E-SO",
        "tagline": "조용히 세상을 읽는, 낮은 온도의 깊은 사유자",
    },
    # High receptivity + High collaboration + High stability → warm & stable
    {
        "match": lambda d: _h(d["A2"]) and _h(d["A5"]) and _h(d["A6"]),
        "name": "따뜻한 항구",
        "emoji": "🏖️",
        "code": "E-WH",
        "tagline": "사람들이 쉬어가는, 안정적이고 개방적인 존재",
    },
    # High expression + Low stability + Expressive emotion reg → deep volatile
    {
        "match": lambda d: _h(d["A4"]) and _l(d["A6"]) and _dom(d.get("A9", {})) == "expressive",
        "name": "심연의 해류",
        "emoji": "🌊",
        "code": "E-DC",
        "tagline": "감정의 깊이가 바닥을 모르는, 격렬하고 불안한 열정의 소유자",
    },
    # High assertiveness + High stability + Analytical cognition → iron compass
    {
        "match": lambda d: _h(d["A3"]) and _h(d["A6"]) and _dom(d.get("A16", {})) == "analytical",
        "name": "쇠로 된 나침반",
        "emoji": "🧭",
        "code": "E-IC",
        "tagline": "감정이 아닌 논리로 방향을 잡는, 흔들리지 않는 판단의 소유자",
    },
    # High collaboration + Fast opener + Active investor → open & free
    {
        "match": lambda d: _h(d["A5"]) and _dom(d.get("A10", {})) == "fast_opener" and _dom(d.get("A15", {})) == "active_investor",
        "name": "자유로운 바람",
        "emoji": "🍃",
        "code": "E-FW",
        "tagline": "경계를 넘나들며 변화를 즐기는, 유연한 적응의 소유자",
    },
    # High engagement + Low expression + Avoidant conflict → armored but caring
    {
        "match": lambda d: _h(d["A1"]) and _l(d["A4"]) and _dom(d.get("A8", {})) == "avoidant",
        "name": "갑옷 입은 심장",
        "emoji": "🛡️",
        "code": "E-AH",
        "tagline": "뜨거운 심장 위에 차가운 갑옷을 두른, 자기 보호의 전문가",
    },
    # Deflective humor + Absorptive feedback + High expression → self-deprecating
    {
        "match": lambda d: _dom(d.get("A17", {})) == "deflective" and _dom(d.get("A13", {})) == "absorptive" and _h(d["A4"]),
        "name": "금 간 거울",
        "emoji": "🪞",
        "code": "E-BM",
        "tagline": "자기를 웃음으로 감추는, 상처 위의 유머리스트",
    },
    # High expression + Low stability + Externalized emotion reg → explosive
    {
        "match": lambda d: _h(d["A4"]) and _l(d["A6"]) and _dom(d.get("A9", {})) == "externalized",
        "name": "불꽃 산책자",
        "emoji": "🔥",
        "code": "E-FS",
        "tagline": "감정을 밖으로 쏟아내는, 예측 불가의 열정가",
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
    # Unwrap 'axes' wrapper if present
    raw = profile_data.get("axes", profile_data)

    # Normalize: extract float values for intensity axes
    flat = {}
    for key, val in raw.items():
        if isinstance(val, (int, float)):
            flat[key] = float(val)
        elif isinstance(val, dict):
            # Try extracting numeric value from various key conventions
            if "score" in val:
                flat[key] = float(val["score"])
            elif "value" in val:
                flat[key] = float(val["value"])
            elif "dominant" in val or "mix" in val:
                flat[key] = val  # keep structural axes as-is
            else:
                flat[key] = val

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

    # Engagement (A1) + Expression (A4)
    a1 = data.get("A1", 0.5)
    a4 = data.get("A4", 0.5)
    if _h(a1) and _l(a4):
        parts.append("관심과 에너지가 높지만, 그걸 밖으로 드러내는 일은 거의 없다.")
    elif _h(a1) and _h(a4):
        parts.append("적극적으로 관여하고 감정 표현도 거침없이 하는 편이다.")
    elif _l(a1):
        parts.append("관여의 온도가 낮고, 조용히 거리를 두며 관찰하는 스타일이다.")

    # Conflict style (A8)
    a8 = data.get("A8", {})
    dom_a8 = _dom(a8) if isinstance(a8, dict) else ""
    if dom_a8 == "confrontational":
        parts.append("갈등 상황에서 정면으로 부딪히는 것을 피하지 않는다.")
    elif dom_a8 == "avoidant":
        parts.append("갈등을 마주하기보다 우회하거나 피하려는 경향이 있다.")
    elif dom_a8 == "repair":
        parts.append("갈등이 생기면 관계를 복구하려는 방향으로 움직인다.")

    # Emotion regulation (A9)
    a9 = data.get("A9", {})
    dom_a9 = _dom(a9) if isinstance(a9, dict) else ""
    if dom_a9 == "expressive":
        parts.append("감정을 안에 가두지 않고 바깥으로 풀어낸다.")
    elif dom_a9 == "suppressive":
        parts.append("감정을 억누르고 드러내지 않으려 한다.")
    elif dom_a9 == "externalized":
        parts.append("내면의 감정이 행동으로 직접 분출되는 경향이 있다.")

    # Cognition (A16)
    a16 = data.get("A16", {})
    dom_a16 = _dom(a16) if isinstance(a16, dict) else ""
    if dom_a16 == "analytical":
        parts.append("판단할 때 감정보다 분석이 먼저 작동한다.")
    elif dom_a16 == "binary":
        parts.append("세상을 흑백으로 나누는 경향이 있다.")

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
    # Expressive × Suppressive emotion regulation → Push-Pull
    {
        "match": lambda a, b: (
            (_dom(a.get("A9", {})) == "expressive" and _dom(b.get("A9", {})) == "suppressive") or
            (_dom(a.get("A9", {})) == "suppressive" and _dom(b.get("A9", {})) == "expressive")
        ),
        "name": "밀물과 썰물",
        "tagline": "다가가면 물러나고, 물러나면 다가오는 — 끝없는 파도의 관계",
        "tension": "높음",
        "growth": "매우 높음",
    },
    # Both high engagement + high expression → Fire meets Fire
    {
        "match": lambda a, b: _h(a.get("A1", 0.5)) and _h(b.get("A1", 0.5)) and _h(a.get("A4", 0.5)) and _h(b.get("A4", 0.5)),
        "name": "두 개의 불꽃",
        "tagline": "서로의 열기가 관계를 밝히기도, 태우기도 하는 — 격렬한 공명의 관계",
        "tension": "매우 높음",
        "growth": "높음",
    },
    # Analytical cognition vs Pragmatic/Binary → Translator pair
    {
        "match": lambda a, b: (
            (_dom(a.get("A16", {})) == "analytical" and _dom(b.get("A16", {})) in ("pragmatic", "binary")) or
            (_dom(a.get("A16", {})) in ("pragmatic", "binary") and _dom(b.get("A16", {})) == "analytical")
        ),
        "name": "번역이 필요한 대화",
        "tagline": "같은 말을 다른 언어로 하는 — 통역이 필요한 관계",
        "tension": "보통",
        "growth": "높음",
    },
    # High expression gap (A4) → Ice and Fire
    {
        "match": lambda a, b: abs(a.get("A4", 0.5) - b.get("A4", 0.5)) > 0.4,
        "name": "불과 얼음",
        "tagline": "한쪽은 타오르고 다른 쪽은 얼어있는 — 온도차가 만드는 긴장과 매력",
        "tension": "높음",
        "growth": "높음",
    },
    # Both high stability + both high collaboration → Calm Waters
    {
        "match": lambda a, b: _h(a.get("A6", 0.5)) and _h(b.get("A6", 0.5)) and _h(a.get("A5", 0.5)) and _h(b.get("A5", 0.5)),
        "name": "잔잔한 호수",
        "tagline": "서로에게 기대도 흔들리지 않는 — 안정 위의 안정",
        "tension": "낮음",
        "growth": "보통",
    },
    # Both avoidant conflict → Two Fortresses
    {
        "match": lambda a, b: (
            _dom(a.get("A8", {})) == "avoidant" and _dom(b.get("A8", {})) == "avoidant"
        ),
        "name": "마주 보는 성벽",
        "tagline": "서로의 벽을 인정하지만 넘지 못하는 — 안전하지만 외로운 거리",
        "tension": "보통",
        "growth": "낮음",
    },
    # Confrontational × Avoidant conflict → Clash
    {
        "match": lambda a, b: (
            (_dom(a.get("A8", {})) == "confrontational" and _dom(b.get("A8", {})) == "avoidant") or
            (_dom(a.get("A8", {})) == "avoidant" and _dom(b.get("A8", {})) == "confrontational")
        ),
        "name": "부딪히는 파장",
        "tagline": "한쪽은 부딪히고 다른 쪽은 피하는 — 갈등 언어가 다른 관계",
        "tension": "매우 높음",
        "growth": "높음",
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
    """Extract float values, keep structural axes as dicts. Handles 'axes' wrapper."""
    raw = data.get("axes", data)
    flat = {}
    for key, val in raw.items():
        if isinstance(val, (int, float)):
            flat[key] = float(val)
        elif isinstance(val, dict):
            if "score" in val:
                flat[key] = float(val["score"])
            elif "value" in val:
                flat[key] = float(val["value"])
            elif "dominant" in val or "mix" in val:
                flat[key] = val
            else:
                flat[key] = val
    return flat


def _calculate_compatibility(a: Dict, b: Dict) -> int:
    """
    Calculate compatibility score (0-100) based on complementarity and similarity.
    Higher is not always better — it means easier, not deeper.
    """
    score = 50  # baseline

    # Emotion regulation compatibility (A9)
    dom_a9a = _dom(a.get("A9", {})) if isinstance(a.get("A9"), dict) else ""
    dom_a9b = _dom(b.get("A9", {})) if isinstance(b.get("A9"), dict) else ""

    if dom_a9a == dom_a9b:
        score += 10  # same style = easier communication
    elif {dom_a9a, dom_a9b} == {"expressive", "suppressive"}:
        score -= 15  # opposite = high friction
    elif {dom_a9a, dom_a9b} == {"expressive", "externalized"}:
        score -= 10  # both outward = volatile

    # Expression gap (A4)
    a4a = a.get("A4", 0.5) if isinstance(a.get("A4"), (int, float)) else 0.5
    a4b = b.get("A4", 0.5) if isinstance(b.get("A4"), (int, float)) else 0.5
    gap = abs(a4a - a4b)
    if gap > 0.4:
        score -= 10
    elif gap < 0.2:
        score += 5

    # Conflict style compatibility (A8)
    dom_a8a = _dom(a.get("A8", {})) if isinstance(a.get("A8"), dict) else ""
    dom_a8b = _dom(b.get("A8", {})) if isinstance(b.get("A8"), dict) else ""
    if {dom_a8a, dom_a8b} == {"confrontational", "avoidant"}:
        score -= 10  # direct clash
    elif dom_a8a == "repair" or dom_a8b == "repair":
        score += 10  # repair tendency helps
    elif dom_a8a == dom_a8b:
        score += 5

    # Stability similarity (A6)
    a6a = a.get("A6", 0.5) if isinstance(a.get("A6"), (int, float)) else 0.5
    a6b = b.get("A6", 0.5) if isinstance(b.get("A6"), (int, float)) else 0.5
    if abs(a6a - a6b) < 0.2:
        score += 5

    # Collaboration (A5) — both high = good
    a5a = a.get("A5", 0.5) if isinstance(a.get("A5"), (int, float)) else 0.5
    a5b = b.get("A5", 0.5) if isinstance(b.get("A5"), (int, float)) else 0.5
    if _h(a5a) and _h(a5b):
        score += 10

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
    elif "파장" in name:
        return "갈등 해결 방식이 정반대인 조합. 한쪽은 정면 돌파, 다른 쪽은 회피. 서로의 방식을 이해하지 못하면 같은 문제가 반복된다."
    else:
        return "단일 패턴으로 설명하기 어려운 복합적 역학. 여러 차원에서 다른 방식으로 작동하는 관계."
