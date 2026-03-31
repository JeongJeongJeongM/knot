"""
EXODIA L4 — Projection (투영).
순수 Python. LLM 금지. 결정론적.
구현 기준: PART 4 §3 + PART 6 §4.5.
"""
from exodia.config import PCR_EXPECTATIONS
from exodia.schemas import L3Output, L4Output


class L4Projector:
    """L4 투영 프로세서. — PART 4 §3"""

    def process(self, l3: L3Output,
                purpose_distribution: dict[str, float] | None = None) -> L4Output:
        """L3Output + Purpose → L4Output.

        세션에 여러 Purpose 혼합 시, 턴 비율로 가중 평균한 기대치 사용.
        Purpose 판별 불가 → P.CASUAL 기본. — PART 4 §5.1
        """
        if not purpose_distribution:
            purpose_distribution = {"P.CASUAL": 1.0}

        # 가중 기대치 계산 — PART 4 §3.3
        weighted_expectation: dict[str, float] = {}
        intensity_keys = ["A1", "A2", "A3", "A4", "A5", "A6"]

        for axis_key in intensity_keys:
            weighted_exp = 0.0
            for purpose, weight in sorted(purpose_distribution.items()):
                pcr = PCR_EXPECTATIONS.get(purpose)
                if pcr and axis_key in pcr:
                    weighted_exp += weight * pcr[axis_key]
            weighted_expectation[axis_key] = weighted_exp

        # Delta & Bias 계산 — PART 4 §3.3
        delta: dict[str, float] = {}
        bias: dict[str, float] = {}

        for axis_key in intensity_keys:
            axis = l3.intensity_axes.get(axis_key)
            observed = axis.score if axis else 0.0
            expected = weighted_expectation.get(axis_key, 0.0)
            delta[axis_key] = abs(observed - expected)
            bias[axis_key] = observed - expected

        # ADP 계산 — PART 4 §3.4
        delta_values = [delta[k] for k in intensity_keys]
        adp = 1.0 - (sum(delta_values) / len(delta_values)) if delta_values else 0.0
        adp = max(0.0, min(1.0, adp))

        return L4Output(
            purpose_distribution=purpose_distribution,
            weighted_expectation=weighted_expectation,
            delta=delta,
            bias=bias,
            adp=adp,
        )
