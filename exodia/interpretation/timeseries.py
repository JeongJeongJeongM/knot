"""
Timeseries tracking for EXODIA profiles.

Stores periodic snapshots of axis values, provides aggregation
across time windows, and serves as the data layer for convergence
and drift detection.

Period-based: sessions within the same period are averaged.
"""

from dataclasses import dataclass, field
from typing import Dict, List, Optional, Tuple
from datetime import datetime, timedelta
import statistics


# ─── Data Structures ────────────────────────────────────────────

@dataclass
class AxisSnapshot:
    """Single axis value at a point in time."""
    value: float  # intensity score [0,1] or structural confidence
    dominant: Optional[str] = None  # structural axis dominant label
    confidence: float = 0.0  # engine confidence for this reading


@dataclass
class PeriodSnapshot:
    """Aggregated profile snapshot for a time period."""
    period_id: str  # e.g. "2025-W12", "2025-03"
    period_start: datetime
    period_end: datetime
    session_count: int  # number of sessions in this period
    axes: Dict[str, AxisSnapshot] = field(default_factory=dict)
    # metadata
    total_turns: int = 0
    avg_confidence: float = 0.0


@dataclass
class TimeseriesStore:
    """Full timeseries for one user profile."""
    user_id: str
    snapshots: List[PeriodSnapshot] = field(default_factory=list)
    created_at: Optional[datetime] = None
    last_updated: Optional[datetime] = None

    @property
    def period_count(self) -> int:
        return len(self.snapshots)

    def get_axis_series(self, axis: str) -> List[Tuple[str, float]]:
        """Get time series for a single axis: [(period_id, value), ...]"""
        result = []
        for snap in self.snapshots:
            if axis in snap.axes:
                result.append((snap.period_id, snap.axes[axis].value))
        return result

    def get_latest(self, n: int = 1) -> List[PeriodSnapshot]:
        """Get the N most recent snapshots."""
        return self.snapshots[-n:] if self.snapshots else []

    def get_dominant_series(self, axis: str) -> List[Tuple[str, str]]:
        """Get dominant label series for structural axis."""
        result = []
        for snap in self.snapshots:
            if axis in snap.axes and snap.axes[axis].dominant:
                result.append((snap.period_id, snap.axes[axis].dominant))
        return result


# ─── Constants ──────────────────────────────────────────────────

INTENSITY_AXES = ["A1", "A2", "A3", "A4", "A5", "A6"]
STRUCTURAL_AXES = ["A7", "A8", "A9", "A10", "A11", "A13", "A15", "A16", "A17"]
ALL_AXES = INTENSITY_AXES + STRUCTURAL_AXES

PERIOD_WEEK = "week"
PERIOD_MONTH = "month"


# ─── Aggregation ────────────────────────────────────────────────

def aggregate_sessions_to_snapshot(
    sessions: List[Dict],
    period_id: str,
    period_start: datetime,
    period_end: datetime,
) -> PeriodSnapshot:
    """
    Aggregate multiple session L3 outputs into a single period snapshot.

    Args:
        sessions: list of dicts, each containing axis data from one session.
            Intensity axes: float or {"score": float}
            Structural axes: {"dominant": str, "mix": dict, "confidence": float}
        period_id: human-readable period label
        period_start, period_end: time bounds

    Returns:
        PeriodSnapshot with averaged intensity axes and majority-vote structural axes
    """
    if not sessions:
        return PeriodSnapshot(
            period_id=period_id,
            period_start=period_start,
            period_end=period_end,
            session_count=0,
        )

    axes: Dict[str, AxisSnapshot] = {}

    # ── Intensity axes: weighted average ──
    for axis in INTENSITY_AXES:
        values = []
        confidences = []
        for s in sessions:
            raw = s.get(axis)
            if raw is None:
                continue
            if isinstance(raw, (int, float)):
                values.append(float(raw))
                confidences.append(0.5)  # default confidence
            elif isinstance(raw, dict):
                v = raw.get("score", raw.get("value"))
                if v is not None:
                    values.append(float(v))
                    confidences.append(float(raw.get("confidence", 0.5)))

        if values:
            # Confidence-weighted average
            total_w = sum(confidences)
            if total_w > 0:
                weighted_avg = sum(v * c for v, c in zip(values, confidences)) / total_w
            else:
                weighted_avg = statistics.mean(values)

            axes[axis] = AxisSnapshot(
                value=round(weighted_avg, 4),
                confidence=round(statistics.mean(confidences), 4),
            )

    # ── Structural axes: majority vote + averaged mix ──
    for axis in STRUCTURAL_AXES:
        dominants = []
        mixes: List[Dict[str, float]] = []
        confidences = []

        for s in sessions:
            raw = s.get(axis)
            if raw is None or not isinstance(raw, dict):
                continue
            dom = raw.get("dominant")
            if dom:
                dominants.append(dom)
            mix = raw.get("mix")
            if mix:
                mixes.append(mix)
            confidences.append(float(raw.get("confidence", 0.5)))

        if dominants:
            # Majority vote for dominant
            from collections import Counter
            dominant = Counter(dominants).most_common(1)[0][0]

            # Average mix distributions
            avg_mix = {}
            if mixes:
                all_keys = set()
                for m in mixes:
                    all_keys.update(m.keys())
                for k in all_keys:
                    avg_mix[k] = round(
                        statistics.mean(m.get(k, 0.0) for m in mixes), 4
                    )

            axes[axis] = AxisSnapshot(
                value=avg_mix.get(dominant, 0.5),
                dominant=dominant,
                confidence=round(statistics.mean(confidences), 4) if confidences else 0.0,
            )

    avg_conf = statistics.mean(
        ax.confidence for ax in axes.values()
    ) if axes else 0.0

    return PeriodSnapshot(
        period_id=period_id,
        period_start=period_start,
        period_end=period_end,
        session_count=len(sessions),
        axes=axes,
        avg_confidence=round(avg_conf, 4),
    )


def assign_period(dt: datetime, granularity: str = PERIOD_WEEK) -> str:
    """Assign a datetime to a period ID string."""
    if granularity == PERIOD_WEEK:
        iso = dt.isocalendar()
        return f"{iso[0]}-W{iso[1]:02d}"
    elif granularity == PERIOD_MONTH:
        return f"{dt.year}-{dt.month:02d}"
    else:
        raise ValueError(f"Unknown granularity: {granularity}")


def group_sessions_by_period(
    sessions: List[Tuple[datetime, Dict]],
    granularity: str = PERIOD_WEEK,
) -> Dict[str, List[Dict]]:
    """
    Group (timestamp, session_data) pairs into period buckets.

    Returns: {period_id: [session_data, ...]}
    """
    buckets: Dict[str, List[Dict]] = {}
    for dt, data in sessions:
        pid = assign_period(dt, granularity)
        buckets.setdefault(pid, []).append(data)
    return buckets


def build_timeseries(
    user_id: str,
    sessions: List[Tuple[datetime, Dict]],
    granularity: str = PERIOD_WEEK,
) -> TimeseriesStore:
    """
    Build a full timeseries store from raw session data.

    Args:
        user_id: unique user identifier
        sessions: list of (timestamp, axis_data_dict) pairs
        granularity: "week" or "month"

    Returns:
        TimeseriesStore with period snapshots sorted chronologically
    """
    buckets = group_sessions_by_period(sessions, granularity)
    snapshots = []

    for pid in sorted(buckets.keys()):
        session_list = buckets[pid]
        # Determine period bounds
        if granularity == PERIOD_WEEK:
            year, week = int(pid.split("-W")[0]), int(pid.split("-W")[1])
            start = datetime.fromisocalendar(year, week, 1)
            end = start + timedelta(days=6)
        else:
            year, month = int(pid.split("-")[0]), int(pid.split("-")[1])
            start = datetime(year, month, 1)
            if month == 12:
                end = datetime(year + 1, 1, 1) - timedelta(days=1)
            else:
                end = datetime(year, month + 1, 1) - timedelta(days=1)

        snap = aggregate_sessions_to_snapshot(session_list, pid, start, end)
        snapshots.append(snap)

    return TimeseriesStore(
        user_id=user_id,
        snapshots=snapshots,
        created_at=datetime.now(),
        last_updated=datetime.now(),
    )
