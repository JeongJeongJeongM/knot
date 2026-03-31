"""
EXODIA v2 — 동적 복합 라벨 생성기 (Dynamic Composite Label Generator).
"[핵심특성] | [관계방식] [— 변조요인]" 형식의 한 줄 라벨 생성.
"""

from __future__ import annotations

from typing import Any

from exodia.interpretation.vocabulary import (
    AXIS_WEIGHTS,
    get_intensity_band,
    get_intensity_word,
    get_structural_word,
)


# ═══════════ 통합 프로필 데이터 추출 ═══════════

def extract_profile_data(l3_output: Any) -> dict[str, float | str]:
    """L3Output에서 해석에 필요한 {축: 값} 딕셔너리 추출.

    IntensityAxis → float(score), StructuralAxis → str(dominant).
    """
    data: dict[str, float | str] = {}

    if l3_output.intensity_axes:
        for key, axis in l3_output.intensity_axes.items():
            data[key] = axis.score

    if l3_output.structural_axes:
        for key, axis in l3_output.structural_axes.items():
            data[key] = axis.dominant

    return data


# ═══════════ 특이축 추출 ═══════════

def get_signature_axes(
    profile_data: dict[str, float | str],
    n: int = 4,
    population_mean: float = 0.5,
) -> list[tuple[str, float]]:
    """모집단 평균에서 가장 벗어난 n개 축을 (축이름, distinctive_score) 튜플로 반환.

    강도축(float)은 |value - mean| * weight,
    구조축(str)은 고정 0.5 (구조축은 항상 의미 있다고 가정).
    """
    scores: list[tuple[str, float]] = []

    for axis_name, value in profile_data.items():
        weight = AXIS_WEIGHTS.get(axis_name, 0.5)
        if isinstance(value, (int, float)):
            deviation = abs(value - population_mean) * (1 + weight)
        else:
            # 구조축: dominant가 "insufficient"면 0, 아니면 0.5 * weight
            deviation = 0.0 if value == "insufficient" else 0.5 * (1 + weight)
        scores.append((axis_name, deviation))

    scores.sort(key=lambda x: x[1], reverse=True)
    return scores[:n]


# ═══════════ Part A: 핵심특성 생성 ═══════════

# A1(Engagement), A3(Conflict), A4(Power), A6(Stability) 조합

_CORE_IDENTITY_MAP: dict[tuple[str, str, str, str], str] = {
    ("high", "low", "high", "high"):   "자신감있는·지배적",
    ("high", "low", "high", "low"):    "야심적·변동성있는",
    ("high", "high", "high", "high"):  "강렬하고·지배적",
    ("high", "high", "low", "high"):   "도전적·평등지향적",
    ("low", "low", "high", "high"):    "자신감있는·절제적",
    ("low", "low", "low", "high"):     "평온한·겸손한",
    ("high", "low", "low", "high"):    "적극적·겸손한",
    ("low", "high", "low", "low"):     "불안정한·격렬한",
    ("high", "high", "high", "low"):   "격렬하면서·지배적",
    ("high", "high", "low", "low"):    "격렬하면서·감정적",
    ("low", "low", "low", "low"):      "조용한·수용적",
    ("low", "high", "high", "high"):   "절제적이지만·지배적",
    ("low", "high", "high", "low"):    "반항적·불안정한",
    ("low", "low", "high", "low"):     "야심적·불안정한",
    ("low", "high", "low", "high"):    "강건한·도전적",
    ("high", "low", "low", "low"):     "적극적·불안정한",
}


def _to_hl(value: float) -> str:
    """0-1 값을 'high'/'low'로 단순화 (0.5 기준)."""
    return "high" if value >= 0.5 else "low"


def _generate_core_identity(
    a1: float, a3: float, a4: float, a6: float,
    used_words: set[str],
) -> str:
    """Part A: 핵심특성 한국어 라벨 생성."""
    key = (_to_hl(a1), _to_hl(a3), _to_hl(a4), _to_hl(a6))
    label = _CORE_IDENTITY_MAP.get(key)
    if label:
        return label

    # 매트릭스에 없는 조합 → 가장 극단적인 2축에서 어휘 조합
    axes = [("A1", a1), ("A3", a3), ("A4", a4), ("A6", a6)]
    axes.sort(key=lambda x: abs(x[1] - 0.5), reverse=True)

    words = []
    for axis_name, val in axes[:2]:
        word = get_intensity_word(axis_name, val, exclude=used_words)
        if word:
            words.append(word)
            used_words.add(word)

    return "·".join(words) if words else "복합적"


# ═══════════ Part B: 관계방식 생성 ═══════════

# A7(Orientation), A8(Conflict Reg), A10(Influence), A12(Attunement) 조합

_RELATIONAL_MAP: dict[tuple[str, str, str, str], str] = {
    ("initiator", "confrontational", "logical", "low"):      "직설적·주도적",
    ("initiator", "confrontational", "logical", "high"):     "분석적·주도적",
    ("responder", "collaborative", "emotional", "high"):     "민감하고·협력적",
    ("responder", "collaborative", "emotional", "low"):      "조용히·협력적",
    ("balanced", "avoidant", "positional", "mid"):           "신중하고·거리감있는",
    ("initiator", "collaborative", "logical", "high"):       "통찰적·주도적",
    ("initiator", "collaborative", "emotional", "high"):     "공감적·주도적",
    ("responder", "avoidant", "logical", "low"):             "분석적·수동적",
    ("responder", "confrontational", "emotional", "high"):   "격렬하고·민감한",
    ("balanced", "collaborative", "collaborative", "high"):  "유연하고·협력적",
    ("balanced", "collaborative", "logical", "mid"):         "균형잡힌·논리적",
}


def _a12_band(a12: float) -> str:
    """A12(Attunement)를 low/mid/high로 단순화."""
    if a12 < 0.35:
        return "low"
    elif a12 < 0.65:
        return "mid"
    else:
        return "high"


def _generate_relational_pattern(
    a7: str, a8: str, a10: str, a12: float,
    used_words: set[str],
) -> str:
    """Part B: 관계방식 한국어 라벨 생성."""
    key = (a7, a8, a10, _a12_band(a12) if isinstance(a12, (int, float)) else "mid")
    label = _RELATIONAL_MAP.get(key)
    if label:
        return label

    # 매핑 없음 → 구조축 어휘에서 조합
    words = []
    for axis, dom in [("A7", a7), ("A8", a8)]:
        word = get_structural_word(axis, dom, exclude=used_words)
        if word:
            words.append(word)
            used_words.add(word)

    # A12가 극단적이면 추가
    if isinstance(a12, (int, float)):
        a12_word = get_intensity_word("A12", a12, exclude=used_words)
        if a12_word:
            words.append(a12_word)
            used_words.add(a12_word)

    return "·".join(words[:2]) if words else "복합적관계"


# ═══════════ Part C: 변조요인 생성 ═══════════

def _generate_modulation_factor(
    profile_data: dict[str, float | str],
    used_words: set[str],
) -> str | None:
    """Part C: 교차축 모순에서 변조요인 도출."""
    contradictions: list[tuple[float, str]] = []  # (강도, 라벨)

    a2 = profile_data.get("A2", 0.5)
    a3 = profile_data.get("A3", 0.5)
    a5 = profile_data.get("A5", 0.5)
    a6 = profile_data.get("A6", 0.5)
    a11 = profile_data.get("A11", "flexible")
    a12 = profile_data.get("A12", 0.5)
    a17 = profile_data.get("A17", "minimal")

    # 패턴 1: 높은 따뜻함 + 단호한 경계
    if isinstance(a2, (int, float)) and a2 > 0.7 and a11 == "rigid":
        contradictions.append((a2 + 0.3, "따뜻하면서도·경계심있는"))

    # 패턴 2: 높은 조율 + 공격적 유머
    if isinstance(a12, (int, float)) and a12 > 0.7 and a17 == "aggressive":
        contradictions.append((a12 + 0.2, "민감하면서도·예리한"))

    # 패턴 3: 공격성 + 높은 불안정성
    if isinstance(a3, (int, float)) and isinstance(a6, (int, float)):
        if a3 > 0.7 and a6 < 0.3:
            contradictions.append((a3 + (1 - a6), "폭발적이면서·불안정한"))

    # 패턴 4: 높은 취약성 + 낮은 따뜻함
    if isinstance(a5, (int, float)) and isinstance(a2, (int, float)):
        if a5 > 0.7 and a2 < 0.3:
            contradictions.append((a5 + (1 - a2), "노출된·냉담함"))

    # 패턴 5: 극단값 다수
    extreme_count = 0
    for key, val in profile_data.items():
        if isinstance(val, (int, float)) and (val < 0.15 or val > 0.85):
            extreme_count += 1
    if extreme_count >= 4:
        contradictions.append((extreme_count * 0.3, "극단적인"))

    if not contradictions:
        return None

    # 가장 강한 모순 선택
    contradictions.sort(key=lambda x: x[0], reverse=True)
    return contradictions[0][1]


# ═══════════ 라벨 생성 메인 함수 ═══════════

def generate_label(
    profile_data: dict[str, float | str],
    *,
    l3_output: Any = None,
) -> dict[str, Any]:
    """17축 프로필 데이터에서 동적 복합 라벨 생성.

    Args:
        profile_data: {축이름: float|str} 딕셔너리.
                      l3_output이 주어지면 이것에서 자동 추출.
        l3_output: L3Output 객체 (선택).

    Returns:
        {
            "label": "핵심특성 | 관계방식 [— 변조요인]",
            "core_identity": "Part A",
            "relational_pattern": "Part B",
            "modulation_factor": "Part C or None",
            "signature_axes": [(축, score), ...],
        }
    """
    if l3_output is not None:
        profile_data = extract_profile_data(l3_output)

    if not profile_data:
        return {
            "label": "데이터부족",
            "core_identity": "",
            "relational_pattern": "",
            "modulation_factor": None,
            "signature_axes": [],
        }

    # 특이축 추출
    sig_axes = get_signature_axes(profile_data)

    # 어휘 중복 방지용 집합
    used: set[str] = set()

    # Part A: 핵심특성
    a1 = float(profile_data.get("A1", 0.5))
    a3 = float(profile_data.get("A3", 0.5))
    a4 = float(profile_data.get("A4", 0.5))
    a6 = float(profile_data.get("A6", 0.5))
    core = _generate_core_identity(a1, a3, a4, a6, used)

    # Part B: 관계방식
    a7 = str(profile_data.get("A7", "balanced"))
    a8 = str(profile_data.get("A8", "collaborative"))
    a10 = str(profile_data.get("A10", "logical"))
    a12_val = profile_data.get("A12", 0.5)
    a12_f = float(a12_val) if isinstance(a12_val, (int, float)) else 0.5
    relational = _generate_relational_pattern(a7, a8, a10, a12_f, used)

    # Part C: 변조요인
    modulation = _generate_modulation_factor(profile_data, used)

    # 라벨 조립
    label = f"{core} | {relational}"
    if modulation:
        label += f" — {modulation}"

    return {
        "label": label,
        "core_identity": core,
        "relational_pattern": relational,
        "modulation_factor": modulation,
        "signature_axes": sig_axes,
    }
