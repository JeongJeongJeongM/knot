"""
PRISM P2 — Engagement Depth 분석기.
같은 주제라도 깊이가 다르다.
지적 수준을 점수화하지 않고 참여 패턴으로 보여주는 방식.

"지적 수준: 72점" ← 금지
"기술 주제에서 analytical 수준으로 대화" ← 허용
"""
import re
from collections import Counter, defaultdict
from typing import Optional

from prism.config import DEPTH_LEVELS, DEPTH_LEVEL_WEIGHTS
from prism.schemas import EngagementProfile, TopicDistribution


# 깊이 판단 시그널
_DEPTH_SIGNALS: dict[str, list[str]] = {
    "creative": [
        "내 생각엔", "내가 보기엔", "이렇게 해석", "새로운 관점",
        "다른 각도에서", "재해석", "나만의", "독자적",
        "제안하자면", "이론을 세워보면",
    ],
    "exploratory": [
        "연결되는", "근본적으로", "본질적", "철학적",
        "존재론적", "메타", "추상적", "구조적으로",
        "패러다임", "프레임워크", "이면에", "심층적",
    ],
    "analytical": [
        "분석하면", "구조가", "패턴이", "원인은",
        "비교하면", "통계적", "데이터", "논리적",
        "왜냐하면", "근거는", "증거는", "체계적",
        "상관관계", "인과", "메커니즘",
    ],
    "casual": [
        "그런 것 같아", "아마", "좀", "약간",
        "그냥", "뭐", "대충", "느낌",
    ],
    "surface": [
        "ㅇㅇ", "ㅋㅋ", "ㄹㅇ", "ㅎㅎ",
        "그래", "맞아", "오", "와",
    ],
}


class P2DepthAnalyzer:
    """참여 깊이 분석기."""

    def analyze(
        self,
        texts: list[str],
        topic_distribution: Optional[TopicDistribution] = None,
    ) -> EngagementProfile:
        """텍스트 리스트 → EngagementProfile."""
        if not texts:
            return EngagementProfile()

        # 각 턴의 깊이 레벨 판정
        depth_scores: list[str] = []
        for text in texts:
            depth = self._classify_depth(text)
            depth_scores.append(depth)

        # 전체 깊이 분포
        depth_counter = Counter(depth_scores)
        total = len(depth_scores)

        # 가중 평균으로 전반적 깊이 결정
        weighted_sum = sum(
            DEPTH_LEVEL_WEIGHTS.get(d, 0.1) * count
            for d, count in depth_counter.items()
        )
        avg_weight = weighted_sum / total if total > 0 else 0.0
        overall = self._weight_to_level(avg_weight)

        # 주제별 깊이 (topic_distribution이 있으면 교차 분석)
        depth_by_topic: dict[str, str] = {}
        if topic_distribution and topic_distribution.topics:
            # 기본적으로 전체 깊이를 각 토픽에 할당
            # (정교한 교차 분석은 향후 확장)
            for cat in topic_distribution.topics:
                depth_by_topic[cat] = overall

        # 일관성 판단
        unique_depths = set(depth_scores)
        if len(unique_depths) <= 2:
            consistency = "consistent"
        elif len(unique_depths) >= 4:
            consistency = "variable"
        else:
            consistency = "topic_dependent"

        return EngagementProfile(
            depth_by_topic=depth_by_topic,
            overall_depth=overall,
            depth_consistency=consistency,
        )

    def _classify_depth(self, text: str) -> str:
        """단일 텍스트의 깊이 레벨 판정."""
        text_lower = text.lower()
        scores: dict[str, int] = {level: 0 for level in DEPTH_LEVELS}

        for level, signals in _DEPTH_SIGNALS.items():
            for signal in signals:
                if signal in text_lower:
                    scores[level] += 1

        # 가장 높은 시그널이 있는 레벨 (동점 시 더 깊은 쪽)
        max_score = max(scores.values())
        if max_score == 0:
            # 시그널 없으면 텍스트 길이로 추정
            if len(text) < 10:
                return "surface"
            elif len(text) < 50:
                return "casual"
            else:
                return "casual"

        # 깊은 쪽 우선
        for level in reversed(DEPTH_LEVELS):
            if scores[level] == max_score:
                return level
        return "surface"

    def _weight_to_level(self, weight: float) -> str:
        """가중 평균 → 깊이 레벨."""
        if weight >= 0.85:
            return "creative"
        elif weight >= 0.6:
            return "exploratory"
        elif weight >= 0.4:
            return "analytical"
        elif weight >= 0.2:
            return "casual"
        else:
            return "surface"
