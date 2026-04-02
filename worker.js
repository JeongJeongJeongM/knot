/**
 * KNOT EXODIA v3 — Unified Cloudflare Worker
 * Proxy to Anthropic Claude API with integrated PRISM & ANCHOR engines
 * Rate limiting, CORS, v3 interpretation system
 */

// ═══════════════════════════════════════════════════════════════
// ═══════════ PRISM ENGINE ═══════════
// ═══════════════════════════════════════════════════════════════

const PRISM_CONFIG = {
  ENGINE_NAME: 'PRISM',
  ENGINE_VERSION: '1.0.0',
  SPEC_VERSION: '1.0',

  TOPIC_CATEGORIES: [
    'technology', 'relationships', 'daily_life', 'philosophy', 'entertainment',
    'work', 'health', 'finance', 'art_culture', 'sports', 'food', 'travel',
    'education', 'politics_society', 'nature_science', 'humor', 'other',
  ],
  SELF_REPORT_DISCREPANCY_THRESHOLD: 0.05,
  TOPIC_MIN_RATIO_SIGNIFICANT: 0.03,

  DEPTH_LEVELS: ['surface', 'casual', 'analytical', 'exploratory', 'creative'],
  DEPTH_LEVEL_WEIGHTS: {
    'surface': 0.1, 'casual': 0.25, 'analytical': 0.5,
    'exploratory': 0.75, 'creative': 1.0,
  },

  TTR_LOW_THRESHOLD: 0.3,
  TTR_HIGH_THRESHOLD: 0.6,
  ABSTRACTION_THRESHOLD_ABSTRACT: 0.6,
  ABSTRACTION_THRESHOLD_CONCRETE: 0.4,

  QUESTION_TYPES: ['factual', 'opinion', 'hypothesis', 'meta'],

  MIN_TURNS_FOR_ANALYSIS: 5,
  MAX_TURNS_PER_SESSION: 1000,
  EPSILON: 1e-12,
};

const PRISM_TOPIC_KEYWORDS = {
  'technology': [
    '코드', '프로그래밍', '개발', '앱', '소프트웨어', '하드웨어', 'AI', '인공지능',
    '서버', '데이터', '알고리즘', 'API', '컴퓨터', '기술', '디지털', '클라우드', '코딩', '깃',
  ],
  'relationships': [
    '연애', '사랑', '관계', '데이트', '결혼', '이별', '남친', '여친', '짝사랑', '고백', '커플', '썸',
  ],
  'daily_life': [
    '오늘', '어제', '내일', '아침', '저녁', '일상', '집', '출근', '퇴근', '주말', '날씨', '잠',
  ],
  'philosophy': [
    '철학', '존재', '의미', '가치', '윤리', '도덕', '진리', '자유의지', '실존', '형이상학', '인식론',
  ],
  'entertainment': [
    '영화', '드라마', '게임', '음악', '노래', '유튜브', '넷플릭스', '웹툰', '만화', '애니', '콘서트',
  ],
  'work': [
    '회사', '직장', '업무', '프로젝트', '상사', '동료', '회의', '미팅', '보고서', '이직', '취업', '면접',
  ],
  'health': [
    '건강', '운동', '헬스', '다이어트', '병원', '약', '수면', '스트레스', '멘탈', '체력', '영양',
  ],
  'finance': [
    '돈', '투자', '주식', '코인', '저축', '월급', '부동산', '대출', '소비', '절약', '경제',
  ],
  'art_culture': [
    '예술', '미술', '전시', '갤러리', '문학', '소설', '시', '공연', '연극', '뮤지컬', '클래식', '오페라',
  ],
  'sports': [
    '축구', '야구', '농구', '운동', '경기', '선수', '올림픽', '승리', '팀', '리그', '월드컵',
  ],
  'food': [
    '맛집', '요리', '음식', '레시피', '카페', '커피', '술', '맥주', '와인', '디저트', '빵',
  ],
  'travel': [
    '여행', '비행기', '호텔', '관광', '해외', '휴가', '배낭여행', '국내여행', '명소',
  ],
  'education': [
    '공부', '학교', '대학', '시험', '학원', '수업', '강의', '논문', '연구', '자격증',
  ],
  'politics_society': [
    '정치', '사회', '뉴스', '정부', '법', '제도', '선거', '국회', '시위', '인권',
  ],
  'nature_science': [
    '과학', '자연', '환경', '우주', '물리', '화학', '생물', '지구', '기후', '동물', '식물',
  ],
  'humor': [
    'ㅋㅋ', 'ㅎㅎ', '웃기', '개그', '농담', '드립', '짤', '밈', '웃음',
  ],
};

const PRISM_DEPTH_SIGNALS = {
  'creative': [
    '내 생각엔', '내가 보기엔', '이렇게 해석', '새로운 관점', '다른 각도에서',
    '재해석', '나만의', '독자적', '제안하자면', '이론을 세워보면',
  ],
  'exploratory': [
    '연결되는', '근본적으로', '본질적', '철학적', '존재론적', '메타', '추상적',
    '구조적으로', '패러다임', '프레임워크', '이면에', '심층적',
  ],
  'analytical': [
    '분석하면', '구조가', '패턴이', '원인은', '비교하면', '통계적', '데이터',
    '논리적', '왜냐하면', '근거는', '증거는', '체계적', '상관관계', '인과', '메커니즘',
  ],
  'casual': [
    '그런 것 같아', '아마', '좀', '약간', '그냥', '뭐', '대충', '느낌',
  ],
  'surface': [
    'ㅇㅇ', 'ㅋㅋ', 'ㄹㅇ', 'ㅎㅎ', '그래', '맞아', '오', '와',
  ],
};

const PRISM_DOMAIN_VOCABULARY = {
  'tech': [
    'API', '서버', '클라이언트', '배포', '디버깅', '리팩토링', '아키텍처',
    '프레임워크', '라이브러리', '인스턴스', '컨테이너', '마이크로서비스',
    '레이턴시', '스케일링', 'CI/CD',
  ],
  'psychology': [
    '인지', '무의식', '투사', '전이', '방어기제', '자아', '트라우마',
    '레질리언스', '메타인지', '스키마', '애착',
  ],
  'finance': [
    '수익률', '포트폴리오', '리스크', '헤지', '배당', '밸류에이션',
    '레버리지', '유동성', '캐시플로우',
  ],
  'art': [
    '구도', '색채', '질감', '미학', '아방가르드', '큐레이션', '매체', '모티프',
    '내러티브', '장르',
  ],
  'science': [
    '가설', '변인', '통제군', '실험군', '유의미', '상관관계', '인과관계',
    '표본', '편향', '메타분석',
  ],
  'philosophy': [
    '존재론', '인식론', '현상학', '해석학', '변증법', '실존주의', '구조주의',
    '해체', '담론', '패러다임',
  ],
};

const PRISM_ABSTRACT_PATTERNS = [
  '개념', '본질', '의미', '가치', '구조', '체계', '패러다임', '프레임', '메타',
  '추상', '이론', '원리', '철학', '존재', '인식', '관점',
];

const PRISM_CONCRETE_PATTERNS = [
  '밥', '집', '차', '돈', '옷', '신발', '먹', '가', '사', '자', '봐',
  '핸드폰', '컴퓨터', '책상', '의자',
];

const PRISM_QUESTION_PATTERNS = {
  'factual': [
    /몇|언제|어디|누구|뭐가|얼마/, /맞아\?|맞지\?|그래\?|진짜\?|정말\?/,
    /있어\?|없어\?|했어\?|됐어\?/,
  ],
  'opinion': [
    /어떻게 생각|어떤 것 같|넌 어때|너는 어떻게/, /의견|생각|느낌|판단/,
    /좋아\?|싫어\?|괜찮\?/,
  ],
  'hypothesis': [
    /만약|가정|혹시|그러면/, /될까|일까|않을까|아닐까/,
    /가능성|확률|경우/,
  ],
  'meta': [
    /왜 그런|이유가|근본적으로|본질/, /의미가|뭘 뜻하|어째서/,
    /구조|체계|시스템|원리/,
  ],
};

function prismComputeHash(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16);
}

function prismNowISO() {
  return new Date().toISOString();
}

function prismCountOccurrences(text, pattern) {
  if (typeof pattern === 'string') {
    const escaped = pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(escaped, 'g');
    const matches = text.match(regex);
    return matches ? matches.length : 0;
  }
  const matches = text.match(pattern);
  return matches ? matches.length : 0;
}

function prismShannonEntropy(probabilities) {
  let entropy = 0;
  for (const p of probabilities) {
    if (p > 0) {
      entropy -= p * Math.log2(p + PRISM_CONFIG.EPSILON);
    }
  }
  return entropy;
}

class PrismP1TopicAnalyzer {
  constructor(customKeywords = null) {
    this.keywords = { ...PRISM_TOPIC_KEYWORDS };
    if (customKeywords) {
      for (const [cat, words] of Object.entries(customKeywords)) {
        if (!this.keywords[cat]) this.keywords[cat] = [];
        this.keywords[cat].push(...words);
      }
    }
  }

  analyze(texts, selfReportedInterests = null) {
    if (!texts || texts.length === 0) {
      return { topics: {}, dominant_topic: '', topic_diversity: 0, self_report_gaps: [] };
    }

    const topicCounts = {};
    const topicTurnCounts = {};

    for (const cat of PRISM_CONFIG.TOPIC_CATEGORIES) {
      topicCounts[cat] = 0;
      topicTurnCounts[cat] = 0;
    }
    topicCounts['other'] = 0;
    topicTurnCounts['other'] = 0;

    for (const text of texts) {
      const textLower = text.toLowerCase();
      const matchedInTurn = new Set();

      for (const [category, keywords] of Object.entries(this.keywords)) {
        for (const kw of keywords) {
          if (textLower.includes(kw.toLowerCase())) {
            if (topicCounts[category] === undefined) {
              topicCounts[category] = 0;
              topicTurnCounts[category] = 0;
            }
            topicCounts[category] += 1;
            matchedInTurn.add(category);
            break;
          }
        }
      }

      for (const cat of matchedInTurn) {
        topicTurnCounts[cat] += 1;
      }

      if (matchedInTurn.size === 0) {
        topicCounts['other'] += 1;
        topicTurnCounts['other'] += 1;
      }
    }

    const total = Object.values(topicCounts).reduce((a, b) => a + b, 0) + PRISM_CONFIG.EPSILON;
    const topics = {};

    for (const [cat, count] of Object.entries(topicCounts)) {
      const ratio = count / total;
      if (ratio >= PRISM_CONFIG.TOPIC_MIN_RATIO_SIGNIFICANT) {
        topics[cat] = {
          category: cat,
          ratio: Math.round(ratio * 10000) / 10000,
          depth: 'surface',
          turn_count: topicTurnCounts[cat] || 0,
        };
      }
    }

    let dominant = 'other';
    let maxRatio = 0;
    for (const [cat, entry] of Object.entries(topics)) {
      if (entry.ratio > maxRatio) {
        maxRatio = entry.ratio;
        dominant = cat;
      }
    }

    const ratios = Object.values(topics).map(t => t.ratio).filter(r => r > 0);
    const entropy = prismShannonEntropy(ratios);
    const maxEntropy = Math.log2(PRISM_CONFIG.TOPIC_CATEGORIES.length) || 1.0;
    const diversity = Math.round((entropy / (maxEntropy + PRISM_CONFIG.EPSILON)) * 10000) / 10000;

    const gaps = [];
    if (selfReportedInterests) {
      for (const interest of selfReportedInterests) {
        const interestLower = interest.toLowerCase();
        const matchedCat = this._findMatchingCategory(interestLower);
        if (matchedCat && topics[matchedCat]) {
          if (topics[matchedCat].ratio < PRISM_CONFIG.SELF_REPORT_DISCREPANCY_THRESHOLD) {
            gaps.push(matchedCat);
          }
        } else if (matchedCat && !topics[matchedCat]) {
          gaps.push(matchedCat);
        }
      }
    }

    return { topics, dominant_topic: dominant, topic_diversity: diversity, self_report_gaps: gaps };
  }

  _findMatchingCategory(interest) {
    for (const [category, keywords] of Object.entries(this.keywords)) {
      for (const kw of keywords) {
        if (kw.toLowerCase().includes(interest) || interest.includes(kw.toLowerCase())) {
          return category;
        }
      }
    }
    for (const cat of PRISM_CONFIG.TOPIC_CATEGORIES) {
      if (cat.includes(interest) || interest.includes(cat)) {
        return cat;
      }
    }
    return null;
  }
}

class PrismP2DepthAnalyzer {
  analyze(texts, topicDistribution = null) {
    if (!texts || texts.length === 0) {
      return { depth_by_topic: {}, overall_depth: 'surface', depth_consistency: 'consistent' };
    }

    const depthScores = [];
    for (const text of texts) {
      const depth = this._classifyDepth(text);
      depthScores.push(depth);
    }

    const depthCounter = {};
    for (const level of PRISM_CONFIG.DEPTH_LEVELS) {
      depthCounter[level] = 0;
    }
    for (const depth of depthScores) {
      depthCounter[depth]++;
    }

    const total = depthScores.length;
    let weightedSum = 0;
    for (const [level, count] of Object.entries(depthCounter)) {
      const weight = PRISM_CONFIG.DEPTH_LEVEL_WEIGHTS[level] || 0.1;
      weightedSum += weight * count;
    }
    const avgWeight = total > 0 ? weightedSum / total : 0;
    const overall = this._weightToLevel(avgWeight);

    const depthByTopic = {};
    if (topicDistribution && topicDistribution.topics) {
      for (const cat of Object.keys(topicDistribution.topics)) {
        depthByTopic[cat] = overall;
      }
    }

    const uniqueDepths = new Set(depthScores);
    let consistency = 'consistent';
    if (uniqueDepths.size >= 4) {
      consistency = 'variable';
    } else if (uniqueDepths.size >= 3) {
      consistency = 'topic_dependent';
    }

    return { depth_by_topic: depthByTopic, overall_depth: overall, depth_consistency: consistency };
  }

  _classifyDepth(text) {
    const textLower = text.toLowerCase();
    const scores = {};

    for (const level of PRISM_CONFIG.DEPTH_LEVELS) {
      scores[level] = 0;
    }

    for (const [level, signals] of Object.entries(PRISM_DEPTH_SIGNALS)) {
      for (const signal of signals) {
        if (textLower.includes(signal)) {
          scores[level]++;
        }
      }
    }

    const maxScore = Math.max(...Object.values(scores));

    if (maxScore === 0) {
      if (text.length < 10) return 'surface';
      if (text.length < 50) return 'casual';
      return 'casual';
    }

    for (let i = PRISM_CONFIG.DEPTH_LEVELS.length - 1; i >= 0; i--) {
      const level = PRISM_CONFIG.DEPTH_LEVELS[i];
      if (scores[level] === maxScore) {
        return level;
      }
    }
    return 'surface';
  }

  _weightToLevel(weight) {
    if (weight >= 0.85) return 'creative';
    if (weight >= 0.6) return 'exploratory';
    if (weight >= 0.4) return 'analytical';
    if (weight >= 0.2) return 'casual';
    return 'surface';
  }
}

class PrismP3VocabularyAnalyzer {
  analyze(texts) {
    if (!texts || texts.length === 0) {
      return {
        diversity: 'moderate', dominant_domains: [], abstraction: 'balanced',
        register_range: 'moderate', lexical_diversity_raw: 0,
      };
    }

    const allText = texts.join(' ');
    const tokens = this._tokenize(allText);

    if (!tokens || tokens.length === 0) {
      return {
        diversity: 'moderate', dominant_domains: [], abstraction: 'balanced',
        register_range: 'moderate', lexical_diversity_raw: 0,
      };
    }

    const ttr = this._computeTTR(tokens);
    const diversity = this._classifyDiversity(ttr);
    const dominantDomains = this._detectDomains(allText);
    const abstraction = this._analyzeAbstraction(allText);
    const registerRange = this._analyzeRegister(texts);

    return {
      diversity, dominant_domains: dominantDomains, abstraction, register_range: registerRange,
      lexical_diversity_raw: Math.round(ttr * 10000) / 10000,
    };
  }

  _tokenize(text) {
    const regex = /[가-힣]+|[a-zA-Z]+|[0-9]+/g;
    const matches = text.match(regex) || [];
    return matches.map(t => t.toLowerCase()).filter(t => t.length > 1);
  }

  _computeTTR(tokens) {
    if (!tokens || tokens.length === 0) return 0;
    const types = new Set(tokens);
    return types.size / (Math.sqrt(tokens.length) + PRISM_CONFIG.EPSILON);
  }

  _classifyDiversity(ttr) {
    if (ttr >= PRISM_CONFIG.TTR_HIGH_THRESHOLD) return 'high';
    if (ttr >= PRISM_CONFIG.TTR_LOW_THRESHOLD) return 'moderate';
    return 'low';
  }

  _detectDomains(text) {
    const textLower = text.toLowerCase();
    const domainScores = {};

    for (const [domain, vocab] of Object.entries(PRISM_DOMAIN_VOCABULARY)) {
      domainScores[domain] = 0;
      for (const term of vocab) {
        if (textLower.includes(term.toLowerCase())) {
          domainScores[domain]++;
        }
      }
    }

    const sorted = Object.entries(domainScores)
      .sort((a, b) => b[1] - a[1])
      .filter(([_, count]) => count >= 2)
      .map(([domain, _]) => domain);

    return sorted;
  }

  _analyzeAbstraction(text) {
    const textLower = text.toLowerCase();
    let abstractCount = 0;
    let concreteCount = 0;

    for (const pattern of PRISM_ABSTRACT_PATTERNS) {
      if (textLower.includes(pattern)) abstractCount++;
    }

    for (const pattern of PRISM_CONCRETE_PATTERNS) {
      if (textLower.includes(pattern)) concreteCount++;
    }

    const total = abstractCount + concreteCount + PRISM_CONFIG.EPSILON;
    const abstractRatio = abstractCount / total;

    if (abstractRatio >= PRISM_CONFIG.ABSTRACTION_THRESHOLD_ABSTRACT) {
      return 'leans_abstract';
    }
    if (abstractRatio <= PRISM_CONFIG.ABSTRACTION_THRESHOLD_CONCRETE) {
      return 'leans_concrete';
    }
    return 'balanced';
  }

  _analyzeRegister(texts) {
    let formalCount = 0;
    let informalCount = 0;
    let englishCount = 0;

    for (const text of texts) {
      if (/습니다|세요|시겠|드릴|하옵/.test(text)) {
        formalCount++;
      }
      if (/ㅋㅋ|ㅎㅎ|ㅇㅇ|ㄹㅇ|ㅇㅋ|야|임마/.test(text)) {
        informalCount++;
      }
      if (/[a-zA-Z]{3,}/.test(text)) {
        englishCount++;
      }
    }

    const total = texts.length;
    if (total === 0) return 'narrow';

    const threshold = total * 0.1;
    let uniqueRegisters = 0;
    if (formalCount > threshold) uniqueRegisters++;
    if (informalCount > threshold) uniqueRegisters++;
    if (englishCount > threshold) uniqueRegisters++;

    if (uniqueRegisters >= 3) return 'wide';
    if (uniqueRegisters >= 2) return 'moderate';
    return 'narrow';
  }
}

class PrismP4CuriosityAnalyzer {
  analyze(texts) {
    if (!texts || texts.length === 0) {
      return {
        question_ratio: 0, dominant_type: 'factual', depth_vs_breadth: 'balanced',
        follow_up_tendency: 'moderate', question_type_distribution: {},
      };
    }

    const totalTurns = texts.length;
    let questionTurns = 0;
    const questionTypes = {};
    let topicTransitions = 0;
    let followUps = 0;
    let prevTopicHash = null;

    for (const qtype of PRISM_CONFIG.QUESTION_TYPES) {
      questionTypes[qtype] = 0;
    }

    for (let i = 0; i < texts.length; i++) {
      const text = texts[i];
      const isQuestion = this._isQuestion(text);

      if (isQuestion) {
        questionTurns++;
        const qtype = this._classifyQuestionType(text);
        questionTypes[qtype]++;
      }

      const topicHash = this._topicHash(text);
      if (prevTopicHash !== null) {
        if (topicHash !== prevTopicHash) {
          topicTransitions++;
        } else if (isQuestion) {
          followUps++;
        }
      }
      prevTopicHash = topicHash;
    }

    const questionRatio = Math.round((questionTurns / (totalTurns + PRISM_CONFIG.EPSILON)) * 10000) / 10000;

    let dominantType = 'factual';
    let maxCount = 0;
    for (const [qtype, count] of Object.entries(questionTypes)) {
      if (count > maxCount) {
        maxCount = count;
        dominantType = qtype;
      }
    }

    const transitionRate = topicTransitions / (totalTurns + PRISM_CONFIG.EPSILON);
    let depthVsBreadth = 'balanced';
    if (transitionRate > 0.4) {
      depthVsBreadth = 'wide_scanner';
    } else if (transitionRate < 0.15) {
      depthVsBreadth = 'deep_diver';
    }

    let followUpTendency = 'moderate';
    if (questionTurns > 0) {
      const followUpRate = followUps / (questionTurns + PRISM_CONFIG.EPSILON);
      if (followUpRate > 0.5) {
        followUpTendency = 'high';
      } else if (followUpRate > 0.2) {
        followUpTendency = 'moderate';
      } else {
        followUpTendency = 'low';
      }
    } else {
      followUpTendency = 'low';
    }

    const totalQ = Object.values(questionTypes).reduce((a, b) => a + b, 0) + PRISM_CONFIG.EPSILON;
    const typeDistribution = {};
    for (const [qtype, count] of Object.entries(questionTypes)) {
      typeDistribution[qtype] = Math.round((count / totalQ) * 10000) / 10000;
    }

    return {
      question_ratio: questionRatio, dominant_type: dominantType, depth_vs_breadth: depthVsBreadth,
      follow_up_tendency: followUpTendency, question_type_distribution: typeDistribution,
    };
  }

  _isQuestion(text) {
    if (text.includes('?') || text.includes('？')) {
      return true;
    }
    if (/까\??|나\??|니\??|지\??|냐\??|가\??$/.test(text.trim())) {
      return true;
    }
    return false;
  }

  _classifyQuestionType(text) {
    const scores = {};
    for (const qtype of PRISM_CONFIG.QUESTION_TYPES) {
      scores[qtype] = 0;
    }

    for (const [qtype, patterns] of Object.entries(PRISM_QUESTION_PATTERNS)) {
      for (const pattern of patterns) {
        if (pattern.test(text)) {
          scores[qtype]++;
        }
      }
    }

    let maxScore = 0;
    let result = 'factual';
    for (const [qtype, score] of Object.entries(scores)) {
      if (score > maxScore) {
        maxScore = score;
        result = qtype;
      }
    }

    return result;
  }

  _topicHash(text) {
    const regex = /[가-힣]{2,}/g;
    const words = text.match(regex) || [];
    const sorted = words.sort((a, b) => b.length - a.length).slice(0, 3);
    let hash = 0;
    for (const word of sorted) {
      for (let i = 0; i < word.length; i++) {
        hash = ((hash << 5) - hash) + word.charCodeAt(i);
        hash = hash & hash;
      }
    }
    return Math.abs(hash) % 100;
  }
}

function analyzePrism(messages, selfReportedInterests = null) {
  if (!messages || messages.length === 0) {
    return {
      error: 'INSUFFICIENT_TURNS',
      message: 'No messages provided',
    };
  }

  const userMessages = messages.filter(msg => msg.sender === 'user' || !msg.sender);
  const texts = userMessages.map(msg => msg.text);

  if (texts.length < PRISM_CONFIG.MIN_TURNS_FOR_ANALYSIS) {
    return {
      error: 'INSUFFICIENT_TURNS',
      message: `Need at least ${PRISM_CONFIG.MIN_TURNS_FOR_ANALYSIS} turns, got ${texts.length}`,
    };
  }

  const inputHash = prismComputeHash(texts.join('||'));

  const p1 = new PrismP1TopicAnalyzer();
  const topicDist = p1.analyze(texts, selfReportedInterests);

  const p2 = new PrismP2DepthAnalyzer();
  const engagement = p2.analyze(texts, topicDist);

  for (const [cat, entry] of Object.entries(topicDist.topics)) {
    if (engagement.depth_by_topic[cat]) {
      entry.depth = engagement.depth_by_topic[cat];
    }
  }

  const p3 = new PrismP3VocabularyAnalyzer();
  const vocabulary = p3.analyze(texts);

  const p4 = new PrismP4CuriosityAnalyzer();
  const curiosity = p4.analyze(texts);

  return {
    topic_distribution: topicDist,
    engagement: engagement,
    vocabulary: vocabulary,
    curiosity: curiosity,
    metadata: {
      engine_version: PRISM_CONFIG.ENGINE_VERSION,
      spec_version: PRISM_CONFIG.SPEC_VERSION,
      computed_at: prismNowISO(),
      input_hash: inputHash,
      turn_count: texts.length,
    },
  };
}

// ═══════════════════════════════════════════════════════════════
// ═══════════ ANCHOR ENGINE ═══════════
// ═══════════════════════════════════════════════════════════════

const ANCHOR_CONFIG = {
  ENGINE_NAME: "ANCHOR",
  ENGINE_VERSION: "1.0.0",
  SPEC_VERSION: "1.0",

  ATTACHMENT_TENDENCIES: [
    "leans_secure", "leans_anxious", "leans_avoidant", "leans_disorganized",
  ],
  STRESS_SHIFT_PATTERNS: [
    "stable_under_pressure", "mild_anxious_under_pressure", "withdrawal_under_pressure",
    "escalation_under_pressure", "inconsistent_under_pressure",
  ],
  REASSURANCE_SEEKING_HIGH: 0.15,
  EMOTIONAL_AVOIDANCE_HIGH: 0.20,

  CONFLICT_MODES: [
    "direct_engagement", "diplomatic_approach", "strategic_withdrawal", "avoidance", "escalation",
  ],
  RECOVERY_SPEED_LABELS: ["fast", "moderate", "slow"],
  PATTERN_FLEXIBILITY_LABELS: ["rigid", "medium", "flexible"],

  RECOGNITION_SPEED_LABELS: ["slow", "moderate", "quick"],
  RESPONSE_STYLES: [
    "dismissive", "acknowledging", "supportive", "empathic_exploration",
  ],
  SOLUTION_VS_SPACE_LABELS: [
    "solution_focused", "balanced", "space_holding",
  ],
  SELF_DISCLOSURE_LABELS: ["minimal", "moderate", "open"],

  GROWTH_ORIENTATIONS: [
    "active_growth", "reflective_growth", "stability_oriented", "externally_driven",
  ],
  CHANGE_TOLERANCE_LABELS: ["low", "moderate", "high"],
  IMPROVEMENT_FREQUENCY_LABELS: ["rare", "periodic", "frequent"],

  MATCH_WEIGHT_ATTACHMENT: 0.30,
  MATCH_WEIGHT_CONFLICT: 0.25,
  MATCH_WEIGHT_EMOTIONAL: 0.25,
  MATCH_WEIGHT_GROWTH: 0.20,

  MIN_TURNS_FOR_ANALYSIS: 10,
  MAX_TURNS_PER_SESSION: 1000,
  EPSILON: 1e-12,
  JSON_ROUND_DIGITS: 4,
};

const ANCHOR_SECURE_SIGNALS = [
  "괜찮아", "이해해", "고마워", "알겠어", "맞아", "당연하지", "그럴 수 있지",
  "충분해", "함께",
];

const ANCHOR_ANXIOUS_SIGNALS = [
  "왜 답 안 해", "언제 연락", "나 싫어", "혼자", "확인", "진짜", "불안", "걱정",
  "왜 안 돼", "나한테 관심", "무시하는 거", "다른 사람", "어디야", "뭐하는 거야", "화났어",
];

const ANCHOR_AVOIDANT_SIGNALS = [
  "그냥", "몰라", "알아서 해", "바빠", "나중에", "상관없어", "별로", "귀찮",
  "그런 얘기 왜", "감정적이지 마", "오버하지 마",
];

const ANCHOR_DISORGANIZED_SIGNALS = [
  "사랑해 근데 짜증나", "보고 싶은데 만나기 싫", "좋은데 불안해",
  "가까이 오지마 근데 가지마",
];

const ANCHOR_STRESS_INDICATORS = [
  "짜증", "화", "스트레스", "힘들", "지쳤", "싸움", "갈등", "문제", "왜 그래", "미치겠",
];

const ANCHOR_CONFLICT_SIGNALS = {
  "direct_engagement": [
    "솔직히 말하면", "직접적으로", "문제가", "이건 아닌 것 같아", "확실히 해야",
    "말해야 할 게 있어", "불만이 있어", "이렇게 하면 안 돼", "동의 못해",
  ],
  "diplomatic_approach": [
    "혹시", "어떻게 생각해", "이해는 하는데", "조심스럽지만", "말하기 좀 그렇지만",
    "기분 나쁘면 미안한데", "네 입장도 알겠는데", "한편으로는", "다만",
  ],
  "strategic_withdrawal": [
    "나중에 얘기하자", "좀 생각해볼게", "정리되면 말할게", "지금은 좀",
    "시간이 좀 필요해", "머리 좀 식히고",
  ],
  "avoidance": [
    "그냥 됐어", "몰라 그냥", "아무거나", "상관없어", "그 얘기는 그만", "됐어 됐어",
    "넘어가자", "굳이", "별거 아니야",
  ],
  "escalation": [
    "맨날 이래", "항상 너는", "지난번에도", "도대체", "이게 몇 번째야",
    "진짜 너무하다", "정말 어이없",
  ],
};

const ANCHOR_CONFLICT_CONTEXT = [
  "싸움", "갈등", "불만", "화나", "짜증", "논쟁", "다툼", "의견 차이",
  "문제가", "불편", "서운", "섭섭", "안 맞",
];

const ANCHOR_EMPATHIC_SIGNALS = [
  "그랬구나", "힘들었겠다", "이해해", "맞아 그럴 수 있어", "당연히 그렇지",
  "많이 힘들었을 텐데", "어떤 기분이었어", "더 얘기해줘", "괜찮아", "네 마음이 어때",
];

const ANCHOR_DISMISSIVE_SIGNALS = [
  "에이 그 정도로", "좀 오버 아니야", "별거 아니야", "너무 예민해", "감정적이야",
  "쿨하게 넘겨", "다 그래", "원래 그런 거야",
];

const ANCHOR_SOLUTION_SIGNALS = [
  "이렇게 해봐", "해결책은", "방법이 있어", "~하면 돼", "내가 도와줄게",
  "그러지 말고", "차라리", "그냥 ~해",
];

const ANCHOR_SPACE_HOLDING_SIGNALS = [
  "천천히 얘기해", "급할 거 없어", "다 들을게", "네 속도대로", "준비되면 말해",
  "여기 있을게",
];

const ANCHOR_SELF_DISCLOSURE_SIGNALS = [
  "나도 그런 적", "솔직히 나는", "내 경험에는", "나한테도", "나도 사실", "내 얘기인데",
];

const ANCHOR_ACTIVE_GROWTH_SIGNALS = [
  "배우고 싶", "도전", "성장", "발전", "개선", "새로운 시도", "변화", "목표",
  "계획", "노력", "공부", "연습", "더 나아",
];

const ANCHOR_REFLECTIVE_SIGNALS = [
  "돌아보면", "경험상", "교훈", "깨달", "알게 됐", "배웠", "실수에서", "반성",
];

const ANCHOR_STABILITY_SIGNALS = [
  "현재가 좋", "만족", "이대로", "편안", "굳이", "바꿀 필요", "충분", "안정",
];

const ANCHOR_EXTERNAL_SIGNALS = [
  "시키면", "해야 하니까", "어쩔 수 없", "강제", "의무", "분위기상", "다들 그러니까",
];

const ANCHOR_ATTACHMENT_COMPATIBILITY = {
  "leans_secure,leans_secure": 0.90,
  "leans_secure,leans_anxious": 0.65,
  "leans_secure,leans_avoidant": 0.60,
  "leans_secure,leans_disorganized": 0.40,
  "leans_anxious,leans_secure": 0.65,
  "leans_anxious,leans_anxious": 0.50,
  "leans_anxious,leans_avoidant": 0.20,
  "leans_anxious,leans_disorganized": 0.15,
  "leans_avoidant,leans_secure": 0.60,
  "leans_avoidant,leans_anxious": 0.20,
  "leans_avoidant,leans_avoidant": 0.35,
  "leans_avoidant,leans_disorganized": 0.15,
  "leans_disorganized,leans_secure": 0.40,
  "leans_disorganized,leans_anxious": 0.15,
  "leans_disorganized,leans_avoidant": 0.15,
  "leans_disorganized,leans_disorganized": 0.10,
};

function R1AttachmentAnalyzer_analyze(texts) {
  if (!texts || texts.length === 0) {
    return {
      primary_tendency: "leans_secure",
      stress_shift: "stable_under_pressure",
      narrative: "",
      reassurance_seeking_ratio: 0.0,
      emotional_avoidance_ratio: 0.0,
    };
  }

  const total = texts.length;
  let secure_count = 0, anxious_count = 0, avoidant_count = 0, disorganized_count = 0;
  let reassurance_count = 0, avoidance_count = 0;
  const stress_texts = [], normal_texts = [];

  for (const text of texts) {
    const text_lower = text.toLowerCase();
    const is_stress = ANCHOR_STRESS_INDICATORS.some(s => text_lower.includes(s));

    if (is_stress) {
      stress_texts.push(text);
    } else {
      normal_texts.push(text);
    }

    if (ANCHOR_SECURE_SIGNALS.some(s => text_lower.includes(s))) secure_count++;
    if (ANCHOR_ANXIOUS_SIGNALS.some(s => text_lower.includes(s))) {
      anxious_count++;
      reassurance_count++;
    }
    if (ANCHOR_AVOIDANT_SIGNALS.some(s => text_lower.includes(s))) {
      avoidant_count++;
      avoidance_count++;
    }
    if (ANCHOR_DISORGANIZED_SIGNALS.some(s => text_lower.includes(s))) disorganized_count++;
  }

  const counts = {
    "leans_secure": secure_count,
    "leans_anxious": anxious_count,
    "leans_avoidant": avoidant_count,
    "leans_disorganized": disorganized_count,
  };

  let primary = Object.keys(counts).reduce((a, b) => counts[a] >= counts[b] ? a : b);
  if (Object.values(counts).every(v => v === 0)) {
    primary = "leans_secure";
  }

  const stress_shift = R1AttachmentAnalyzer_analyzeStressShift(normal_texts, stress_texts, primary);

  const reassurance_ratio = Math.round((reassurance_count / (total + ANCHOR_CONFIG.EPSILON)) * 10000) / 10000;
  const avoidance_ratio = Math.round((avoidance_count / (total + ANCHOR_CONFIG.EPSILON)) * 10000) / 10000;

  const narrative = R1AttachmentAnalyzer_generateNarrative(primary, stress_shift, reassurance_ratio, avoidance_ratio);

  return {
    primary_tendency: primary,
    stress_shift: stress_shift,
    narrative: narrative,
    reassurance_seeking_ratio: reassurance_ratio,
    emotional_avoidance_ratio: avoidance_ratio,
  };
}

function R1AttachmentAnalyzer_analyzeStressShift(normal_texts, stress_texts, normal_tendency) {
  if (stress_texts.length === 0) {
    return "stable_under_pressure";
  }

  let stress_anxious = 0, stress_avoidant = 0;

  for (const text of stress_texts) {
    const text_lower = text.toLowerCase();
    if (ANCHOR_ANXIOUS_SIGNALS.some(s => text_lower.includes(s))) stress_anxious++;
    if (ANCHOR_AVOIDANT_SIGNALS.some(s => text_lower.includes(s))) stress_avoidant++;
  }

  const total_stress = stress_texts.length + ANCHOR_CONFIG.EPSILON;

  if (stress_anxious / total_stress > 0.4) {
    return "mild_anxious_under_pressure";
  } else if (stress_avoidant / total_stress > 0.4) {
    return "withdrawal_under_pressure";
  } else if (stress_anxious > 0 && stress_avoidant > 0) {
    return "inconsistent_under_pressure";
  } else if (normal_tendency === "leans_secure") {
    return "stable_under_pressure";
  } else {
    return "escalation_under_pressure";
  }
}

function R1AttachmentAnalyzer_generateNarrative(tendency, stress_shift, reassurance_ratio, avoidance_ratio) {
  const narratives = {
    "leans_secure": "평상시 안정적이고 일관된 대화 패턴을 보입니다.",
    "leans_anxious": "감정적 확인과 연결 유지에 대한 관심이 높은 대화 패턴을 보입니다.",
    "leans_avoidant": "감정적 거리를 유지하며 독립적인 대화 패턴을 보입니다.",
    "leans_disorganized": "감정 표현에 있어 상반된 경향이 공존하는 패턴을 보입니다.",
  };

  const stress_narratives = {
    "stable_under_pressure": "",
    "mild_anxious_under_pressure": " 감정적 압박 상황에서 확인 요구가 증가하는 경향이 있습니다.",
    "withdrawal_under_pressure": " 감정적 압박 상황에서 거리두기 경향이 나타납니다.",
    "escalation_under_pressure": " 감정적 압박 상황에서 감정 표현이 강해지는 경향이 있습니다.",
    "inconsistent_under_pressure": " 감정적 압박 상황에서 반응 패턴이 일관적이지 않습니다.",
  };

  const base = narratives[tendency] || "";
  const stress_note = stress_narratives[stress_shift] || "";
  return base + stress_note;
}

function R2ConflictAnalyzer_analyze(texts) {
  if (!texts || texts.length === 0) {
    return {
      default_mode: "diplomatic_approach",
      under_pressure: "diplomatic_approach",
      recovery_speed: "moderate",
      pattern_flexibility: "medium",
      narrative: "",
    };
  }

  const default_mode = R2ConflictAnalyzer_classifyMode(texts);
  const conflict_texts = texts.filter(t => ANCHOR_CONFLICT_CONTEXT.some(c => t.toLowerCase().includes(c)));
  const under_pressure = conflict_texts.length > 0
    ? R2ConflictAnalyzer_classifyMode(conflict_texts)
    : default_mode;

  const recovery = R2ConflictAnalyzer_estimateRecovery(texts);
  const flexibility = R2ConflictAnalyzer_estimateFlexibility(texts);

  const narrative = R2ConflictAnalyzer_generateNarrative(default_mode, under_pressure, recovery, flexibility);

  return {
    default_mode: default_mode,
    under_pressure: under_pressure,
    recovery_speed: recovery,
    pattern_flexibility: flexibility,
    narrative: narrative,
  };
}

function R2ConflictAnalyzer_classifyMode(texts) {
  const mode_counts = {};
  for (const mode of ANCHOR_CONFIG.CONFLICT_MODES) {
    mode_counts[mode] = 0;
  }

  for (const text of texts) {
    const text_lower = text.toLowerCase();
    for (const [mode, signals] of Object.entries(ANCHOR_CONFLICT_SIGNALS)) {
      for (const signal of signals) {
        if (text_lower.includes(signal)) {
          mode_counts[mode]++;
          break;
        }
      }
    }
  }

  const modes = Object.keys(mode_counts);
  if (modes.length === 0) {
    return "diplomatic_approach";
  }

  return modes.reduce((a, b) => mode_counts[a] > mode_counts[b] ? a : b);
}

function R2ConflictAnalyzer_estimateRecovery(texts) {
  let in_conflict = false;
  let conflict_duration = 0;
  const recovery_durations = [];

  for (const text of texts) {
    const text_lower = text.toLowerCase();
    const is_conflict = ANCHOR_CONFLICT_CONTEXT.some(c => text_lower.includes(c));

    if (is_conflict) {
      in_conflict = true;
      conflict_duration++;
    } else if (in_conflict) {
      recovery_durations.push(conflict_duration);
      in_conflict = false;
      conflict_duration = 0;
    }
  }

  if (recovery_durations.length === 0) {
    return "moderate";
  }

  const avg_duration = recovery_durations.reduce((a, b) => a + b, 0) / recovery_durations.length;
  if (avg_duration <= 2) {
    return "fast";
  } else if (avg_duration <= 5) {
    return "moderate";
  } else {
    return "slow";
  }
}

function R2ConflictAnalyzer_estimateFlexibility(texts) {
  const modes_used = new Set();

  for (const text of texts) {
    const text_lower = text.toLowerCase();
    for (const [mode, signals] of Object.entries(ANCHOR_CONFLICT_SIGNALS)) {
      if (signals.some(signal => text_lower.includes(signal))) {
        modes_used.add(mode);
      }
    }
  }

  if (modes_used.size >= 3) {
    return "flexible";
  } else if (modes_used.size >= 2) {
    return "medium";
  } else {
    return "rigid";
  }
}

function R2ConflictAnalyzer_generateNarrative(default_mode, under_pressure, recovery, flexibility) {
  const mode_desc = {
    "direct_engagement": "불편한 사안을 직접적으로 꺼내어 논의하는",
    "diplomatic_approach": "상대의 감정을 고려하며 신중하게 접근하는",
    "strategic_withdrawal": "일단 정리한 후 재접근하는",
    "avoidance": "갈등 상황을 우회하거나 넘기는",
    "escalation": "감정이 확대되는 방향으로 반응하는",
  };

  let base = `평상시 ${mode_desc[default_mode] || '중립적인'} 패턴을 보입니다.`;

  if (under_pressure !== default_mode) {
    const pressure_desc = mode_desc[under_pressure] || "다른";
    base += ` 강한 압박 상황에서는 ${pressure_desc} 방향으로 변화합니다.`;
  }

  return base;
}

function R3EmotionalAnalyzer_analyze(texts) {
  if (!texts || texts.length === 0) {
    return {
      recognition: "moderate",
      response_style: "supportive",
      solution_vs_space: "balanced",
      self_disclosure: "moderate",
      narrative: "",
    };
  }

  const total = texts.length;
  let empathic = 0, dismissive = 0, solution = 0, space = 0, disclosure = 0;

  for (const text of texts) {
    const tl = text.toLowerCase();
    if (ANCHOR_EMPATHIC_SIGNALS.some(s => tl.includes(s))) empathic++;
    if (ANCHOR_DISMISSIVE_SIGNALS.some(s => tl.includes(s))) dismissive++;
    if (ANCHOR_SOLUTION_SIGNALS.some(s => tl.includes(s))) solution++;
    if (ANCHOR_SPACE_HOLDING_SIGNALS.some(s => tl.includes(s))) space++;
    if (ANCHOR_SELF_DISCLOSURE_SIGNALS.some(s => tl.includes(s))) disclosure++;
  }

  const empathic_ratio = empathic / (total + ANCHOR_CONFIG.EPSILON);
  let recognition = "slow";
  if (empathic_ratio > 0.2) {
    recognition = "quick";
  } else if (empathic_ratio > 0.08) {
    recognition = "moderate";
  }

  const style_counts = {
    "dismissive": dismissive,
    "acknowledging": Math.max(0, total - empathic - dismissive - solution - space),
    "supportive": solution + space,
    "empathic_exploration": empathic,
  };
  let response_style = Object.keys(style_counts).reduce((a, b) =>
    style_counts[a] >= style_counts[b] ? a : b
  );
  if (Object.values(style_counts).every(v => v === 0)) {
    response_style = "acknowledging";
  }

  const sol_total = solution + space + ANCHOR_CONFIG.EPSILON;
  let sol_vs_space = "balanced";
  if (solution / sol_total > 0.7) {
    sol_vs_space = "solution_focused";
  } else if (space / sol_total > 0.7) {
    sol_vs_space = "space_holding";
  }

  const disc_ratio = disclosure / (total + ANCHOR_CONFIG.EPSILON);
  let self_disc = "minimal";
  if (disc_ratio > 0.15) {
    self_disc = "open";
  } else if (disc_ratio > 0.05) {
    self_disc = "moderate";
  }

  const narrative = R3EmotionalAnalyzer_generateNarrative(recognition, response_style, sol_vs_space, self_disc);

  return {
    recognition: recognition,
    response_style: response_style,
    solution_vs_space: sol_vs_space,
    self_disclosure: self_disc,
    narrative: narrative,
  };
}

function R3EmotionalAnalyzer_generateNarrative(recog, style, svs, disc) {
  const style_desc = {
    "dismissive": "감정 표현을 최소화하는",
    "acknowledging": "감정을 인정하되 깊이 들어가지 않는",
    "supportive": "지지적으로 반응하는",
    "empathic_exploration": "공감하며 감정을 함께 탐색하는",
  };
  const svs_desc = {
    "solution_focused": "해결책 제시를 선호합니다.",
    "balanced": "해결책과 감정 공간을 균형있게 제공합니다.",
    "space_holding": "감정을 풀 수 있는 공간을 우선 만들어줍니다.",
  };
  return (
    `상대의 감정에 대해 ${style_desc[style] || '중립적으로'} 패턴을 보이며, ` +
    `${svs_desc[svs] || ''}`
  );
}

function R4GrowthAnalyzer_analyze(texts) {
  if (!texts || texts.length === 0) {
    return {
      orientation: "reflective_growth",
      change_tolerance: "moderate",
      self_improvement_frequency: "periodic",
      narrative: "",
    };
  }

  const total = texts.length;
  let active = 0, reflective = 0, stability = 0, external = 0;

  for (const text of texts) {
    const tl = text.toLowerCase();
    if (ANCHOR_ACTIVE_GROWTH_SIGNALS.some(s => tl.includes(s))) active++;
    if (ANCHOR_REFLECTIVE_SIGNALS.some(s => tl.includes(s))) reflective++;
    if (ANCHOR_STABILITY_SIGNALS.some(s => tl.includes(s))) stability++;
    if (ANCHOR_EXTERNAL_SIGNALS.some(s => tl.includes(s))) external++;
  }

  const counts = {
    "active_growth": active,
    "reflective_growth": reflective,
    "stability_oriented": stability,
    "externally_driven": external,
  };

  let orientation = Object.keys(counts).reduce((a, b) =>
    counts[a] >= counts[b] ? a : b
  );
  if (Object.values(counts).every(v => v === 0)) {
    orientation = "reflective_growth";
  }

  const change_signals = active + reflective;
  const resist_signals = stability + external;
  const change_total = change_signals + resist_signals + ANCHOR_CONFIG.EPSILON;
  const change_ratio = change_signals / change_total;

  let change_tolerance = "moderate";
  if (change_ratio > 0.65) {
    change_tolerance = "high";
  } else if (change_ratio > 0.35) {
    change_tolerance = "moderate";
  } else {
    change_tolerance = "low";
  }

  const improvement_ratio = (active + reflective) / (total + ANCHOR_CONFIG.EPSILON);
  let frequency = "rare";
  if (improvement_ratio > 0.2) {
    frequency = "frequent";
  } else if (improvement_ratio > 0.08) {
    frequency = "periodic";
  }

  const narrative = R4GrowthAnalyzer_generateNarrative(orientation, change_tolerance);

  return {
    orientation: orientation,
    change_tolerance: change_tolerance,
    self_improvement_frequency: frequency,
    narrative: narrative,
  };
}

function R4GrowthAnalyzer_generateNarrative(orientation, tolerance) {
  const orient_desc = {
    "active_growth": "지속적인 자기 개선과 새로운 시도를 추구하는 패턴을 보입니다.",
    "reflective_growth": "경험에서 배우며 점진적으로 성장하는 패턴을 보입니다.",
    "stability_oriented": "현재의 안정적인 상태를 선호하는 패턴을 보입니다.",
    "externally_driven": "외부 자극이나 환경 변화에 의해 움직이는 패턴을 보입니다.",
  };
  return orient_desc[orientation] || "";
}

function analyzeAnchor(messages) {
  if (!messages || !Array.isArray(messages)) {
    return {
      error: "INVALID_INPUT",
      message: "Input must be an array of message objects with 'sender' and 'text' fields",
    };
  }

  const user_messages = messages.filter(
    m => m && (m.sender === "user" || m.sender === "me")
  );

  if (user_messages.length < ANCHOR_CONFIG.MIN_TURNS_FOR_ANALYSIS) {
    return {
      error: "INSUFFICIENT_TURNS",
      message: `ANCHOR requires at least ${ANCHOR_CONFIG.MIN_TURNS_FOR_ANALYSIS} user messages, got ${user_messages.length}`,
    };
  }

  const texts = user_messages.map(m => m.text || "").filter(t => t.length > 0);

  if (texts.length < ANCHOR_CONFIG.MIN_TURNS_FOR_ANALYSIS) {
    return {
      error: "INSUFFICIENT_DATA",
      message: `ANCHOR requires at least ${ANCHOR_CONFIG.MIN_TURNS_FOR_ANALYSIS} non-empty messages`,
    };
  }

  const input_hash = prismComputeHash(texts.join("||"));

  try {
    const attachment = R1AttachmentAnalyzer_analyze(texts);
    const conflict = R2ConflictAnalyzer_analyze(texts);
    const emotional_availability = R3EmotionalAnalyzer_analyze(texts);
    const growth = R4GrowthAnalyzer_analyze(texts);

    return {
      success: true,
      attachment: attachment,
      conflict: conflict,
      emotional_availability: emotional_availability,
      growth: growth,
      metadata: {
        engine_version: ANCHOR_CONFIG.ENGINE_VERSION,
        spec_version: ANCHOR_CONFIG.SPEC_VERSION,
        computed_at: prismNowISO(),
        input_hash: input_hash,
        turn_count: texts.length,
      },
    };
  } catch (e) {
    return {
      error: "COMPUTATION_ERROR",
      message: e.message,
      engine_version: ANCHOR_CONFIG.ENGINE_VERSION,
    };
  }
}

// ═══════════════════════════════════════════════════════════════
// ═══════════ ORIGINAL WORKER CODE ═══════════
// ═══════════════════════════════════════════════════════════════

const RATE_LIMIT_ANALYZE = 10;
const RATE_LIMIT_MATCH = 10;
const RATE_LIMIT_WINDOW = 60;
const MAX_SIZE_ANALYZE = 500 * 1024;
const MAX_SIZE_MATCH = 500 * 1024;
const MAX_SIZE_FEEDBACK = 10 * 1024;
const MAX_SIZE_SHARE = 50 * 1024;

const ALLOWED_ORIGINS = [
  'https://jeongjeongjeongm.github.io',
  'https://knot-exodia.ashirmallo.workers.dev'
];

function isOriginAllowed(origin) {
  if (!origin) return false;
  return ALLOWED_ORIGINS.some(allowed => origin === allowed || origin.startsWith(allowed + '/'));
}

async function checkRateLimit(ip, endpoint, limit, env) {
  if (!env.RATE_LIMITER) return true;
  const key = `rl:${ip}:${endpoint}`;
  try {
    const current = parseInt(await env.RATE_LIMITER.get(key) || '0');
    if (current >= limit) return false;
    await env.RATE_LIMITER.put(key, String(current + 1), { expirationTtl: RATE_LIMIT_WINDOW });
    return true;
  } catch {
    return true;
  }
}

function sanitizeString(str, maxLen = 100000) {
  if (typeof str !== 'string') return '';
  return str.slice(0, maxLen).replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');
}

function sanitizeAxes(axes) {
  if (!axes || typeof axes !== 'object') return null;
  const clean = {};
  const allowed = ['intensity', 'structural'];
  for (const key of allowed) {
    if (axes[key] && typeof axes[key] === 'object') {
      clean[key] = {};
      for (const [axisKey, val] of Object.entries(axes[key])) {
        if (!/^A\d{1,2}$/.test(axisKey)) continue;
        if (typeof val === 'number') {
          clean[key][axisKey] = Math.max(0, Math.min(1, val));
        } else if (typeof val === 'object' && val !== null) {
          const cleanAxis = {};
          if (val.primary && typeof val.primary === 'string') {
            cleanAxis.primary = val.primary.slice(0, 50);
          }
          if (val.styles && typeof val.styles === 'object') {
            cleanAxis.styles = {};
            for (const [s, r] of Object.entries(val.styles)) {
              if (typeof r === 'number') {
                cleanAxis.styles[s.slice(0, 30)] = Math.max(0, Math.min(1, r));
              }
            }
          }
          clean[key][axisKey] = cleanAxis;
        }
      }
    }
  }
  return clean;
}

function deepSanitize(obj, depth) {
  if (depth === undefined) depth = 0;
  if (depth > 5) return null;
  if (obj === null || obj === undefined) return null;
  if (typeof obj === 'string') return obj.slice(0, 500);
  if (typeof obj === 'number') return isFinite(obj) ? obj : 0;
  if (typeof obj === 'boolean') return obj;
  if (Array.isArray(obj)) {
    return obj.slice(0, 50).map(function(item) { return deepSanitize(item, depth + 1); }).filter(function(x) { return x !== null; });
  }
  if (typeof obj === 'object') {
    var clean = {};
    var keys = Object.keys(obj).slice(0, 50);
    for (var i = 0; i < keys.length; i++) {
      var key = keys[i].slice(0, 50);
      var val = deepSanitize(obj[keys[i]], depth + 1);
      if (val !== null) clean[key] = val;
    }
    return Object.keys(clean).length > 0 ? clean : null;
  }
  return null;
}

function sanitizePrism(prism) {
  if (!prism || typeof prism !== 'object') return null;
  var clean = {};

  if (prism.topic_distribution && typeof prism.topic_distribution === 'object') {
    clean.topic_distribution = deepSanitize(prism.topic_distribution);
  }
  if (prism.engagement && typeof prism.engagement === 'object') {
    clean.engagement = deepSanitize(prism.engagement);
  }
  if (prism.vocabulary && typeof prism.vocabulary === 'object') {
    clean.vocabulary = deepSanitize(prism.vocabulary);
  }
  if (prism.curiosity && typeof prism.curiosity === 'object') {
    clean.curiosity = deepSanitize(prism.curiosity);
  }
  if (prism.metadata && typeof prism.metadata === 'object') {
    clean.metadata = deepSanitize(prism.metadata);
  }

  return Object.keys(clean).length > 0 ? clean : null;
}

function sanitizeAnchor(anchor) {
  if (!anchor || typeof anchor !== 'object') return null;
  var clean = {};

  if (anchor.attachment && typeof anchor.attachment === 'object') {
    clean.attachment = deepSanitize(anchor.attachment);
  }
  if (anchor.conflict && typeof anchor.conflict === 'object') {
    clean.conflict = deepSanitize(anchor.conflict);
  }
  if (anchor.emotional_availability && typeof anchor.emotional_availability === 'object') {
    clean.emotional_availability = deepSanitize(anchor.emotional_availability);
  }
  if (anchor.growth && typeof anchor.growth === 'object') {
    clean.growth = deepSanitize(anchor.growth);
  }
  if (anchor.metadata && typeof anchor.metadata === 'object') {
    clean.metadata = deepSanitize(anchor.metadata);
  }

  return Object.keys(clean).length > 0 ? clean : null;
}

const SYSTEM_PROMPT_INDIVIDUAL = `당신은 행동 심리 분석 전문가입니다. 주어진 분석 데이터를 바탕으로 한 사람의 심리 프로필을 에세이/칼럼 톤으로 작성합니다.

핵심 규칙:
1. 엔진 용어 금지: 축 번호(A1, A7 등), 수치(0.82, 65% 등), 밴드(very_high 등), 기술 용어를 절대 사용하지 마세요.
2. 자연스러운 한국어: 번역체("~를 의미한다", "~에 가깝다" 반복)를 피하고, 칼럼니스트가 쓴 글처럼 자연스럽게 쓰세요.
3. 구체적 행동 묘사: 추상적 설명 대신 "밤에 잠이 안 오거나", "갑자기 말수가 줄거나" 같은 구체적 장면으로 보여주세요.
4. PRISM 데이터 (관심사/호기심 패턴): 사람이 어떤 주제에 끌리는지, 어떻게 질문하고 탐구하는지, 언어적 특징을 해석하세요.
5. ANCHOR 데이터 (관계 역학 패턴): 이 사람이 관계 속에서 어떻게 작동하는지, 안정감을 느끼는 방식, 갈등 대처, 정서적 개방성, 성장 방향을 분석하세요.
6. 각 섹션마다: summary (2-3문장 요약) + subsections (각 200-400자 상세)

문체 예시 (이 톤을 유지):
- "이 사람이 있으면 공기가 좀 달라진다."
- "근데 이건 지배하고 싶어서가 아니다. 불안해서다."
- "겉과 속이 극단적으로 다르다."`;

const SYSTEM_PROMPT_MATCHING = `당신은 관계 역학 분석 전문가입니다. 두 사람의 분석 데이터를 바탕으로 관계 프로파일링을 에세이/칼럼 톤으로 작성합니다.

핵심 규칙:
1. 엔진 용어 금지: 축 번호, 수치, 밴드, 기술 용어를 절대 사용하지 마세요.
2. 자연스러운 한국어: 번역체를 피하고 칼럼 톤으로.
3. 관계 역학 중심: 개인 분석이 아니라 "둘 사이에서 무슨 일이 벌어지는지"에 집중.
4. PRISM 비교 (공유 세계): 둘이 대화할 수 있는 주제의 접점, 탐구 스타일이 어떻게 맞물리는지 분석하세요.
5. ANCHOR 비교 (감정의 춤): 애착 패턴이 어떻게 교차하는지, 갈등에서의 역학, 정서적 안정감과 성장 가능성을 분석하세요.
6. 각 섹션마다: summary (2-3문장) + subsections (각 200-400자)
7. 판단이 아닌 관찰: "위험하다"가 아니라 "이런 패턴이 반복될 수 있다."

문체 예시:
- "이 사람한테 배신은 상처이기 전에 버그다."
- "좋아하니까 무서운 거고, 무서우니까 공격하는 거다."`;

const INDIVIDUAL_SECTIONS = [
  { key: 'first_impression', title: '첫인상', subsections: ['에너지 유형', '대인 시그널', '오해받기 쉬운 지점'] },
  { key: 'mechanism', title: '작동원리', subsections: ['핵심 동기', '방어 전략', '의사결정 구조'] },
  { key: 'crack', title: '균열', subsections: ['주요 모순', '파급 효과', '본인의 자각 수준'] },
  { key: 'contextual_faces', title: '맥락별 얼굴', subsections: ['혼자일 때', '친밀한 관계에서', '집단 속에서'] },
  { key: 'simulation', title: '시뮬레이션', subsections: ['배신당했을 때', '사랑에 빠졌을 때', '권력을 쥐었을 때', '실패했을 때'] },
  { key: 'unconscious', title: '무의식', subsections: ['반복 패턴', '회피하는 감정', '인정하지 않는 욕구'] },
  { key: 'growth', title: '성장 방향', subsections: ['현재 정체 지점', '성장 조건', '가능성의 범위'] },
  { key: 'interests', title: '관심사 지형', subsections: ['주제 지도', '탐구 깊이', '언어적 풍경'] },
  { key: 'curiosity', title: '호기심 패턴', subsections: ['질문 스타일', '탐구 방향', '지적 호기심의 특징'] },
  { key: 'attachment', title: '관계 안에서의 나', subsections: ['안정감의 원천', '불안 신호', '거리 조절 방식'] },
  { key: 'relational_dynamics', title: '관계 역학', subsections: ['갈등 대처', '정서적 가용성', '성장 지향'] },
];

const MATCHING_SECTIONS = [
  { key: 'first_meeting', title: '첫 만남', subsections: ['서로에게 읽히는 첫 신호', '초반 역학'] },
  { key: 'attraction', title: '끌림의 구조', subsections: ['A가 상대에게서 보는 것', 'B가 상대에게서 보는 것'] },
  { key: 'collision', title: '충돌 지점', subsections: ['거리 조절 전쟁', '싸우는 방식의 충돌', '지뢰밭'] },
  { key: 'trap', title: '관계의 함정', subsections: ['추격-도주의 고착', '역할 고정'] },
  { key: 'needs', title: '서로에게 필요한 것', subsections: ['A가 이 관계에서 얻을 수 있는 것', 'B가 이 관계에서 얻을 수 있는 것'] },
  { key: 'possibility', title: '이 관계의 가능성', subsections: ['최선의 시나리오', '최악의 시나리오', '이 관계를 유지하려면'] },
  { key: 'shared_world', title: '공유 세계', subsections: ['대화 소재의 접점', '탐구 스타일의 조화'] },
  { key: 'emotional_dance', title: '감정의 춤', subsections: ['애착 패턴의 교차', '갈등에서의 역학', '정서적 균형'] },
];

const INTENSITY_AXIS_NAMES = {
  A1: '정서 강도', A2: '정서 안정성', A3: '감정 표현',
  A4: '자기 확신', A5: '사회적 주도성', A6: '권위 수용',
  A12: '친밀감 편안함', A14: '변화 수용성',
};

const STRUCTURAL_AXIS_NAMES = {
  A7: '갈등 반응', A8: '유머 스타일', A9: '애착 유형',
  A10: '의사결정', A11: '스트레스 반응', A13: '인정 욕구 방향',
  A15: '공감 방식', A16: '자기개방 수준', A17: '경계 설정',
};

function getIntensityBand(value) {
  if (value < 0.2) return 'very_low';
  if (value < 0.4) return 'low';
  if (value < 0.6) return 'mid';
  if (value < 0.8) return 'high';
  return 'very_high';
}

const INTENSITY_WORDS = {
  A1: { very_low: '무관심적', low: '신중한', high: '적극적', very_high: '몰두적' },
  A2: { very_low: '냉담한', low: '예의바른', high: '친절한', very_high: '감정적' },
  A3: { very_low: '평화추구적', low: '분노억제적', high: '도전적', very_high: '대항적' },
  A4: { very_low: '겸손한', low: '성취지향적', high: '영향력있는', very_high: '지배적' },
  A5: { very_low: '강건한', low: '신중한', high: '개방적', very_high: '내적취약성높은' },
  A6: { very_low: '변동성높은', low: '변동적인', high: '일관된', very_high: '지극히안정적' },
  A12: { very_low: '둔감한', low: '선별적인식', high: '민감한', very_high: '초민감한' },
  A14: { very_low: '갈등고착적', low: '회피경향적', high: '중재능력있는', very_high: '뛰어난중재자' },
};

const STRUCTURAL_WORDS = {
  A7: { initiator: '주도적', responder: '반응적', balanced: '균형잡힌' },
  A8: { confrontational: '직면적', avoidant: '회피적', collaborative: '협력적', accommodating: '양보적' },
  A9: { selective: '선별적', progressive: '관계심화적', broadcast: '공개적', guarded: '폐쇄적' },
  A10: { logical: '논리기반', emotional: '감정기반', positional: '지위기반', collaborative: '협동기반' },
  A11: { rigid: '경직된', flexible: '유연한', porous: '경계약한' },
  A13: { growth: '성장추구적', defensive: '방어적', avoidant: '회피적', absorptive: '자기비판적' },
  A15: { active_investor: '능동적', passive_maintainer: '수동적', disengaged: '단절된' },
  A16: { analytical: '분석적', pragmatic: '실용적', binary: '이분법적' },
  A17: { tension_breaker: '긴장해소형', bonding: '결속형', deflective: '회피형', aggressive: '공격형', minimal: '최소형' },
};

function describeProfileForPrompt(axes) {
  const lines = [];
  const intensity = axes.intensity || {};
  const structural = axes.structural || {};

  for (const [axis, name] of Object.entries(INTENSITY_AXIS_NAMES)) {
    const val = intensity[axis];
    if (val === undefined || val === null) continue;
    const band = getIntensityBand(val);
    const word = (INTENSITY_WORDS[axis] || {})[band] || band;
    lines.push(`- ${name}: ${word} (${band})`);
  }

  for (const [axis, name] of Object.entries(STRUCTURAL_AXIS_NAMES)) {
    const data = structural[axis];
    if (!data || typeof data !== 'object') continue;
    const dominant = data.primary || '';
    const word = (STRUCTURAL_WORDS[axis] || {})[dominant] || dominant;
    let mixStr = '';
    if (data.styles && typeof data.styles === 'object') {
      const sorted = Object.entries(data.styles).sort((a, b) => b[1] - a[1]);
      mixStr = sorted.map(([k, v]) => `${k} ${Math.round(v * 100)}%`).join(', ');
    }
    lines.push(`- ${name}: ${word} (주: ${dominant}, 분포: ${mixStr})`);
  }

  return lines.join('\n');
}

function buildAnalyzePrompt(axes, identity, messagesSample, lensSummary, prism, anchor) {
  const profileDesc = describeProfileForPrompt(axes);

  let prompt = `다음 분석 데이터를 바탕으로 개인 심리 프로필을 작성해주세요.

## 프로필 요약
정체성: ${identity.name} (${identity.tagline})

## 특성 데이터
${profileDesc}
`;

  if (prism) {
    prompt += `\n## 관심사·호기심 패턴 (PRISM)\n`;
    if (prism.topic_distribution && Object.keys(prism.topic_distribution).length > 0) {
      prompt += `주제 분포: ${Object.entries(prism.topic_distribution)
        .map(([k, v]) => `${k} (${Math.round(v * 100)}%)`)
        .join(', ')}\n`;
    }
    if (typeof prism.engagement === 'number') {
      prompt += `참여도: ${Math.round(prism.engagement * 100)}%\n`;
    }
    if (prism.vocabulary && Object.keys(prism.vocabulary).length > 0) {
      prompt += `언어 특징: ${Object.entries(prism.vocabulary)
        .map(([k, v]) => `${k}: ${v}`)
        .join(' | ')}\n`;
    }
    if (prism.curiosity && Object.keys(prism.curiosity).length > 0) {
      prompt += `호기심 패턴: ${Object.entries(prism.curiosity)
        .map(([k, v]) => `${k}: ${v}`)
        .join(' | ')}\n`;
    }
  }

  if (anchor) {
    prompt += `\n## 관계 역학 패턴 (ANCHOR)\n`;
    if (anchor.attachment && Object.keys(anchor.attachment).length > 0) {
      prompt += `애착 특성: ${Object.entries(anchor.attachment)
        .map(([k, v]) => `${k}: ${v}`)
        .join(' | ')}\n`;
    }
    if (anchor.conflict && Object.keys(anchor.conflict).length > 0) {
      prompt += `갈등 대처: ${Object.entries(anchor.conflict)
        .map(([k, v]) => `${k}: ${v}`)
        .join(' | ')}\n`;
    }
    if (anchor.emotional_availability && Object.keys(anchor.emotional_availability).length > 0) {
      prompt += `정서적 가용성: ${Object.entries(anchor.emotional_availability)
        .map(([k, v]) => `${k}: ${v}`)
        .join(' | ')}\n`;
    }
    if (anchor.growth && Object.keys(anchor.growth).length > 0) {
      prompt += `성장 방향: ${Object.entries(anchor.growth)
        .map(([k, v]) => `${k}: ${v}`)
        .join(' | ')}\n`;
    }
  }

  if (lensSummary) {
    prompt += `\n## 렌즈 요약\n${sanitizeString(lensSummary, 5000)}\n`;
  }

  if (messagesSample) {
    prompt += `\n## 대화 샘플 (참고용)\n${sanitizeString(messagesSample, 50000)}\n`;
  }

  prompt += `\n## 작성할 구조
아래 ${INDIVIDUAL_SECTIONS.length}개 섹션 각각에 대해 작성하세요:\n`;

  INDIVIDUAL_SECTIONS.forEach((section, i) => {
    prompt += `\n### ${i + 1}. ${section.title}\n`;
    prompt += `- summary: 2-3문장 요약\n`;
    section.subsections.forEach(sub => {
      prompt += `- ${sub}: 200-400자 상세 서술\n`;
    });
  });

  prompt += `
## 중요 규칙
- 엔진 축 번호(A1, A7 등), 수치(0.82 등), 밴드 이름 절대 사용 금지
- 자연스러운 에세이/칼럼 톤 (번역체 금지)
- 구체적인 행동/상황 묘사 위주
- PRISM 데이터가 있다면 관심사 지형, 호기심 패턴 섹션에 통합
- ANCHOR 데이터가 있다면 관계 안에서의 나, 관계 역학 섹션에 통합
- JSON 형식으로 출력: {"sections": [{"key": "...", "title": "...", "summary": "...", "subsections": [{"title": "...", "content": "..."}]}]}`;

  return prompt;
}

function buildMatchPrompt(profileA, profileB, identityA, identityB, matchIdentity, prismA, prismB, anchorA, anchorB) {
  const descA = describeProfileForPrompt(profileA.axes || profileA);
  const descB = describeProfileForPrompt(profileB.axes || profileB);

  let prompt = `다음 두 사람의 분석 데이터를 바탕으로 관계 프로파일링을 작성해주세요.

## Person A: ${identityA.name} (${identityA.tagline})
${descA}

## Person B: ${identityB.name} (${identityB.tagline})
${descB}

## 관계 요약
관계 이름: ${matchIdentity.name} (${matchIdentity.tagline})
호환성: ${matchIdentity.compatibility}%
긴장도: ${matchIdentity.tension}
성장 가능성: ${matchIdentity.growth}
`;

  if (prismA || prismB) {
    prompt += `\n## 공유 세계 (관심사·호기심 비교)\n`;
    if (prismA && prismA.topic_distribution) {
      prompt += `${identityA.name}의 주제: ${Object.keys(prismA.topic_distribution).join(', ')}\n`;
    }
    if (prismB && prismB.topic_distribution) {
      prompt += `${identityB.name}의 주제: ${Object.keys(prismB.topic_distribution).join(', ')}\n`;
    }
    if (prismA && prismA.curiosity && prismB && prismB.curiosity) {
      prompt += `호기심 스타일 비교: ${identityA.name}은 ${Object.keys(prismA.curiosity).join('/')}, ${identityB.name}은 ${Object.keys(prismB.curiosity).join('/')}\n`;
    }
  }

  if (anchorA || anchorB) {
    prompt += `\n## 감정의 춤 (관계 역학 비교)\n`;
    if (anchorA && anchorA.attachment && anchorB && anchorB.attachment) {
      prompt += `애착 패턴: ${identityA.name}은 ${Object.keys(anchorA.attachment).join('/')}, ${identityB.name}은 ${Object.keys(anchorB.attachment).join('/')}\n`;
    }
    if (anchorA && anchorA.conflict && anchorB && anchorB.conflict) {
      prompt += `갈등 대처: ${identityA.name}은 ${Object.keys(anchorA.conflict).join('/')}, ${identityB.name}은 ${Object.keys(anchorB.conflict).join('/')}\n`;
    }
    if (anchorA && anchorA.emotional_availability && anchorB && anchorB.emotional_availability) {
      prompt += `정서 개방성: ${identityA.name}은 ${Object.keys(anchorA.emotional_availability).join('/')}, ${identityB.name}은 ${Object.keys(anchorB.emotional_availability).join('/')}\n`;
    }
  }

  prompt += `\n## 작성할 구조
아래 ${MATCHING_SECTIONS.length}개 섹션 각각에 대해 작성하세요:\n`;

  MATCHING_SECTIONS.forEach((section, i) => {
    prompt += `\n### ${i + 1}. ${section.title}\n`;
    prompt += `- summary: 2-3문장 요약\n`;
    section.subsections.forEach(sub => {
      const title = sub
        .replace('A가', `${identityA.name}이/가`)
        .replace('B가', `${identityB.name}이/가`);
      prompt += `- ${title}: 200-400자 상세 서술\n`;
    });
  });

  prompt += `
## 중요 규칙
- 엔진 축 번호, 수치, 밴드 이름 절대 사용 금지
- 에세이/칼럼 톤 (번역체 금지)
- "위험하다" 대신 "이런 패턴이 반복될 수 있다" 식으로 관찰적 서술
- PRISM 데이터가 있다면 공유 세계, 대화 가능성 분석에 통합
- ANCHOR 데이터가 있다면 감정의 춤, 안정감과 갈등 역학 분석에 통합
- JSON 형식으로 출력: {"sections": [{"key": "...", "title": "...", "summary": "...", "subsections": [{"title": "...", "content": "..."}]}]}`;

  return prompt;
}

async function callClaude(apiKey, systemPrompt, userPrompt) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 55000);

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 8000,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Claude API error: ${response.status} - ${error}`);
    }

    const data = await response.json();
    return data.content[0].text;
  } catch (e) {
    clearTimeout(timeoutId);
    if (e.name === 'AbortError') {
      throw new Error('Claude API timeout (55s)');
    }
    throw e;
  }
}

function extractJSON(text) {
  try { return JSON.parse(text); } catch {}
  const match = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (match) {
    try { return JSON.parse(match[1].trim()); } catch {}
  }
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start >= 0 && end > start) {
    try { return JSON.parse(text.slice(start, end + 1)); } catch {}
  }
  return null;
}

function jsonResponse(data, status = 200, corsHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  });
}

function buildSharePageHTML(profile) {
  const identity = profile.identity || {};
  const sections = profile.sections || [];
  const emoji = identity.emoji || '🔮';
  const name = identity.name || '미지의 윤곽';
  const tagline = identity.tagline || '';
  const code = identity.code || '';

  let sectionsHTML = '';
  sections.forEach(section => {
    sectionsHTML += `<div class="section">
      <h2>${escapeHTML(section.title)}</h2>
      <p class="summary">${escapeHTML(section.summary || '')}</p>`;
    if (section.subsections) {
      section.subsections.forEach(sub => {
        sectionsHTML += `<div class="subsection">
          <h3>${escapeHTML(sub.title)}</h3>
          <p>${escapeHTML(sub.content || '')}</p>
        </div>`;
      });
    }
    sectionsHTML += '</div>';
  });

  return `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>KNOT — ${escapeHTML(name)}</title>
<style>
  :root { --bg: #08080D; --ac: #F5A623; --text: #E8E8E8; --dim: #999; --border: #333; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { background: var(--bg); color: var(--text); font-family: 'Courier New', monospace; padding: 20px; min-height: 100vh; }
  .container { max-width: 540px; margin: 0 auto; }
  .header { text-align: center; padding: 30px 0; border-bottom: 1px solid var(--border); margin-bottom: 30px; }
  .emoji { font-size: 64px; }
  .name { font-size: 24px; color: var(--ac); margin: 10px 0; font-weight: bold; }
  .tagline { color: var(--dim); font-size: 14px; }
  .code { color: var(--dim); font-size: 11px; margin-top: 5px; }
  .section { margin-bottom: 30px; padding: 20px; border: 1px solid var(--border); border-radius: 8px; }
  .section h2 { color: var(--ac); font-size: 16px; margin-bottom: 10px; }
  .summary { color: var(--dim); font-size: 13px; margin-bottom: 15px; line-height: 1.6; }
  .subsection { margin-bottom: 15px; }
  .subsection h3 { font-size: 13px; color: #60A5FA; margin-bottom: 5px; }
  .subsection p { font-size: 13px; line-height: 1.7; }
  .footer { text-align: center; padding: 20px; color: var(--dim); font-size: 11px; }
  .footer a { color: var(--ac); }
</style>
</head>
<body>
<div class="container">
  <div class="header">
    <div class="emoji">${emoji}</div>
    <div class="name">${escapeHTML(name)}</div>
    <div class="tagline">${escapeHTML(tagline)}</div>
    <div class="code">${escapeHTML(code)}</div>
  </div>
  ${sectionsHTML}
  <div class="footer">
    <a href="https://jeongjeongjeongm.github.io/knot/">KNOT</a>에서 나도 분석하기
  </div>
</div>
</body>
</html>`;
}

function escapeHTML(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get('Origin') || '';
    const ip = request.headers.get('CF-Connecting-IP') || '0.0.0.0';

    const corsHeaders = {
      'Access-Control-Allow-Origin': isOriginAllowed(origin) ? origin : ALLOWED_ORIGINS[0],
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    if (request.method !== 'POST') {
      if (request.method === 'GET' && url.pathname.startsWith('/share/')) {
        const shareId = url.pathname.split('/share/')[1];
        if (shareId && env.SHARE_STORE) {
          try {
            const data = await env.SHARE_STORE.get(shareId);
            if (data) {
              const profile = JSON.parse(data);
              const html = buildSharePageHTML(profile);
              return new Response(html, {
                headers: { 'Content-Type': 'text/html;charset=UTF-8' },
              });
            }
          } catch {}
        }
        return new Response('Not found', { status: 404 });
      }
      return jsonResponse({ error: 'Method not allowed' }, 405, corsHeaders);
    }

    if (!isOriginAllowed(origin)) {
      return jsonResponse({ error: 'Origin not allowed' }, 403, corsHeaders);
    }

    const path = url.pathname;

    // ──── POST /test-api ──── (minimal Claude API test)
    if (path === '/test-api') {
      try {
        const start = Date.now();
        const controller = new AbortController();
        const tid = setTimeout(() => controller.abort(), 20000);
        const apiResp = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': env.ANTHROPIC_API_KEY || '',
            'anthropic-version': '2023-06-01',
          },
          body: JSON.stringify({
            model: 'claude-sonnet-4-20250514',
            max_tokens: 50,
            messages: [{ role: 'user', content: 'Say hello in Korean, one word only.' }],
          }),
          signal: controller.signal,
        });
        clearTimeout(tid);
        const elapsed = Date.now() - start;
        const text = await apiResp.text();
        return jsonResponse({ status: apiResp.status, elapsed_ms: elapsed, body: text.slice(0, 500) }, 200, corsHeaders);
      } catch (e) {
        return jsonResponse({ error: e.message, name: e.name }, 500, corsHeaders);
      }
    }

    // ──── POST /analyze ────
    if (path === '/analyze') {
      if (!(await checkRateLimit(ip, 'analyze', RATE_LIMIT_ANALYZE, env))) {
        return jsonResponse({ error: '분석 요청이 너무 많습니다. 잠시 후 다시 시도해주세요.' }, 429, corsHeaders);
      }

      const contentLength = parseInt(request.headers.get('Content-Length') || '0');
      if (contentLength > MAX_SIZE_ANALYZE) {
        return jsonResponse({ error: '요청 크기 초과' }, 413, corsHeaders);
      }

      try {
        const body = await request.json();
        const axes = sanitizeAxes(body.axes);
        if (!axes) {
          return jsonResponse({ error: 'Invalid axes data' }, 400, corsHeaders);
        }

        const identity = body.identity || { name: '미지의 윤곽', tagline: '복합적인 존재', emoji: '🔮', code: 'E-XX' };
        const messagesSample = sanitizeString(body.messages_sample || '', 50000);
        const lensSummary = sanitizeString(body.lens_summary || '', 5000);

        // Handle PRISM: either use pre-computed or compute from raw_messages
        let prism = sanitizePrism(body.prism);
        if (!prism && body.raw_messages && Array.isArray(body.raw_messages)) {
          const messages = body.raw_messages.map(msg =>
            typeof msg === 'string' ? { sender: 'user', text: msg } : msg
          );
          const prismResult = analyzePrism(messages);
          if (prismResult.success !== false && !prismResult.error) {
            prism = sanitizePrism(prismResult);
          }
        }

        // Handle ANCHOR: either use pre-computed or compute from raw_messages
        let anchor = sanitizeAnchor(body.anchor);
        if (!anchor && body.raw_messages && Array.isArray(body.raw_messages)) {
          const messages = body.raw_messages.map(msg =>
            typeof msg === 'string' ? { sender: 'user', text: msg } : msg
          );
          const anchorResult = analyzeAnchor(messages);
          if (anchorResult.success !== false && !anchorResult.error) {
            anchor = sanitizeAnchor(anchorResult);
          }
        }

        // Diagnostic mode: return early without calling Claude API
        if (url.searchParams.get('diag') === '1') {
          return jsonResponse({
            diag: true,
            axes_ok: !!axes,
            prism_ok: !!prism,
            anchor_ok: !!anchor,
            identity,
            has_api_key: !!env.ANTHROPIC_API_KEY,
            prompt_length: buildAnalyzePrompt(axes, identity, messagesSample, lensSummary, prism, anchor).length,
          }, 200, corsHeaders);
        }

        const userPrompt = buildAnalyzePrompt(axes, identity, messagesSample, lensSummary, prism, anchor);
        const rawResponse = await callClaude(env.ANTHROPIC_API_KEY, SYSTEM_PROMPT_INDIVIDUAL, userPrompt);
        const parsed = extractJSON(rawResponse);

        if (!parsed) {
          return jsonResponse({ error: 'Failed to parse AI response', raw: rawResponse.slice(0, 500) }, 500, corsHeaders);
        }

        // Add PRISM and ANCHOR to response
        const response = parsed;
        if (prism) response.prism = prism;
        if (anchor) response.anchor = anchor;

        return jsonResponse(response, 200, corsHeaders);
      } catch (e) {
        return jsonResponse({ error: e.message }, 500, corsHeaders);
      }
    }

    // ──── POST /match ────
    if (path === '/match') {
      if (!(await checkRateLimit(ip, 'match', RATE_LIMIT_MATCH, env))) {
        return jsonResponse({ error: '매칭 요청이 너무 많습니다. 잠시 후 다시 시도해주세요.' }, 429, corsHeaders);
      }

      const contentLength = parseInt(request.headers.get('Content-Length') || '0');
      if (contentLength > MAX_SIZE_MATCH) {
        return jsonResponse({ error: '요청 크기 초과' }, 413, corsHeaders);
      }

      try {
        const body = await request.json();
        const profileA = body.profileA;
        const profileB = body.profileB;
        const identityA = body.identityA || { name: 'Person A', tagline: '' };
        const identityB = body.identityB || { name: 'Person B', tagline: '' };
        const matchIdentity = body.matchIdentity || { name: '교차하는 궤도', tagline: '복합적 역학의 관계', compatibility: 50, tension: '보통', growth: '보통' };

        // Handle PRISM A/B: either use pre-computed or compute from raw_messages_a/b
        let prismA = sanitizePrism(body.prismA);
        if (!prismA && body.raw_messages_a && Array.isArray(body.raw_messages_a)) {
          const messages = body.raw_messages_a.map(msg =>
            typeof msg === 'string' ? { sender: 'user', text: msg } : msg
          );
          const prismResult = analyzePrism(messages);
          if (prismResult.success !== false && !prismResult.error) {
            prismA = sanitizePrism(prismResult);
          }
        }

        let prismB = sanitizePrism(body.prismB);
        if (!prismB && body.raw_messages_b && Array.isArray(body.raw_messages_b)) {
          const messages = body.raw_messages_b.map(msg =>
            typeof msg === 'string' ? { sender: 'user', text: msg } : msg
          );
          const prismResult = analyzePrism(messages);
          if (prismResult.success !== false && !prismResult.error) {
            prismB = sanitizePrism(prismResult);
          }
        }

        // Handle ANCHOR A/B: either use pre-computed or compute from raw_messages_a/b
        let anchorA = sanitizeAnchor(body.anchorA);
        if (!anchorA && body.raw_messages_a && Array.isArray(body.raw_messages_a)) {
          const messages = body.raw_messages_a.map(msg =>
            typeof msg === 'string' ? { sender: 'user', text: msg } : msg
          );
          const anchorResult = analyzeAnchor(messages);
          if (anchorResult.success !== false && !anchorResult.error) {
            anchorA = sanitizeAnchor(anchorResult);
          }
        }

        let anchorB = sanitizeAnchor(body.anchorB);
        if (!anchorB && body.raw_messages_b && Array.isArray(body.raw_messages_b)) {
          const messages = body.raw_messages_b.map(msg =>
            typeof msg === 'string' ? { sender: 'user', text: msg } : msg
          );
          const anchorResult = analyzeAnchor(messages);
          if (anchorResult.success !== false && !anchorResult.error) {
            anchorB = sanitizeAnchor(anchorResult);
          }
        }

        if (!profileA || !profileB) {
          return jsonResponse({ error: 'Missing profile data' }, 400, corsHeaders);
        }

        const userPrompt = buildMatchPrompt(profileA, profileB, identityA, identityB, matchIdentity, prismA, prismB, anchorA, anchorB);
        const rawResponse = await callClaude(env.ANTHROPIC_API_KEY, SYSTEM_PROMPT_MATCHING, userPrompt);
        const parsed = extractJSON(rawResponse);

        if (!parsed) {
          return jsonResponse({ error: 'Failed to parse AI response', raw: rawResponse.slice(0, 500) }, 500, corsHeaders);
        }

        // Add PRISM and ANCHOR to response
        const response = parsed;
        if (prismA) response.prismA = prismA;
        if (prismB) response.prismB = prismB;
        if (anchorA) response.anchorA = anchorA;
        if (anchorB) response.anchorB = anchorB;

        return jsonResponse(response, 200, corsHeaders);
      } catch (e) {
        return jsonResponse({ error: e.message }, 500, corsHeaders);
      }
    }

    // ──── POST /feedback ────
    if (path === '/feedback') {
      const contentLength = parseInt(request.headers.get('Content-Length') || '0');
      if (contentLength > MAX_SIZE_FEEDBACK) {
        return jsonResponse({ error: '요청 크기 초과' }, 413, corsHeaders);
      }
      try {
        const body = await request.json();
        if (env.FEEDBACK_STORE) {
          const key = `fb:${Date.now()}:${ip.replace(/\./g, '_')}`;
          await env.FEEDBACK_STORE.put(key, JSON.stringify({
            ...body,
            ip: ip,
            timestamp: new Date().toISOString(),
          }), { expirationTtl: 60 * 60 * 24 * 90 });
        }
        return jsonResponse({ ok: true }, 200, corsHeaders);
      } catch (e) {
        return jsonResponse({ error: e.message }, 500, corsHeaders);
      }
    }

    // ──── POST /share ────
    if (path === '/share') {
      const contentLength = parseInt(request.headers.get('Content-Length') || '0');
      if (contentLength > MAX_SIZE_SHARE) {
        return jsonResponse({ error: '요청 크기 초과' }, 413, corsHeaders);
      }
      try {
        const body = await request.json();
        if (!env.SHARE_STORE) {
          return jsonResponse({ error: 'Share storage not configured' }, 500, corsHeaders);
        }
        const shareId = crypto.randomUUID().slice(0, 8);
        await env.SHARE_STORE.put(shareId, JSON.stringify(body), {
          expirationTtl: 60 * 60 * 24 * 30,
        });
        const shareUrl = `${url.origin}/share/${shareId}`;
        return jsonResponse({ shareUrl }, 200, corsHeaders);
      } catch (e) {
        return jsonResponse({ error: e.message }, 500, corsHeaders);
      }
    }

    return jsonResponse({ error: 'Not found' }, 404, corsHeaders);
  },
};
