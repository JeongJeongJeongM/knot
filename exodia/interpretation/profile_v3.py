"""
EXODIA v3 — Profile Interpretation Generator.

Generates structured LLM prompts for the v3 interpretation framework:
- Individual: 7 sections (첫인상, 작동원리, 균열, 맥락별 얼굴, 시뮬레이션, 무의식, 성장 방향)
- Matching: 6 sections (첫 만남, 끌림의 구조, 충돌 지점, 관계의 함정, 서로에게 필요한 것, 관계의 가능성)

Each section: summary (2-3 sentences) + detail (3-4 subsections)
Tone: Essay/column style. No engine terms (axis numbers, scores, bands) in output.
"""

from __future__ import annotations
from typing import Any, Dict, List, Optional

from exodia.interpretation.identity import (
    Identity,
    MatchIdentity,
    generate_identity,
    generate_match_identity,
)
from exodia.interpretation.labels import extract_profile_data, generate_label
from exodia.interpretation.patterns import detect_cross_axis_patterns, detect_contradictions
from exodia.interpretation.differentiation import calculate_differentiation_score


# ─── Section Structure Definitions ───────────────────────────────

INDIVIDUAL_SECTIONS = [
    {
        "key": "first_impression",
        "title": "첫인상",
        "subsections": ["에너지 유형", "대인 시그널", "오해받기 쉬운 지점"],
    },
    {
        "key": "mechanism",
        "title": "작동원리",
        "subsections": ["핵심 동기", "방어 전략", "의사결정 구조"],
    },
    {
        "key": "crack",
        "title": "균열",
        "subsections": ["주요 모순", "파급 효과", "본인의 자각 수준"],
    },
    {
        "key": "contextual_faces",
        "title": "맥락별 얼굴",
        "subsections": ["혼자일 때", "친밀한 관계에서", "집단 속에서"],
    },
    {
        "key": "simulation",
        "title": "시뮬레이션",
        "subsections": ["배신당했을 때", "사랑에 빠졌을 때", "권력을 쥐었을 때", "실패했을 때"],
    },
    {
        "key": "unconscious",
        "title": "무의식",
        "subsections": ["반복 패턴", "회피하는 감정", "인정하지 않는 욕구"],
    },
    {
        "key": "growth",
        "title": "성장 방향",
        "subsections": ["현재 정체 지점", "성장 조건", "가능성의 범위"],
    },
]

MATCHING_SECTIONS = [
    {
        "key": "first_meeting",
        "title": "첫 만남",
        "subsections": ["서로에게 읽히는 첫 신호", "초반 역학"],
    },
    {
        "key": "attraction",
        "title": "끌림의 구조",
        "subsections": ["A가 상대에게서 보는 것", "B가 상대에게서 보는 것"],
    },
    {
        "key": "collision",
        "title": "충돌 지점",
        "subsections": ["거리 조절 전쟁", "싸우는 방식의 충돌", "지뢰밭"],
    },
    {
        "key": "trap",
        "title": "관계의 함정",
        "subsections": ["추격-도주의 고착", "역할 고정"],
    },
    {
        "key": "needs",
        "title": "서로에게 필요한 것",
        "subsections": ["A가 이 관계에서 얻을 수 있는 것", "B가 이 관계에서 얻을 수 있는 것"],
    },
    {
        "key": "possibility",
        "title": "이 관계의 가능성",
        "subsections": ["최선의 시나리오", "최악의 시나리오", "이 관계를 유지하려면"],
    },
]


# ─── System Prompt ───────────────────────────────────────────────

_SYSTEM_PROMPT_INDIVIDUAL = """당신은 행동 심리 분석 전문가입니다. 주어진 분석 데이터를 바탕으로 한 사람의 심리 프로필을 에세이/칼럼 톤으로 작성합니다.

핵심 규칙:
1. 엔진 용어 금지: 축 번호(A1, A7 등), 수치(0.82, 65% 등), 밴드(very_high 등), 기술 용어를 절대 사용하지 마세요.
2. 자연스러운 한국어: 번역체("~를 의미한다", "~에 가깝다" 반복)를 피하고, 칼럼니스트가 쓴 글처럼 자연스럽게 쓰세요.
3. 구체적 행동 묘사: 추상적 설명 대신 "밤에 잠이 안 오거나", "갑자기 말수가 줄거나" 같은 구체적 장면으로 보여주세요.
4. 각 섹션마다: summary (2-3문장 요약) + subsections (각 200-400자 상세)

문체 예시 (이 톤을 유지):
- "이 사람이 있으면 공기가 좀 달라진다."
- "근데 이건 지배하고 싶어서가 아니다. 불안해서다."
- "겉과 속이 극단적으로 다르다."
"""

_SYSTEM_PROMPT_MATCHING = """당신은 관계 역학 분석 전문가입니다. 두 사람의 분석 데이터를 바탕으로 관계 프로파일링을 에세이/칼럼 톤으로 작성합니다.

핵심 규칙:
1. 엔진 용어 금지: 축 번호, 수치, 밴드, 기술 용어를 절대 사용하지 마세요.
2. 자연스러운 한국어: 번역체를 피하고 칼럼 톤으로.
3. 관계 역학 중심: 개인 분석이 아니라 "둘 사이에서 무슨 일이 벌어지는지"에 집중.
4. 각 섹션마다: summary (2-3문장) + subsections (각 200-400자)
5. 판단이 아닌 관찰: "위험하다"가 아니라 "이런 패턴이 반복될 수 있다."

문체 예시:
- "이 사람한테 배신은 상처이기 전에 버그다."
- "좋아하니까 무서운 거고, 무서우니까 공격하는 거다."
"""


# ─── Prompt Builders ─────────────────────────────────────────────

def _describe_profile_for_prompt(profile_data: Dict) -> str:
    """
    Convert profile data into natural language description for LLM prompt.
    Uses descriptive words, not raw numbers.
    """
    from exodia.interpretation.vocabulary import (
        get_intensity_band, get_intensity_word,
        get_structural_word, AXIS_WEIGHTS,
    )

    lines = []

    intensity_axes = {
        "A1": "정서 강도", "A2": "정서 안정성", "A3": "감정 표현",
        "A4": "자기 확신", "A5": "사회적 주도성", "A6": "권위 수용",
        "A12": "친밀감 편안함", "A14": "변화 수용성",
    }

    structural_axes = {
        "A7": "갈등 반응", "A8": "유머 스타일", "A9": "애착 유형",
        "A10": "의사결정", "A11": "스트레스 반응", "A13": "인정 욕구 방향",
        "A15": "공감 방식", "A16": "자기개방 수준", "A17": "경계 설정",
    }

    for axis, name in intensity_axes.items():
        val = profile_data.get(axis)
        if val is None:
            continue
        if isinstance(val, dict):
            val = val.get("value", 0.5)
        band = get_intensity_band(float(val))
        word = get_intensity_word(axis, float(val))
        lines.append(f"- {name}: {word} ({band})")

    for axis, name in structural_axes.items():
        val = profile_data.get(axis)
        if val is None or not isinstance(val, dict):
            continue
        dominant = val.get("dominant", "")
        mix = val.get("mix", {})
        word = get_structural_word(axis, dominant)
        mix_str = ", ".join(f"{k} {int(v*100)}%" for k, v in sorted(mix.items(), key=lambda x: -x[1]))
        lines.append(f"- {name}: {word} (주: {dominant}, 분포: {mix_str})")

    return "\n".join(lines)


def generate_individual_prompt(profile_data: Dict, l3_output: Any = None) -> Dict:
    """
    Generate LLM prompt package for v3 individual profile interpretation.

    Returns:
        {
            "system_prompt": str,
            "user_prompt": str,
            "identity": Identity,
            "sections": list of section defs,
            "rarity_data": dict,
            "metadata": dict
        }
    """
    # Extract data if L3Output object
    if l3_output is not None:
        data = extract_profile_data(l3_output)
    else:
        data = profile_data

    # Generate components
    identity = generate_identity(data)
    label_result = generate_label(data)
    patterns = detect_cross_axis_patterns(data)
    contradictions = detect_contradictions(data)
    diff_score = calculate_differentiation_score(data)
    profile_desc = _describe_profile_for_prompt(data)

    # Build pattern descriptions
    pattern_lines = []
    for p in patterns[:6]:
        pattern_lines.append(f"- {p.name_ko}: {p.description}")

    contradiction_lines = []
    for c in contradictions:
        contradiction_lines.append(f"- {c.name_ko}: {c.description}")

    # Build user prompt
    user_prompt = f"""다음 분석 데이터를 바탕으로 개인 심리 프로필을 작성해주세요.

## 프로필 요약
정체성: {identity.name} ({identity.tagline})
희소성 점수: {diff_score['score']}점 / 100점
희소성 해석: {diff_score['interpretation']}

## 특성 데이터
{profile_desc}

## 발견된 패턴
{chr(10).join(pattern_lines) if pattern_lines else "특이 패턴 없음"}

## 발견된 내적 모순
{chr(10).join(contradiction_lines) if contradiction_lines else "뚜렷한 모순 없음"}

## 작성할 구조
아래 7개 섹션 각각에 대해 작성하세요:
"""

    for i, section in enumerate(INDIVIDUAL_SECTIONS):
        user_prompt += f"\n### {i+1}. {section['title']}\n"
        user_prompt += f"- summary: 2-3문장 요약\n"
        for sub in section["subsections"]:
            user_prompt += f"- {sub}: 200-400자 상세 서술\n"

    user_prompt += """
## 중요 규칙
- 엔진 축 번호(A1, A7 등), 수치(0.82 등), 밴드 이름 절대 사용 금지
- 자연스러운 에세이/칼럼 톤 (번역체 금지)
- 구체적인 행동/상황 묘사 위주
- JSON 형식으로 출력: {"sections": [{"key": "...", "title": "...", "summary": "...", "subsections": [{"title": "...", "content": "..."}]}]}
"""

    return {
        "system_prompt": _SYSTEM_PROMPT_INDIVIDUAL,
        "user_prompt": user_prompt,
        "identity": identity,
        "sections": INDIVIDUAL_SECTIONS,
        "rarity_data": {
            "score": diff_score["score"],
            "interpretation": diff_score["interpretation"],
            "rarity_pct": max(1.0, 100 - diff_score["score"]) / 10,  # rough estimate
        },
        "metadata": {
            "label": label_result.get("full_label", ""),
            "pattern_count": len(patterns),
            "contradiction_count": len(contradictions),
        },
    }


def generate_matching_prompt(
    profile_a: Dict, profile_b: Dict,
    identity_a: Optional[Identity] = None,
    identity_b: Optional[Identity] = None,
) -> Dict:
    """
    Generate LLM prompt package for v3 matching profile interpretation.

    Returns:
        {
            "system_prompt": str,
            "user_prompt": str,
            "match_identity": MatchIdentity,
            "sections": list of section defs,
            "metadata": dict
        }
    """
    if identity_a is None:
        identity_a = generate_identity(profile_a)
    if identity_b is None:
        identity_b = generate_identity(profile_b)

    match_identity = generate_match_identity(profile_a, profile_b, identity_a, identity_b)

    desc_a = _describe_profile_for_prompt(profile_a)
    desc_b = _describe_profile_for_prompt(profile_b)

    patterns_a = detect_cross_axis_patterns(profile_a)
    patterns_b = detect_cross_axis_patterns(profile_b)
    contradictions_a = detect_contradictions(profile_a)
    contradictions_b = detect_contradictions(profile_b)

    user_prompt = f"""다음 두 사람의 분석 데이터를 바탕으로 관계 프로파일링을 작성해주세요.

## Person A: {identity_a.name} ({identity_a.tagline})
{desc_a}

주요 패턴: {', '.join(p.name_ko for p in patterns_a[:3]) if patterns_a else '없음'}
내적 모순: {', '.join(c.name_ko for c in contradictions_a[:2]) if contradictions_a else '없음'}

## Person B: {identity_b.name} ({identity_b.tagline})
{desc_b}

주요 패턴: {', '.join(p.name_ko for p in patterns_b[:3]) if patterns_b else '없음'}
내적 모순: {', '.join(c.name_ko for c in contradictions_b[:2]) if contradictions_b else '없음'}

## 관계 요약
관계 이름: {match_identity.name} ({match_identity.tagline})
호환성: {match_identity.compatibility}%
긴장도: {match_identity.tension}
성장 가능성: {match_identity.growth}

## 작성할 구조
아래 6개 섹션 각각에 대해 작성하세요:
"""

    for i, section in enumerate(MATCHING_SECTIONS):
        user_prompt += f"\n### {i+1}. {section['title']}\n"
        user_prompt += f"- summary: 2-3문장 요약\n"
        for sub in section["subsections"]:
            sub_title = sub.replace("A가", f"{identity_a.name}이/가").replace("B가", f"{identity_b.name}이/가")
            user_prompt += f"- {sub_title}: 200-400자 상세 서술\n"

    user_prompt += """
## 중요 규칙
- 엔진 축 번호, 수치, 밴드 이름 절대 사용 금지
- 에세이/칼럼 톤 (번역체 금지)
- "위험하다" 대신 "이런 패턴이 반복될 수 있다" 식으로 관찰적 서술
- JSON 형식으로 출력: {"sections": [{"key": "...", "title": "...", "summary": "...", "subsections": [{"title": "...", "content": "..."}]}]}
"""

    return {
        "system_prompt": _SYSTEM_PROMPT_MATCHING,
        "user_prompt": user_prompt,
        "match_identity": match_identity,
        "identity_a": identity_a,
        "identity_b": identity_b,
        "sections": MATCHING_SECTIONS,
        "metadata": {
            "compatibility": match_identity.compatibility,
            "tension": match_identity.tension,
            "growth": match_identity.growth,
        },
    }
