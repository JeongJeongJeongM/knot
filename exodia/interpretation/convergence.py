"""
Convergence detection for EXODIA timeseries profiles.

Determines when a profile has "stabilized" — i.e., the engine
has gathered enough data to produce reliable, consistent results.

Uses a composite criterion:
  1. Delta check: axis-level changes between consecutive periods
     are below threshold for N consecutive periods.
  2. Confidence interval: accumulated values fall within a tight band.
Both must be satisfied simultaneously.
"""

from dataclasses import dataclass, field
from typing import Dict, List, Optional, Tuple
import statistics
import math

from exodia.interpretation.timeseries import (
    TimeseriesStore, PeriodSnapshot, AxisSnapshot,
    INTENSITY_AXES, STRUCTURAL_AXES, ALL_AXES,
)


# ─── Constants ──────────────────────────────────────────────────

# Intensity axis delta must be below this for N consecutive periods
INTENSITY_DELTA_THRESHOLD = 0.08
# Structural axis must keep same dominant for N consecutive periods
STRUCTURAL_STABILITY_THRESHOLD = 3  # consecutive same-dominant periods
# Required consecutive stable periods for convergence
REQUIRED_STABLE_PERIODS = 3
# Minimum total periods before convergence can be declared
MIN_PERIODS_FOR_CONVERGENCE = 4
# Confidence interval half-width threshold (95% CI)
CI_THRESHOLD = 0.12
# Minimum sessions total across all periods
MIN_TOTAL_SESSIONS = 5


# ─── Data Structures ────────────────────────────────────────────

@dataclass
class AxisConvergence:
    """Convergence status for a single axis."""
    axis: str
    converged: bool = False
    stable_periods: int = 0  # consecutive stable periods
    current_value: Optional[float] = None
    ci_width: Optional[float] = None  # 95% CI half-width
    last_delta: Optional[float] = None  # change from previous period
    trend: str = "unknown"  # "stable", "rising", "falling", "oscillating"


@dataclass
class ConvergenceReport:
    """Overall convergence assessment for a profile."""
    converged: bool = False
    convergence_pct: float = 0.0  # 0-100, what % of axes have converged
    converged_at: Optional[str] = None  # period_id when convergence was achieved
    period_count: int = 0
    total_sessions: int = 0
    axes: Dict[str, AxisConvergence] = field(default_factory=dict)
    message: str = ""
    confidence_level: str = "low"  # "low", "medium", "high", "very_high"

    @property
    def summary_kr(self) -> str:
        """Korean summary for display."""
        if self.converged:
            return f"프로필 수렴 완료 — {self.convergence_pct:.0f}% 축이 안정화됨 (신뢰도: {self.confidence_level_kr})"
        else:
            return f"프로필 수렴 중 — {self.convergence_pct:.0f}% 축 안정, 더 많은 데이터 필요"

    @property
    def confidence_level_kr(self) -> str:
        return {
            "low": "낮음",
            "medium": "보통",
            "high": "높음",
            "very_high": "매우 높음",
        }.get(self.confidence_level, "알 수 없음")


# ─── Core Logic ─────────────────────────────────────────────────

def assess_convergence(store: TimeseriesStore) -> ConvergenceReport:
    """
    Assess whether a profile's timeseries has converged.

    Convergence requires:
    1. At least MIN_PERIODS_FOR_CONVERGENCE periods of data
    2. At least MIN_TOTAL_SESSIONS sessions total
    3. For each axis:
       - Intensity: delta < threshold for REQUIRED_STABLE_PERIODS consecutive periods
                    AND 95% CI width < CI_THRESHOLD
       - Structural: same dominant for STRUCTURAL_STABILITY_THRESHOLD consecutive periods
    4. Overall: >= 70% of axes must be individually converged

    Returns:
        ConvergenceReport with per-axis and overall status
    """
    snapshots = store.snapshots
    n_periods = len(snapshots)
    total_sessions = sum(s.session_count for s in snapshots)

    report = ConvergenceReport(
        period_count=n_periods,
        total_sessions=total_sessions,
    )

    # Not enough data
    if n_periods < MIN_PERIODS_FOR_CONVERGENCE:
        report.message = f"데이터 부족: {n_periods}개 기간 / 최소 {MIN_PERIODS_FOR_CONVERGENCE}개 필요"
        return report

    if total_sessions < MIN_TOTAL_SESSIONS:
        report.message = f"세션 부족: {total_sessions}회 / 최소 {MIN_TOTAL_SESSIONS}회 필요"
        return report

    # ── Assess each intensity axis ──
    for axis in INTENSITY_AXES:
        ac = _assess_intensity_axis(axis, snapshots)
        report.axes[axis] = ac

    # ── Assess each structural axis ──
    for axis in STRUCTURAL_AXES:
        ac = _assess_structural_axis(axis, snapshots)
        report.axes[axis] = ac

    # ── Overall convergence ──
    total_axes = len(report.axes)
    converged_axes = sum(1 for ac in report.axes.values() if ac.converged)
    report.convergence_pct = (converged_axes / total_axes * 100) if total_axes > 0 else 0

    # Need >= 70% of axes converged
    report.converged = report.convergence_pct >= 70

    if report.converged:
        # Find when convergence was first achieved
        report.converged_at = _find_convergence_point(report.axes, snapshots)
        report.message = f"프로필이 안정화되었습니다. {converged_axes}/{total_axes}개 축이 수렴했습니다."
    else:
        remaining = total_axes - converged_axes
        report.message = f"아직 {remaining}개 축이 불안정합니다. 더 많은 대화 데이터가 필요합니다."

    # Confidence level based on data quantity + convergence
    report.confidence_level = _compute_confidence_level(
        n_periods, total_sessions, report.convergence_pct
    )

    return report


def _assess_intensity_axis(axis: str, snapshots: List[PeriodSnapshot]) -> AxisConvergence:
    """Assess convergence for a single intensity axis."""
    values = []
    for snap in snapshots:
        if axis in snap.axes:
            values.append(snap.axes[axis].value)
        else:
            values.append(None)

    ac = AxisConvergence(axis=axis)

    # Get non-None values
    valid_values = [v for v in values if v is not None]
    if len(valid_values) < 3:
        ac.trend = "insufficient"
        return ac

    ac.current_value = valid_values[-1]

    # Compute deltas between consecutive periods
    deltas = []
    for i in range(1, len(values)):
        if values[i] is not None and values[i - 1] is not None:
            deltas.append(abs(values[i] - values[i - 1]))

    if deltas:
        ac.last_delta = deltas[-1]

    # Count consecutive stable periods (delta < threshold)
    consecutive_stable = 0
    for d in reversed(deltas):
        if d < INTENSITY_DELTA_THRESHOLD:
            consecutive_stable += 1
        else:
            break
    ac.stable_periods = consecutive_stable

    # Compute 95% CI width
    if len(valid_values) >= 3:
        mean = statistics.mean(valid_values)
        std = statistics.stdev(valid_values)
        se = std / math.sqrt(len(valid_values))
        ci_half = 1.96 * se
        ac.ci_width = round(ci_half, 4)
    else:
        ac.ci_width = 1.0  # unknown → wide

    # Convergence: stable periods + tight CI
    delta_ok = consecutive_stable >= REQUIRED_STABLE_PERIODS
    ci_ok = ac.ci_width < CI_THRESHOLD
    ac.converged = delta_ok and ci_ok

    # Trend detection
    ac.trend = _detect_trend(valid_values)

    return ac


def _assess_structural_axis(axis: str, snapshots: List[PeriodSnapshot]) -> AxisConvergence:
    """Assess convergence for a structural axis (categorical)."""
    dominants = []
    for snap in snapshots:
        if axis in snap.axes and snap.axes[axis].dominant:
            dominants.append(snap.axes[axis].dominant)
        else:
            dominants.append(None)

    ac = AxisConvergence(axis=axis)
    valid = [d for d in dominants if d is not None]
    if len(valid) < 3:
        ac.trend = "insufficient"
        return ac

    ac.current_value = 0.0  # not applicable for structural
    ac.last_delta = 0.0 if len(valid) >= 2 and valid[-1] == valid[-2] else 1.0

    # Count consecutive same-dominant periods
    consecutive_same = 1
    for i in range(len(dominants) - 2, -1, -1):
        if dominants[i] is not None and dominants[i] == dominants[-1]:
            consecutive_same += 1
        else:
            break
    ac.stable_periods = consecutive_same

    # Convergence: same dominant for N periods
    ac.converged = consecutive_same >= STRUCTURAL_STABILITY_THRESHOLD

    # Trend
    if len(valid) >= 3:
        from collections import Counter
        counts = Counter(valid)
        if counts.most_common(1)[0][1] >= len(valid) * 0.8:
            ac.trend = "stable"
        elif len(counts) == len(valid):
            ac.trend = "oscillating"
        else:
            ac.trend = "shifting"
    else:
        ac.trend = "insufficient"

    return ac


def _detect_trend(values: List[float]) -> str:
    """Detect trend in a series of values."""
    if len(values) < 3:
        return "insufficient"

    # Use last 5 values for trend
    recent = values[-5:]

    # Simple linear regression slope
    n = len(recent)
    x_mean = (n - 1) / 2
    y_mean = statistics.mean(recent)
    numerator = sum((i - x_mean) * (v - y_mean) for i, v in enumerate(recent))
    denominator = sum((i - x_mean) ** 2 for i in range(n))

    if denominator == 0:
        return "stable"

    slope = numerator / denominator

    if abs(slope) < 0.02:
        return "stable"
    elif slope > 0.05:
        return "rising"
    elif slope < -0.05:
        return "falling"
    elif slope > 0:
        return "slight_rise"
    else:
        return "slight_fall"


def _find_convergence_point(
    axes: Dict[str, AxisConvergence],
    snapshots: List[PeriodSnapshot],
) -> Optional[str]:
    """Find the period when convergence was first achieved."""
    # Approximate: use the latest snapshot as convergence point
    if snapshots:
        return snapshots[-1].period_id
    return None


def _compute_confidence_level(
    n_periods: int, total_sessions: int, convergence_pct: float
) -> str:
    """Compute overall confidence level."""
    score = 0

    # Data quantity
    if total_sessions >= 20:
        score += 3
    elif total_sessions >= 10:
        score += 2
    elif total_sessions >= 5:
        score += 1

    # Period coverage
    if n_periods >= 8:
        score += 3
    elif n_periods >= 5:
        score += 2
    elif n_periods >= 3:
        score += 1

    # Convergence
    if convergence_pct >= 90:
        score += 3
    elif convergence_pct >= 70:
        score += 2
    elif convergence_pct >= 50:
        score += 1

    if score >= 8:
        return "very_high"
    elif score >= 5:
        return "high"
    elif score >= 3:
        return "medium"
    else:
        return "low"
