"""
Drift detection for EXODIA timeseries profiles.

After a profile has converged, monitors for significant changes
that indicate real evolution (growth, regression, relationship changes)
vs. normal noise.

Uses the converged baseline as reference and flags deviations
that exceed statistical thresholds.
"""

from dataclasses import dataclass, field
from typing import Dict, List, Optional, Tuple
import statistics
import math

from exodia.interpretation.timeseries import (
    TimeseriesStore, PeriodSnapshot,
    INTENSITY_AXES, STRUCTURAL_AXES,
)
from exodia.interpretation.convergence import (
    assess_convergence, ConvergenceReport,
)


# ─── Constants ──────────────────────────────────────────────────

# Intensity drift: z-score threshold for significant change
DRIFT_Z_THRESHOLD = 2.0  # ~95% confidence it's not noise
# Structural drift: dominant must change for this many periods
STRUCTURAL_DRIFT_MIN_PERIODS = 2
# Minimum converged periods before drift detection activates
MIN_CONVERGED_PERIODS = 2
# Number of recent periods to compare against baseline
COMPARISON_WINDOW = 3


# ─── Data Structures ────────────────────────────────────────────

@dataclass
class AxisDrift:
    """Drift detection result for a single axis."""
    axis: str
    drifted: bool = False
    direction: str = "none"  # "increase", "decrease", "type_change", "none"
    magnitude: float = 0.0  # z-score or normalized magnitude
    baseline_value: Optional[float] = None
    current_value: Optional[float] = None
    baseline_dominant: Optional[str] = None
    current_dominant: Optional[str] = None
    significance: str = "none"  # "none", "mild", "significant", "major"


@dataclass
class DriftEvent:
    """A detected drift event with interpretation."""
    period_id: str
    axes_affected: List[str]
    event_type: str  # "growth", "regression", "shift", "instability"
    description_kr: str
    severity: str  # "info", "warning", "alert"


@dataclass
class DriftReport:
    """Full drift analysis report."""
    drift_detected: bool = False
    converged: bool = False
    axes: Dict[str, AxisDrift] = field(default_factory=dict)
    events: List[DriftEvent] = field(default_factory=list)
    overall_stability: str = "unknown"  # "stable", "drifting", "volatile", "unknown"
    message: str = ""

    @property
    def summary_kr(self) -> str:
        if not self.converged:
            return "프로필이 아직 수렴하지 않아 변화 감지를 시작할 수 없습니다."
        if not self.drift_detected:
            return "프로필이 안정적입니다. 유의미한 변화가 감지되지 않았습니다."
        n_drift = sum(1 for ad in self.axes.values() if ad.drifted)
        return f"{n_drift}개 영역에서 변화가 감지되었습니다. {self.message}"


# ─── Core Logic ─────────────────────────────────────────────────

def detect_drift(
    store: TimeseriesStore,
    convergence: Optional[ConvergenceReport] = None,
) -> DriftReport:
    """
    Detect drift in a converged profile.

    If convergence report is not provided, it will be computed.
    Drift is only checked for axes that have converged.

    Strategy:
    1. Establish baseline from converged period window
    2. Compare recent window against baseline
    3. Flag significant deviations (z-score > threshold for intensity,
       dominant change for structural)
    4. Classify drift events

    Returns:
        DriftReport with per-axis analysis and event classification
    """
    report = DriftReport()

    # Check convergence
    if convergence is None:
        convergence = assess_convergence(store)

    report.converged = convergence.converged
    if not convergence.converged:
        report.message = "프로필 미수렴"
        return report

    snapshots = store.snapshots
    n = len(snapshots)

    if n < MIN_CONVERGED_PERIODS + COMPARISON_WINDOW:
        report.message = "수렴 이후 데이터 부족"
        return report

    # Split into baseline (earlier) and recent (later) windows
    baseline_end = n - COMPARISON_WINDOW
    baseline_start = max(0, baseline_end - 5)  # use up to 5 periods for baseline
    baseline = snapshots[baseline_start:baseline_end]
    recent = snapshots[-COMPARISON_WINDOW:]

    # ── Assess each intensity axis ──
    for axis in INTENSITY_AXES:
        if axis not in convergence.axes or not convergence.axes[axis].converged:
            continue
        ad = _detect_intensity_drift(axis, baseline, recent)
        report.axes[axis] = ad

    # ── Assess each structural axis ──
    for axis in STRUCTURAL_AXES:
        if axis not in convergence.axes or not convergence.axes[axis].converged:
            continue
        ad = _detect_structural_drift(axis, baseline, recent)
        report.axes[axis] = ad

    # ── Classify events ──
    report.drift_detected = any(ad.drifted for ad in report.axes.values())
    if report.drift_detected:
        report.events = _classify_drift_events(report.axes, recent[-1].period_id)
        report.overall_stability = _assess_overall_stability(report.axes)
        drifted_names = [ad.axis for ad in report.axes.values() if ad.drifted]
        report.message = _generate_drift_message(report.axes, report.events)
    else:
        report.overall_stability = "stable"
        report.message = "안정적"

    return report


def _detect_intensity_drift(
    axis: str,
    baseline: List[PeriodSnapshot],
    recent: List[PeriodSnapshot],
) -> AxisDrift:
    """Detect drift for an intensity axis using z-score."""
    ad = AxisDrift(axis=axis)

    # Baseline statistics
    base_values = [s.axes[axis].value for s in baseline if axis in s.axes]
    recent_values = [s.axes[axis].value for s in recent if axis in s.axes]

    if len(base_values) < 2 or not recent_values:
        return ad

    base_mean = statistics.mean(base_values)
    base_std = statistics.stdev(base_values) if len(base_values) >= 2 else 0.1
    base_std = max(base_std, 0.02)  # floor to avoid division by zero

    recent_mean = statistics.mean(recent_values)

    ad.baseline_value = round(base_mean, 4)
    ad.current_value = round(recent_mean, 4)

    # Z-score of recent mean vs baseline distribution
    z = abs(recent_mean - base_mean) / base_std
    ad.magnitude = round(z, 2)

    if z >= DRIFT_Z_THRESHOLD:
        ad.drifted = True
        ad.direction = "increase" if recent_mean > base_mean else "decrease"

        if z >= 3.0:
            ad.significance = "major"
        elif z >= 2.5:
            ad.significance = "significant"
        else:
            ad.significance = "mild"

    return ad


def _detect_structural_drift(
    axis: str,
    baseline: List[PeriodSnapshot],
    recent: List[PeriodSnapshot],
) -> AxisDrift:
    """Detect drift for a structural axis (dominant type change)."""
    ad = AxisDrift(axis=axis)

    base_doms = [s.axes[axis].dominant for s in baseline if axis in s.axes and s.axes[axis].dominant]
    recent_doms = [s.axes[axis].dominant for s in recent if axis in s.axes and s.axes[axis].dominant]

    if not base_doms or not recent_doms:
        return ad

    # Baseline dominant = most common
    from collections import Counter
    base_dominant = Counter(base_doms).most_common(1)[0][0]
    recent_dominant = Counter(recent_doms).most_common(1)[0][0]

    ad.baseline_dominant = base_dominant
    ad.current_dominant = recent_dominant

    # Check if dominant has changed
    if base_dominant != recent_dominant:
        # Count how many recent periods show the new dominant
        new_count = sum(1 for d in recent_doms if d == recent_dominant)
        if new_count >= STRUCTURAL_DRIFT_MIN_PERIODS:
            ad.drifted = True
            ad.direction = "type_change"
            ad.magnitude = new_count / len(recent_doms)
            ad.significance = "significant" if new_count == len(recent_doms) else "mild"

    return ad


# ─── Event Classification ───────────────────────────────────────

# Axis semantic groups for event classification
_ENGAGEMENT_AXES = {"A1", "A5"}
_EMOTIONAL_AXES = {"A4", "A9"}
_ASSERTIVENESS_AXES = {"A3", "A7", "A8"}
_STABILITY_AXES = {"A6"}

_AXIS_NAMES_KR = {
    "A1": "관여도", "A2": "수용성", "A3": "자기주장",
    "A4": "감정 표현", "A5": "협력", "A6": "안정성",
    "A7": "방향성", "A8": "갈등 스타일", "A9": "감정 조절",
    "A10": "친밀도 궤적", "A11": "균형", "A13": "피드백 반응",
    "A15": "투자도", "A16": "인지 방식", "A17": "유머",
}


def _classify_drift_events(
    axes: Dict[str, AxisDrift],
    period_id: str,
) -> List[DriftEvent]:
    """Classify drift patterns into meaningful events."""
    events = []
    drifted = {k: v for k, v in axes.items() if v.drifted}

    if not drifted:
        return events

    # Check for engagement growth/decline
    eng_drifts = {k: v for k, v in drifted.items() if k in _ENGAGEMENT_AXES}
    if eng_drifts:
        all_increase = all(v.direction == "increase" for v in eng_drifts.values())
        all_decrease = all(v.direction == "decrease" for v in eng_drifts.values())
        if all_increase:
            events.append(DriftEvent(
                period_id=period_id,
                axes_affected=list(eng_drifts.keys()),
                event_type="growth",
                description_kr="관여도와 협력 수준이 상승하고 있습니다. 관계에 더 적극적으로 참여하는 양상입니다.",
                severity="info",
            ))
        elif all_decrease:
            events.append(DriftEvent(
                period_id=period_id,
                axes_affected=list(eng_drifts.keys()),
                event_type="regression",
                description_kr="관여도가 하락하고 있습니다. 관계에서 거리를 두기 시작한 신호일 수 있습니다.",
                severity="warning",
            ))

    # Check for emotional shift
    emo_drifts = {k: v for k, v in drifted.items() if k in _EMOTIONAL_AXES}
    if emo_drifts:
        events.append(DriftEvent(
            period_id=period_id,
            axes_affected=list(emo_drifts.keys()),
            event_type="shift",
            description_kr="감정 표현 또는 조절 방식에 변화가 감지되었습니다.",
            severity="info",
        ))

    # Check for stability drop
    stab_drifts = {k: v for k, v in drifted.items() if k in _STABILITY_AXES}
    if stab_drifts:
        for v in stab_drifts.values():
            if v.direction == "decrease":
                events.append(DriftEvent(
                    period_id=period_id,
                    axes_affected=list(stab_drifts.keys()),
                    event_type="instability",
                    description_kr="행동 패턴의 안정성이 떨어지고 있습니다. 외부 스트레스나 관계 변화의 신호일 수 있습니다.",
                    severity="alert",
                ))

    # Generic: any remaining drifts not yet classified
    classified_axes = set()
    for e in events:
        classified_axes.update(e.axes_affected)
    remaining = {k: v for k, v in drifted.items() if k not in classified_axes}
    if remaining:
        names = [_AXIS_NAMES_KR.get(k, k) for k in remaining.keys()]
        events.append(DriftEvent(
            period_id=period_id,
            axes_affected=list(remaining.keys()),
            event_type="shift",
            description_kr=f"{', '.join(names)} 영역에서 변화가 감지되었습니다.",
            severity="info",
        ))

    return events


def _assess_overall_stability(axes: Dict[str, AxisDrift]) -> str:
    """Assess overall profile stability."""
    drifted_count = sum(1 for ad in axes.values() if ad.drifted)
    total = len(axes) or 1

    ratio = drifted_count / total
    if ratio == 0:
        return "stable"
    elif ratio < 0.3:
        return "drifting"
    else:
        return "volatile"


def _generate_drift_message(
    axes: Dict[str, AxisDrift],
    events: List[DriftEvent],
) -> str:
    """Generate a human-readable drift message."""
    if not events:
        return "안정적"

    parts = []
    for e in events:
        if e.severity == "alert":
            parts.append(f"⚠️ {e.description_kr}")
        else:
            parts.append(e.description_kr)

    return " ".join(parts)
