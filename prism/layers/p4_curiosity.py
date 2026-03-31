"""
PRISM P4 — Curiosity Signature 분석기.
질문 패턴으로 드러나는 지적 호기심의 방향을 분석한다.
"""
import re
from collections import Counter

from prism.config import EPSILON
from prism.schemas import CuriositySignature


# 질문 유형 판별 패턴
_QUESTION_PATTERNS: dict[str, list[str]] = {
    "factual": [
        r'(몇|언제|어디|누구|뭐가|얼마)',
        r'(맞아\?|맞지\?|그래\?|진짜\?|정말\?)',
        r'(있어\?|없어\?|했어\?|됐어\?)',
    ],
    "opinion": [
        r'(어떻게 생각|어떤 것 같|넌 어때|너는 어떻게)',
        r'(의견|생각|느낌|판단)',
        r'(좋아\?|싫어\?|괜찮\?)',
    ],
    "hypothesis": [
        r'(만약|가정|혹시|그러면)',
        r'(될까|일까|않을까|아닐까)',
        r'(가능성|확률|경우)',
    ],
    "meta": [
        r'(왜 그런|이유가|근본적으로|본질)',
        r'(의미가|뭘 뜻하|어째서)',
        r'(구조|체계|시스템|원리)',
    ],
}


class P4CuriosityAnalyzer:
    """호기심 시그니처 분석기."""

    def analyze(self, texts: list[str]) -> CuriositySignature:
        """텍스트 리스트 → CuriositySignature."""
        if not texts:
            return CuriositySignature()

        total_turns = len(texts)
        question_turns = 0
        question_types: Counter = Counter()
        topic_transitions = 0
        follow_ups = 0
        prev_topic_hash = None

        for i, text in enumerate(texts):
            is_question = self._is_question(text)
            if is_question:
                question_turns += 1
                q_type = self._classify_question_type(text)
                question_types[q_type] += 1

            # 주제 전환 감지 (간단한 해시 기반)
            topic_hash = self._topic_hash(text)
            if prev_topic_hash is not None:
                if topic_hash != prev_topic_hash:
                    topic_transitions += 1
                elif is_question:
                    follow_ups += 1
            prev_topic_hash = topic_hash

        # 질문 비율
        question_ratio = round(question_turns / (total_turns + EPSILON), 4)

        # 지배적 질문 유형
        dominant_type = (
            question_types.most_common(1)[0][0]
            if question_types else "factual"
        )

        # 깊이 vs 폭 판단
        transition_rate = topic_transitions / (total_turns + EPSILON)
        if transition_rate > 0.4:
            depth_vs_breadth = "wide_scanner"
        elif transition_rate < 0.15:
            depth_vs_breadth = "deep_diver"
        else:
            depth_vs_breadth = "balanced"

        # 후속 질문 경향
        if question_turns > 0:
            follow_up_rate = follow_ups / (question_turns + EPSILON)
        else:
            follow_up_rate = 0.0

        if follow_up_rate > 0.5:
            follow_up_tendency = "high"
        elif follow_up_rate > 0.2:
            follow_up_tendency = "moderate"
        else:
            follow_up_tendency = "low"

        # 질문 유형 분포
        total_q = sum(question_types.values()) + EPSILON
        type_distribution = {
            qt: round(count / total_q, 4)
            for qt, count in question_types.items()
        }

        return CuriositySignature(
            question_ratio=question_ratio,
            dominant_type=dominant_type,
            depth_vs_breadth=depth_vs_breadth,
            follow_up_tendency=follow_up_tendency,
            question_type_distribution=type_distribution,
        )

    def _is_question(self, text: str) -> bool:
        """텍스트가 질문인지 판별."""
        if '?' in text or '？' in text:
            return True
        # 한국어 의문형 종결어미
        if re.search(r'(까\??|나\??|니\??|지\??|냐\??|가\??)$', text.strip()):
            return True
        return False

    def _classify_question_type(self, text: str) -> str:
        """질문 유형 분류."""
        scores: Counter = Counter()

        for q_type, patterns in _QUESTION_PATTERNS.items():
            for pattern in patterns:
                if re.search(pattern, text):
                    scores[q_type] += 1

        if scores:
            return scores.most_common(1)[0][0]
        return "factual"

    def _topic_hash(self, text: str) -> int:
        """간단한 토픽 해시 (키워드 기반)."""
        # 주요 명사/키워드 추출 (간단 버전)
        words = re.findall(r'[가-힣]{2,}', text)
        # 상위 3개 단어의 해시로 토픽 대리
        key_words = sorted(words, key=len, reverse=True)[:3]
        return hash(tuple(key_words)) % 100
