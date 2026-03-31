"""
EXODIA v2 — 4-Layer Profile Generator.
Layer 0: 한 줄 라벨
Layer 1: 3줄 핵심 요약
Layer 2: 상세 프로필 (~500단어)
Layer 3: 완전 리포트 (~3000단어)

Layer 0-1: 결정론적 (LLM 불필요).
Layer 2-3: LLM 프롬프트 생성 (외부 호출은 caller 책임).
"""

from __future__ import annotations

from typing import Any

from exodia.interpretation.labels import generate_label, extract_profile_data
from exodia.interpretation.patterns import (
    CrossAxisPattern,
    detect_cross_axis_patterns,
)
from exodia.interpretation.differentiation import calculate_differentiation_score
from exodia.interpretation.vocabulary import (
    get_intensity_band,
    get_intensity_word,
    get_structural_word,
    INTENSITY_VOCAB,
    STRUCTURAL_VOCAB,
)


# ═══════════ Layer 0: 한 줄 라벨 ═══════════

def generate_layer0(profile_data: dict[str, float | str]) -> str:
    """Layer 0: "[핵심특성] | [관계방식] [— 변조요인]"."""
    result = generate_label(profile_data)
    return result["label"]


# ═══════════ Layer 1: 3줄 핵심 요약 ═══════════

def generate_layer1(profile_data: dict[str, float | str]) -> str:
    """Layer 1: 라벨 + 심리학적 기본 특성 + 관계 행동 방식."""
    label_result = generate_label(profile_data)
    label = label_result["label"]

    # 주요 축 값 추출
    a1 = _sf(profile_data, "A1")
    a2 = _sf(profile_data, "A2")
    a3 = _sf(profile_data, "A3")
    a4 = _sf(profile_data, "A4")
    a7 = profile_data.get("A7", "balanced")
    a8 = profile_data.get("A8", "collaborative")

    # 문장 2: 심리학적 기본 특성
    traits = []
    if a1 >= 0.6:
        traits.append("자신이 관심 있는 영역에 적극적으로 관여하며")
    elif a1 < 0.4:
        traits.append("선별적으로 관여하고 대부분은 관찰자 위치를 선호하며")

    if a2 >= 0.6:
        traits.append("감정 표현이 풍부하고 타인에 대한 배려가 두드러진다")
    elif a2 < 0.4:
        traits.append("감정 표현을 절제하고 효율성을 우선시한다")
    else:
        traits.append("감정과 이성의 균형을 유지한다")

    if a3 >= 0.6:
        traits.append("갈등을 회피하지 않고 자신의 의견을 분명히 한다")
    elif a3 < 0.4:
        traits.append("조화를 추구하며 갈등을 최소화하려 한다")

    if a4 >= 0.6:
        traits.append("영향력과 주도권을 자연스럽게 추구한다")
    elif a4 < 0.4:
        traits.append("권력보다는 동등한 관계를 선호한다")

    line2 = f"이 사람은 {'. '.join(traits[:2])}."

    # 문장 3: 관계 행동
    rel_parts = []
    if a7 == "initiator":
        rel_parts.append("관계에서 주도적으로 방향을 설정하고")
    elif a7 == "responder":
        rel_parts.append("관계에서 상대방의 리드를 따르며")
    else:
        rel_parts.append("관계에서 상황에 따라 유연하게 대응하고")

    if a8 == "confrontational":
        rel_parts.append("문제가 생기면 직접 대면하여 해결하려 한다")
    elif a8 == "avoidant":
        rel_parts.append("갈등 상황에서는 일단 물러나 시간을 둔다")
    elif a8 == "collaborative":
        rel_parts.append("갈등 시 함께 해결책을 찾으려 한다")
    else:
        rel_parts.append("상대방에게 맞춰주며 양보하는 편이다")

    line3 = ", ".join(rel_parts) + "."

    return f"{label}\n\n{line2}\n\n{line3}"


# ═══════════ Layer 2: LLM 프롬프트 생성 ═══════════

def generate_layer2_prompt(profile_data: dict[str, float | str]) -> dict[str, Any]:
    """Layer 2용 LLM 프롬프트 및 입력 데이터 패키지 반환.

    Returns:
        {
            "system_prompt": str,
            "user_prompt": str,
            "profile_data": dict,
            "label": str,
            "cross_axis_patterns": list,
            "differentiation": dict,
        }
    """
    label_result = generate_label(profile_data)
    patterns = detect_cross_axis_patterns(profile_data)
    diff_score = calculate_differentiation_score(profile_data)

    patterns_serialized = [
        {
            "name_ko": p.name_ko,
            "name_en": p.name_en,
            "axes": p.axes,
            "description": p.description,
            "warning": p.warning,
        }
        for p in patterns
    ]

    system_prompt = _SYSTEM_PROMPT

    user_prompt = f"""다음 17축 프로필 데이터를 바탕으로 약 500단어의 상세 심리 프로필을 작성하시오.

프로필 데이터:
{_format_profile_json(profile_data)}

라벨: {label_result['label']}
특이축: {label_result['signature_axes']}
차별성 점수: {diff_score['total_score']}점 ({diff_score['interpretation'][:20]}...)

교차축 패턴:
{_format_patterns(patterns)}

구조:

### {label_result['label']} - 프로필 개요

#### I. 기본 심리학적 특성 (약 150단어)
각 주요 축(A1, A2, A3, A4, A6)을 분석하되:
- 축의 값이 무엇을 의미하는지 명확히
- 축들 사이의 상호작용 강조
- 구체적 일상 예시 포함

#### II. 관계 패턴 (약 150단어)
- 초기 만남에서의 행동
- 깊어지는 관계에서의 변화
- 갈등 상황에서의 전형적 반응
- 신뢰 구축 방식

#### III. 두드러진 특징 3-4가지 (약 100단어)
- 특이축이 드러내는 구체적 특징

#### IV. 기본 욕구와 두려움 (약 80단어)
- Autonomy, Competence, Relatedness 중 우선순위
- 방어기제

#### V. 특화 패턴 (약 100단어)
- 전달된 cross_axis_patterns 설명

요구사항:
1. 임상심리학적 정확성 유지
2. 모순과 긴장을 자연스럽게 언급
3. 구체적 예시 포함
4. 비판 없이 이해의 깊이 전달
5. 한국어로 작성"""

    return {
        "system_prompt": system_prompt,
        "user_prompt": user_prompt,
        "profile_data": profile_data,
        "label": label_result["label"],
        "cross_axis_patterns": patterns_serialized,
        "differentiation": diff_score,
    }


# ═══════════ Layer 3: 완전 리포트 프롬프트 ═══════════

def generate_layer3_prompt(profile_data: dict[str, float | str]) -> dict[str, Any]:
    """Layer 3용 LLM 프롬프트 및 입력 데이터 패키지 반환."""
    label_result = generate_label(profile_data)
    patterns = detect_cross_axis_patterns(profile_data, max_patterns=12)
    diff_score = calculate_differentiation_score(profile_data)

    patterns_serialized = [
        {
            "name_ko": p.name_ko,
            "name_en": p.name_en,
            "axes": p.axes,
            "description": p.description,
            "warning": p.warning,
        }
        for p in patterns
    ]

    system_prompt = _SYSTEM_PROMPT

    user_prompt = f"""다음 17축 데이터의 완전 심리 평가 보고서를 작성하시오.

프로필 데이터:
{_format_profile_json(profile_data)}

라벨: {label_result['label']}
특이축: {label_result['signature_axes']}
차별성 점수: {diff_score['total_score']}점
해석: {diff_score['interpretation']}

교차축 패턴:
{_format_patterns(patterns)}

희귀 조합:
{diff_score['rare_combinations']}

모순:
{diff_score['contradictions']}

구조:

## {label_result['label']} - 완전 심리 평가 보고서

### 프로필 특이성 점수: {diff_score['total_score']}점

### A. 17축 완전 분석
각 축마다:
- 현재 값과 인구집단 비교
- 심리학적 의미 (100단어)
- 일상의 예 (50단어)
- 강점 (50단어)
- 약점 (50단어)
- 발전 (30단어)

### B. 교차축 분석
입력된 모든 cross_axis_patterns 설명

### C. 상황별 예측 분석
1. 업무/학업 환경
2. 친밀한 관계
3. 갈등 상황
4. 압박 상황
5. 변화/실패 상황

### D. 심리적 성장 영역
우선순위별 6-8개

### E. 관계별 최적 파트너 프로필
최고 호환성 / 높은 호환성 / 위험 조합

### F. 대표 행동 시나리오 (5-7개)
각: 상황 설정 → 반응 → 심리학 → 결과

### G. 통합 결론

요구사항:
1. 매우 구체적, 일반화 피하기
2. 모순 강조: "이 사람은 X이지만 동시에 Y"
3. 증거 기반
4. 비판 없음
5. 성장 가능성 암시
6. 단어 수: 3000-3500
7. 한국어로 작성

톤: 진지하되 인간적. 경험 많은 임상 심리사가 수 개월 면담 후 작성하는 보고서."""

    return {
        "system_prompt": system_prompt,
        "user_prompt": user_prompt,
        "profile_data": profile_data,
        "label": label_result["label"],
        "cross_axis_patterns": patterns_serialized,
        "differentiation": diff_score,
    }


# ═══════════ 통합 프로필 생성 ═══════════

def generate_profile(
    profile_data: dict[str, float | str] | None = None,
    *,
    l3_output: Any = None,
    layer: int = 1,
) -> dict[str, Any]:
    """지정된 레이어까지의 프로필 생성.

    Args:
        profile_data: {축: 값} 딕셔너리.
        l3_output: L3Output 객체 (선택). 주어지면 profile_data 자동 추출.
        layer: 0-3. 생성할 최대 레이어.

    Returns:
        {
            "layer0": str (라벨),
            "layer1": str (3줄, layer>=1),
            "layer2_prompt": dict (LLM 프롬프트, layer>=2),
            "layer3_prompt": dict (LLM 프롬프트, layer>=3),
            "label_data": dict (라벨 생성 메타데이터),
            "patterns": list (교차축 패턴),
            "differentiation": dict (차별성 점수),
        }
    """
    if l3_output is not None:
        profile_data = extract_profile_data(l3_output)

    if not profile_data:
        return {"error": "프로필 데이터 없음"}

    result: dict[str, Any] = {}

    # Layer 0: 항상 생성
    label_data = generate_label(profile_data)
    result["layer0"] = label_data["label"]
    result["label_data"] = label_data

    # 공통 데이터
    patterns = detect_cross_axis_patterns(profile_data)
    diff = calculate_differentiation_score(profile_data)
    result["patterns"] = [
        {
            "name_ko": p.name_ko,
            "name_en": p.name_en,
            "axes": p.axes,
            "type": p.pattern_type,
            "significance": p.significance,
            "description": p.description,
            "warning": p.warning,
        }
        for p in patterns
    ]
    result["differentiation"] = diff

    # Layer 1
    if layer >= 1:
        result["layer1"] = generate_layer1(profile_data)

    # Layer 2
    if layer >= 2:
        result["layer2_prompt"] = generate_layer2_prompt(profile_data)

    # Layer 3
    if layer >= 3:
        result["layer3_prompt"] = generate_layer3_prompt(profile_data)

    return result


# ═══════════ 내부 유틸리티 ═══════════

_SYSTEM_PROMPT = """당신은 임상심리학적 이해도 높은 심리 평가 전문가이다.

당신의 역할:
- 17축 연속 데이터를 심리학적 내러티브로 변환
- 과학적 정확성과 인간적 통찰의 균형
- 진단적이되 낙인(stigma) 피하기
- 깊이감: 모순, 긴장, 그리고 그 속의 의미 찾기

톤 가이드라인:
- 전문적이되 접근 가능한 (clinical but not jargon-heavy)
- 객관적이되 인간적 (objective but human-centered)
- 긍정적이되 진실된 (affirming but honest)
- 판단하지 않되 명확함 (non-judgmental but clear)

절대 하지 말아야 할 것:
- 도덕적 판단 ("좋은 사람" "나쁜 사람")
- 고정된 진단명 ("ADHD처럼", "성격장애처럼")
- 과잉 해석 (데이터 없이 추측하기)
- 일반화 (이 패턴이면 반드시 이렇다는 식)
- 거만한 톤 (마치 이 사람을 다 안다는 식)

핵심 원칙:
- 이 사람의 프로필은 현재의 스냅샷이지 영구적 정체성 아님
- 모든 극단값에는 문맥과 의미가 있음
- 모순은 약점이 아니라 복잡함
- 성장은 항상 가능"""


def _sf(data: dict, key: str, default: float = 0.5) -> float:
    v = data.get(key, default)
    return float(v) if isinstance(v, (int, float)) else default


def _format_profile_json(data: dict[str, float | str]) -> str:
    lines = []
    axis_names = {
        "A1": "Engagement", "A2": "Warmth", "A3": "Conflict",
        "A4": "Power", "A5": "Vulnerability", "A6": "Stability",
        "A7": "Orientation", "A8": "Conflict Regulation",
        "A9": "Disclosure", "A10": "Influence", "A11": "Boundary",
        "A12": "Attunement", "A13": "Feedback Response",
        "A14": "Conflict Resolution", "A15": "Investment",
        "A16": "Cognition", "A17": "Humor",
    }
    for key in sorted(data.keys(), key=lambda k: int(k[1:])):
        name = axis_names.get(key, key)
        val = data[key]
        lines.append(f"  {key} ({name}): {val}")
    return "\n".join(lines)


def _format_patterns(patterns: list) -> str:
    lines = []
    for p in patterns:
        if hasattr(p, "name_ko"):
            warn = " ⚠️" if p.warning else ""
            lines.append(f"  - {p.name_ko} ({p.name_en}){warn}: {p.description} [{', '.join(p.axes)}]")
        elif isinstance(p, dict):
            warn = " ⚠️" if p.get("warning") else ""
            lines.append(f"  - {p['name_ko']} ({p['name_en']}){warn}: {p['description']} [{', '.join(p['axes'])}]")
    return "\n".join(lines) if lines else "  (없음)"
