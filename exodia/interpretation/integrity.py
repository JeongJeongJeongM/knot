"""
EXODIA v3 — Response Integrity & Fake Data Detection.

Identifies potentially manipulated, random, or dishonest responses
in web-based assessments where users self-report.

Detection strategies:
  1. Consistency check: contradictory responses across related axes
  2. Extremity bias: all responses clustered at extremes (0-1)
  3. Central tendency: all responses suspiciously neutral (~0.5)
  4. Speed anomaly: response patterns too fast for genuine reflection
  5. Pattern repetition: identical structural dominants everywhere
  6. Statistical improbability: combinations that almost never occur naturally

Output is a confidence score (0-1) for data integrity,
plus specific flags for each detected anomaly.
"""

from __future__ import annotations
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Tuple
import statistics
import math


# ─── Data Structures ────────────────────────────────────────────

@dataclass
class IntegrityFlag:
    """A single integrity violation flag."""
    flag_id: str
    flag_type: str        # "consistency", "extremity", "central", "speed", "repetition", "improbable"
    severity: str         # "mild", "moderate", "severe"
    description_kr: str
    axes_involved: List[str]
    confidence: float     # 0-1, how confident we are this is fake


@dataclass
class IntegrityReport:
    """Full integrity assessment for a response set."""
    integrity_score: float = 1.0    # 0-1, where 1 = fully trustworthy
    is_suspect: bool = False        # True if integrity_score < threshold
    flags: List[IntegrityFlag] = field(default_factory=list)
    overall_assessment: str = "trustworthy"  # "trustworthy", "questionable", "suspect", "unreliable"
    summary_kr: str = ""

    @property
    def flag_count(self) -> int:
        return len(self.flags)

    def flags_by_type(self, flag_type: str) -> List[IntegrityFlag]:
        return [f for f in self.flags if f.flag_type == flag_type]


# ─── Constants ──────────────────────────────────────────────────

INTEGRITY_THRESHOLD = 0.6   # Below this = suspect
INTENSITY_AXES = ["A1", "A2", "A3", "A4", "A5", "A6"]
STRUCTURAL_AXES = ["A7", "A8", "A9", "A10", "A11", "A13", "A15", "A16", "A17"]

# Axes that should correlate positively (high A → high B or low A → low B)
_POSITIVE_CORRELATIONS = [
    ("A1", "A5"),   # engagement ↔ collaboration (usually move together)
    ("A2", "A5"),   # receptivity ↔ collaboration
]

# Axes that should correlate negatively (high A → low B)
_NEGATIVE_CORRELATIONS = [
    ("A3", "A2"),   # assertiveness vs receptivity (extreme cases)
]

# Axes that are contradictory when both extreme
_EXTREME_CONTRADICTIONS = [
    ("A1", "A8_avoidant"),    # high engagement + avoidant conflict (mild contradiction)
    ("A3", "A8_avoidant"),    # high assertiveness + avoidant conflict (strong contradiction)
    ("A6", "A9_externalized"), # high stability + externalized emotion (contradiction)
]


# ─── Helper Functions ───────────────────────────────────────────

def _v(data: Dict, key: str, default: float = 0.5) -> float:
    """Extract intensity value."""
    raw = data.get(key)
    if raw is None:
        return default
    if isinstance(raw, (int, float)):
        return float(raw)
    if isinstance(raw, dict):
        return float(raw.get("score", raw.get("value", default)))
    return default


def _dom(data: Dict, key: str) -> str:
    """Extract dominant label."""
    raw = data.get(key)
    if raw is None:
        return ""
    if isinstance(raw, dict):
        return raw.get("dominant", "")
    if isinstance(raw, str):
        return raw
    return ""


def _mix(data: Dict, key: str) -> Dict[str, float]:
    """Extract mix distribution."""
    raw = data.get(key)
    if not isinstance(raw, dict):
        return {}
    return raw.get("mix", {})


# ─── Core Detection ─────────────────────────────────────────────

def assess_integrity(
    profile_data: Dict,
    response_times: Optional[List[float]] = None,
) -> IntegrityReport:
    """
    Assess the integrity of profile response data.

    Args:
        profile_data: axis data dict (may be wrapped in 'axes')
        response_times: optional list of response times in seconds per question

    Returns:
        IntegrityReport with flags and overall score
    """
    report = IntegrityReport()

    # Unwrap 'axes' wrapper
    data = profile_data
    if "axes" in data and isinstance(data["axes"], dict):
        data = data["axes"]

    flags: List[IntegrityFlag] = []

    # Run all detectors
    flags.extend(_check_extremity_bias(data))
    flags.extend(_check_central_tendency(data))
    flags.extend(_check_consistency(data))
    flags.extend(_check_structural_repetition(data))
    flags.extend(_check_mix_uniformity(data))
    flags.extend(_check_improbable_combinations(data))

    if response_times:
        flags.extend(_check_speed_anomaly(response_times))

    report.flags = flags

    # Compute integrity score
    if not flags:
        report.integrity_score = 1.0
    else:
        # Weighted penalty
        penalty = sum(_severity_penalty(f) for f in flags)
        report.integrity_score = max(0.0, 1.0 - penalty)

    report.is_suspect = report.integrity_score < INTEGRITY_THRESHOLD
    report.overall_assessment = _score_to_assessment(report.integrity_score)
    report.summary_kr = _generate_summary(report)

    return report


# ─── Detectors ──────────────────────────────────────────────────

def _check_extremity_bias(data: Dict) -> List[IntegrityFlag]:
    """Check if too many intensity values are at extremes."""
    flags = []
    values = [_v(data, axis) for axis in INTENSITY_AXES if data.get(axis) is not None]

    if len(values) < 4:
        return flags

    extreme_count = sum(1 for v in values if v >= 0.85 or v <= 0.15)
    ratio = extreme_count / len(values)

    if ratio >= 0.8:
        flags.append(IntegrityFlag(
            flag_id="ext_001",
            flag_type="extremity",
            severity="severe",
            description_kr=(
                "대부분의 응답이 극단값에 치우쳐 있습니다. "
                "자연스러운 프로필에서는 이 정도의 극단 집중이 매우 드뭅니다."
            ),
            axes_involved=INTENSITY_AXES,
            confidence=0.85,
        ))
    elif ratio >= 0.6:
        flags.append(IntegrityFlag(
            flag_id="ext_002",
            flag_type="extremity",
            severity="moderate",
            description_kr="응답의 상당수가 극단값에 집중되어 있습니다.",
            axes_involved=INTENSITY_AXES,
            confidence=0.6,
        ))

    return flags


def _check_central_tendency(data: Dict) -> List[IntegrityFlag]:
    """Check if all values are suspiciously neutral."""
    flags = []
    values = [_v(data, axis) for axis in INTENSITY_AXES if data.get(axis) is not None]

    if len(values) < 4:
        return flags

    neutral_count = sum(1 for v in values if 0.4 <= v <= 0.6)
    ratio = neutral_count / len(values)

    if ratio >= 0.85:
        flags.append(IntegrityFlag(
            flag_id="cen_001",
            flag_type="central",
            severity="moderate",
            description_kr=(
                "거의 모든 응답이 중간값 근처에 몰려 있습니다. "
                "진지하게 응답하지 않았을 가능성이 있습니다."
            ),
            axes_involved=INTENSITY_AXES,
            confidence=0.7,
        ))

    # Also check if variance is suspiciously low
    if len(values) >= 3:
        std = statistics.stdev(values)
        if std < 0.05:
            flags.append(IntegrityFlag(
                flag_id="cen_002",
                flag_type="central",
                severity="severe",
                description_kr=(
                    "응답 간 변동이 거의 없습니다. "
                    "모든 질문에 동일하게 응답했을 가능성이 높습니다."
                ),
                axes_involved=INTENSITY_AXES,
                confidence=0.9,
            ))

    return flags


def _check_consistency(data: Dict) -> List[IntegrityFlag]:
    """Check for contradictory axis combinations."""
    flags = []

    # High assertiveness (A3) + avoidant conflict (A8)
    a3 = _v(data, "A3")
    a8 = _dom(data, "A8")
    if a3 >= 0.75 and a8 == "avoidant":
        flags.append(IntegrityFlag(
            flag_id="con_001",
            flag_type="consistency",
            severity="moderate",
            description_kr=(
                "매우 높은 자기주장과 회피적 갈등 방식이 동시에 나타나는 것은 "
                "일반적이지 않습니다. 응답 일관성을 재확인할 필요가 있습니다."
            ),
            axes_involved=["A3", "A8"],
            confidence=0.55,
        ))

    # High stability (A6) + externalized emotion regulation (A9)
    a6 = _v(data, "A6")
    a9 = _dom(data, "A9")
    if a6 >= 0.8 and a9 == "externalized":
        flags.append(IntegrityFlag(
            flag_id="con_002",
            flag_type="consistency",
            severity="moderate",
            description_kr=(
                "매우 높은 안정성과 외부 표출형 감정 조절이 동시에 나타납니다. "
                "감정을 외부로 표출하면서도 안정적인 것은 드문 조합입니다."
            ),
            axes_involved=["A6", "A9"],
            confidence=0.5,
        ))

    # Low engagement (A1) + active investor (A15)
    a1 = _v(data, "A1")
    a15 = _dom(data, "A15")
    if a1 < 0.25 and a15 == "active_investor":
        flags.append(IntegrityFlag(
            flag_id="con_003",
            flag_type="consistency",
            severity="moderate",
            description_kr=(
                "관여도가 매우 낮으면서 적극적 투자자 성향은 모순됩니다. "
                "관심 없으면서 투자하는 것은 자연스럽지 않습니다."
            ),
            axes_involved=["A1", "A15"],
            confidence=0.6,
        ))

    # High collaboration (A5) + taker (A11) with high values
    a5 = _v(data, "A5")
    a11 = _dom(data, "A11")
    if a5 >= 0.8 and a11 == "taker":
        flags.append(IntegrityFlag(
            flag_id="con_004",
            flag_type="consistency",
            severity="mild",
            description_kr=(
                "매우 높은 협력성과 '받는 쪽' 성향이 동시에 나타납니다. "
                "반드시 모순은 아니지만, 응답에 주의가 필요합니다."
            ),
            axes_involved=["A5", "A11"],
            confidence=0.4,
        ))

    return flags


def _check_structural_repetition(data: Dict) -> List[IntegrityFlag]:
    """Check if structural axes show suspicious repetition patterns."""
    flags = []

    # Get all structural dominants
    dominants = []
    for axis in STRUCTURAL_AXES:
        d = _dom(data, axis)
        if d:
            dominants.append(d)

    if len(dominants) < 5:
        return flags

    # Check if too many different axes have the same dominant
    # (unlikely since axes have different label sets)
    from collections import Counter
    counts = Counter(dominants)
    max_repeat = counts.most_common(1)[0][1] if counts else 0

    if max_repeat >= 4:
        flags.append(IntegrityFlag(
            flag_id="rep_001",
            flag_type="repetition",
            severity="moderate",
            description_kr=(
                "서로 다른 유형의 질문에서 동일한 응답 패턴이 반복됩니다. "
                "무작위 또는 무성의한 응답의 가능성이 있습니다."
            ),
            axes_involved=STRUCTURAL_AXES,
            confidence=0.6,
        ))

    return flags


def _check_mix_uniformity(data: Dict) -> List[IntegrityFlag]:
    """Check if mix distributions are suspiciously uniform."""
    flags = []
    uniform_count = 0
    total_checked = 0

    for axis in STRUCTURAL_AXES:
        mix_data = _mix(data, axis)
        if not mix_data or len(mix_data) < 2:
            continue

        total_checked += 1
        values = list(mix_data.values())

        # Check if all mix values are nearly equal (uniform distribution)
        if len(values) >= 2:
            std = statistics.stdev(values) if len(values) >= 2 else 0
            expected_uniform_val = 1.0 / len(values)
            max_dev = max(abs(v - expected_uniform_val) for v in values)

            if max_dev < 0.05:
                uniform_count += 1

    if total_checked >= 4 and uniform_count >= 3:
        flags.append(IntegrityFlag(
            flag_id="mix_001",
            flag_type="repetition",
            severity="severe",
            description_kr=(
                "여러 구조적 축에서 분포가 완전히 균등합니다. "
                "자연스러운 응답에서는 편향이 존재하는 것이 정상입니다. "
                "무작위 응답 또는 시스템 조작이 의심됩니다."
            ),
            axes_involved=STRUCTURAL_AXES,
            confidence=0.85,
        ))

    return flags


def _check_speed_anomaly(response_times: List[float]) -> List[IntegrityFlag]:
    """Check if response times indicate bot or random clicking."""
    flags = []

    if len(response_times) < 5:
        return flags

    avg_time = statistics.mean(response_times)
    min_time = min(response_times)

    # Too fast: less than 2 seconds average
    if avg_time < 2.0:
        flags.append(IntegrityFlag(
            flag_id="spd_001",
            flag_type="speed",
            severity="severe",
            description_kr=(
                "평균 응답 시간이 2초 미만입니다. "
                "질문을 읽지 않고 무작위로 클릭했을 가능성이 높습니다."
            ),
            axes_involved=[],
            confidence=0.9,
        ))
    elif avg_time < 4.0:
        flags.append(IntegrityFlag(
            flag_id="spd_002",
            flag_type="speed",
            severity="moderate",
            description_kr=(
                "평균 응답 시간이 매우 짧습니다. "
                "충분히 생각하지 않고 응답했을 수 있습니다."
            ),
            axes_involved=[],
            confidence=0.6,
        ))

    # Suspiciously uniform timing (bot-like)
    if len(response_times) >= 5:
        std_time = statistics.stdev(response_times)
        if std_time < 0.3 and avg_time < 5.0:
            flags.append(IntegrityFlag(
                flag_id="spd_003",
                flag_type="speed",
                severity="severe",
                description_kr=(
                    "응답 시간이 기계적으로 일정합니다. "
                    "자동 응답 프로그램 사용이 의심됩니다."
                ),
                axes_involved=[],
                confidence=0.85,
            ))

    return flags


def _check_improbable_combinations(data: Dict) -> List[IntegrityFlag]:
    """Check for statistically improbable axis combinations."""
    flags = []

    values = [_v(data, axis) for axis in INTENSITY_AXES if data.get(axis) is not None]
    if len(values) < 4:
        return flags

    # All values above 0.8 (everything high) is extremely rare naturally
    all_high = all(v >= 0.8 for v in values)
    if all_high:
        flags.append(IntegrityFlag(
            flag_id="imp_001",
            flag_type="improbable",
            severity="moderate",
            description_kr=(
                "모든 강도축이 높은 값을 보입니다. "
                "사회적 바람직성 편향(자신을 좋게 보이려는 경향)이 의심됩니다."
            ),
            axes_involved=INTENSITY_AXES,
            confidence=0.65,
        ))

    # All values below 0.2 (everything low) is also extremely rare
    all_low = all(v <= 0.2 for v in values)
    if all_low:
        flags.append(IntegrityFlag(
            flag_id="imp_002",
            flag_type="improbable",
            severity="moderate",
            description_kr=(
                "모든 강도축이 낮은 값을 보입니다. "
                "의도적 부정응답이 의심됩니다."
            ),
            axes_involved=INTENSITY_AXES,
            confidence=0.65,
        ))

    return flags


# ─── Scoring ────────────────────────────────────────────────────

_SEVERITY_PENALTIES = {
    "severe": 0.25,
    "moderate": 0.12,
    "mild": 0.05,
}


def _severity_penalty(flag: IntegrityFlag) -> float:
    """Compute integrity score penalty for a flag."""
    base = _SEVERITY_PENALTIES.get(flag.severity, 0.05)
    return base * flag.confidence


def _score_to_assessment(score: float) -> str:
    """Convert integrity score to assessment label."""
    if score >= 0.85:
        return "trustworthy"
    elif score >= 0.6:
        return "questionable"
    elif score >= 0.35:
        return "suspect"
    else:
        return "unreliable"


def _generate_summary(report: IntegrityReport) -> str:
    """Generate Korean summary."""
    if not report.flags:
        return "응답 데이터의 일관성과 신뢰성이 양호합니다."

    if report.overall_assessment == "unreliable":
        return "응답 데이터의 신뢰성이 매우 낮습니다. 재검사를 권장합니다."
    elif report.overall_assessment == "suspect":
        return "응답 데이터에 의심스러운 패턴이 다수 발견되었습니다. 결과 해석에 주의가 필요합니다."
    elif report.overall_assessment == "questionable":
        return "일부 응답에서 일관성 문제가 감지되었습니다. 참고 수준으로 활용하세요."
    else:
        return "응답 데이터가 대체로 신뢰할 수 있습니다."
