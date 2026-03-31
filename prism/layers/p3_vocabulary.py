"""
PRISM P3 — Vocabulary Landscape 분석기.
어휘 다양성, 전문 영역, 추상성, 레지스터 범위를 패턴으로 기술한다.

점수가 아닌 패턴 기술로 출력.
"""
import re
from collections import Counter
from typing import Optional

from prism.config import (
    ABSTRACTION_THRESHOLD_ABSTRACT,
    ABSTRACTION_THRESHOLD_CONCRETE,
    EPSILON,
    TTR_HIGH_THRESHOLD,
    TTR_LOW_THRESHOLD,
)
from prism.schemas import VocabularyLandscape


# 전문 영역 어휘 사전
_DOMAIN_VOCABULARY: dict[str, list[str]] = {
    "tech": [
        "API", "서버", "클라이언트", "배포", "디버깅", "리팩토링",
        "아키텍처", "프레임워크", "라이브러리", "인스턴스", "컨테이너",
        "마이크로서비스", "레이턴시", "스케일링", "CI/CD",
    ],
    "psychology": [
        "인지", "무의식", "투사", "전이", "방어기제", "자아",
        "트라우마", "레질리언스", "메타인지", "스키마", "애착",
    ],
    "finance": [
        "수익률", "포트폴리오", "리스크", "헤지", "배당",
        "밸류에이션", "레버리지", "유동성", "캐시플로우",
    ],
    "art": [
        "구도", "색채", "질감", "미학", "아방가르드",
        "큐레이션", "매체", "모티프", "내러티브", "장르",
    ],
    "science": [
        "가설", "변인", "통제군", "실험군", "유의미",
        "상관관계", "인과관계", "표본", "편향", "메타분석",
    ],
    "philosophy": [
        "존재론", "인식론", "현상학", "해석학", "변증법",
        "실존주의", "구조주의", "해체", "담론", "패러다임",
    ],
}

# 추상어 패턴 (추상적 개념어)
_ABSTRACT_PATTERNS: list[str] = [
    "개념", "본질", "의미", "가치", "구조", "체계",
    "패러다임", "프레임", "메타", "추상", "이론",
    "원리", "철학", "존재", "인식", "관점",
]

# 구체어 패턴 (구체적 사물/행동)
_CONCRETE_PATTERNS: list[str] = [
    "밥", "집", "차", "돈", "옷", "신발",
    "먹", "가", "사", "자", "봐",
    "핸드폰", "컴퓨터", "책상", "의자",
]


class P3VocabularyAnalyzer:
    """어휘 지형 분석기."""

    def analyze(self, texts: list[str]) -> VocabularyLandscape:
        """텍스트 리스트 → VocabularyLandscape."""
        if not texts:
            return VocabularyLandscape()

        all_text = " ".join(texts)
        tokens = self._tokenize(all_text)

        if not tokens:
            return VocabularyLandscape()

        # 어휘 다양성 (TTR)
        ttr = self._compute_ttr(tokens)
        diversity = self._classify_diversity(ttr)

        # 전문 영역 탐지
        dominant_domains = self._detect_domains(all_text)

        # 추상성 분석
        abstraction = self._analyze_abstraction(all_text)

        # 레지스터 범위 (존댓말/반말/영어 혼용 등)
        register_range = self._analyze_register(texts)

        return VocabularyLandscape(
            diversity=diversity,
            dominant_domains=dominant_domains,
            abstraction=abstraction,
            register_range=register_range,
            lexical_diversity_raw=round(ttr, 4),
        )

    def _tokenize(self, text: str) -> list[str]:
        """간단한 토크나이징 (형태소 분석기 없이 공백+정규식 기반)."""
        # 한글, 영어, 숫자 단위로 분리
        tokens = re.findall(r'[가-힣]+|[a-zA-Z]+|[0-9]+', text)
        return [t.lower() for t in tokens if len(t) > 1]

    def _compute_ttr(self, tokens: list[str]) -> float:
        """Type-Token Ratio."""
        if not tokens:
            return 0.0
        types = set(tokens)
        # 긴 텍스트에서 TTR이 과도하게 낮아지는 걸 보정 (루트 TTR)
        return len(types) / (len(tokens) ** 0.5 + EPSILON)

    def _classify_diversity(self, ttr: float) -> str:
        """TTR → 다양성 라벨."""
        if ttr >= TTR_HIGH_THRESHOLD:
            return "high"
        elif ttr >= TTR_LOW_THRESHOLD:
            return "moderate"
        else:
            return "low"

    def _detect_domains(self, text: str) -> list[str]:
        """전문 영역 어휘 탐지."""
        text_lower = text.lower()
        domain_scores: Counter = Counter()

        for domain, vocab in _DOMAIN_VOCABULARY.items():
            for term in vocab:
                if term.lower() in text_lower:
                    domain_scores[domain] += 1

        # 2개 이상 매칭된 영역만 포함
        return [
            domain for domain, count in domain_scores.most_common()
            if count >= 2
        ]

    def _analyze_abstraction(self, text: str) -> str:
        """추상어 vs 구체어 비율."""
        text_lower = text.lower()
        abstract_count = sum(1 for p in _ABSTRACT_PATTERNS if p in text_lower)
        concrete_count = sum(1 for p in _CONCRETE_PATTERNS if p in text_lower)
        total = abstract_count + concrete_count + EPSILON
        abstract_ratio = abstract_count / total

        if abstract_ratio >= ABSTRACTION_THRESHOLD_ABSTRACT:
            return "leans_abstract"
        elif abstract_ratio <= ABSTRACTION_THRESHOLD_CONCRETE:
            return "leans_concrete"
        else:
            return "balanced"

    def _analyze_register(self, texts: list[str]) -> str:
        """레지스터 범위 분석 (존댓말/반말/영어 혼용)."""
        formal_count = 0
        informal_count = 0
        english_count = 0

        for text in texts:
            # 존댓말 시그널
            if re.search(r'(습니다|세요|시겠|드릴|하옵)', text):
                formal_count += 1
            # 반말 시그널
            if re.search(r'(ㅋㅋ|ㅎㅎ|ㅇㅇ|ㄹㅇ|ㅇㅋ|야|임마)', text):
                informal_count += 1
            # 영어 혼용
            if re.search(r'[a-zA-Z]{3,}', text):
                english_count += 1

        total = len(texts)
        if total == 0:
            return "narrow"

        unique_registers = sum([
            formal_count > total * 0.1,
            informal_count > total * 0.1,
            english_count > total * 0.1,
        ])

        if unique_registers >= 3:
            return "wide"
        elif unique_registers >= 2:
            return "moderate"
        else:
            return "narrow"
