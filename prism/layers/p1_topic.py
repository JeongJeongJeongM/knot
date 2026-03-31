"""
PRISM P1 — Topic Distribution 분석기.
대화에서 실제로 다루는 주제의 비율 맵을 생성한다.

자기 신고 vs 실제 행동 괴리 감지 포함.
"""
import math
import re
from collections import Counter
from typing import Optional

from prism.config import (
    EPSILON,
    SELF_REPORT_DISCREPANCY_THRESHOLD,
    TOPIC_CATEGORIES,
    TOPIC_MIN_RATIO_SIGNIFICANT,
)
from prism.schemas import TopicDistribution, TopicEntry


# 한국어 토픽 키워드 사전 (확장 가능)
_TOPIC_KEYWORDS: dict[str, list[str]] = {
    "technology": [
        "코드", "프로그래밍", "개발", "앱", "소프트웨어", "하드웨어",
        "AI", "인공지능", "서버", "데이터", "알고리즘", "API",
        "컴퓨터", "기술", "디지털", "클라우드", "코딩", "깃",
    ],
    "relationships": [
        "연애", "사랑", "관계", "데이트", "결혼", "이별",
        "남친", "여친", "짝사랑", "고백", "커플", "썸",
    ],
    "daily_life": [
        "오늘", "어제", "내일", "아침", "저녁", "일상",
        "집", "출근", "퇴근", "주말", "날씨", "잠",
    ],
    "philosophy": [
        "철학", "존재", "의미", "가치", "윤리", "도덕",
        "진리", "자유의지", "실존", "형이상학", "인식론",
    ],
    "entertainment": [
        "영화", "드라마", "게임", "음악", "노래", "유튜브",
        "넷플릭스", "웹툰", "만화", "애니", "콘서트",
    ],
    "work": [
        "회사", "직장", "업무", "프로젝트", "상사", "동료",
        "회의", "미팅", "보고서", "이직", "취업", "면접",
    ],
    "health": [
        "건강", "운동", "헬스", "다이어트", "병원", "약",
        "수면", "스트레스", "멘탈", "체력", "영양",
    ],
    "finance": [
        "돈", "투자", "주식", "코인", "저축", "월급",
        "부동산", "대출", "소비", "절약", "경제",
    ],
    "art_culture": [
        "예술", "미술", "전시", "갤러리", "문학", "소설",
        "시", "공연", "연극", "뮤지컬", "클래식", "오페라",
    ],
    "sports": [
        "축구", "야구", "농구", "운동", "경기", "선수",
        "올림픽", "승리", "팀", "리그", "월드컵",
    ],
    "food": [
        "맛집", "요리", "음식", "레시피", "카페", "커피",
        "술", "맥주", "와인", "디저트", "빵",
    ],
    "travel": [
        "여행", "비행기", "호텔", "관광", "해외", "휴가",
        "배낭여행", "국내여행", "명소",
    ],
    "education": [
        "공부", "학교", "대학", "시험", "학원", "수업",
        "강의", "논문", "연구", "자격증",
    ],
    "politics_society": [
        "정치", "사회", "뉴스", "정부", "법", "제도",
        "선거", "국회", "시위", "인권",
    ],
    "nature_science": [
        "과학", "자연", "환경", "우주", "물리", "화학",
        "생물", "지구", "기후", "동물", "식물",
    ],
    "humor": [
        "ㅋㅋ", "ㅎㅎ", "웃기", "개그", "농담", "드립",
        "짤", "밈", "웃음",
    ],
}


class P1TopicAnalyzer:
    """주제 분포 분석기."""

    def __init__(self, custom_keywords: Optional[dict[str, list[str]]] = None):
        self._keywords = {**_TOPIC_KEYWORDS}
        if custom_keywords:
            for cat, words in custom_keywords.items():
                self._keywords.setdefault(cat, []).extend(words)

    def analyze(
        self,
        texts: list[str],
        self_reported_interests: Optional[list[str]] = None,
    ) -> TopicDistribution:
        """텍스트 리스트 → TopicDistribution."""
        if not texts:
            return TopicDistribution()

        # 턴별 토픽 매칭
        topic_counts: Counter = Counter()
        topic_turn_counts: Counter = Counter()

        for text in texts:
            text_lower = text.lower()
            matched_in_turn: set[str] = set()

            for category, keywords in self._keywords.items():
                for kw in keywords:
                    if kw.lower() in text_lower:
                        topic_counts[category] += 1
                        matched_in_turn.add(category)
                        break  # 같은 카테고리에서 중복 카운트 방지

            for cat in matched_in_turn:
                topic_turn_counts[cat] += 1

            if not matched_in_turn:
                topic_counts["other"] += 1
                topic_turn_counts["other"] += 1

        # 비율 계산
        total = sum(topic_counts.values()) + EPSILON
        topics: dict[str, TopicEntry] = {}

        for cat, count in topic_counts.items():
            ratio = count / total
            if ratio >= TOPIC_MIN_RATIO_SIGNIFICANT:
                topics[cat] = TopicEntry(
                    category=cat,
                    ratio=round(ratio, 4),
                    depth="surface",  # 깊이는 P2에서 분석
                    turn_count=topic_turn_counts[cat],
                )

        # 지배적 토픽
        dominant = max(topics, key=lambda k: topics[k].ratio) if topics else "other"

        # Shannon entropy 기반 다양성
        ratios = [t.ratio for t in topics.values() if t.ratio > 0]
        entropy = -sum(r * math.log2(r + EPSILON) for r in ratios)
        max_entropy = math.log2(len(TOPIC_CATEGORIES)) if TOPIC_CATEGORIES else 1.0
        diversity = round(entropy / (max_entropy + EPSILON), 4)

        # 자기신고 괴리 감지
        gaps: list[str] = []
        if self_reported_interests:
            for interest in self_reported_interests:
                interest_lower = interest.lower()
                # 자기신고 관심사와 매칭되는 카테고리 찾기
                matched_cat = self._find_matching_category(interest_lower)
                if matched_cat and matched_cat in topics:
                    if topics[matched_cat].ratio < SELF_REPORT_DISCREPANCY_THRESHOLD:
                        gaps.append(matched_cat)
                elif matched_cat and matched_cat not in topics:
                    gaps.append(matched_cat)

        return TopicDistribution(
            topics=topics,
            dominant_topic=dominant,
            topic_diversity=diversity,
            self_report_gaps=gaps,
        )

    def _find_matching_category(self, interest: str) -> Optional[str]:
        """관심사 문자열 → 가장 가까운 카테고리."""
        for category, keywords in self._keywords.items():
            for kw in keywords:
                if kw.lower() in interest or interest in kw.lower():
                    return category
        # 카테고리명 직접 매칭
        for cat in TOPIC_CATEGORIES:
            if cat in interest or interest in cat:
                return cat
        return None
