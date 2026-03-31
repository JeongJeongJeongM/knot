"""EXODIA v5.0 — CalibrationConfig.
Dynamic thresholds and weights management for phase-based calibration.
"""
from __future__ import annotations

from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field


class Phase(str, Enum):
    PHASE_1_RULED = "phase1_ruled"
    PHASE_2_CALIBRATED = "phase2_calibrated"
    PHASE_3_ML = "phase3_ml"


class CalibrationConfig(BaseModel):
    """Dynamic threshold and weight configuration."""

    phase: Phase = Phase.PHASE_1_RULED

    # L6 friction weights (dynamic)
    l6_alpha: float = 0.475    # intensity friction weight (rebalanced for lsm_min)
    l6_beta: float = 0.475     # structural friction weight
    l6_gamma: float = 0.05     # LSM friction weight (MVP minimum)

    # LSM reliability-based weight override
    lsm_min_weight: float = 0.05
    lsm_max_weight: float = 0.20
    lsm_enabled: bool = True

    # L7 thresholds (calibration target)
    l7_thresholds: dict = Field(default_factory=lambda: {
        "normal": 0.25,
        "elevated": 0.45,
        "high": 0.65,
    })

    # Cold start minimum turns
    cold_start_min_turns: int = 12
    cold_start_profiled_turns: int = 30

    # Confidence min turns (adjustable)
    confidence_min_turns: int = 30

    # PCR expectations override (data-based)
    pcr_expectations_override: Optional[dict] = None

    # Monitoring metadata
    calibration_data: dict = Field(default_factory=dict)
    last_calibrated: Optional[str] = None

    def effective_l6_weights(
        self, lsm_reliability: Optional[float] = None
    ) -> tuple[float, float, float]:
        """Compute effective L6 weights based on LSM reliability.

        Returns:
            (alpha, beta, gamma) tuple that sums to 1.0
        """
        if not self.lsm_enabled:
            return (0.5, 0.5, 0.0)

        if lsm_reliability is None:
            gamma = self.lsm_min_weight
        else:
            gamma = self.lsm_min_weight + (
                self.lsm_max_weight - self.lsm_min_weight
            ) * max(0.0, min(1.0, lsm_reliability))

        remaining = 1.0 - gamma
        alpha = remaining / 2.0
        beta = remaining / 2.0

        return (alpha, beta, gamma)

    def confidence_cap(self, total_turns: int) -> float:
        """Compute confidence cap based on turn count.

        v5.0: 12-turn cold start strategy.
        """
        if total_turns < self.cold_start_min_turns:
            return 0.3
        elif total_turns < self.cold_start_profiled_turns:
            progress = (total_turns - self.cold_start_min_turns) / (
                self.cold_start_profiled_turns - self.cold_start_min_turns
            )
            return 0.5 + 0.5 * progress
        else:
            return 1.0
