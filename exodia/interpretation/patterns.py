"""
EXODIA v2 — 교차축 패턴 탐지 엔진 (Cross-Axis Pattern Detection).
2축, 3축 조합 패턴 + 모순 탐지.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any


@dataclass
class CrossAxisPattern:
    """탐지된 교차축 패턴."""
    name_ko: str
    name_en: str
    axes: list[str]
    pattern_type: str  # "2축", "3축", "모순"
    significance: float  # 0-1
    description: str = ""
    warning: bool = False  # ⚠️ 위험 패턴 여부


# ═══════════ 2축 패턴 데이터베이스 ═══════════

def _hl(v: float) -> str:
    return "high" if v >= 0.5 else "low"


def _detect_2axis_patterns(data: dict[str, float | str]) -> list[CrossAxisPattern]:
    """2축 조합 패턴 탐지."""
    patterns: list[CrossAxisPattern] = []

    a1 = _safe_float(data, "A1")
    a2 = _safe_float(data, "A2")
    a3 = _safe_float(data, "A3")
    a4 = _safe_float(data, "A4")
    a5 = _safe_float(data, "A5")
    a6 = _safe_float(data, "A6")
    a12 = _safe_float(data, "A12")
    a14 = _safe_float(data, "A14")

    a7 = _safe_str(data, "A7")
    a8 = _safe_str(data, "A8")
    a9 = _safe_str(data, "A9")
    a10 = _safe_str(data, "A10")
    a11 = _safe_str(data, "A11")
    a13 = _safe_str(data, "A13")
    a17 = _safe_str(data, "A17")

    # ── A1×A2: 관계 에너지의 품질 ──
    if a1 >= 0.6 and a2 >= 0.6:
        patterns.append(CrossAxisPattern(
            "포용적 활성자", "Engaged Warmth", ["A1", "A2"], "2축",
            _sig(a1, a2), "사람들과의 관계에 에너지 있고 따뜻함"))
    elif a1 >= 0.6 and a2 < 0.4:
        patterns.append(CrossAxisPattern(
            "냉정한 활성자", "Engaged Detachment", ["A1", "A2"], "2축",
            _sig(a1, 1 - a2), "강렬하지만 거리감 있음", warning=True))
    elif a1 < 0.4 and a2 >= 0.6:
        patterns.append(CrossAxisPattern(
            "조용한 배려자", "Passive Warmth", ["A1", "A2"], "2축",
            _sig(1 - a1, a2), "참여도는 낮지만 따뜻함"))
    elif a1 < 0.4 and a2 < 0.4:
        patterns.append(CrossAxisPattern(
            "고립된", "Withdrawn", ["A1", "A2"], "2축",
            _sig(1 - a1, 1 - a2), "참여도, 따뜻함 모두 낮음", warning=True))

    # ── A1×A3: 도발성 ──
    if a1 >= 0.6 and a3 >= 0.6:
        patterns.append(CrossAxisPattern(
            "격렬한 주도자", "Intense Challenger", ["A1", "A3"], "2축",
            _sig(a1, a3), "적극적이고 도전적", warning=True))
    elif a1 >= 0.6 and a3 < 0.4:
        patterns.append(CrossAxisPattern(
            "건설적 주도자", "Engaged Builder", ["A1", "A3"], "2축",
            _sig(a1, 1 - a3), "적극적이지만 평화 추구"))
    elif a1 < 0.4 and a3 >= 0.6:
        patterns.append(CrossAxisPattern(
            "간헐적 반항자", "Intermittent Rebel", ["A1", "A3"], "2축",
            _sig(1 - a1, a3), "대부분 무관하지만 갑자기 격렬해짐", warning=True))

    # ── A2×A3: 감정 표현 방식 ──
    if a2 >= 0.6 and a3 >= 0.6:
        patterns.append(CrossAxisPattern(
            "격정적", "Passionate", ["A2", "A3"], "2축",
            _sig(a2, a3), "강한 감정 표현, 좋고 싫음이 명확"))
    elif a2 < 0.4 and a3 >= 0.6:
        patterns.append(CrossAxisPattern(
            "신랄한", "Sharp/Biting", ["A2", "A3"], "2축",
            _sig(1 - a2, a3), "차갑고 도전적", warning=True))

    # ── A3×A4: 권력 추구 방식 ──
    if a3 >= 0.6 and a4 >= 0.6:
        patterns.append(CrossAxisPattern(
            "독재적", "Autocratic", ["A3", "A4"], "2축",
            _sig(a3, a4), "갈등 불사, 지배 추구", warning=True))
    elif a3 < 0.4 and a4 >= 0.6:
        patterns.append(CrossAxisPattern(
            "부드러운 영향자", "Gentle Authority", ["A3", "A4"], "2축",
            _sig(1 - a3, a4), "권력은 추구하지만 갈등 회피"))
    elif a3 >= 0.6 and a4 < 0.4:
        patterns.append(CrossAxisPattern(
            "반항적", "Rebellious", ["A3", "A4"], "2축",
            _sig(a3, 1 - a4), "갈등 추구하지만 지배 거부"))

    # ── A5×A6: 심리 안정 기반 ──
    if a5 >= 0.6 and a6 >= 0.6:
        patterns.append(CrossAxisPattern(
            "역설적 불안정", "Consistent Vulnerability", ["A5", "A6"], "2축",
            _sig(a5, a6), "취약하지만 일관성 있음"))
    elif a5 >= 0.6 and a6 < 0.4:
        patterns.append(CrossAxisPattern(
            "불안정하고 노출된", "Volatile & Open", ["A5", "A6"], "2축",
            _sig(a5, 1 - a6), "감정도, 안정성도 낮음", warning=True))
    elif a5 < 0.4 and a6 >= 0.6:
        patterns.append(CrossAxisPattern(
            "강건하고 자기보호적", "Stoic", ["A5", "A6"], "2축",
            _sig(1 - a5, a6), "감정 폐쇄적이지만 안정적"))

    # ── A6×A12: 관계 적응 방식 ──
    if a6 >= 0.6 and a12 >= 0.6:
        patterns.append(CrossAxisPattern(
            "신뢰할 수 있는 카멜레온", "Reliable Adapter", ["A6", "A12"], "2축",
            _sig(a6, a12), "일관되지만 상황 맞춤 반응"))
    elif a6 >= 0.6 and a12 < 0.4:
        patterns.append(CrossAxisPattern(
            "고집스러운", "Stubborn", ["A6", "A12"], "2축",
            _sig(a6, 1 - a12), "자신의 방식을 유지, 타인 무시"))
    elif a6 < 0.4 and a12 >= 0.6:
        patterns.append(CrossAxisPattern(
            "예민하고 변덕스러운", "Moody Sensitive", ["A6", "A12"], "2축",
            _sig(1 - a6, a12), "예측 불가능", warning=True))

    # ── A1×A12: 참여와 감정 인식 ──
    if a1 >= 0.6 and a12 >= 0.6:
        patterns.append(CrossAxisPattern(
            "감정지능 높은 활성자", "High-EQ Engager", ["A1", "A12"], "2축",
            _sig(a1, a12), "적극적이면서 타인 감정 잘 인식"))
    elif a1 >= 0.6 and a12 < 0.4:
        patterns.append(CrossAxisPattern(
            "자기중심적 활성자", "Egocentric Engager", ["A1", "A12"], "2축",
            _sig(a1, 1 - a12), "내가 좋아하니까 너도 좋을 거야", warning=True))

    # ── Structural × Structural ──
    # A7×A8: 갈등 주도권
    if a7 == "initiator" and a8 == "confrontational":
        patterns.append(CrossAxisPattern(
            "갈등 주도자", "Conflict Initiator", ["A7", "A8"], "2축",
            0.7, "적극적으로 문제 제기, 정면 대응"))
    elif a7 == "initiator" and a8 == "collaborative":
        patterns.append(CrossAxisPattern(
            "건설적 리더", "Constructive Leader", ["A7", "A8"], "2축",
            0.65, "문제 제기하되 협력 추구"))
    elif a7 == "responder" and a8 == "confrontational":
        patterns.append(CrossAxisPattern(
            "수동적 도전자", "Passive Rebel", ["A7", "A8"], "2축",
            0.6, "공격 받으면 격렬하게 반격"))
    elif a7 == "responder" and a8 == "avoidant":
        patterns.append(CrossAxisPattern(
            "침묵하는", "Silently Compliant", ["A7", "A8"], "2축",
            0.55, "수동적이고 회피적"))

    # A8×A13: 비판 수용
    if a8 == "confrontational" and a13 == "growth":
        patterns.append(CrossAxisPattern(
            "개선지향적 도전자", "Improvement-Focused Challenger", ["A8", "A13"], "2축",
            0.7, "싸우지만 배우려 함"))
    elif a8 == "confrontational" and a13 == "defensive":
        patterns.append(CrossAxisPattern(
            "고집스러운 논쟁가", "Stubborn Debater", ["A8", "A13"], "2축",
            0.65, "끝없는 논쟁", warning=True))
    elif a8 == "avoidant" and a13 == "defensive":
        patterns.append(CrossAxisPattern(
            "부정하는", "Denying", ["A8", "A13"], "2축",
            0.6, "변화 불가능", warning=True))

    # A11×A17: 경계와 유머
    if a11 == "rigid" and a17 == "aggressive":
        patterns.append(CrossAxisPattern(
            "날카로운 비판가", "Sharp Critic", ["A11", "A17"], "2축",
            0.65, "농담이라고 했지만 상처", warning=True))
    elif a11 == "flexible" and a17 == "bonding":
        patterns.append(CrossAxisPattern(
            "친밀한 유머자", "Bonding Humorist", ["A11", "A17"], "2축",
            0.6, "웃음으로 관계 깊이 만드는 사람"))

    return patterns


# ═══════════ 3축 패턴 데이터베이스 ═══════════

def _detect_3axis_patterns(data: dict[str, float | str]) -> list[CrossAxisPattern]:
    """3축 이상 복합 패턴 탐지."""
    patterns: list[CrossAxisPattern] = []

    a1 = _safe_float(data, "A1")
    a2 = _safe_float(data, "A2")
    a3 = _safe_float(data, "A3")
    a4 = _safe_float(data, "A4")
    a5 = _safe_float(data, "A5")
    a6 = _safe_float(data, "A6")
    a12 = _safe_float(data, "A12")

    a7 = _safe_str(data, "A7")
    a8 = _safe_str(data, "A8")
    a10 = _safe_str(data, "A10")
    a11 = _safe_str(data, "A11")
    a13 = _safe_str(data, "A13")

    # ── 리더십 기질: A1+A2+A4 ──
    if a1 >= 0.6 and a2 >= 0.6 and a4 >= 0.6:
        patterns.append(CrossAxisPattern(
            "카리스마 리더", "Charismatic Leader",
            ["A1", "A2", "A4"], "3축", 0.85,
            "많은 사람이 따르고 싶어함. 우호적이면서 강력함."))
    elif a1 >= 0.6 and a2 >= 0.6 and a4 < 0.4:
        patterns.append(CrossAxisPattern(
            "봉사형 리더", "Servant Leader",
            ["A1", "A2", "A4"], "3축", 0.8,
            "따뜻하고 적극적이지만 권력 추구 안 함"))
    elif a1 >= 0.6 and a2 < 0.4 and a4 >= 0.6:
        patterns.append(CrossAxisPattern(
            "냉정한 지휘자", "Stern Commander",
            ["A1", "A2", "A4"], "3축", 0.8,
            "강력하지만 따뜻하지 않음", warning=True))

    # ── 감정 신뢰성: A2+A5+A6 ──
    if a2 >= 0.6 and a5 >= 0.6 and a6 >= 0.6:
        patterns.append(CrossAxisPattern(
            "일관되게 따뜻한", "Consistently Warm",
            ["A2", "A5", "A6"], "3축", 0.75,
            "감정 표현 많지만 예측가능. 신뢰 구축 용이."))
    elif a2 >= 0.6 and a5 >= 0.6 and a6 < 0.4:
        patterns.append(CrossAxisPattern(
            "변덕스럽지만 따뜻한", "Moody but Warm",
            ["A2", "A5", "A6"], "3축", 0.7,
            "감정 기복 크지만 근본 따뜻함", warning=True))
    elif a2 < 0.4 and a5 < 0.4 and a6 >= 0.6:
        patterns.append(CrossAxisPattern(
            "일관되게 냉담한", "Consistently Detached",
            ["A2", "A5", "A6"], "3축", 0.7,
            "예측가능하지만 감정이 없는 것처럼 보임"))

    # ── 갈등 성숙도: A3+A8+A13 ──
    if a3 >= 0.6 and a8 == "confrontational" and a13 == "growth":
        patterns.append(CrossAxisPattern(
            "발전지향적 도전자", "Growth-Focused Challenger",
            ["A3", "A8", "A13"], "3축", 0.8,
            "싸우지만 배우려고 함. 건설적 갈등."))
    elif a3 >= 0.6 and a8 == "confrontational" and a13 == "defensive":
        patterns.append(CrossAxisPattern(
            "끝없는 싸움꾼", "Endless Fighter",
            ["A3", "A8", "A13"], "3축", 0.75,
            "높은 관계 파괴 위험", warning=True))
    elif a3 < 0.4 and a8 == "avoidant" and a13 == "defensive":
        patterns.append(CrossAxisPattern(
            "변화 불가능한", "Unchangeable",
            ["A3", "A8", "A13"], "3축", 0.7,
            "매우 위험한 조합", warning=True))

    # ── 리더십 효과: A4+A10+A12 ──
    if a4 >= 0.6 and a10 == "logical" and a12 >= 0.6:
        patterns.append(CrossAxisPattern(
            "신뢰할 수 있는 리더", "Trustworthy Leader",
            ["A4", "A10", "A12"], "3축", 0.85,
            "논리적이면서 타인 감정도 인식"))
    elif a4 >= 0.6 and a10 == "logical" and a12 < 0.4:
        patterns.append(CrossAxisPattern(
            "독재적 전문가", "Dictatorial Expert",
            ["A4", "A10", "A12"], "3축", 0.75,
            "내 논리가 최고 태도", warning=True))
    elif a4 >= 0.6 and a10 == "positional" and a12 < 0.4:
        patterns.append(CrossAxisPattern(
            "거리감 있는 권위자", "Distant Authority",
            ["A4", "A10", "A12"], "3축", 0.7,
            "순응이 아닌 두려움 기반", warning=True))

    # ── 관계 통제성: A7+A8+A11 ──
    if a7 == "initiator" and a8 == "confrontational" and a11 == "rigid":
        patterns.append(CrossAxisPattern(
            "통제적 리더", "Controlling Leader",
            ["A7", "A8", "A11"], "3축", 0.8,
            "내 방식이 유일한 방식", warning=True))
    elif a7 == "initiator" and a8 == "collaborative" and a11 == "flexible":
        patterns.append(CrossAxisPattern(
            "파트너십 지향적", "Partnership-Oriented",
            ["A7", "A8", "A11"], "3축", 0.75,
            "리드하되 타인 의견 수용"))
    elif a7 == "responder" and a8 == "avoidant" and a11 == "porous":
        patterns.append(CrossAxisPattern(
            "수동적이고 경계약한", "Passive & Boundary-Less",
            ["A7", "A8", "A11"], "3축", 0.65,
            "타인에게 휘둘릴 위험", warning=True))

    return patterns


# ═══════════ 모순 탐지 ═══════════

def detect_contradictions(data: dict[str, float | str]) -> list[CrossAxisPattern]:
    """교차축 모순(contradiction) 탐지.

    모순 = 일반적으로 함께 나타나지 않는 특성 조합.
    """
    contradictions: list[CrossAxisPattern] = []

    a1 = _safe_float(data, "A1")
    a2 = _safe_float(data, "A2")
    a3 = _safe_float(data, "A3")
    a4 = _safe_float(data, "A4")
    a5 = _safe_float(data, "A5")
    a6 = _safe_float(data, "A6")
    a12 = _safe_float(data, "A12")

    a8 = _safe_str(data, "A8")
    a11 = _safe_str(data, "A11")
    a13 = _safe_str(data, "A13")
    a17 = _safe_str(data, "A17")

    # 따뜻함 + 경계 경직
    if a2 >= 0.7 and a11 == "rigid":
        contradictions.append(CrossAxisPattern(
            "따뜻하면서도 방어적", "Warm yet Guarded",
            ["A2", "A11"], "모순", 0.8,
            "감정적으로 따뜻하지만 개인 영역 강하게 보호"))

    # 높은 조율 + 공격적 유머
    if a12 >= 0.7 and a17 == "aggressive":
        contradictions.append(CrossAxisPattern(
            "민감하면서도 날카로운", "Sensitive yet Sharp",
            ["A12", "A17"], "모순", 0.75,
            "타인의 감정을 잘 읽지만 유머로 상처 줌"))

    # 높은 참여 + 회피적 갈등 조절
    if a1 >= 0.7 and a8 == "avoidant":
        contradictions.append(CrossAxisPattern(
            "적극적이지만 회피적", "Engaged yet Avoidant",
            ["A1", "A8"], "모순", 0.7,
            "관계에 적극 참여하면서도 갈등 시 물러남"))

    # 높은 취약성 + 낮은 따뜻함
    if a5 >= 0.7 and a2 < 0.3:
        contradictions.append(CrossAxisPattern(
            "노출되었지만 냉담한", "Exposed yet Detached",
            ["A5", "A2"], "모순", 0.75,
            "감정적으로 노출되어 있지만 따뜻함은 없음", warning=True))

    # 높은 갈등성 + 높은 안정성
    if a3 >= 0.7 and a6 >= 0.7:
        contradictions.append(CrossAxisPattern(
            "안정적이지만 전투적", "Stable yet Combative",
            ["A3", "A6"], "모순", 0.7,
            "감정적으로 안정적이면서도 갈등 추구"))

    # 높은 권력 + 방어적 피드백
    if a4 >= 0.7 and a13 == "defensive":
        contradictions.append(CrossAxisPattern(
            "지배적이지만 비판 못 받는", "Dominant yet Fragile",
            ["A4", "A13"], "모순", 0.8,
            "통제하려 하면서 비판에 방어적", warning=True))

    # 높은 감정 조율 + 낮은 참여
    if a12 >= 0.7 and a1 < 0.3:
        contradictions.append(CrossAxisPattern(
            "조용한 공감자", "Silent Empath",
            ["A12", "A1"], "모순", 0.65,
            "감정은 잘 읽지만 참여하지 않음"))

    return contradictions


# ═══════════ 메인 탐지 함수 ═══════════

def detect_cross_axis_patterns(
    profile_data: dict[str, float | str],
    max_patterns: int = 8,
) -> list[CrossAxisPattern]:
    """모든 의미 있는 2축, 3축, 모순 패턴 탐지 후 중요도순 Top N 반환."""
    all_patterns: list[CrossAxisPattern] = []

    all_patterns.extend(_detect_2axis_patterns(profile_data))
    all_patterns.extend(_detect_3axis_patterns(profile_data))
    all_patterns.extend(detect_contradictions(profile_data))

    # 중복 제거 (같은 이름)
    seen: set[str] = set()
    unique: list[CrossAxisPattern] = []
    for p in all_patterns:
        if p.name_ko not in seen:
            seen.add(p.name_ko)
            unique.append(p)

    # 중요도순 정렬
    unique.sort(key=lambda p: p.significance, reverse=True)
    return unique[:max_patterns]


# ═══════════ 유틸리티 ═══════════

def _safe_float(data: dict, key: str, default: float = 0.5) -> float:
    v = data.get(key, default)
    return float(v) if isinstance(v, (int, float)) else default


def _safe_str(data: dict, key: str, default: str = "insufficient") -> str:
    v = data.get(key, default)
    return str(v) if isinstance(v, str) else default


def _sig(*values: float) -> float:
    """여러 값의 평균 (0-1 범위), 편차가 클수록 significance 높음."""
    avg = sum(abs(v - 0.5) for v in values) / len(values) if values else 0
    return min(1.0, 0.5 + avg)
