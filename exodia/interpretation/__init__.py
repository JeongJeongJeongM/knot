"""
EXODIA v3 Interpretation System.
동적 복합 라벨 + 다층 프로필 + 교차축 패턴 + 차별성 점수 +
정체성 네이밍 + 매칭 분석 + 공유 카드.
"""

# Core analysis
from exodia.interpretation.vocabulary import INTENSITY_VOCAB, STRUCTURAL_VOCAB
from exodia.interpretation.labels import generate_label, get_signature_axes
from exodia.interpretation.patterns import detect_cross_axis_patterns, detect_contradictions
from exodia.interpretation.differentiation import calculate_differentiation_score

# v2 legacy (deterministic layers)
from exodia.interpretation.profile import generate_profile

# v3 identity system
from exodia.interpretation.identity import (
    Identity,
    MatchIdentity,
    generate_identity,
    generate_match_identity,
)

# v3 profile interpretation (7-section individual, 6-section matching)
from exodia.interpretation.profile_v3 import (
    generate_individual_prompt,
    generate_matching_prompt,
    INDIVIDUAL_SECTIONS,
    MATCHING_SECTIONS,
)

# v3 share card data
from exodia.interpretation.card import (
    IndividualCardData,
    MatchingCardData,
    generate_individual_card,
    generate_matching_card,
)

# v3 timeseries tracking
from exodia.interpretation.timeseries import (
    TimeseriesStore,
    PeriodSnapshot,
    AxisSnapshot,
    build_timeseries,
    aggregate_sessions_to_snapshot,
)

# v3 convergence detection
from exodia.interpretation.convergence import (
    ConvergenceReport,
    AxisConvergence,
    assess_convergence,
)

# v3 drift detection
from exodia.interpretation.drift import (
    DriftReport,
    DriftEvent,
    AxisDrift,
    detect_drift,
)

__all__ = [
    # Core
    "INTENSITY_VOCAB", "STRUCTURAL_VOCAB",
    "generate_label", "get_signature_axes",
    "detect_cross_axis_patterns", "detect_contradictions",
    "calculate_differentiation_score",
    "generate_profile",
    # v3 Identity
    "Identity", "MatchIdentity",
    "generate_identity", "generate_match_identity",
    # v3 Interpretation
    "generate_individual_prompt", "generate_matching_prompt",
    "INDIVIDUAL_SECTIONS", "MATCHING_SECTIONS",
    # v3 Cards
    "IndividualCardData", "MatchingCardData",
    "generate_individual_card", "generate_matching_card",
    # v3 Timeseries
    "TimeseriesStore", "PeriodSnapshot", "AxisSnapshot",
    "build_timeseries", "aggregate_sessions_to_snapshot",
    # v3 Convergence
    "ConvergenceReport", "AxisConvergence", "assess_convergence",
    # v3 Drift
    "DriftReport", "DriftEvent", "AxisDrift", "detect_drift",
]
