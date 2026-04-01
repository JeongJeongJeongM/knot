/**
 * PRISM v1.0 — JavaScript Client-Side Engine
 *
 * Complete port of the Python PRISM analysis engine for browser use.
 * Analyzes conversation patterns across 4 dimensions:
 * - P1: Topic Distribution
 * - P2: Engagement Depth
 * - P3: Vocabulary Landscape
 * - P4: Curiosity Signature
 */

(function(global) {
  'use strict';

  // ═══════════════════════════════════════════════════════════════
  // CONFIG CONSTANTS
  // ═══════════════════════════════════════════════════════════════

  const CONFIG = {
    ENGINE_NAME: 'PRISM',
    ENGINE_VERSION: '1.0.0',
    SPEC_VERSION: '1.0',

    // P1. Topic Distribution
    TOPIC_CATEGORIES: [
      'technology',
      'relationships',
      'daily_life',
      'philosophy',
      'entertainment',
      'work',
      'health',
      'finance',
      'art_culture',
      'sports',
      'food',
      'travel',
      'education',
      'politics_society',
      'nature_science',
      'humor',
      'other',
    ],
    SELF_REPORT_DISCREPANCY_THRESHOLD: 0.05,
    TOPIC_MIN_RATIO_SIGNIFICANT: 0.03,

    // P2. Engagement Depth
    DEPTH_LEVELS: [
      'surface',
      'casual',
      'analytical',
      'exploratory',
      'creative',
    ],
    DEPTH_LEVEL_WEIGHTS: {
      'surface': 0.1,
      'casual': 0.25,
      'analytical': 0.5,
      'exploratory': 0.75,
      'creative': 1.0,
    },

    // P3. Vocabulary Landscape
    TTR_LOW_THRESHOLD: 0.3,
    TTR_HIGH_THRESHOLD: 0.6,
    ABSTRACTION_THRESHOLD_ABSTRACT: 0.6,
    ABSTRACTION_THRESHOLD_CONCRETE: 0.4,

    // P4. Curiosity Signature
    QUESTION_TYPES: [
      'factual',
      'opinion',
      'hypothesis',
      'meta',
    ],

    // Misc
    MIN_TURNS_FOR_ANALYSIS: 5,
    MAX_TURNS_PER_SESSION: 1000,
    EPSILON: 1e-12,
  };

  // ═══════════════════════════════════════════════════════════════
  // KEYWORD DICTIONARIES (P1, P3)
  // ═══════════════════════════════════════════════════════════════

  const TOPIC_KEYWORDS = {
    'technology': [
      '코드', '프로그래밍', '개발', '앱', '소프트웨어', '하드웨어',
      'AI', '인공지능', '서버', '데이터', '알고리즘', 'API',
      '컴퓨터', '기술', '디지털', '클라우드', '코딩', '깃',
    ],
    'relationships': [
      '연애', '사랑', '관계', '데이트', '결혼', '이별',
      '남친', '여친', '짝사랑', '고백', '커플', '썸',
    ],
    'daily_life': [
      '오늘', '어제', '내일', '아침', '저녁', '일상',
      '집', '출근', '퇴근', '주말', '날씨', '잠',
    ],
    'philosophy': [
      '철학', '존재', '의미', '가치', '윤리', '도덕',
      '진리', '자유의지', '실존', '형이상학', '인식론',
    ],
    'entertainment': [
      '영화', '드라마', '게임', '음악', '노래', '유튜브',
      '넷플릭스', '웹툰', '만화', '애니', '콘서트',
    ],
    'work': [
      '회사', '직장', '업무', '프로젝트', '상사', '동료',
      '회의', '미팅', '보고서', '이직', '취업', '면접',
    ],
    'health': [
      '건강', '운동', '헬스', '다이어트', '병원', '약',
      '수면', '스트레스', '멘탈', '체력', '영양',
    ],
    'finance': [
      '돈', '투자', '주식', '코인', '저축', '월급',
      '부동산', '대출', '소비', '절약', '경제',
    ],
    'art_culture': [
      '예술', '미술', '전시', '갤러리', '문학', '소설',
      '시', '공연', '연극', '뮤지컬', '클래식', '오페라',
    ],
    'sports': [
      '축구', '야구', '농구', '운동', '경기', '선수',
      '올림픽', '승리', '팀', '리그', '월드컵',
    ],
    'food': [
      '맛집', '요리', '음식', '레시피', '카페', '커피',
      '술', '맥주', '와인', '디저트', '빵',
    ],
    'travel': [
      '여행', '비행기', '호텔', '관광', '해외', '휴가',
      '배낭여행', '국내여행', '명소',
    ],
    'education': [
      '공부', '학교', '대학', '시험', '학원', '수업',
      '강의', '논문', '연구', '자격증',
    ],
    'politics_society': [
      '정치', '사회', '뉴스', '정부', '법', '제도',
      '선거', '국회', '시위', '인권',
    ],
    'nature_science': [
      '과학', '자연', '환경', '우주', '물리', '화학',
      '생물', '지구', '기후', '동물', '식물',
    ],
    'humor': [
      'ㅋㅋ', 'ㅎㅎ', '웃기', '개그', '농담', '드립',
      '짤', '밈', '웃음',
    ],
  };

  const DEPTH_SIGNALS = {
    'creative': [
      '내 생각엔', '내가 보기엔', '이렇게 해석', '새로운 관점',
      '다른 각도에서', '재해석', '나만의', '독자적',
      '제안하자면', '이론을 세워보면',
    ],
    'exploratory': [
      '연결되는', '근본적으로', '본질적', '철학적',
      '존재론적', '메타', '추상적', '구조적으로',
      '패러다임', '프레임워크', '이면에', '심층적',
    ],
    'analytical': [
      '분석하면', '구조가', '패턴이', '원인은',
      '비교하면', '통계적', '데이터', '논리적',
      '왜냐하면', '근거는', '증거는', '체계적',
      '상관관계', '인과', '메커니즘',
    ],
    'casual': [
      '그런 것 같아', '아마', '좀', '약간',
      '그냥', '뭐', '대충', '느낌',
    ],
    'surface': [
      'ㅇㅇ', 'ㅋㅋ', 'ㄹㅇ', 'ㅎㅎ',
      '그래', '맞아', '오', '와',
    ],
  };

  const DOMAIN_VOCABULARY = {
    'tech': [
      'API', '서버', '클라이언트', '배포', '디버깅', '리팩토링',
      '아키텍처', '프레임워크', '라이브러리', '인스턴스', '컨테이너',
      '마이크로서비스', '레이턴시', '스케일링', 'CI/CD',
    ],
    'psychology': [
      '인지', '무의식', '투사', '전이', '방어기제', '자아',
      '트라우마', '레질리언스', '메타인지', '스키마', '애착',
    ],
    'finance': [
      '수익률', '포트폴리오', '리스크', '헤지', '배당',
      '밸류에이션', '레버리지', '유동성', '캐시플로우',
    ],
    'art': [
      '구도', '색채', '질감', '미학', '아방가르드',
      '큐레이션', '매체', '모티프', '내러티브', '장르',
    ],
    'science': [
      '가설', '변인', '통제군', '실험군', '유의미',
      '상관관계', '인과관계', '표본', '편향', '메타분석',
    ],
    'philosophy': [
      '존재론', '인식론', '현상학', '해석학', '변증법',
      '실존주의', '구조주의', '해체', '담론', '패러다임',
    ],
  };

  const ABSTRACT_PATTERNS = [
    '개념', '본질', '의미', '가치', '구조', '체계',
    '패러다임', '프레임', '메타', '추상', '이론',
    '원리', '철학', '존재', '인식', '관점',
  ];

  const CONCRETE_PATTERNS = [
    '밥', '집', '차', '돈', '옷', '신발',
    '먹', '가', '사', '자', '봐',
    '핸드폰', '컴퓨터', '책상', '의자',
  ];

  const QUESTION_PATTERNS = {
    'factual': [
      /몇|언제|어디|누구|뭐가|얼마/,
      /맞아\?|맞지\?|그래\?|진짜\?|정말\?/,
      /있어\?|없어\?|했어\?|됐어\?/,
    ],
    'opinion': [
      /어떻게 생각|어떤 것 같|넌 어때|너는 어떻게/,
      /의견|생각|느낌|판단/,
      /좋아\?|싫어\?|괜찮\?/,
    ],
    'hypothesis': [
      /만약|가정|혹시|그러면/,
      /될까|일까|않을까|아닐까/,
      /가능성|확률|경우/,
    ],
    'meta': [
      /왜 그런|이유가|근본적으로|본질/,
      /의미가|뭘 뜻하|어째서/,
      /구조|체계|시스템|원리/,
    ],
  };

  // ═══════════════════════════════════════════════════════════════
  // UTILITY FUNCTIONS
  // ═══════════════════════════════════════════════════════════════

  function computeSHA256(str) {
    // Simplified hash for browser (not cryptographic)
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(16);
  }

  function nowISO() {
    return new Date().toISOString();
  }

  function countOccurrences(text, pattern) {
    if (typeof pattern === 'string') {
      const escaped = pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(escaped, 'g');
      const matches = text.match(regex);
      return matches ? matches.length : 0;
    }
    const matches = text.match(pattern);
    return matches ? matches.length : 0;
  }

  function shannonEntropy(probabilities) {
    let entropy = 0;
    for (const p of probabilities) {
      if (p > 0) {
        entropy -= p * Math.log2(p + CONFIG.EPSILON);
      }
    }
    return entropy;
  }

  // ═══════════════════════════════════════════════════════════════
  // P1: TOPIC DISTRIBUTION ANALYZER
  // ═══════════════════════════════════════════════════════════════

  class P1TopicAnalyzer {
    constructor(customKeywords = null) {
      this.keywords = { ...TOPIC_KEYWORDS };
      if (customKeywords) {
        for (const [cat, words] of Object.entries(customKeywords)) {
          if (!this.keywords[cat]) {
            this.keywords[cat] = [];
          }
          this.keywords[cat].push(...words);
        }
      }
    }

    analyze(texts, selfReportedInterests = null) {
      if (!texts || texts.length === 0) {
        return {
          topics: {},
          dominant_topic: '',
          topic_diversity: 0,
          self_report_gaps: [],
        };
      }

      const topicCounts = {};
      const topicTurnCounts = {};

      // Initialize counters
      for (const cat of CONFIG.TOPIC_CATEGORIES) {
        topicCounts[cat] = 0;
        topicTurnCounts[cat] = 0;
      }
      topicCounts['other'] = 0;
      topicTurnCounts['other'] = 0;

      // Process each text
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

      // Calculate ratios
      const total = Object.values(topicCounts).reduce((a, b) => a + b, 0) + CONFIG.EPSILON;
      const topics = {};

      for (const [cat, count] of Object.entries(topicCounts)) {
        const ratio = count / total;
        if (ratio >= CONFIG.TOPIC_MIN_RATIO_SIGNIFICANT) {
          topics[cat] = {
            category: cat,
            ratio: Math.round(ratio * 10000) / 10000,
            depth: 'surface',
            turn_count: topicTurnCounts[cat] || 0,
          };
        }
      }

      // Dominant topic
      let dominant = 'other';
      let maxRatio = 0;
      for (const [cat, entry] of Object.entries(topics)) {
        if (entry.ratio > maxRatio) {
          maxRatio = entry.ratio;
          dominant = cat;
        }
      }

      // Shannon entropy
      const ratios = Object.values(topics)
        .map(t => t.ratio)
        .filter(r => r > 0);
      const entropy = shannonEntropy(ratios);
      const maxEntropy = Math.log2(CONFIG.TOPIC_CATEGORIES.length) || 1.0;
      const diversity = Math.round((entropy / (maxEntropy + CONFIG.EPSILON)) * 10000) / 10000;

      // Self-report gaps
      const gaps = [];
      if (selfReportedInterests) {
        for (const interest of selfReportedInterests) {
          const interestLower = interest.toLowerCase();
          const matchedCat = this._findMatchingCategory(interestLower);
          if (matchedCat && topics[matchedCat]) {
            if (topics[matchedCat].ratio < CONFIG.SELF_REPORT_DISCREPANCY_THRESHOLD) {
              gaps.push(matchedCat);
            }
          } else if (matchedCat && !topics[matchedCat]) {
            gaps.push(matchedCat);
          }
        }
      }

      return {
        topics,
        dominant_topic: dominant,
        topic_diversity: diversity,
        self_report_gaps: gaps,
      };
    }

    _findMatchingCategory(interest) {
      for (const [category, keywords] of Object.entries(this.keywords)) {
        for (const kw of keywords) {
          if (kw.toLowerCase().includes(interest) || interest.includes(kw.toLowerCase())) {
            return category;
          }
        }
      }
      for (const cat of CONFIG.TOPIC_CATEGORIES) {
        if (cat.includes(interest) || interest.includes(cat)) {
          return cat;
        }
      }
      return null;
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // P2: ENGAGEMENT DEPTH ANALYZER
  // ═══════════════════════════════════════════════════════════════

  class P2DepthAnalyzer {
    analyze(texts, topicDistribution = null) {
      if (!texts || texts.length === 0) {
        return {
          depth_by_topic: {},
          overall_depth: 'surface',
          depth_consistency: 'consistent',
        };
      }

      const depthScores = [];
      for (const text of texts) {
        const depth = this._classifyDepth(text);
        depthScores.push(depth);
      }

      // Calculate distribution and weighted average
      const depthCounter = {};
      for (const level of CONFIG.DEPTH_LEVELS) {
        depthCounter[level] = 0;
      }
      for (const depth of depthScores) {
        depthCounter[depth]++;
      }

      const total = depthScores.length;
      let weightedSum = 0;
      for (const [level, count] of Object.entries(depthCounter)) {
        const weight = CONFIG.DEPTH_LEVEL_WEIGHTS[level] || 0.1;
        weightedSum += weight * count;
      }
      const avgWeight = total > 0 ? weightedSum / total : 0;
      const overall = this._weightToLevel(avgWeight);

      // Depth by topic
      const depthByTopic = {};
      if (topicDistribution && topicDistribution.topics) {
        for (const cat of Object.keys(topicDistribution.topics)) {
          depthByTopic[cat] = overall;
        }
      }

      // Consistency
      const uniqueDepths = new Set(depthScores);
      let consistency = 'consistent';
      if (uniqueDepths.size >= 4) {
        consistency = 'variable';
      } else if (uniqueDepths.size >= 3) {
        consistency = 'topic_dependent';
      }

      return {
        depth_by_topic: depthByTopic,
        overall_depth: overall,
        depth_consistency: consistency,
      };
    }

    _classifyDepth(text) {
      const textLower = text.toLowerCase();
      const scores = {};

      for (const level of CONFIG.DEPTH_LEVELS) {
        scores[level] = 0;
      }

      for (const [level, signals] of Object.entries(DEPTH_SIGNALS)) {
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

      for (let i = CONFIG.DEPTH_LEVELS.length - 1; i >= 0; i--) {
        const level = CONFIG.DEPTH_LEVELS[i];
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

  // ═══════════════════════════════════════════════════════════════
  // P3: VOCABULARY LANDSCAPE ANALYZER
  // ═══════════════════════════════════════════════════════════════

  class P3VocabularyAnalyzer {
    analyze(texts) {
      if (!texts || texts.length === 0) {
        return {
          diversity: 'moderate',
          dominant_domains: [],
          abstraction: 'balanced',
          register_range: 'moderate',
          lexical_diversity_raw: 0,
        };
      }

      const allText = texts.join(' ');
      const tokens = this._tokenize(allText);

      if (!tokens || tokens.length === 0) {
        return {
          diversity: 'moderate',
          dominant_domains: [],
          abstraction: 'balanced',
          register_range: 'moderate',
          lexical_diversity_raw: 0,
        };
      }

      const ttr = this._computeTTR(tokens);
      const diversity = this._classifyDiversity(ttr);
      const dominantDomains = this._detectDomains(allText);
      const abstraction = this._analyzeAbstraction(allText);
      const registerRange = this._analyzeRegister(texts);

      return {
        diversity,
        dominant_domains: dominantDomains,
        abstraction,
        register_range: registerRange,
        lexical_diversity_raw: Math.round(ttr * 10000) / 10000,
      };
    }

    _tokenize(text) {
      // Korean, English, numeric tokens
      const regex = /[가-힣]+|[a-zA-Z]+|[0-9]+/g;
      const matches = text.match(regex) || [];
      return matches
        .map(t => t.toLowerCase())
        .filter(t => t.length > 1);
    }

    _computeTTR(tokens) {
      if (!tokens || tokens.length === 0) return 0;
      const types = new Set(tokens);
      return types.size / (Math.sqrt(tokens.length) + CONFIG.EPSILON);
    }

    _classifyDiversity(ttr) {
      if (ttr >= CONFIG.TTR_HIGH_THRESHOLD) return 'high';
      if (ttr >= CONFIG.TTR_LOW_THRESHOLD) return 'moderate';
      return 'low';
    }

    _detectDomains(text) {
      const textLower = text.toLowerCase();
      const domainScores = {};

      for (const [domain, vocab] of Object.entries(DOMAIN_VOCABULARY)) {
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

      for (const pattern of ABSTRACT_PATTERNS) {
        if (textLower.includes(pattern)) abstractCount++;
      }

      for (const pattern of CONCRETE_PATTERNS) {
        if (textLower.includes(pattern)) concreteCount++;
      }

      const total = abstractCount + concreteCount + CONFIG.EPSILON;
      const abstractRatio = abstractCount / total;

      if (abstractRatio >= CONFIG.ABSTRACTION_THRESHOLD_ABSTRACT) {
        return 'leans_abstract';
      }
      if (abstractRatio <= CONFIG.ABSTRACTION_THRESHOLD_CONCRETE) {
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

  // ═══════════════════════════════════════════════════════════════
  // P4: CURIOSITY SIGNATURE ANALYZER
  // ═══════════════════════════════════════════════════════════════

  class P4CuriosityAnalyzer {
    analyze(texts) {
      if (!texts || texts.length === 0) {
        return {
          question_ratio: 0,
          dominant_type: 'factual',
          depth_vs_breadth: 'balanced',
          follow_up_tendency: 'moderate',
          question_type_distribution: {},
        };
      }

      const totalTurns = texts.length;
      let questionTurns = 0;
      const questionTypes = {};
      let topicTransitions = 0;
      let followUps = 0;
      let prevTopicHash = null;

      for (const qtype of CONFIG.QUESTION_TYPES) {
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

      const questionRatio = Math.round((questionTurns / (totalTurns + CONFIG.EPSILON)) * 10000) / 10000;

      // Dominant question type
      let dominantType = 'factual';
      let maxCount = 0;
      for (const [qtype, count] of Object.entries(questionTypes)) {
        if (count > maxCount) {
          maxCount = count;
          dominantType = qtype;
        }
      }

      // Depth vs breadth
      const transitionRate = topicTransitions / (totalTurns + CONFIG.EPSILON);
      let depthVsBreadth = 'balanced';
      if (transitionRate > 0.4) {
        depthVsBreadth = 'wide_scanner';
      } else if (transitionRate < 0.15) {
        depthVsBreadth = 'deep_diver';
      }

      // Follow-up tendency
      let followUpTendency = 'moderate';
      if (questionTurns > 0) {
        const followUpRate = followUps / (questionTurns + CONFIG.EPSILON);
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

      // Question type distribution
      const totalQ = Object.values(questionTypes).reduce((a, b) => a + b, 0) + CONFIG.EPSILON;
      const typeDistribution = {};
      for (const [qtype, count] of Object.entries(questionTypes)) {
        typeDistribution[qtype] = Math.round((count / totalQ) * 10000) / 10000;
      }

      return {
        question_ratio: questionRatio,
        dominant_type: dominantType,
        depth_vs_breadth: depthVsBreadth,
        follow_up_tendency: followUpTendency,
        question_type_distribution: typeDistribution,
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
      for (const qtype of CONFIG.QUESTION_TYPES) {
        scores[qtype] = 0;
      }

      for (const [qtype, patterns] of Object.entries(QUESTION_PATTERNS)) {
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

  // ═══════════════════════════════════════════════════════════════
  // MAIN PIPELINE
  // ═══════════════════════════════════════════════════════════════

  function analyzePrism(messages, selfReportedInterests = null) {
    if (!messages || messages.length === 0) {
      return {
        error: 'INSUFFICIENT_TURNS',
        message: 'No messages provided',
      };
    }

    // Filter for user messages
    const userMessages = messages.filter(msg => msg.sender === 'user' || !msg.sender);
    const texts = userMessages.map(msg => msg.text);

    if (texts.length < CONFIG.MIN_TURNS_FOR_ANALYSIS) {
      return {
        error: 'INSUFFICIENT_TURNS',
        message: `Need at least ${CONFIG.MIN_TURNS_FOR_ANALYSIS} turns, got ${texts.length}`,
      };
    }

    const inputHash = computeSHA256(texts.join('||'));

    // P1: Topic Distribution
    const p1 = new P1TopicAnalyzer();
    const topicDist = p1.analyze(texts, selfReportedInterests);

    // P2: Engagement Depth
    const p2 = new P2DepthAnalyzer();
    const engagement = p2.analyze(texts, topicDist);

    // Update topic distribution with depth
    for (const [cat, entry] of Object.entries(topicDist.topics)) {
      if (engagement.depth_by_topic[cat]) {
        entry.depth = engagement.depth_by_topic[cat];
      }
    }

    // P3: Vocabulary Landscape
    const p3 = new P3VocabularyAnalyzer();
    const vocabulary = p3.analyze(texts);

    // P4: Curiosity Signature
    const p4 = new P4CuriosityAnalyzer();
    const curiosity = p4.analyze(texts);

    // Return results
    return {
      topic_distribution: topicDist,
      engagement: engagement,
      vocabulary: vocabulary,
      curiosity: curiosity,
      metadata: {
        engine_version: CONFIG.ENGINE_VERSION,
        spec_version: CONFIG.SPEC_VERSION,
        computed_at: nowISO(),
        input_hash: inputHash,
        turn_count: texts.length,
      },
    };
  }

  // ═══════════════════════════════════════════════════════════════
  // EXPORT API
  // ═══════════════════════════════════════════════════════════════

  global.PRISM = {
    analyze: analyzePrism,
    version: CONFIG.ENGINE_VERSION,
    // Export internal classes for advanced use
    P1TopicAnalyzer: P1TopicAnalyzer,
    P2DepthAnalyzer: P2DepthAnalyzer,
    P3VocabularyAnalyzer: P3VocabularyAnalyzer,
    P4CuriosityAnalyzer: P4CuriosityAnalyzer,
  };

})(typeof window !== 'undefined' ? window : global);
