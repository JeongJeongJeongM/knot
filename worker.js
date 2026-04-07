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
    'education', 'politics_society', 'nature_science', 'psychology', 'humor', 'other',
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
    '프론트엔드', '백엔드', '풀스택', '데이터베이스', 'DB', '스크립트', '자동화', '봇',
    '머신러닝', '딥러닝', 'LLM', 'GPT', '챗봇', '크롤링', '스크래핑', '파싱',
    '배포', '도커', '쿠버네티스', 'AWS', '호스팅', '도메인', 'DNS', 'SSL', 'HTTPS',
    '깃허브', '리포', '커밋', '브랜치', '풀리퀘', 'PR', '이슈', '버그', '디버그', '에러',
    '리눅스', '터미널', '커맨드', '패키지', '라이브러리', '프레임워크', '노드', '리액트',
    '타입스크립트', '자바스크립트', '파이썬', 'CSS', 'HTML', '워커', '웹소켓', '캐시',
    '인터넷', '와이파이', '블루투스', '아이폰', '안드로이드', '갤럭시', '태블릿', '노트북',
    '모니터', '키보드', '마우스', 'SSD', 'RAM', 'CPU', 'GPU', '사양', '스펙',
    '피그마', '디자인시스템', 'UX', 'UI', '와이어프레임', '프로토타입',
  ],
  'relationships': [
    '연애', '사랑', '관계', '데이트', '결혼', '이별', '남친', '여친', '짝사랑', '고백', '커플', '썸',
    '남자친구', '여자친구', '남편', '아내', '와이프', '신랑', '신부', '약혼',
    '부부', '가족', '부모', '엄마', '아빠', '형', '누나', '동생', '오빠', '언니',
    '친구', '우정', '절친', '베프', '사이', '갈등', '화해', '다툼', '싸움',
    '소개팅', '매칭', '어플', '만남', '첫만남', '호감', '밀당',
    '이혼', '별거', '재혼', '외도', '바람', '권태기', '장거리',
    '애정', '스킨십', '질투', '집착', '신뢰', '배려', '존중',
    '시댁', '시어머니', '장인', '장모', '며느리', '사위', '시누이',
    '육아', '아기', '아들', '딸', '자녀', '임신', '출산',
  ],
  'daily_life': [
    '오늘', '어제', '내일', '아침', '저녁', '일상', '집', '출근', '퇴근', '주말', '날씨', '잠',
    '점심', '저녁밥', '아침밥', '세탁', '청소', '설거지', '빨래', '정리',
    '이사', '월세', '전세', '자취', '자취방', '원룸', '투룸', '아파트', '빌라',
    '교통', '지하철', '버스', '택시', '출퇴근', '통근', '정체', '막히',
    '택배', '배달', '쿠팡', '마켓', '장보기', '쇼핑', '구매', '환불',
    '핸드폰', '충전', '배터리', '알람', '일정', '약속', '모임',
    '피곤', '지침', '쉬고싶', '휴일', '공휴일', '연휴',
  ],
  'philosophy': [
    '철학', '존재', '의미', '가치', '윤리', '도덕', '진리', '자유의지', '실존', '형이상학', '인식론',
    '본질', '의식', '자아', '주체', '객체', '인과', '필연', '우연', '결정론',
    '니체', '칸트', '소크라테스', '플라톤', '아리스토텔레스', '데카르트', '하이데거',
    '사르트르', '비트겐슈타인', '공리주의', '덕윤리', '의무론', '실용주의',
    '존재론', '현상학', '해석학', '변증법', '구조주의', '해체', '포스트모던',
    '정의란', '선과 악', '옳고 그름', '삶의 목적', '행복이란', '죽음',
    '궁극적', '근원적', '근본적', '본질적', '세계관', '인생관', '가치관',
    '사유', '성찰', '통찰', '관조', '명상', '깨달음', '각성',
    '무', '공', '도', '리', '기', '음양', '중용', '유교', '불교', '도교',
    '원리', '법칙', '질서', '혼돈', '카오스', '엔트로피', '복잡계',
  ],
  'entertainment': [
    '영화', '드라마', '게임', '음악', '노래', '유튜브', '넷플릭스', '웹툰', '만화', '애니', '콘서트',
    '시리즈', '시즌', '에피소드', '스포', '결말', '반전', '캐릭터', '주인공', '악역', '조연',
    '감독', '배우', '아이돌', '가수', '밴드', '앨범', '싱글', '뮤비', 'MV',
    '플리', '플레이리스트', '스포티파이', '멜론', '음원', '스트리밍',
    '트위치', '스트리머', '방송', '컨텐츠', '콘텐츠', '크리에이터', '유튜버',
    '롤', 'LOL', '오버워치', '발로란트', '마크', '스팀', '닌텐도', '플스', 'PS5',
    '디즈니', '마블', 'DC', '스타워즈', '해리포터', '반지의제왕',
    '예능', '개그', '코미디', '토크쇼', '리얼리티', '오디션',
    '팟캐스트', '라디오', '웹소설', '소설', '책', '만화책',
    '보드게임', '퍼즐', '퀴즈', '탈출', '방탈출',
  ],
  'work': [
    '회사', '직장', '업무', '프로젝트', '상사', '동료', '회의', '미팅', '보고서', '이직', '취업', '면접',
    '커리어', '경력', '이력서', '포트폴리오', '자소서', '스펙', '인턴',
    '연봉', '성과', 'KPI', 'OKR', '평가', '승진', '인사', '팀장', '대리', '과장', '부장',
    '야근', '칼퇴', '워라밸', '재택', '리모트', '출장', '파견',
    '기획', '전략', '마케팅', '영업', '세일즈', '고객', '클라이언트', '거래처',
    '슬랙', '노션', '구글독스', '엑셀', '파워포인트', '발표', 'PPT',
    '사업', '창업', '스타트업', '대표', 'CEO', 'CTO', '투자유치', '시리즈A',
    '프리랜서', '외주', '계약', '납기', '마감', '데드라인', '일정',
    '퇴사', '사직', '해고', '구조조정', '정리해고', '계약직', '정규직',
    '복지', '연차', '휴가', '보험', '퇴직금', '4대보험',
  ],
  'health': [
    '건강', '운동', '헬스', '다이어트', '병원', '약', '수면', '스트레스', '멘탈', '체력', '영양',
    '필라테스', '요가', '러닝', '조깅', '등산', '수영', '크로스핏', '홈트',
    '체중', '살', '몸무게', '근육', '벌크업', '린', '체지방', '단백질', '보충제',
    '두통', '감기', '열', '기침', '콧물', '알러지', '알레르기', '아프',
    '치과', '안과', '피부과', '정형외과', '내과', '외과', '수술', '입원', '통원',
    '비타민', '유산균', '영양제', '오메가3', '혈압', '혈당', '콜레스테롤',
    '허리', '목', '어깨', '무릎', '관절', '디스크', '거북목', '자세',
    '불면', '수면제', '카페인', '피곤', '만성피로', '번아웃',
    '검진', '건강검진', '혈액검사', '엑스레이', 'MRI', 'CT',
  ],
  'finance': [
    '돈', '투자', '주식', '코인', '저축', '월급', '부동산', '대출', '소비', '절약', '경제',
    '펀드', '채권', 'ETF', '배당', '복리', '이자', '금리', '환율', '달러', '원화',
    '비트코인', '이더리움', '가상화폐', '암호화폐', '블록체인', '코인거래소',
    '적금', '예금', '통장', '카드', '신용카드', '할부', '캐시백', '포인트',
    '세금', '연말정산', '소득세', '부가세', '종소세', '세무', '절세',
    '보험', '실손', '종신', '연금', '퇴직연금', 'IRP', 'ISA',
    '아파트값', '전셋값', '시세', '매매', '분양', '청약', '갭투자',
    '재테크', '자산', '부채', '순자산', '포트폴리오', '분산투자',
    '수익률', '손실', '원금', '마이너스', '빚', '상환', '이자율',
    '인플레이션', '디플레이션', '경기침체', '호황', '불황', 'GDP', '기준금리',
  ],
  'art_culture': [
    '예술', '미술', '전시', '갤러리', '문학', '소설', '시', '공연', '연극', '뮤지컬', '클래식', '오페라',
    '미술관', '박물관', '작품', '작가', '화가', '조각', '설치미술', '현대미술',
    '사진', '포토', '촬영', '카메라', 'DSLR', '미러리스', '필름',
    '디자인', '타이포', '일러스트', '그래픽', '건축', '인테리어', '가구',
    '패션', '스타일', '브랜드', '컬렉션', '런웨이', '빈티지', '트렌드',
    '문화', '전통', '역사', '유산', '문명', '풍속', '의례', '축제', '페스티벌',
    '도자기', '서예', '한복', '판소리', '탈춤', '국악',
    '발레', '무용', '댄스', '현대무용', '안무',
    '큐레이터', '비엔날레', '아트페어', '크리에이티브',
  ],
  'sports': [
    '축구', '야구', '농구', '운동', '경기', '선수', '올림픽', '승리', '팀', '리그', '월드컵',
    '프리미어리그', 'EPL', 'KBO', 'MLB', 'NBA', 'K리그', '챔피언스리그',
    '골프', '테니스', '배드민턴', '탁구', '복싱', '격투기', 'UFC', 'MMA',
    '마라톤', '트라이애슬론', '사이클', '스키', '스노보드', '서핑',
    '감독', '코치', '심판', '이적', '트레이드', '드래프트', '스카우트',
    '골', '홈런', '스트라이크', '파울', '어시스트', 'MVP',
    '응원', '팬', '직관', '중계', '하이라이트', '해설',
    'e스포츠', '프로게이머', '대회', '토너먼트',
  ],
  'food': [
    '맛집', '요리', '음식', '레시피', '카페', '커피', '술', '맥주', '와인', '디저트', '빵',
    '라면', '치킨', '피자', '햄버거', '초밥', '회', '고기', '삼겹살', '불고기',
    '한식', '중식', '일식', '양식', '태국', '베트남', '멕시칸', '이탈리안',
    '배달', '배민', '쿠팡이츠', '포장', '먹방', '맛있', '맛없',
    '브런치', '에스프레소', '라떼', '아메리카노', '디카페인',
    '비건', '채식', '글루텐프리', '오가닉', '유기농', '건강식',
    '소주', '위스키', '칵테일', '하이볼', '이자카야', '바', '펍',
    '베이킹', '제빵', '제과', '쿠키', '케이크', '마카롱', '파스타',
  ],
  'travel': [
    '여행', '비행기', '호텔', '관광', '해외', '휴가', '배낭여행', '국내여행', '명소',
    '항공', '항공권', '예약', '숙소', '에어비앤비', '게스트하우스', '리조트', '펜션',
    '일본', '도쿄', '오사카', '유럽', '파리', '런던', '미국', '뉴욕', 'LA',
    '동남아', '태국', '방콕', '발리', '베트남', '다낭', '하노이', '대만', '타이베이',
    '제주', '부산', '강릉', '경주', '전주', '속초', '여수',
    '환전', '여권', '비자', '면세', '면세점', '기내', '트랜짓', '경유',
    '맛집투어', '카페투어', '사진스팟', '인스타', '뷰',
    '캠핑', '글램핑', '차박', '트레킹', '하이킹',
  ],
  'education': [
    '공부', '학교', '대학', '시험', '학원', '수업', '강의', '논문', '연구', '자격증',
    '수능', '입시', '내신', '등급', '성적', '학점', 'GPA', '장학금',
    '유학', '어학연수', '토익', '토플', 'IELTS', '영어', '외국어',
    '독학', '인강', '강좌', '코세라', '유데미', '클래스101',
    '독서', '책', '서적', '도서관', '서점', '추천도서',
    '석사', '박사', '대학원', '학위', '졸업', '전공', '부전공', '복수전공',
    '교수', '선생님', '튜터', '과외', '멘토', '스터디',
    '자기개발', '자기계발', '배움', '학습', '역량', '스킬업',
  ],
  'politics_society': [
    '정치', '사회', '뉴스', '정부', '법', '제도', '선거', '국회', '시위', '인권',
    '대통령', '국회의원', '여당', '야당', '정당', '보수', '진보', '중도',
    '민주주의', '자본주의', '사회주의', '공산주의', '이념', '좌파', '우파',
    '외교', '안보', '북한', '통일', '미중', '무역', '관세', '제재',
    '복지', '불평등', '양극화', '빈부격차', '최저임금', '기본소득',
    '젠더', '페미니즘', '성평등', '차별', '혐오', '소수자', 'LGBT',
    '환경', '기후변화', '탄소중립', '에너지', '원전', '재생에너지',
    '범죄', '사건', '사고', '판결', '재판', '검찰', '경찰', '법원',
  ],
  'nature_science': [
    '과학', '자연', '환경', '우주', '물리', '화학', '생물', '지구', '기후', '동물', '식물',
    '천문', '행성', '은하', '블랙홀', '빅뱅', 'NASA', '로켓', '화성', '달',
    '진화', '유전', 'DNA', 'RNA', '세포', '바이러스', '박테리아', '면역',
    '양자', '상대성', '중력', '전자기', '열역학', '파동', '입자',
    '생태계', '멸종', '보존', '서식지', '야생', '해양', '산호초',
    '실험', '관찰', '가설', '이론', '증명', '발견', '논문',
    '공학', '로봇', '나노', '바이오', '신소재', '반도체',
  ],
  'psychology': [
    '심리', '성격', 'MBTI', '트라우마', '감정', '정서', '우울', '불안', '공황',
    '자존감', '자기애', '나르시시즘', '자기효능감', '자아실현',
    '상담', '치료', '테라피', '정신과', '심리상담', '인지행동', 'CBT',
    '무의식', '잠재의식', '프로이트', '융', '아들러', '라캉',
    '투사', '전이', '방어기제', '합리화', '부정', '억압', '승화',
    '애착', '회피형', '불안형', '안정형', '애착유형',
    '인지', '인지편향', '확증편향', '가용성', '닻내림', '프레이밍',
    '동기', '동기부여', '매슬로우', '욕구', '보상', '강화', '처벌',
    '스키마', '메타인지', '마음이론', '공감', '거울뉴런',
    '성향', '기질', '빅파이브', '외향', '내향', '개방성', '성실성', '신경성',
    '인간관계', '대인관계', '사회심리', '집단심리', '동조', '복종', '권위',
    '번아웃', '회복탄력성', '레질리언스', '그릿', '마인드셋',
    '행동경제', '넛지', '카너먼', '휴리스틱', '이중처리', '시스템1', '시스템2',
  ],
  'humor': [
    'ㅋㅋ', 'ㅎㅎ', '웃기', '개그', '농담', '드립', '짤', '밈', '웃음',
    'ㅋㅋㅋ', 'ㅎㅎㅎ', 'ㅋㅋㅋㅋ', '꿀잼', '노잼', '킹받', '존웃',
    '썰', '레전드', '미친', '대박', '헐', '실화', '찐',
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
    '왜 그런지', '근본 원인', '깊이 파', '파고들', '뜯어보', '분해해',
    '시스템이', '아키텍처', '설계 철학', '트레이드오프', '본질은',
  ],
  'analytical': [
    '분석하면', '구조가', '패턴이', '원인은', '비교하면', '통계적', '데이터',
    '논리적', '왜냐하면', '근거는', '증거는', '체계적', '상관관계', '인과', '메커니즘',
    '어떻게 되는', '왜 이런', '문제는', '해결', '고치', '수정', '구현', '설계',
    '원리가', '작동', '방식이', '로직', '알고리즘', '최적화', '디버그', '버그',
  ],
  'casual': [
    '그런 것 같아', '아마도', '약간', '대충', '느낌적',
  ],
  'surface': [
    'ㅇㅇ', 'ㄹㅇ', '그래', '맞아',
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
    /^(몇|언제|어디서|누가|얼마)\b/,
    /있어\?$|없어\?$|했어\?$|됐어\?$/,
  ],
  'opinion': [
    /어떻게 생각|어떤 것 같|넌 어때|너는 어떻게/, /의견|판단/,
    /좋아\?|싫어\?|괜찮\?/, /맞아\?|맞지\?|그래\?|아니야\?/,
  ],
  'hypothesis': [
    /만약|가정|혹시|그러면/, /될까|일까|않을까|아닐까/,
    /가능성|확률|경우/, /할 수 있|할 수 없|불가능|가능한/,
    /아닌가|아닌지|건 아닐|수도 있/,
  ],
  'meta': [
    /왜 그런|이유가|근본적으로|본질/, /의미가|뭘 뜻하|어째서/,
    /구조|체계|시스템|원리/, /중립|편향|객관|주관|윤리|도덕/,
    /철학|존재|본질적|근원|한계|모순|역설|딜레마/,
    /정의가|개념이|논리적|논쟁|반론|비판|문제점|결함/,
    /왜.*인지|왜.*하는|근데 왜|이게 맞|말이 안 되|논리가|모순이/,
    /중립.*불가|절대.*없|가능.*한가|문제.*뭐|핵심.*뭐/,
    /진짜\?$|정말\?$/,
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

// ═══════════════════════════════════════════════════════════
// INTAKE PREPROCESSOR — 불필요 데이터 제거, 용량 최적화
// ═══════════════════════════════════════════════════════════

const PREPROCESS_CONFIG = {
  MAX_MESSAGES: 1000,        // 최대 메시지 수 (LLM은 500개만 사용)
  MAX_MSG_LENGTH: 3000,      // 개별 메시지 최대 길이 (chars)
  MIN_MSG_LENGTH: 2,         // 너무 짧은 메시지 제거
  ALLOWED_SENDERS: new Set(['user', 'me', 'human']),
};

/**
 * preprocessMessages — 원본 대화 데이터에서 분석에 필요한 것만 추출
 *
 * 지원 포맷:
 *   1) raw_messages: [{ sender, text }, ...] — 기존 포맷
 *   2) Claude export: { chat_messages: [{ sender, text }, ...] }
 *   3) ChatGPT export: { mapping: { id: { message: { author: { role }, content: { parts } } } } }
 *   4) ChatGPT array: [{ message: { author, content } }] 또는 conversations.json 내부
 *   5) 문자열 배열: ["msg1", "msg2", ...]
 *
 * @param {Object} body — 파싱된 JSON body 전체
 * @returns {{ messages: Array, format: string, originalCount: number, processedCount: number }}
 */
function preprocessMessages(body) {
  let extracted = [];
  let format = 'unknown';

  // ── 1) 이미 raw_messages 형태로 왔을 때 ──
  if (body.raw_messages && Array.isArray(body.raw_messages)) {
    extracted = body.raw_messages;
    format = 'raw_messages';
  }
  // ── 2) Claude export 형태 ──
  else if (body.chat_messages && Array.isArray(body.chat_messages)) {
    extracted = body.chat_messages;
    format = 'claude';
  }
  // ── 3) ChatGPT mapping 형태 ──
  else if (body.mapping && typeof body.mapping === 'object') {
    extracted = extractFromChatGPTMapping(body.mapping);
    format = 'chatgpt_mapping';
  }
  // ── 4) conversations.json 배열 (여러 대화) ──
  else if (Array.isArray(body) && body.length > 0 && body[0].mapping) {
    // 모든 대화에서 메시지 추출 후 합침
    for (const conv of body) {
      if (conv.mapping) {
        extracted = extracted.concat(extractFromChatGPTMapping(conv.mapping));
      }
    }
    format = 'chatgpt_conversations';
  }
  // ── 5) 단순 배열 ──
  else if (Array.isArray(body)) {
    extracted = body;
    format = 'array';
  }

  const originalCount = extracted.length;

  // ── 정규화: 모든 메시지를 { sender, text } 형태로 ──
  let normalized = extracted.map(msg => {
    if (typeof msg === 'string') {
      return { sender: 'user', text: msg };
    }
    const sender = (msg.sender || msg.role || msg.author || 'user').toLowerCase();
    const text = msg.text || msg.content || '';
    return { sender, text: typeof text === 'string' ? text : String(text) };
  });

  // ── 사용자 메시지만 필터 (assistant/system 제거) ──
  normalized = normalized.filter(m => {
    if (!m.sender) return true;  // sender 없으면 사용자로 간주
    return PREPROCESS_CONFIG.ALLOWED_SENDERS.has(m.sender) ||
           !['assistant', 'system', 'bot', 'ai', 'chatgpt'].includes(m.sender);
  });

  // ── 빈/짧은 메시지 제거 ──
  normalized = normalized.filter(m =>
    m.text && m.text.trim().length >= PREPROCESS_CONFIG.MIN_MSG_LENGTH
  );

  // ── 개별 메시지 길이 트림 ──
  normalized = normalized.map(m => ({
    sender: 'user',
    text: m.text.length > PREPROCESS_CONFIG.MAX_MSG_LENGTH
      ? m.text.slice(0, PREPROCESS_CONFIG.MAX_MSG_LENGTH) + '...'
      : m.text
  }));

  // ── 메시지 수 제한 (최신 N개 유지) ──
  if (normalized.length > PREPROCESS_CONFIG.MAX_MESSAGES) {
    normalized = normalized.slice(-PREPROCESS_CONFIG.MAX_MESSAGES);
  }

  return {
    messages: normalized,
    format,
    originalCount,
    processedCount: normalized.length,
  };
}

/**
 * ChatGPT mapping 객체에서 메시지 추출
 */
function extractFromChatGPTMapping(mapping) {
  const messages = [];
  const nodes = Object.values(mapping);

  // 시간순 정렬 시도
  nodes.sort((a, b) => {
    const tA = a.message?.create_time || 0;
    const tB = b.message?.create_time || 0;
    return tA - tB;
  });

  for (const node of nodes) {
    const msg = node.message;
    if (!msg) continue;

    const role = msg.author?.role || '';
    if (role === 'system' || role === 'tool') continue;

    // content.parts에서 텍스트 추출
    let text = '';
    if (msg.content?.parts && Array.isArray(msg.content.parts)) {
      text = msg.content.parts
        .filter(p => typeof p === 'string')
        .join('\n');
    } else if (typeof msg.content === 'string') {
      text = msg.content;
    }

    if (!text || text.trim().length === 0) continue;

    messages.push({
      sender: role === 'user' ? 'user' : 'assistant',
      text: text.trim()
    });
  }

  return messages;
}

// ═══════════════════════════════════════════════════════════
// L0 PREPROCESSING LAYER — H2AI Core Points #1, #2, #3
// ═══════════════════════════════════════════════════════════

const L0_CONFIG = {
  MIN_CHAR_COUNT: 2000,          // #3: 최소 총 글자 수
  MIN_VALID_TURNS: 10,           // #3: 최소 유효 턴 수
  TURN_MERGE_INTERVAL_MS: 3600000, // #1: 1시간 = 3,600,000ms
};

/**
 * #2: Code/Markdown Stripper — 코드 블록, JSON, 로그 노이즈 소거
 */
function l0StripCodeAndNoise(text) {
  // 코드 블록 치환 (```...```)
  let cleaned = text.replace(/```[\s\S]*?```/g, '[CODE_BLOCK]');
  // 인라인 코드 치환 (`...`)
  cleaned = cleaned.replace(/`[^`]+`/g, '[CODE]');
  // JSON 블록 치환 ({...} 형태의 멀티라인)
  cleaned = cleaned.replace(/\{[\s\S]{50,}?\}/g, '[JSON_BLOCK]');
  // URL 치환
  cleaned = cleaned.replace(/https?:\/\/[^\s]+/g, '[URL]');
  // 로그 패턴 치환 (타임스탬프 + 로그레벨)
  cleaned = cleaned.replace(/\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}[^\n]*/g, '[LOG]');
  // 파일 경로 치환
  cleaned = cleaned.replace(/(?:\/[\w.-]+){3,}/g, '[PATH]');
  return cleaned;
}

/**
 * #1: The Sanitizer — assistant 발화 제거 + 타임스탬프 기반 턴 병합
 */
function l0SanitizeAndMergeTurns(messages) {
  // Step 1: assistant 발화 100% 제거, user 발화만 추출
  const userOnly = messages.filter(msg =>
    msg.sender === 'user' || msg.sender === 'me' || !msg.sender
  );

  if (userOnly.length === 0) return [];

  // Step 2: 코드/노이즈 스트리핑 적용
  const cleaned = userOnly.map(msg => ({
    ...msg,
    text: l0StripCodeAndNoise(msg.text || ''),
    _originalText: msg.text || '',
  }));

  // Step 3: 타임스탬프 기반 턴 병합 (1시간 이내 연속 발화 → 단일 턴)
  if (!cleaned[0]?.timestamp) {
    // 타임스탬프가 없으면 병합 없이 반환
    return cleaned;
  }

  const merged = [];
  let buffer = { ...cleaned[0] };

  for (let i = 1; i < cleaned.length; i++) {
    const curr = cleaned[i];
    const prevTime = new Date(buffer.timestamp).getTime();
    const currTime = new Date(curr.timestamp).getTime();

    if (!isNaN(prevTime) && !isNaN(currTime) &&
        (currTime - prevTime) <= L0_CONFIG.TURN_MERGE_INTERVAL_MS) {
      // 1시간 이내: 단일 턴으로 병합
      buffer.text += '\n' + curr.text;
      buffer._originalText += '\n' + curr._originalText;
    } else {
      merged.push(buffer);
      buffer = { ...curr };
    }
  }
  merged.push(buffer);
  return merged;
}

/**
 * #3: Density Filter — 저밀도 데이터 엔진 진입 차단
 * Returns: { pass: boolean, reason?: string }
 */
function l0DensityCheck(texts) {
  const totalChars = texts.reduce((sum, t) => sum + t.length, 0);
  const validTurns = texts.filter(t => t.trim().length > 5).length;

  if (totalChars < L0_CONFIG.MIN_CHAR_COUNT) {
    return {
      pass: false,
      reason: `DENSITY_TOO_LOW`,
      message: `사유 데이터가 부족합니다. 최소 ${L0_CONFIG.MIN_CHAR_COUNT}자 이상의 대화가 필요합니다. (현재: ${totalChars}자)`,
    };
  }
  if (validTurns < L0_CONFIG.MIN_VALID_TURNS) {
    return {
      pass: false,
      reason: `TURNS_TOO_FEW`,
      message: `유효한 대화 턴이 부족합니다. 최소 ${L0_CONFIG.MIN_VALID_TURNS}회 이상 필요합니다. (현재: ${validTurns}회)`,
    };
  }
  return { pass: true };
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

    // #4: Cross-Matrix — 단일 발화 내 이종 주제 동시 발현 추적
    const coOccurrence = {};  // "catA|catB" → count
    let fusionTurnCount = 0;  // 2개 이상 주제가 공존하는 턴 수

    // 1차 패스: 키워드 매칭
    const turnCategories = []; // 각 턴의 매칭 결과 저장 (2차 패스용)
    const unmatchedIndices = []; // other로 빠진 턴의 인덱스

    for (let i = 0; i < texts.length; i++) {
      const text = texts[i];
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

      // #4: 교차 행렬 — 단일 턴 내 복수 주제 co-occurrence 기록
      const matchedArr = Array.from(matchedInTurn).sort();
      if (matchedArr.length >= 2) {
        fusionTurnCount++;
        for (let a = 0; a < matchedArr.length; a++) {
          for (let b = a + 1; b < matchedArr.length; b++) {
            const key = `${matchedArr[a]}|${matchedArr[b]}`;
            coOccurrence[key] = (coOccurrence[key] || 0) + 1;
          }
        }
      }

      if (matchedInTurn.size === 0) {
        unmatchedIndices.push(i);
        turnCategories.push(null);
      } else {
        turnCategories.push(matchedArr[0]); // 대표 카테고리 저장
      }
    }

    // ── 2차 패스: 문맥 기반 재분류 ──
    // other로 빠진 텍스트를 (1) 인접 턴 토픽 전파 (2) 문장 구조 패턴으로 구제
    const CONTEXT_PATTERNS = {
      'technology': /어떻게 (만들|구현|짜|돌려|빌드|설정|세팅)|\.js|\.py|\.ts|\.html|\.css|\.json|\.yaml|\.toml|import |export |const |let |var |function |class |=>/,
      'relationships': /사이가|좋아하|싫어하|헤어지|만나고|사귀|연락|답장|읽씹|카톡|문자|전화해|안부|보고싶/,
      'work': /출근|퇴근|야근|월급|연봉|이직|퇴사|상사가|팀장|회의|업무|프로젝트|마감|데드라인|보고/,
      'philosophy': /왜.*일까|무엇인가|의미가.*있|본질|결국.*뭐|삶이|인생|존재|가치가|옳[다은]|그른|정의란/,
      'psychology': /마음이|감정[이을]|느끼|성격이|사람[들의].*왜|행동[이을]|패턴|습관|무의식|인지|심리|트라우마|자존/,
      'finance': /얼마|가격|비싸|싸다|비용|원$|만원|돈이|벌[었고]|쓰[었고]|아끼|투자|수익|손해|이자/,
      'daily_life': /밥|먹[었고]|씻|잤|일어나|나가|들어[와옴]|청소|빨래|씻[었고]|샤워|양치|귀찮|심심|할거/,
      'health': /아프|아팠|다쳤|통증|열이|기침|두통|허리|목이|감기|병원|의사|처방|약을|복용|증상/,
      'entertainment': /봤[어는]|재밌|재미없|스포|결말|몇화|시즌|에피|캐릭터|주인공|ost|bgm|플레이|클리어/,
      'education': /배우[고는]|가르치|수업|강의|시험|과제|숙제|레포트|발표|졸업|학기|학점|전공/,
    };

    for (const idx of unmatchedIndices) {
      const text = texts[idx];
      let rescued = false;

      // 전략 1: 문장 구조 패턴 매칭
      for (const [cat, pattern] of Object.entries(CONTEXT_PATTERNS)) {
        if (pattern.test(text)) {
          topicCounts[cat] = (topicCounts[cat] || 0) + 1;
          topicTurnCounts[cat] = (topicTurnCounts[cat] || 0) + 1;
          turnCategories[idx] = cat;
          rescued = true;
          break;
        }
      }

      // 전략 2: 인접 턴 토픽 전파 (앞뒤 2턴 내 같은 토픽이 있으면 이어받음)
      if (!rescued) {
        const neighbors = {};
        for (let d = -2; d <= 2; d++) {
          if (d === 0) continue;
          const ni = idx + d;
          if (ni >= 0 && ni < turnCategories.length && turnCategories[ni]) {
            neighbors[turnCategories[ni]] = (neighbors[turnCategories[ni]] || 0) + 1;
          }
        }
        // 인접에서 2번 이상 나온 토픽이 있으면 전파 (같은 대화 흐름일 가능성 높음)
        let bestNeighbor = null;
        let bestCount = 0;
        for (const [cat, cnt] of Object.entries(neighbors)) {
          if (cnt >= 2 && cnt > bestCount) {
            bestNeighbor = cat;
            bestCount = cnt;
          }
        }
        if (bestNeighbor) {
          topicCounts[bestNeighbor] = (topicCounts[bestNeighbor] || 0) + 1;
          topicTurnCounts[bestNeighbor] = (topicTurnCounts[bestNeighbor] || 0) + 1;
          turnCategories[idx] = bestNeighbor;
          rescued = true;
        }
      }

      // 여전히 미분류면 other
      if (!rescued) {
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
    const baseDiversity = entropy / (maxEntropy + PRISM_CONFIG.EPSILON);

    // #4: 융합적 사고력 가점 — 이종 주제 동시 발현 비율에 따라 다양성 보정
    const fusionRatio = fusionTurnCount / (texts.length + PRISM_CONFIG.EPSILON);
    const fusionBonus = Math.min(fusionRatio * 0.3, 0.15); // 최대 0.15 가점
    const diversity = Math.round(Math.min(1.0, baseDiversity + fusionBonus) * 10000) / 10000;

    // 상위 co-occurrence 쌍 추출 (융합 패턴)
    const topFusions = Object.entries(coOccurrence)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([pair, count]) => ({ pair: pair.split('|'), count }));

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

    return {
      topics, dominant_topic: dominant, topic_diversity: diversity,
      self_report_gaps: gaps,
      topic_fusion: { fusion_ratio: Math.round(fusionRatio * 10000) / 10000, top_fusions: topFusions },
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

    // ── 대화 패턴 기반 깊이 보정 (텍스트 길이 편향 제거) ──
    // 1) 전문 도메인 용어 밀도 — 짧게 써도 전문용어 쓰면 깊은 사고
    const allText = texts.join(' ');
    let domainTermCount = 0;
    for (const terms of Object.values(PRISM_DOMAIN_VOCABULARY)) {
      for (const term of terms) {
        if (allText.includes(term)) domainTermCount++;
      }
    }
    const domainDensity = domainTermCount / (texts.length + PRISM_CONFIG.EPSILON);
    const domainBoost = domainDensity > 0.3 ? 0.3 : domainDensity > 0.1 ? 0.15 : domainDensity > 0.05 ? 0.08 : 0;

    // 2) 주제 지속성 — 같은 주제를 오래 파면 deep, 자주 바꾸면 shallow
    // 위임형 대화 패턴 감지: 명령형 종결어미 + 짧은 메시지 = 매니지먼트 패턴
    // 이 경우 주제 전환이 산만함이 아니라 위임이므로 persistence 페널티 무력화
    const delegationMarkers = /해$|해줘|해봐|하자$|하세요|합시다|확인해|넘어가|다음|ㄱㄱ|ㄱ$|고고|해라$|하셈|하삼|돌려|실행|배포|올려|보내|넣어|빼|바꿔|고쳐|수정해|삭제해|추가해|만들어/;
    let delegationCount = 0;
    let shortMessageCount = 0;
    for (const text of texts) {
      if (delegationMarkers.test(text)) delegationCount++;
      if (text.length < 30) shortMessageCount++;
    }
    const delegationRatio = delegationCount / (texts.length + PRISM_CONFIG.EPSILON);
    const shortRatio = shortMessageCount / (texts.length + PRISM_CONFIG.EPSILON);
    const isDelegationPattern = delegationRatio > 0.25 && shortRatio > 0.4;

    // 간단한 n-gram 기반 연속 유사도: 연속된 메시지 쌍의 단어 겹침
    let topicPersistence = 0;
    if (texts.length >= 3) {
      let similarities = 0;
      for (let i = 1; i < texts.length; i++) {
        const prev = new Set(texts[i-1].split(/\s+/).filter(w => w.length > 1));
        const curr = new Set(texts[i].split(/\s+/).filter(w => w.length > 1));
        if (prev.size === 0 || curr.size === 0) continue;
        let overlap = 0;
        for (const w of curr) { if (prev.has(w)) overlap++; }
        similarities += overlap / Math.max(prev.size, curr.size);
      }
      topicPersistence = similarities / (texts.length - 1);
    }
    // 위임형 패턴이면 persistence 보정을 최소 0.12로 올림 (산만함 페널티 제거)
    let persistenceBoost;
    if (isDelegationPattern) {
      persistenceBoost = Math.max(0.12, topicPersistence > 0.2 ? 0.2 : topicPersistence > 0.1 ? 0.12 : topicPersistence > 0.05 ? 0.06 : 0);
    } else {
      persistenceBoost = topicPersistence > 0.2 ? 0.2 : topicPersistence > 0.1 ? 0.12 : topicPersistence > 0.05 ? 0.06 : 0;
    }

    // 3) 추상 표현 밀도 — 짧아도 추상적 개념어 쓰면 깊은 사고
    let abstractCount = 0;
    for (const pattern of PRISM_ABSTRACT_PATTERNS) {
      const matches = allText.match(new RegExp(pattern, 'g'));
      if (matches) abstractCount += matches.length;
    }
    const abstractDensity = abstractCount / (texts.length + PRISM_CONFIG.EPSILON);
    const abstractBoost = abstractDensity > 0.2 ? 0.15 : abstractDensity > 0.08 ? 0.08 : abstractDensity > 0.03 ? 0.04 : 0;

    // 4) 집요한 탐구 패턴 — 같은 주제에 대해 반복 질문/수정 요청 = 깊이 있는 사고
    const deepEngagementMarkers = (allText.match(/왜|어떻게|근데|그런데|아니|틀린|잘못|다시|더 자세|설명해|이해가 안|뭔 소리|좀 더|구체적으로|정확히|확인해|검증|테스트|실험/g) || []).length;
    const engagementDensity = deepEngagementMarkers / (texts.length + PRISM_CONFIG.EPSILON);
    const engagementBoost = engagementDensity > 0.5 ? 0.15 : engagementDensity > 0.25 ? 0.08 : engagementDensity > 0.1 ? 0.04 : 0;

    // 보정된 가중 평균
    const adjustedWeight = Math.min(0.95, avgWeight + domainBoost + persistenceBoost + abstractBoost + engagementBoost);
    const overall = this._weightToLevel(adjustedWeight);

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
      // 키워드 매칭 없을 때: 메시지 특성으로 추정
      if (text.length < 5) return 'surface';
      if (text.length < 15) return 'casual';
      // 질문하거나 설명하는 메시지는 최소 analytical 가능성
      const hasQuestion = /\?|왜|어떻게|뭐가|무슨|어째서/.test(text);
      const hasExplanation = text.length > 80 || /때문|이유|결과|그래서|따라서/.test(text);
      if (hasQuestion || hasExplanation) return 'analytical';
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
    if (weight >= 0.75) return 'creative';
    if (weight >= 0.5) return 'exploratory';
    if (weight >= 0.3) return 'analytical';
    if (weight >= 0.15) return 'casual';
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
        if (qtype) questionTypes[qtype]++;
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

    // #5: 프롬프트 목적성 분류 — Task-Master vs Philosopher 강제 레이블링
    const factualRatio = typeDistribution['factual'] || 0;
    const hypothesisRatio = typeDistribution['hypothesis'] || 0;
    const metaRatio = typeDistribution['meta'] || 0;

    let prompt_intent = 'balanced';
    if (factualRatio > 0.9) {
      prompt_intent = 'task_master';      // 명령/사실 위주 90% 초과
    } else if ((hypothesisRatio + metaRatio) > 0.15) {
      prompt_intent = 'philosopher';      // 가설+메타 15% 초과
    }

    return {
      question_ratio: questionRatio, dominant_type: dominantType, depth_vs_breadth: depthVsBreadth,
      follow_up_tendency: followUpTendency, question_type_distribution: typeDistribution,
      prompt_intent: prompt_intent,
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
    let result = null;
    for (const [qtype, score] of Object.entries(scores)) {
      if (score > maxScore) {
        maxScore = score;
        result = qtype;
      }
    }

    // 어떤 패턴에도 안 맞는 질문은 null (분포에서 제외됨)
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

  // #1, #2: L0 전처리 — assistant 제거, 코드 스트리핑, 턴 병합
  const preprocessed = l0SanitizeAndMergeTurns(messages);
  const texts = preprocessed.map(msg => msg.text);

  if (texts.length < PRISM_CONFIG.MIN_TURNS_FOR_ANALYSIS) {
    return {
      error: 'INSUFFICIENT_TURNS',
      message: `Need at least ${PRISM_CONFIG.MIN_TURNS_FOR_ANALYSIS} turns, got ${texts.length}`,
    };
  }

  // #3: 밀도 필터
  const densityCheck = l0DensityCheck(texts);
  if (!densityCheck.pass) {
    return {
      error: densityCheck.reason,
      message: densityCheck.message,
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

  // #11: L3.5 Consistency Volatility
  const consistency = l3ConsistencyVolatility(texts, PRISM_CONFIG.DEPTH_LEVEL_WEIGHTS);

  return {
    topic_distribution: topicDist,
    engagement: { ...engagement, consistency_volatility: consistency },
    vocabulary: vocabulary,
    curiosity: curiosity,
    metadata: {
      engine_version: PRISM_CONFIG.ENGINE_VERSION,
      spec_version: PRISM_CONFIG.SPEC_VERSION,
      computed_at: prismNowISO(),
      input_hash: inputHash,
      turn_count: texts.length,
      preprocessed_from: messages.length,
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
  // 구조 점프형 성장 시그널 — 점진적 개선이 아닌 전면 재구축/구조 변경
  "갈아엎", "아예 새로", "처음부터", "다시 만들", "다시 짜", "새로 짜",
  "리팩토링", "리팩터링", "재설계", "재구성", "재구축", "아키텍처", "구조 변경",
  "전면 수정", "엎어", "뜯어고", "밀어버리", "리셋", "리빌드", "제로부터",
  "바닥부터", "뒤집어", "근본적으로", "판 갈", "판을 새로",
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

  // #7: H2AI 전용 가중치 보정 — empathic 가중치 0, self_disclosure 5배
  // H2AI 모드에서는 '타인 공감'이 의미 없으므로 '자기 개방'에 집중
  const h2ai_empathic_weight = 0;         // 공감 시그널 가중치 → 0
  const h2ai_disclosure_weight = 5;       // 자기 개방 시그널 가중치 → 5x
  const weighted_empathic = empathic * h2ai_empathic_weight;
  const weighted_disclosure = disclosure * h2ai_disclosure_weight;

  // #8: Absolute Magnitude — 비율이 아닌 벡터 크기(총량) 측정
  // ||V|| = sqrt(Space^2 + Solution^2)
  const magnitude = Math.sqrt(space * space + solution * solution);
  const magnitudeNorm = magnitude / (total + ANCHOR_CONFIG.EPSILON);

  const sol_total = solution + space + ANCHOR_CONFIG.EPSILON;
  let sol_vs_space = "balanced";
  if (solution / sol_total > 0.7) {
    sol_vs_space = "solution_focused";
  } else if (space / sol_total > 0.7) {
    sol_vs_space = "space_holding";
  }

  // #8: 두 영역 모두 상위 80%일 경우 Alpha_Integrated로 격상
  const solRatio = solution / (total + ANCHOR_CONFIG.EPSILON);
  const spaceRatio = space / (total + ANCHOR_CONFIG.EPSILON);
  if (solRatio > 0.15 && spaceRatio > 0.15 && magnitudeNorm > 0.2) {
    sol_vs_space = "balanced";
  }

  // #7: 자기 개방도는 H2AI 보정된 가중치 사용
  const disc_ratio = weighted_disclosure / (total * h2ai_disclosure_weight + ANCHOR_CONFIG.EPSILON);
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
    emotional_magnitude: Math.round(magnitudeNorm * 10000) / 10000,
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

  // 구조 점프형 성장도 active count에 이미 포함됨 (시그널 확장)
  // 절대 횟수도 고려: 비율이 낮아도 여러 번 나오면 periodic 이상
  const improvement_ratio = (active + reflective) / (total + ANCHOR_CONFIG.EPSILON);
  const improvement_abs = active + reflective;
  let frequency = "rare";
  if (improvement_ratio > 0.2 || improvement_abs >= 6) {
    frequency = "frequent";
  } else if (improvement_ratio > 0.05 || improvement_abs >= 2) {
    frequency = "periodic";
  }
  // rare 판정은 원래 임계값 유지하되, 절대 횟수 2회 이상이면 periodic으로 구제

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

  // #1, #2: L0 전처리 재활용 (PRISM에서 이미 처리된 경우 중복 방지)
  const preprocessed = l0SanitizeAndMergeTurns(messages);
  const texts = preprocessed.map(m => m.text || "").filter(t => t.length > 0);

  if (texts.length < ANCHOR_CONFIG.MIN_TURNS_FOR_ANALYSIS) {
    return {
      error: "INSUFFICIENT_TURNS",
      message: `ANCHOR requires at least ${ANCHOR_CONFIG.MIN_TURNS_FOR_ANALYSIS} user messages, got ${texts.length}`,
    };
  }

  const input_hash = prismComputeHash(texts.join("||"));

  try {
    const attachment = R1AttachmentAnalyzer_analyze(texts);
    const conflict = R2ConflictAnalyzer_analyze(texts);
    const emotional_availability = R3EmotionalAnalyzer_analyze(texts);
    const growth = R4GrowthAnalyzer_analyze(texts);

    // #6: Markov State Transition — 턴 간 상태 전이 행렬
    const markov = anchorMarkovTransition(texts);

    return {
      success: true,
      attachment: attachment,
      conflict: conflict,
      emotional_availability: emotional_availability,
      growth: growth,
      markov_transitions: markov,
      metadata: {
        engine_version: ANCHOR_CONFIG.ENGINE_VERSION,
        spec_version: ANCHOR_CONFIG.SPEC_VERSION,
        computed_at: prismNowISO(),
        input_hash: input_hash,
        turn_count: texts.length,
        interaction_mode: 'H2AI',
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

// ═══════════════════════════════════════════════════════════
// #6: Markov State Transition — 시계열 인과성 추적
// ═══════════════════════════════════════════════════════════

const MARKOV_STATES = ['secure', 'anxious', 'avoidant', 'neutral', 'conflict'];

function anchorClassifyTurnState(text) {
  const tl = text.toLowerCase();
  if (ANCHOR_STRESS_INDICATORS.some(s => tl.includes(s)) ||
      ANCHOR_CONFLICT_CONTEXT.some(s => tl.includes(s))) {
    // 갈등 상태
    if (ANCHOR_AVOIDANT_SIGNALS.some(s => tl.includes(s))) return 'avoidant';
    if (ANCHOR_ANXIOUS_SIGNALS.some(s => tl.includes(s))) return 'anxious';
    return 'conflict';
  }
  if (ANCHOR_ANXIOUS_SIGNALS.some(s => tl.includes(s))) return 'anxious';
  if (ANCHOR_AVOIDANT_SIGNALS.some(s => tl.includes(s))) return 'avoidant';
  if (ANCHOR_SECURE_SIGNALS.some(s => tl.includes(s))) return 'secure';
  return 'neutral';
}

function anchorMarkovTransition(texts) {
  if (texts.length < 2) return { transitions: {}, dominant_pattern: null, collapse_patterns: [] };

  // 각 턴의 상태 태깅
  const states = texts.map(t => anchorClassifyTurnState(t));

  // 전이 행렬 구축: P(S_t+1 | S_t)
  const transCount = {};
  const fromCount = {};
  for (let i = 0; i < states.length - 1; i++) {
    const from = states[i];
    const to = states[i + 1];
    const key = `${from}->${to}`;
    transCount[key] = (transCount[key] || 0) + 1;
    fromCount[from] = (fromCount[from] || 0) + 1;
  }

  // 전이 확률 계산
  const transitions = {};
  for (const [key, count] of Object.entries(transCount)) {
    const from = key.split('->')[0];
    transitions[key] = Math.round((count / (fromCount[from] || 1)) * 10000) / 10000;
  }

  // 붕괴 패턴 감지: 부정적 연쇄 전이 (불안→회피, 갈등→회피 등)
  const collapsePatterns = [];
  const negativeChains = [
    ['anxious', 'avoidant'],   // 불안 → 회피
    ['conflict', 'avoidant'],  // 갈등 → 회피
    ['anxious', 'conflict'],   // 불안 → 갈등 격화
    ['conflict', 'anxious'],   // 갈등 → 불안 전이
  ];
  for (const [from, to] of negativeChains) {
    const key = `${from}->${to}`;
    if (transitions[key] && transitions[key] > 0.3) {
      collapsePatterns.push({ pattern: key, probability: transitions[key] });
    }
  }

  // 가장 빈도 높은 전이 패턴
  let dominantPattern = null;
  let maxCount = 0;
  for (const [key, count] of Object.entries(transCount)) {
    if (count > maxCount) { maxCount = count; dominantPattern = key; }
  }

  return { transitions, dominant_pattern: dominantPattern, collapse_patterns: collapsePatterns };
}

// ═══════════════════════════════════════════════════════════
// #9: L1 Decision Tree Fallback — LLM 장애 시 하드코딩 분석
// ═══════════════════════════════════════════════════════════

// 인과 접속사 사전
const L1_CAUSAL_CONJUNCTIONS = [
  '왜냐하면', '따라서', '그러므로', '때문에', '그래서', '결론적으로',
  '이로 인해', '결과적으로', '그 결과', '이에 따라', '즉', '바꿔 말하면',
  '다시 말해', '요컨대', '한편', '반면에', '그럼에도', '하지만', '그러나',
];

// P3 전문 어휘 교차 참조 (PRISM_DOMAIN_VOCABULARY에서 핵심 키워드)
const L1_DOMAIN_MARKERS = [
  // tech
  '알고리즘', '아키텍처', '프레임워크', '리팩토링', '디버깅',
  // psychology
  '인지', '무의식', '방어기제', '트라우마', '메타인지',
  // philosophy
  '존재론', '인식론', '변증법', '현상학', '실존',
  // finance
  '포트폴리오', '리스크', '헤지', '레버리지', '밸류에이션',
  // science
  '가설', '실험', '변수', '상관관계', '인과관계',
];

/**
 * L1 Decision Tree: LLM 없이 텍스트 기반 행동 프로필 추정
 * 정확도 목표: 80%+ (분석적 대화 여부 판정)
 */
function l1FallbackDecisionTree(texts, prism, anchor) {
  const allText = texts.join(' ');
  const totalLen = allText.length;

  // 인과 접속사 밀도
  let causalCount = 0;
  for (const conj of L1_CAUSAL_CONJUNCTIONS) {
    const regex = new RegExp(conj, 'g');
    const matches = allText.match(regex);
    if (matches) causalCount += matches.length;
  }
  const causalDensity = causalCount / (texts.length + PRISM_CONFIG.EPSILON);

  // 전문 어휘 밀도
  let domainCount = 0;
  for (const marker of L1_DOMAIN_MARKERS) {
    if (allText.includes(marker)) domainCount++;
  }
  const domainDensity = domainCount / (L1_DOMAIN_MARKERS.length || 1);

  // 평균 문장 길이
  const avgLen = totalLen / (texts.length + PRISM_CONFIG.EPSILON);

  // 질문 비율 (PRISM P4에서 가져옴)
  const questionRatio = prism?.curiosity?.question_ratio || 0;
  const promptIntent = prism?.curiosity?.prompt_intent || 'balanced';

  // 결정 트리 로직
  const fallbackIntensity = {};

  // A1 정서 강도: 감탄사/강조 표현 밀도
  const emotionalMarkers = (allText.match(/[!！]{2,}|ㅠ+|ㅜ+|ㅋ+|ㅎ+|하하|진짜|대박|미쳤/g) || []).length;
  fallbackIntensity.A1 = Math.min(1.0, emotionalMarkers / (texts.length * 0.5 + PRISM_CONFIG.EPSILON));

  // A2 정서 안정성: 인과 접속사 + 문장 길이 일관성
  const lengths = texts.map(t => t.length);
  const lenMean = lengths.length > 0 ? lengths.reduce((a, b) => a + b, 0) / lengths.length : 0;
  const lenStd = lengths.length > 0 ? Math.sqrt(lengths.reduce((sum, l) => sum + (l - lenMean) ** 2, 0) / lengths.length) : 0;
  const lenCV = lenStd / (lenMean + PRISM_CONFIG.EPSILON);
  fallbackIntensity.A2 = Math.min(1.0, Math.max(0, 1.0 - lenCV));

  // A3 감정 표현: 감정 어휘 밀도
  const expressiveMarkers = (allText.match(/좋아|싫어|슬프|기뻐|화나|무서|불안|행복|사랑|미워|짜증/g) || []).length;
  fallbackIntensity.A3 = Math.min(1.0, expressiveMarkers / (texts.length * 0.3 + PRISM_CONFIG.EPSILON));

  // A4 자기 확신: 단정적 표현 밀도
  const assertiveMarkers = (allText.match(/확실히|분명히|당연히|반드시|절대|무조건|틀림없이|나는|내가/g) || []).length;
  fallbackIntensity.A4 = Math.min(1.0, assertiveMarkers / (texts.length * 0.3 + PRISM_CONFIG.EPSILON));

  // A5 사회적 주도성: 제안/의견 표현
  const initiativeMarkers = (allText.match(/해보자|하자|어때|제안|생각에는|방법은|해볼까/g) || []).length;
  fallbackIntensity.A5 = Math.min(1.0, initiativeMarkers / (texts.length * 0.2 + PRISM_CONFIG.EPSILON));

  // A6 권위 수용: 겸양/수용 표현
  const acceptanceMarkers = (allText.match(/맞아|그렇지|동의|알겠|이해|감사|고마워|배우|참고/g) || []).length;
  fallbackIntensity.A6 = Math.min(1.0, acceptanceMarkers / (texts.length * 0.3 + PRISM_CONFIG.EPSILON));

  // A12 친밀감 편안함: 개인적 이야기 공유
  const intimacyMarkers = (allText.match(/내 경험|솔직히|사실은|비밀인데|나만|개인적으로|우리|같이/g) || []).length;
  fallbackIntensity.A12 = Math.min(1.0, intimacyMarkers / (texts.length * 0.2 + PRISM_CONFIG.EPSILON));

  // A14 변화 수용성: 열린 태도 표현
  const openMarkers = (allText.match(/새로운|다르게|바꿔|시도|도전|변화|혁신|왜 안 돼/g) || []).length;
  fallbackIntensity.A14 = Math.min(1.0, openMarkers / (texts.length * 0.2 + PRISM_CONFIG.EPSILON));

  // 간이 structural axes (기본값 — styles 포함, precomputeAxes와 동일 구조)
  const a7p = avgLen > 100 && causalDensity > 0.5 ? 'initiator' : avgLen < 30 ? 'responder' : 'balanced';
  const a9p = fallbackIntensity.A3 > 0.3 ? 'expressive' : fallbackIntensity.A3 < 0.1 ? 'suppressive' : 'analytical';
  const a10p = domainDensity > 0.2 ? 'depth_seeker' : domainDensity < 0.02 ? 'surface_locked' : 'slow_burn';
  const a13p = questionRatio > 0.3 ? 'growth' : 'defensive';
  const a15p = promptIntent === 'philosopher' ? 'active_investor' : 'passive_maintainer';
  const a16p = causalDensity > 0.3 ? 'analytical' : 'pragmatic';
  const fallbackStructural = {
    A7:  { primary: a7p, styles: { initiator: a7p === 'initiator' ? 0.6 : 0.2, responder: a7p === 'responder' ? 0.6 : 0.2, balanced: a7p === 'balanced' ? 0.6 : 0.2 } },
    A8:  { primary: 'boundary', styles: { confrontational: 0.1, repair: 0.15, avoidant: 0.1, boundary: 0.5 } },
    A9:  { primary: a9p, styles: { expressive: a9p === 'expressive' ? 0.5 : 0.15, analytical: a9p === 'analytical' ? 0.5 : 0.15, suppressive: a9p === 'suppressive' ? 0.5 : 0.1, externalized: 0.1 } },
    A10: { primary: a10p, styles: { depth_seeker: a10p === 'depth_seeker' ? 0.5 : 0.15, slow_burn: a10p === 'slow_burn' ? 0.5 : 0.15, surface_locked: a10p === 'surface_locked' ? 0.5 : 0.1, explorer: 0.1 } },
    A11: { primary: 'balanced', styles: { proactive: 0.2, balanced: 0.5, reactive: 0.2, volatile: 0.1 } },
    A13: { primary: a13p, styles: { growth: a13p === 'growth' ? 0.5 : 0.15, defensive: a13p === 'defensive' ? 0.5 : 0.15, avoidant: 0.1, absorptive: 0.1 } },
    A15: { primary: a15p, styles: { active_investor: a15p === 'active_investor' ? 0.5 : 0.15, passive_maintainer: a15p === 'passive_maintainer' ? 0.5 : 0.15, selective_engager: 0.15, withdrawn: 0.05 } },
    A16: { primary: a16p, styles: { analytical: a16p === 'analytical' ? 0.5 : 0.15, pragmatic: a16p === 'pragmatic' ? 0.5 : 0.15, intuitive: 0.15, rigid: 0.05 } },
    A17: { primary: 'minimal', styles: { expansive: 0.1, moderate: 0.2, minimal: 0.5, absent: 0.2 } },
  };

  return {
    intensity: fallbackIntensity,
    structural: fallbackStructural,
    _fallback: true,
    _confidence: causalDensity > 0.3 && domainDensity > 0.15 ? 'high' : causalDensity > 0.1 ? 'medium' : 'low',
  };
}

// ═══════════════════════════════════════════════════════════
// #11: L3.5 Consistency Volatility — 구간 분산 페널티
// ═══════════════════════════════════════════════════════════

/**
 * 전/후반부 평균 차이 + 표준편차 페널티
 * C4_final = (|late_mean - early_mean| + λ * σ_total) / ceiling
 */
function l3ConsistencyVolatility(texts, depthWeights) {
  if (texts.length < 4) return { c4_score: 0, volatility: 'stable' };

  const LAMBDA = 0.5;
  const C4_CEILING = 1.0;

  // 각 턴의 depth weight 추출
  const p2 = new PrismP2DepthAnalyzer();
  const weights = texts.map(t => {
    const depth = p2._classifyDepth(t);
    return depthWeights[depth] || 0.1;
  });

  const mid = Math.floor(weights.length / 2);
  const earlyWeights = weights.slice(0, mid);
  const lateWeights = weights.slice(mid);

  const mean = arr => arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
  const std = arr => {
    if (arr.length === 0) return 0;
    const m = mean(arr);
    return Math.sqrt(arr.reduce((sum, v) => sum + (v - m) ** 2, 0) / arr.length);
  };

  const earlyMean = mean(earlyWeights);
  const lateMean = mean(lateWeights);
  const sigmaTotal = std(weights);

  const c4Final = Math.min(1.0, (Math.abs(lateMean - earlyMean) + LAMBDA * sigmaTotal) / C4_CEILING);

  let volatility = 'stable';
  if (c4Final > 0.6) volatility = 'volatile';
  else if (c4Final > 0.3) volatility = 'moderate';

  return {
    c4_score: Math.round(c4Final * 10000) / 10000,
    volatility: volatility,
    early_mean: Math.round(earlyMean * 10000) / 10000,
    late_mean: Math.round(lateMean * 10000) / 10000,
    sigma: Math.round(sigmaTotal * 10000) / 10000,
  };
}

// ═══════════════════════════════════════════════════════════
// #12: L4 Asymmetric Delta — 비대칭 마찰 계수
// ═══════════════════════════════════════════════════════════

/**
 * Δ = α · max(0, O - E) + β · max(0, E - O)
 * O = Observed (실제값), E = Expected (기준값/중립 0.5)
 */
const L4_AXIS_WEIGHTS = {
  // 초과(α)와 미달(β) 가중치를 축별로 차등 적용
  A1:  { alpha: 1.2, beta: 0.8 },   // 정서 강도: 초과에 약간 가산
  A2:  { alpha: 0.8, beta: 1.2 },   // 정서 안정성: 불안정(미달)에 가산
  A3:  { alpha: 1.0, beta: 1.0 },   // 감정 표현: 대칭
  A4:  { alpha: 1.5, beta: 0.8 },   // 자기 확신: 과잉확신(초과)에 높은 마찰
  A5:  { alpha: 1.3, beta: 0.7 },   // 사회적 주도성: 공격적 주도(초과) 페널티
  A6:  { alpha: 0.7, beta: 1.3 },   // 권위 수용: 맹종(미달)에 가산
  A12: { alpha: 1.0, beta: 1.0 },   // 친밀감: 대칭
  A14: { alpha: 0.8, beta: 1.2 },   // 변화 수용: 경직(미달)에 가산
};

function l4AsymmetricDelta(observed, expected) {
  if (!observed || !expected) return null;

  const deltas = {};
  let totalFriction = 0;

  for (const [axis, weights] of Object.entries(L4_AXIS_WEIGHTS)) {
    const o = observed[axis];
    const e = expected[axis] ?? 0.5; // 기준값 없으면 중립(0.5)

    if (o === undefined) continue;

    const overshoot = Math.max(0, o - e);
    const undershoot = Math.max(0, e - o);
    const delta = weights.alpha * overshoot + weights.beta * undershoot;

    deltas[axis] = {
      observed: Math.round(o * 10000) / 10000,
      expected: Math.round(e * 10000) / 10000,
      delta: Math.round(delta * 10000) / 10000,
      direction: overshoot > undershoot ? 'overshoot' : undershoot > overshoot ? 'undershoot' : 'aligned',
    };
    totalFriction += delta;
  }

  const axisCount = Object.keys(deltas).length || 1;
  const avgFriction = totalFriction / axisCount;

  return {
    axis_deltas: deltas,
    total_friction: Math.round(totalFriction * 10000) / 10000,
    avg_friction: Math.round(avgFriction * 10000) / 10000,
    friction_level: avgFriction > 0.3 ? 'high' : avgFriction > 0.15 ? 'moderate' : 'low',
  };
}

// ═══════════════════════════════════════════════════════════════
// ═══════════ ORIGINAL WORKER CODE ═══════════
// ═══════════════════════════════════════════════════════════════

const RATE_LIMIT_ANALYZE = 10;
const RATE_LIMIT_MATCH = 10;
const RATE_LIMIT_WINDOW = 60;
const MAX_SIZE_ANALYZE = 10 * 1024 * 1024; // 10MB (전처리가 1000개로 잘라줌)
const MAX_SIZE_MATCH = 10 * 1024 * 1024;   // 10MB
const MAX_SIZE_FEEDBACK = 10 * 1024;
const MAX_SIZE_SHARE = 50 * 1024;

const ALLOWED_ORIGINS = [
  'https://jeongjeongjeongm.github.io',
  'https://knot-exodia.ashirmallo.workers.dev',
  'https://knot-ai.pages.dev'
];

function isOriginAllowed(origin) {
  if (!origin) return false;
  return ALLOWED_ORIGINS.some(allowed => origin === allowed || origin.startsWith(allowed + '/'));
}

async function checkRateLimit(ip, endpoint, limit, env) {
  if (!env.RATE_LIMITER) {
    console.warn('[RateLimit] RATE_LIMITER binding missing — fail-closed');
    return false;
  }
  const key = `rl:${ip}:${endpoint}`;
  try {
    const current = parseInt(await env.RATE_LIMITER.get(key) || '0');
    if (current >= limit) return false;
    await env.RATE_LIMITER.put(key, String(current + 1), { expirationTtl: RATE_LIMIT_WINDOW });
    return true;
  } catch (e) {
    console.error('[RateLimit] Error — fail-closed:', e.message);
    return false;
  }
}

// ═══════════════════════════════════════════════════════════
// GOOGLE AUTH TOKEN VERIFICATION
// ═══════════════════════════════════════════════════════════

async function verifyGoogleToken(token, env) {
  if (!token) return null;
  try {
    // Use Google's tokeninfo endpoint to verify
    const resp = await fetch('https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(token));
    if (!resp.ok) return null;
    const data = await resp.json();

    // Verify token is not expired
    if (data.exp && parseInt(data.exp) * 1000 < Date.now()) return null;

    // Verify audience matches our client ID (if configured)
    // Verify audience matches our client ID
    if (env.GOOGLE_CLIENT_ID && data.aud !== env.GOOGLE_CLIENT_ID) {
      console.error('[Auth] Token audience mismatch:', data.aud);
      return null;
    }

    // 필수 필드 검증
    if (!data.email || !data.sub) return null;

    return {
      email: data.email,
      name: data.name || data.email,
      picture: data.picture || null,
      sub: data.sub, // Google user ID
      verified: data.email_verified === 'true'
    };
  } catch (e) {
    console.error('[Auth] Token verification failed:', e.message);
    return null;
  }
}

async function requireAuth(request, env) {
  const authHeader = request.headers.get('Authorization') || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    return { error: 'Authentication required', status: 401 };
  }

  const user = await verifyGoogleToken(token, env);
  if (!user) {
    return { error: 'Invalid or expired token', status: 401 };
  }

  // Track user in D1 (fire-and-forget, don't block the request)
  if (env.KNOT_DB) {
    try {
      env.KNOT_DB.prepare(
        `INSERT INTO users (id, email, last_seen) VALUES (?, ?, datetime('now'))
         ON CONFLICT(id) DO UPDATE SET last_seen = datetime('now')`
      ).bind(user.sub, user.email).run().catch(() => {});
    } catch(e) {}
  }

  return { user };
}

function sanitizeString(str, maxLen = 100000) {
  if (Array.isArray(str)) str = str.join('\n');
  if (typeof str !== 'string') str = String(str || '');
  let s = str.slice(0, maxLen).replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');
  // Prompt injection defense: neutralize system/instruction override attempts
  s = s.replace(/\[\s*(SYSTEM|INST|INSTRUCTION|END|ADMIN|OVERRIDE|HUMAN|ASSISTANT|USER)\s*[:\]]/gi, '[FILTERED]');
  s = s.replace(/(ignore|disregard|forget|override)\s+(all\s+)?(previous|above|prior|system)\s+(instructions?|prompts?|rules?)/gi, '[FILTERED]');
  return s;
}

// ── 민감 표현 마스킹 (403 재시도용) ──
// 성적 표현, 노골적 욕설을 중립 태그로 치환 — 감정 톤/행동 패턴은 유지
function maskSensitiveContent(text) {
  if (typeof text !== 'string') return text;
  let s = text;
  // 성적 행위/표현
  s = s.replace(/섹스|세ㄱ스|쎅스|sex|SEX/gi, '[친밀행위]');
  s = s.replace(/성관계|성행위|잠자리|동침|합방/g, '[친밀행위]');
  s = s.replace(/박[았았을을]|박아|박히|꽂[았아히]|삽입|넣[었어]|집어넣/g, '[신체접촉]');
  s = s.replace(/빨[았아어]|빨아|핥[았아어]|물[었어]고|깨물/g, '[신체접촉]');
  s = s.replace(/자위|딸[쳤치]|딸치|오르가[즘슴]|사정|절정|이[갔가]/g, '[성적표현]');
  s = s.replace(/발기|흥분|젖[었어]|적[셨셔]|축축/g, '[신체반응]');
  s = s.replace(/가슴|젖꼭지|엉덩이|보[지즤]|자[지]|페니스|음경|음핵|클리/g, '[신체부위]');
  s = s.replace(/야동|포르노|AV|av|성인물|야한|야설/gi, '[성인콘텐츠]');
  s = s.replace(/콘돔|피임|임신|생리|월경/g, '[건강관련]');
  s = s.replace(/노출|벗[었어기]|알몸|나체|옷\s*벗/g, '[노출표현]');
  s = s.replace(/강간|성폭|성추행|성희롱|몰카|도촬/g, '[범죄표현]');
  // 거친 욕설 (감정 톤은 태그로 유지)
  s = s.replace(/씨[발빨바]|시[발빨바]|ㅅㅂ|ㅆㅂ|씹[새새년놈]|좆|존?나|ㅈㄴ/g, '[욕설]');
  s = s.replace(/개새끼|개[년놈]|미친[년놈]|ㅂㅅ|병[신싄]|장애|지[랄럴]|꺼져|닥[쳐치]/g, '[욕설]');
  // === 실제 403 트리거: 감정/고통 표현 → 동일 감정강도의 필터 안전 표현으로 치환 ===
  s = s.replace(/죽겠[다어]/g, '너무 벅차다');
  s = s.replace(/죽을것같|죽을\s*것\s*같/g, '한계에 달했다');
  s = s.replace(/죽고\s*싶/g, '너무 지쳤다');
  s = s.replace(/죽을래/g, '포기하고 싶다');
  s = s.replace(/죽어버리/g, '무너져버리다');
  s = s.replace(/죽어야/g, '끝내야');
  s = s.replace(/살기\s*싫/g, '모든게 버겁다');
  s = s.replace(/미치겠[다어]/g, '정말 답답하다');
  s = s.replace(/미칠것같|미칠\s*것\s*같/g, '감당이 안 된다');
  s = s.replace(/미쳐버리/g, '한계에 다다르다');
  s = s.replace(/돌아버리/g, '감당이 안 되다');
  s = s.replace(/돌겠[다어]/g, '너무 답답하다');
  s = s.replace(/정신나가/g, '멘탈이 흔들리다');
  s = s.replace(/힘들[다어었]/g, '버겁다');
  s = s.replace(/괴롭[다어워]/g, '마음이 무겁다');
  s = s.replace(/슬프[다어]/g, '마음이 아프다');
  s = s.replace(/우울[하해]/g, '기분이 가라앉다');
  s = s.replace(/고통스[럽러]/g, '감당하기 어렵다');
  s = s.replace(/외롭[다어워]/g, '혼자인 느낌이다');
  s = s.replace(/자살/g, '극심한 고통');
  s = s.replace(/자해/g, '자기파괴적 충동');
  s = s.replace(/손목/g, '신체 일부');
  s = s.replace(/목숨/g, '삶');
  s = s.replace(/극단적/g, '매우 강렬한');
  // === 실제 403 트리거: 공격적 일상표현 → 감정 강도 보존 치환 ===
  s = s.replace(/죽여[버줄]|죽여/g, '혼내주다');
  s = s.replace(/때려[죽치]/g, '혼내다');
  s = s.replace(/맞아\s*죽/g, '크게 당하다');
  s = s.replace(/개죽/g, '크게 망하다');
  s = s.replace(/뒤[져지질]|뒤져[라야버]/g, '큰일 나다');
  s = s.replace(/골로\s*가/g, '끝장나다');
  s = s.replace(/패[버줄]|패죽/g, '크게 혼내다');
  s = s.replace(/찢어[버]/g, '박살내다');
  s = s.replace(/박살[나내]/g, '완전히 망가지다');
  s = s.replace(/부셔[버]/g, '부수다');
  // === 실제 403 트리거: 기술/보안 키워드 → 중립 치환 ===
  s = s.replace(/해킹/g, '무단침입');
  s = s.replace(/핵|치트/g, '부정행위');
  s = s.replace(/크랙/g, '불법복제');
  s = s.replace(/탈옥|루팅/g, '기기변조');
  s = s.replace(/exploit/gi, '취약점이용');
  s = s.replace(/랜섬/g, '데이터인질');
  s = s.replace(/디도스|DDoS|ddos/gi, '서버공격');
  s = s.replace(/바이러스|악성코드/g, '유해프로그램');
  s = s.replace(/피싱|스니핑/g, '사기수법');
  // 연속된 태그 정리
  s = s.replace(/(\[(?:친밀행위|신체접촉|성적표현|신체반응|신체부위|성인콘텐츠|건강관련|노출표현|범죄표현|욕설)\]){2,}/g, '$1');
  return s;
}

// rawMessages 배열 전체 마스킹
function maskMessages(rawMessages) {
  return rawMessages.map(m => {
    if (typeof m === 'string') return maskSensitiveContent(m);
    if (m && typeof m === 'object') return { ...m, text: maskSensitiveContent(m.text || '') };
    return m;
  });
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

// ═══════════════════════════════════════════════════════════
// STAGE 1: SCORING SYSTEM PROMPT — LLM reads conversation, outputs structured scores
// ═══════════════════════════════════════════════════════════

const SYSTEM_PROMPT_SCORING = `당신은 행동 분석 엔진입니다. 대화 원문을 읽고 정량적 행동 프로필을 JSON으로 출력합니다.
절대 설명하지 마세요. 오직 유효한 JSON만 출력하세요.

## 분석 맥락
이것은 사용자가 자발적으로 제출한 자신의 대화 데이터에 대한 심리 행동 패턴 분석입니다.
대화 내용에 성적 표현, 거친 언어, 민감한 주제가 포함될 수 있으나, 당신의 역할은 내용을 판단하거나 재생산하는 것이 아니라 행동 패턴의 정량적 지표를 추출하는 것입니다.
대화 내용 자체를 출력하지 마세요. 오직 수치 점수만 출력하세요.

## 작동 모드
사전 추정값이 제공된 경우: 대화 원문을 직접 읽고, 추정값의 정확성을 검증하세요. 맞으면 그대로 유지, 틀리면 보정하세요. 특히 [신뢰도: low] 축은 대화 원문 기반으로 재평가하세요.
사전 추정값이 없는 경우: 대화 원문만으로 전체 프로필을 생성하세요.

## Intensity 축 (0.0~1.0 실수)
A1 정서 강도 (0=무감각, 1=격정) | A2 정서 안정성 (0=냉담, 1=깊은 공감) | A3 감정 표현 (0=억제, 1=대항적) | A4 자기 확신 (0=소극, 1=지배적) | A5 사회적 주도성 (0=수동, 1=적극) | A6 권위 수용 (0=불안정, 1=일관) | A12 친밀감 편안함 (0=거리감, 1=깊은 친밀) | A14 변화 수용성 (0=경직, 1=유연)

## Structural 축 (primary + styles 분포, 합계 1.0)
A7 상호작용 지향: initiator|responder|balanced
A8 갈등 조절: confrontational|repair|avoidant|boundary
A9 감정 처리: expressive|analytical|suppressive|externalized
A10 친밀감 기울기: surface_locked|slow_burn|depth_seeker|fast_opener
A11 호혜성: giver|taker|balanced
A13 인정 욕구: growth|defensive|avoidant|absorptive
A15 관계 투자: active_investor|passive_maintainer|disengaged
A16 의사결정: analytical|pragmatic|binary
A17 유머/긴장 해소: tension_breaker|bonding|deflective|aggressive|minimal

## 판단 원칙
1. 키워드 빈도가 아니라 맥락과 의도를 읽으세요
2. 단일 발화에 과도한 비중을 두지 마세요 — 반복 패턴을 찾으세요
3. 정보가 부족한 축은 0.5 (중립), styles는 균등 분배
4. 사전 추정값은 참고용 — 대화 원문 관찰이 항상 우선
5. 유효한 JSON만 출력. 코드블록, 설명, 주석 금지

## 출력 형식
{"intensity":{"A1":0.00,"A2":0.00,"A3":0.00,"A4":0.00,"A5":0.00,"A6":0.00,"A12":0.00,"A14":0.00},"structural":{"A7":{"primary":"...","styles":{}},"A8":{"primary":"...","styles":{}},"A9":{"primary":"...","styles":{}},"A10":{"primary":"...","styles":{}},"A11":{"primary":"...","styles":{}},"A13":{"primary":"...","styles":{}},"A15":{"primary":"...","styles":{}},"A16":{"primary":"...","styles":{}},"A17":{"primary":"...","styles":{}}}}`;

// ═══════════════════════════════════════════════════════════
// SERVER-SIDE CALCULATION LOGIC (migrated from client for security)
// ═══════════════════════════════════════════════════════════

const CONFLICT_MATRIX = {
    A7: { 'initiator_initiator': 0.4, 'initiator_responder': 0.1, 'initiator_balanced': 0.2, 'responder_initiator': 0.1, 'responder_responder': 0.5, 'responder_balanced': 0.3, 'balanced_initiator': 0.2, 'balanced_responder': 0.3, 'balanced_balanced': 0.2 },
    A8: { 'confrontational_confrontational': 0.3, 'confrontational_boundary': 0.4, 'confrontational_avoidant': 0.7, 'confrontational_repair': 0.2, 'boundary_confrontational': 0.4, 'boundary_boundary': 0.1, 'boundary_avoidant': 0.5, 'boundary_repair': 0.1, 'avoidant_confrontational': 0.7, 'avoidant_boundary': 0.5, 'avoidant_avoidant': 0.4, 'avoidant_repair': 0.3, 'repair_confrontational': 0.2, 'repair_boundary': 0.1, 'repair_avoidant': 0.3, 'repair_repair': 0.1 },
    A9: { 'expressive_expressive': 0.2, 'expressive_analytical': 0.5, 'expressive_suppressive': 0.6, 'expressive_externalized': 0.4, 'analytical_expressive': 0.5, 'analytical_analytical': 0.1, 'analytical_suppressive': 0.3, 'analytical_externalized': 0.5, 'suppressive_expressive': 0.6, 'suppressive_analytical': 0.3, 'suppressive_suppressive': 0.3, 'suppressive_externalized': 0.5, 'externalized_expressive': 0.4, 'externalized_analytical': 0.5, 'externalized_suppressive': 0.5, 'externalized_externalized': 0.7 },
    A10: { 'slow_burn_slow_burn': 0.1, 'slow_burn_fast_opener': 0.4, 'slow_burn_surface_locked': 0.5, 'slow_burn_depth_seeker': 0.3, 'fast_opener_slow_burn': 0.4, 'fast_opener_fast_opener': 0.2, 'fast_opener_surface_locked': 0.7, 'fast_opener_depth_seeker': 0.1, 'surface_locked_slow_burn': 0.5, 'surface_locked_fast_opener': 0.7, 'surface_locked_surface_locked': 0.3, 'surface_locked_depth_seeker': 0.6, 'depth_seeker_slow_burn': 0.3, 'depth_seeker_fast_opener': 0.1, 'depth_seeker_surface_locked': 0.6, 'depth_seeker_depth_seeker': 0.2 },
    A11: { 'giver_giver': 0.2, 'giver_taker': 0.5, 'giver_balanced': 0.1, 'taker_giver': 0.5, 'taker_taker': 0.7, 'taker_balanced': 0.4, 'balanced_giver': 0.1, 'balanced_taker': 0.4, 'balanced_balanced': 0.25 }
};

const KOREAN_FUNC_WORDS = {
  particles: ['은','는','이','가','을','를','에','에서','의','로','으로','와','과','도','만','까지','부터','마다','조차','라도','이나','나','든지','이든지'],
  pronouns: ['나','너','저','우리','너희','그','그녀','이것','저것','그것','여기','저기','거기','누구','뭐','무엇','어디','언제'],
  conjunctions: ['그리고','그런데','그래서','하지만','그러나','또','또는','그래도','그러면','왜냐하면','즉','만약','비록','때문에'],
  adverbs: ['좀','너무','매우','정말','진짜','아주','조금','많이','잘','못','안','다','또','이미','아직','바로','꼭','항상','자주','가끔'],
  negations: ['안','못','없','아니','절대','전혀','별로','싫','말'],
  quantifiers: ['모든','각','여러','몇','많은','적은','조금','약간','대부분','전부','다','좀','꽤','상당히'],
  fillers: ['음','어','그','뭐','아','네','예','응','글쎄','뭐랄까','그냥','일단','아마','혹시']
};

function computeFunctionWordProfile(messages) {
  if (!messages || messages.length === 0) return null;
  const allText = messages.map(m => typeof m === 'string' ? m : (m.text || m.content || '')).join(' ');
  const totalChars = allText.length || 1;
  const profile = {};
  for (const [cat, words] of Object.entries(KOREAN_FUNC_WORDS)) {
    let count = 0;
    for (const w of words) {
      let idx = 0;
      while ((idx = allText.indexOf(w, idx)) !== -1) { count++; idx += w.length; }
    }
    profile[cat] = count / (totalChars / 100);
  }
  return profile;
}

function computeLSMSimilarity(fwpA, fwpB) {
  if (!fwpA || !fwpB) return 0.5;
  const cats = Object.keys(KOREAN_FUNC_WORDS);
  let totalLSM = 0;
  for (const cat of cats) {
    const a = fwpA[cat] || 0;
    const b = fwpB[cat] || 0;
    totalLSM += 1 - Math.abs(a - b) / (a + b + 0.0001);
  }
  return totalLSM / cats.length;
}

function _h(v) { return typeof v === 'number' && v >= 0.6; }
function _l(v) { return typeof v === 'number' && v < 0.4; }
function _sdom(data, axis) {
  const axData = data._structural && data._structural[axis];
  if (!axData) return '';
  return axData.primary || '';
}

function _flattenProfile(axes) {
  const flat = {};
  if (axes.intensity) {
    for (const [k, v] of Object.entries(axes.intensity)) {
      flat[k] = typeof v === 'number' ? v : 0.5;
    }
  }
  flat._structural = axes.structural || {};
  return flat;
}

const MATCH_ARCHETYPES = [
  {
    match: (a, b) => (_sdom(a, 'A9') === 'expressive' && _sdom(b, 'A9') === 'suppressive') || (_sdom(a, 'A9') === 'suppressive' && _sdom(b, 'A9') === 'expressive'),
    name: '밀물과 썰물', tagline: '다가가면 물러나고, 물러나면 다가오는 — 끝없는 파도의 관계',
    tension: '높음', growth: '매우 높음'
  },
  {
    match: (a, b) => _h(a.A1) && _h(b.A1) && _h(a.A4) && _h(b.A4),
    name: '두 개의 불꽃', tagline: '서로의 열기가 관계를 밝히기도, 태우기도 하는 — 격렬한 공명의 관계',
    tension: '매우 높음', growth: '높음'
  },
  {
    match: (a, b) => (_sdom(a, 'A16') === 'analytical' && ['pragmatic','binary'].includes(_sdom(b, 'A16'))) || (_sdom(b, 'A16') === 'analytical' && ['pragmatic','binary'].includes(_sdom(a, 'A16'))),
    name: '번역이 필요한 대화', tagline: '같은 말을 다른 언어로 하는 — 통역이 필요한 관계',
    tension: '보통', growth: '높음'
  },
  {
    match: (a, b) => Math.abs((a.A4 || 0.5) - (b.A4 || 0.5)) > 0.4,
    name: '불과 얼음', tagline: '한쪽은 타오르고 다른 쪽은 얼어있는 — 온도차가 만드는 긴장과 매력',
    tension: '높음', growth: '높음'
  },
  {
    match: (a, b) => _h(a.A6) && _h(b.A6) && _h(a.A5) && _h(b.A5),
    name: '잔잔한 호수', tagline: '서로에게 기대도 흔들리지 않는 — 안정 위의 안정',
    tension: '낮음', growth: '보통'
  },
  {
    match: (a, b) => (_sdom(a, 'A8') === 'avoidant' || _sdom(a, 'A8') === 'boundary') && (_sdom(b, 'A8') === 'avoidant' || _sdom(b, 'A8') === 'boundary'),
    name: '마주 보는 성벽', tagline: '서로의 벽을 인정하지만 넘지 못하는 — 안전하지만 외로운 거리',
    tension: '보통', growth: '낮음'
  },
  {
    match: (a, b) => {
      const aMode = _sdom(a, 'A8');
      const bMode = _sdom(b, 'A8');
      const isConfront = m => m === 'confrontational';
      const isAvoid = m => m === 'avoidant' || m === 'boundary';
      return (isConfront(aMode) && isAvoid(bMode)) || (isAvoid(aMode) && isConfront(bMode));
    },
    name: '부딪히는 파장', tagline: '한쪽은 부딪히고 다른 쪽은 피하는 — 갈등 언어가 다른 관계',
    tension: '매우 높음', growth: '높음'
  },
  {
    match: () => true,
    name: '교차하는 궤도', tagline: '서로 다른 궤도를 돌지만 주기적으로 만나는 — 복합적 역학의 관계',
    tension: '보통', growth: '보통'
  },
];

function serverComputeMatchIdentity(axesA, axesB, identityA, identityB) {
  const flatA = _flattenProfile(axesA);
  const flatB = _flattenProfile(axesB);
  for (const arch of MATCH_ARCHETYPES) {
    try {
      if (arch.match(flatA, flatB)) {
        return {
          name: arch.name, tagline: arch.tagline,
          emoji_a: identityA?.emoji || '🔮', emoji_b: identityB?.emoji || '🔮',
          code: (identityA?.code || '-') + ' × ' + (identityB?.code || '-'),
          tension: arch.tension, growth: arch.growth
        };
      }
    } catch { continue; }
  }
  return {
    name: '교차하는 궤도', tagline: '복합적 역학의 관계',
    emoji_a: identityA?.emoji || '🔮', emoji_b: identityB?.emoji || '🔮',
    code: (identityA?.code || '-') + ' × ' + (identityB?.code || '-'),
    tension: '보통', growth: '보통'
  };
}

function serverComputeCompatibility(axesA, axesB, fwpA, fwpB) {
  const intensities_a = axesA.intensity || {};
  const intensities_b = axesB.intensity || {};

  // Intensity friction
  const intensity_friction = (
    Math.abs((intensities_a.A1 || 0.5) - (intensities_b.A1 || 0.5)) +
    Math.abs((intensities_a.A2 || 0.5) - (intensities_b.A2 || 0.5)) +
    Math.abs((intensities_a.A3 || 0.5) - (intensities_b.A3 || 0.5)) +
    Math.abs((intensities_a.A4 || 0.5) - (intensities_b.A4 || 0.5)) +
    Math.abs((intensities_a.A5 || 0.5) - (intensities_b.A5 || 0.5)) +
    Math.abs((intensities_a.A6 || 0.5) - (intensities_b.A6 || 0.5))
  ) / 6;

  // Structural friction
  let structural_friction = 0;
  let count = 0;
  const structA = axesA.structural || {};
  const structB = axesB.structural || {};
  ['A7', 'A8', 'A9', 'A10', 'A11'].forEach(axisId => {
    const styleA = structA[axisId]?.primary;
    const styleB = structB[axisId]?.primary;
    if (styleA && styleB) {
      const key = styleA + '_' + styleB;
      if (CONFLICT_MATRIX[axisId] && CONFLICT_MATRIX[axisId][key] !== undefined) {
        structural_friction += CONFLICT_MATRIX[axisId][key];
        count++;
      }
    }
  });
  structural_friction = count > 0 ? structural_friction / count : 0;

  // LSM friction
  const lsm_similarity = computeLSMSimilarity(fwpA, fwpB);
  const lsm_friction = 1 - lsm_similarity;

  // Weighted formula
  const total_friction = 0.40 * intensity_friction + 0.40 * structural_friction + 0.20 * lsm_friction;
  const compatibility = (1 - total_friction) * 100;

  return {
    score: Math.max(0, Math.min(100, compatibility)),
    intensity_friction,
    structural_friction,
    lsm_similarity,
    lsm_friction,
    total_friction
  };
}

// ═══════════════════════════════════════════════════════════
// PRECOMPUTE LAYER — PRISM/ANCHOR/L1 기반 축 사전 추정
// LLM은 이 추정값을 검증/보정만 수행 → 토큰 절감
// ═══════════════════════════════════════════════════════════

function precomputeAxes(rawMessages, prism, anchor) {
  const texts = rawMessages
    .map(m => typeof m === 'string' ? m : (m.text || ''))
    .filter(t => t.length > 0);

  if (texts.length < 3) return null;

  const allText = texts.join(' ');
  const EPS = 0.0001;

  // ── Intensity axes: 키워드 밀도 + PRISM/ANCHOR 데이터 결합 ──
  const intensity = {};
  const confidence = {}; // per-axis confidence: 'high'|'medium'|'low'

  // A1 정서 강도: 감탄사/강조 밀도 + ANCHOR attachment 참조
  const emotionalMarkers = (allText.match(/[!！]{2,}|ㅠ+|ㅜ+|ㅋ+|ㅎ+|하하|진짜|대박|미쳤|ㄹㅇ|레알|씨발|시발|존나/g) || []).length;
  const a1base = Math.min(1.0, emotionalMarkers / (texts.length * 0.5 + EPS));
  // ANCHOR anxious attachment boosts emotional intensity
  const anxiousBoost = anchor?.attachment?.primary_tendency === 'leans_anxious' ? 0.15 : 0;
  intensity.A1 = Math.min(1.0, Math.max(0, a1base + anxiousBoost));
  confidence.A1 = emotionalMarkers > 5 ? 'high' : emotionalMarkers > 2 ? 'medium' : 'low';

  // A2 정서 안정성: 감정 신호 변동성 기반 (문장 길이 CV가 아닌 실제 감정 지표)
  // 1) 각 메시지별 감정 밀도 측정
  const emotionRegex = /[!！]{2,}|ㅠ+|ㅜ+|ㅋ{3,}|ㅎ{3,}|좋아|싫어|슬프|기뻐|화나|무서|불안|행복|사랑|미워|짜증|설레|우울|외로|진짜|대박|미쳤|씨발|시발|존나/g;
  const perMsgEmotion = texts.map(t => {
    const markers = (t.match(emotionRegex) || []).length;
    return Math.min(1.0, markers / (Math.max(t.length / 50, 1)));
  });
  // 2) 감정 밀도의 변동 계수 = 불안정성
  const emoMean = perMsgEmotion.reduce((a, b) => a + b, 0) / (perMsgEmotion.length + EPS);
  const emoStd = Math.sqrt(perMsgEmotion.reduce((s, v) => s + (v - emoMean) ** 2, 0) / (perMsgEmotion.length + EPS));
  const emoCV = emoStd / (emoMean + EPS);
  // 3) 감정 극성 전환 횟수 (긍↔부정 왔다갔다 = 불안정)
  const posWords = /좋아|기뻐|행복|사랑|설레|대박|ㅋ{3,}|ㅎ{3,}/g;
  const negWords = /싫어|슬프|화나|무서|불안|미워|짜증|우울|외로|씨발|시발|존나/g;
  let polarityFlips = 0;
  let prevPolarity = 0;
  for (const t of texts) {
    const pos = (t.match(posWords) || []).length;
    const neg = (t.match(negWords) || []).length;
    const polarity = pos > neg ? 1 : neg > pos ? -1 : 0;
    if (polarity !== 0 && prevPolarity !== 0 && polarity !== prevPolarity) polarityFlips++;
    if (polarity !== 0) prevPolarity = polarity;
  }
  const flipRate = polarityFlips / (texts.length + EPS);
  // 4) 종합: 낮은 변동 + 낮은 극성 전환 = 높은 안정성
  let a2base = Math.min(1.0, Math.max(0, 1.0 - (emoCV * 0.5 + flipRate * 3.0)));
  // stress_shift: 'stable_under_pressure'|'mild_anxious_under_pressure'|'withdrawal_under_pressure'|'escalation_under_pressure'|'inconsistent_under_pressure'
  const stressShift = anchor?.attachment?.stress_shift;
  if (stressShift === 'mild_anxious_under_pressure' || stressShift === 'escalation_under_pressure' || stressShift === 'inconsistent_under_pressure') a2base = Math.max(0, a2base - 0.15);
  if (stressShift === 'stable_under_pressure') a2base = Math.min(1.0, a2base + 0.1);
  intensity.A2 = a2base;
  confidence.A2 = texts.length > 20 ? 'high' : texts.length > 8 ? 'medium' : 'low';

  // A3 감정 표현: 감정 어휘 밀도 + ANCHOR emotional_availability
  const expressiveMarkers = (allText.match(/좋아|싫어|슬프|기뻐|화나|무서|불안|행복|사랑|미워|짜증|설레|우울|외로|그리|질투|부러/g) || []).length;
  let a3base = Math.min(1.0, expressiveMarkers / (texts.length * 0.3 + EPS));
  // emotional_availability: response_style = 'dismissive'|'acknowledging'|'supportive'|'empathic_exploration'
  const eaMode = anchor?.emotional_availability?.response_style;
  if (eaMode === 'empathic_exploration' || eaMode === 'supportive') a3base = Math.min(1.0, a3base + 0.1);
  if (eaMode === 'dismissive') a3base = Math.max(0, a3base - 0.1);
  intensity.A3 = a3base;
  confidence.A3 = expressiveMarkers > 5 ? 'high' : expressiveMarkers > 1 ? 'medium' : 'low';

  // A4 자기 확신: 단정적 표현 밀도
  const assertiveMarkers = (allText.match(/확실히|분명히|당연히|반드시|절대|무조건|틀림없이|나는|내가|해야|돼야/g) || []).length;
  intensity.A4 = Math.min(1.0, assertiveMarkers / (texts.length * 0.3 + EPS));
  confidence.A4 = assertiveMarkers > 5 ? 'high' : assertiveMarkers > 2 ? 'medium' : 'low';

  // A5 사회적 주도성: 제안/의견 + PRISM curiosity prompt_intent
  const initiativeMarkers = (allText.match(/해보자|하자|어때|제안|생각에는|방법은|해볼까|이렇게|저렇게|시작하자/g) || []).length;
  let a5base = Math.min(1.0, initiativeMarkers / (texts.length * 0.2 + EPS));
  const promptIntent = prism?.curiosity?.prompt_intent;
  if (promptIntent === 'philosopher' || promptIntent === 'challenger') a5base = Math.min(1.0, a5base + 0.1);
  intensity.A5 = a5base;
  confidence.A5 = initiativeMarkers > 3 ? 'high' : initiativeMarkers > 1 ? 'medium' : 'low';

  // A6 권위 수용: 수용/겸양 표현 + ANCHOR growth orientation
  const acceptanceMarkers = (allText.match(/맞아|그렇지|동의|알겠|이해|감사|고마워|배우|참고|인정/g) || []).length;
  let a6base = Math.min(1.0, acceptanceMarkers / (texts.length * 0.3 + EPS));
  if (anchor?.growth?.orientation === 'active_growth') a6base = Math.min(1.0, a6base + 0.1);
  intensity.A6 = a6base;
  confidence.A6 = acceptanceMarkers > 3 ? 'medium' : 'low';

  // A12 친밀감 편안함: 자기개방 + ANCHOR self_disclosure
  const intimacyMarkers = (allText.match(/내 경험|솔직히|사실은|비밀인데|나만|개인적으로|우리|같이|너한테만/g) || []).length;
  let a12base = Math.min(1.0, intimacyMarkers / (texts.length * 0.2 + EPS));
  // self_disclosure: 'minimal'|'moderate'|'open'
  const disclosureLevel = anchor?.emotional_availability?.self_disclosure;
  if (disclosureLevel === 'open') a12base = Math.min(1.0, a12base + 0.15);
  if (disclosureLevel === 'minimal') a12base = Math.max(0, a12base - 0.1);
  intensity.A12 = a12base;
  confidence.A12 = intimacyMarkers > 3 ? 'high' : intimacyMarkers > 1 ? 'medium' : 'low';

  // A14 변화 수용성: 열린 태도 + ANCHOR conflict flexibility
  const openMarkers = (allText.match(/새로운|다르게|바꿔|시도|도전|변화|혁신|왜 안 돼|실험|탐구/g) || []).length;
  let a14base = Math.min(1.0, openMarkers / (texts.length * 0.2 + EPS));
  // pattern_flexibility: 'flexible'|'medium'|'rigid'
  const conflictFlex = anchor?.conflict?.pattern_flexibility;
  if (conflictFlex === 'flexible') a14base = Math.min(1.0, a14base + 0.1);
  if (conflictFlex === 'rigid') a14base = Math.max(0, a14base - 0.1);
  intensity.A14 = a14base;
  confidence.A14 = openMarkers > 3 ? 'medium' : 'low';

  // ── Structural axes: PRISM/ANCHOR 직접 매핑 ──
  const structural = {};

  // A7 상호작용 지향: 메시지 길이 + 인과접속사 밀도
  let causalCount = 0;
  for (const conj of L1_CAUSAL_CONJUNCTIONS) {
    const matches = allText.match(new RegExp(conj, 'g'));
    if (matches) causalCount += matches.length;
  }
  const causalDensity = causalCount / (texts.length + EPS);
  const avgLen = allText.length / (texts.length + EPS);
  const a7primary = avgLen > 100 && causalDensity > 0.5 ? 'initiator' : avgLen < 30 ? 'responder' : 'balanced';
  structural.A7 = { primary: a7primary, styles: { initiator: a7primary === 'initiator' ? 0.6 : 0.2, responder: a7primary === 'responder' ? 0.6 : 0.2, balanced: a7primary === 'balanced' ? 0.6 : 0.2 } };
  confidence.A7 = texts.length > 15 ? 'high' : 'medium';

  // A8 갈등 조절: ANCHOR conflict → normalized enum 매핑
  const rawConflictMode = anchor?.conflict?.default_mode || 'diplomatic_approach';
  const conflictFlexibility = anchor?.conflict?.pattern_flexibility || 'medium';
  // ANCHOR enum → A8 normalized enum
  const CONFLICT_NORM = { 'direct_engagement': 'confrontational', 'diplomatic_approach': 'repair', 'strategic_withdrawal': 'boundary', 'avoidance': 'avoidant', 'escalation': 'confrontational' };
  const conflictMode = CONFLICT_NORM[rawConflictMode] || 'repair';
  structural.A8 = { primary: conflictMode, flexibility: conflictFlexibility, styles: { confrontational: conflictMode === 'confrontational' ? 0.5 : 0.1, repair: conflictMode === 'repair' ? 0.5 : 0.15, avoidant: conflictMode === 'avoidant' ? 0.5 : 0.1, boundary: conflictMode === 'boundary' ? 0.5 : 0.15 } };
  confidence.A8 = anchor?.conflict ? 'high' : 'low';

  // A9 감정 처리: ANCHOR emotional_availability response_mode
  let a9primary = 'analytical';
  // eaMode: 'dismissive'|'acknowledging'|'supportive'|'empathic_exploration'
  if (eaMode === 'empathic_exploration' || eaMode === 'supportive') a9primary = 'expressive';
  else if (eaMode === 'dismissive') a9primary = 'suppressive';
  else if (eaMode === 'acknowledging') a9primary = 'analytical';
  else if (intensity.A3 > 0.4) a9primary = 'expressive';
  structural.A9 = { primary: a9primary, styles: { expressive: a9primary === 'expressive' ? 0.5 : 0.15, analytical: a9primary === 'analytical' ? 0.5 : 0.15, suppressive: a9primary === 'suppressive' ? 0.5 : 0.1, externalized: 0.1 } };
  confidence.A9 = eaMode ? 'high' : 'medium';

  // A10 친밀감 기울기: PRISM depth + ANCHOR attachment
  let domainCount = 0;
  for (const marker of L1_DOMAIN_MARKERS) { if (allText.includes(marker)) domainCount++; }
  const domainDensity = domainCount / (L1_DOMAIN_MARKERS.length || 1);
  const depthLevel = prism?.engagement?.overall_depth || 'surface';
  let a10primary = 'slow_burn';
  if (depthLevel === 'creative' || depthLevel === 'exploratory') a10primary = 'depth_seeker';
  else if (anchor?.attachment?.primary_tendency === 'leans_anxious') a10primary = 'fast_opener';
  else if (anchor?.attachment?.primary_tendency === 'leans_avoidant') a10primary = 'surface_locked';
  structural.A10 = { primary: a10primary, styles: { surface_locked: a10primary === 'surface_locked' ? 0.5 : 0.1, slow_burn: a10primary === 'slow_burn' ? 0.5 : 0.2, depth_seeker: a10primary === 'depth_seeker' ? 0.5 : 0.1, fast_opener: a10primary === 'fast_opener' ? 0.5 : 0.1 } };
  confidence.A10 = (prism?.engagement?.overall_depth && anchor?.attachment) ? 'high' : 'medium';

  // A11 호혜성: 질문비율 + 공감/지지 표현 + 상대 언급 복합 판단
  const questionRatio = prism?.curiosity?.question_ratio || 0;
  // 공감/지지 표현 밀도
  const supportMarkers = (allText.match(/맞아|그렇지|이해해|힘들었겠다|수고했|잘했|괜찮아|응원|파이팅|화이팅|대단하|고생|걱정된다|걱정돼|괜찮으|잘될|응 맞아|맞는 말|그럴 수 있|충분해/g) || []).length;
  const supportDensity = supportMarkers / (texts.length + EPS);
  // 상대방 지칭 밀도 (너/네/당신 등)
  const otherRefMarkers = (allText.match(/너는|너의|네가|당신|상대|그쪽|니가|너도|너한테|너를|너랑/g) || []).length;
  const otherRefDensity = otherRefMarkers / (texts.length + EPS);
  // 자기 지칭 밀도 (나/내/저 등)
  const selfRefMarkers = (allText.match(/나는|내가|저는|제가|나의|나한테|나를|나도|내 생각/g) || []).length;
  const selfRefDensity = selfRefMarkers / (texts.length + EPS);
  // 복합 점수: 양성 신호만 사용 (부재 신호 제거 — balanced를 taker로 오판 방지)
  const giverScore = questionRatio * 0.3 + supportDensity * 0.4 + otherRefDensity * 0.3;
  const takerSignal = selfRefDensity > otherRefDensity + supportDensity ? selfRefDensity : 0;
  let a11primary = 'balanced';
  if (giverScore > 0.3 && giverScore > takerSignal * 2) a11primary = 'giver';
  else if (takerSignal > 0.3 && selfRefDensity > (otherRefDensity + supportDensity) * 2) a11primary = 'taker';
  const confSignals = (questionRatio > 0 ? 1 : 0) + (supportMarkers > 2 ? 1 : 0) + (otherRefMarkers > 2 ? 1 : 0);
  structural.A11 = { primary: a11primary, styles: { giver: a11primary === 'giver' ? 0.5 : 0.2, taker: a11primary === 'taker' ? 0.5 : 0.1, balanced: a11primary === 'balanced' ? 0.5 : 0.3 } };
  confidence.A11 = confSignals >= 2 ? 'high' : confSignals >= 1 ? 'medium' : 'low';

  // A13 인정 욕구: ANCHOR growth orientation
  const growthOrientation = anchor?.growth?.orientation || 'defensive';
  let a13primary = 'defensive';
  if (growthOrientation === 'active_growth') a13primary = 'growth';
  else if (growthOrientation === 'reflective_growth') a13primary = 'absorptive';
  else if (growthOrientation === 'stability_oriented') a13primary = 'avoidant';
  else if (growthOrientation === 'externally_driven') a13primary = 'defensive';
  structural.A13 = { primary: a13primary, styles: { growth: a13primary === 'growth' ? 0.5 : 0.15, defensive: a13primary === 'defensive' ? 0.5 : 0.15, avoidant: a13primary === 'avoidant' ? 0.5 : 0.1, absorptive: a13primary === 'absorptive' ? 0.5 : 0.1 } };
  confidence.A13 = anchor?.growth ? 'high' : 'low';

  // A15 관계 투자: ANCHOR growth + prompt_intent
  let a15primary = 'passive_maintainer';
  if (promptIntent === 'philosopher' || growthOrientation === 'active_growth') a15primary = 'active_investor';
  else if (anchor?.attachment?.primary_tendency === 'leans_avoidant') a15primary = 'disengaged';
  structural.A15 = { primary: a15primary, styles: { active_investor: a15primary === 'active_investor' ? 0.5 : 0.2, passive_maintainer: a15primary === 'passive_maintainer' ? 0.5 : 0.3, disengaged: a15primary === 'disengaged' ? 0.5 : 0.1 } };
  confidence.A15 = 'medium';

  // A16 의사결정 스타일: 인과접속사 밀도 + PRISM vocabulary
  let a16primary = 'pragmatic';
  if (causalDensity > 0.3 || domainDensity > 0.15) a16primary = 'analytical';
  else if (intensity.A4 > 0.6 && causalDensity < 0.1) a16primary = 'binary';
  structural.A16 = { primary: a16primary, styles: { analytical: a16primary === 'analytical' ? 0.5 : 0.2, pragmatic: a16primary === 'pragmatic' ? 0.5 : 0.3, binary: a16primary === 'binary' ? 0.5 : 0.1 } };
  confidence.A16 = causalDensity > 0.1 ? 'high' : 'medium';

  // A17 유머/긴장 해소: 웃음 표현 패턴
  const humorMarkers = (allText.match(/ㅋ{2,}|ㅎ{2,}|하하|ㅉㅉ|큭|푸하|ㄱㅂㅈㄱ|개웃|꿀잼|웃프|ㅠㅋ|ㅋㅠ/g) || []).length;
  const sarcasticMarkers = (allText.match(/ㅉ|에이|뭔|아 진짜|하|씁|어이없/g) || []).length;
  let a17primary = 'minimal';
  if (humorMarkers > texts.length * 0.3) a17primary = 'tension_breaker';
  else if (humorMarkers > texts.length * 0.15) a17primary = 'bonding';
  else if (sarcasticMarkers > texts.length * 0.1) a17primary = 'aggressive';
  structural.A17 = { primary: a17primary, styles: { tension_breaker: a17primary === 'tension_breaker' ? 0.5 : 0.1, bonding: a17primary === 'bonding' ? 0.5 : 0.15, deflective: 0.1, aggressive: a17primary === 'aggressive' ? 0.4 : 0.05, minimal: a17primary === 'minimal' ? 0.5 : 0.1 } };
  confidence.A17 = humorMarkers > 3 ? 'high' : 'medium';

  // Round all intensity values
  for (const k of Object.keys(intensity)) {
    intensity[k] = Math.round(intensity[k] * 100) / 100;
  }

  // Normalize all structural styles to sum to 1.0
  for (const axisKey of Object.keys(structural)) {
    const axis = structural[axisKey];
    if (axis && axis.styles && typeof axis.styles === 'object') {
      const sum = Object.values(axis.styles).reduce((a, b) => a + (typeof b === 'number' ? b : 0), 0);
      if (sum > 0 && sum !== 1) {
        for (const sk of Object.keys(axis.styles)) {
          if (typeof axis.styles[sk] === 'number') {
            axis.styles[sk] = Math.round((axis.styles[sk] / sum) * 1000) / 1000;
          }
        }
      } else if (sum === 0) {
        // All styles zero — distribute equally
        const numStyles = Object.keys(axis.styles).filter(sk => typeof axis.styles[sk] === 'number').length;
        if (numStyles > 0) {
          const equalShare = Math.round((1.0 / numStyles) * 1000) / 1000;
          for (const sk of Object.keys(axis.styles)) {
            if (typeof axis.styles[sk] === 'number') {
              axis.styles[sk] = equalShare;
            }
          }
        }
      }
    }
  }

  return { intensity, structural, confidence };
}

function buildScoringPrompt(rawMessages, prism, anchor) {
  // Precompute axes from PRISM/ANCHOR/keyword analysis
  const precomputed = precomputeAxes(rawMessages, prism, anchor);

  let prompt = '';

  if (precomputed) {
    // Structural 사전 추정만 프롬프트에 포함 (패턴 기반, 신뢰할 수 있음)
    // Intensity 사전 추정은 키워드 카운팅 기반이라 LLM 앵커링을 유발하므로 제외
    prompt += `## 사전 추정 결과 (구조적 축만 — 키워드/패턴 기반)\n`;
    prompt += `아래는 엔진이 패턴 매칭으로 사전 추정한 구조적 축입니다. 참고만 하세요.\n`;
    prompt += `Intensity 축(A1~A6, A12, A14)은 대화 원문을 직접 읽고 독립적으로 판단하세요.\n\n`;

    const intConf = precomputed.confidence;
    prompt += `### Structural 사전 추정\n`;
    for (const [axis, data] of Object.entries(precomputed.structural)) {
      const conf = intConf[axis] || 'medium';
      prompt += `${axis}: ${data.primary} [신뢰도: ${conf}]\n`;
    }

    prompt += `\n## 대화 원문 (${rawMessages.length}개 메시지)\n`;
  } else {
    prompt += `다음 대화 메시지를 분석하여 행동 프로필 JSON을 출력하세요.\n\n`;
    prompt += `## 대화 원문 (${rawMessages.length}개 메시지)\n`;
  }

  const truncated = rawMessages.slice(0, 500);
  truncated.forEach((msg, i) => {
    const text = typeof msg === 'string' ? msg : (msg.text || '');
    const clean = sanitizeString(text, 2000);
    prompt += `[${i + 1}] ${clean}\n`;
  });
  if (rawMessages.length > 500) {
    prompt += `\n... (${rawMessages.length - 500}개 메시지 생략)\n`;
  }

  // PRISM/ANCHOR 보조 데이터는 precomputed에 이미 반영 — high-confidence일 때 중복 전송 생략
  const hasPrecomputed = !!precomputed;
  const allHighConf = hasPrecomputed && Object.values(precomputed.confidence).every(c => c === 'high');

  if (!allHighConf) {
    if (prism) {
      prompt += `\n## 보조 데이터: PRISM\n`;
      if (prism.topic_distribution && typeof prism.topic_distribution === 'object') {
        const topics = prism.topic_distribution.topics || prism.topic_distribution;
        if (topics && typeof topics === 'object') {
          prompt += `주제 분포: ${JSON.stringify(topics).slice(0, 1000)}\n`;
        }
      }
      if (prism.curiosity && typeof prism.curiosity === 'object') {
        prompt += `호기심: ${JSON.stringify(prism.curiosity).slice(0, 500)}\n`;
      }
      if (prism.vocabulary && typeof prism.vocabulary === 'object') {
        prompt += `어휘: ${JSON.stringify(prism.vocabulary).slice(0, 500)}\n`;
      }
    }

    if (anchor) {
      prompt += `\n## 보조 데이터: ANCHOR\n`;
      if (anchor.attachment) prompt += `애착: ${JSON.stringify(anchor.attachment).slice(0, 500)}\n`;
      if (anchor.conflict) prompt += `갈등: ${JSON.stringify(anchor.conflict).slice(0, 500)}\n`;
      if (anchor.emotional_availability) prompt += `정서: ${JSON.stringify(anchor.emotional_availability).slice(0, 500)}\n`;
      if (anchor.growth) prompt += `성장: ${JSON.stringify(anchor.growth).slice(0, 500)}\n`;
    }
  }

  prompt += `\n위 대화를 읽고 행동 프로필 JSON만 출력하세요.`;
  if (precomputed) {
    prompt += ` 사전 추정값과 대화 원문이 일치하면 그대로, 불일치하면 보정하여 최종 JSON을 출력하세요.`;
  }
  return prompt;
}

// ═══════════════════════════════════════════════════════════
// Server-side type code + identity computation (mirrors frontend logic)
// ═══════════════════════════════════════════════════════════

const SERVER_TYPE_AXES = [
  {
    id: 'emotion', name: '정서 표출',
    high: { letter: 'F', label: 'Fire', desc: '감정을 강하게 느끼고 적극적으로 표현한다' },
    low:  { letter: 'S', label: 'Still', desc: '감정을 내면에서 처리하고 절제된 방식으로 표현한다' },
    calc: (d) => ((d.A1 || 0.5) * 0.6 + (d.A3 || 0.5) * 0.4)
  },
  {
    id: 'drive', name: '사회 동력',
    high: { letter: 'A', label: 'Assert', desc: '상황을 주도하고 방향을 설정한다' },
    low:  { letter: 'H', label: 'Harmonize', desc: '상황을 관찰하고 흐름에 맞춰 움직인다' },
    calc: (d) => {
      const base = ((d.A4 || 0.5) * 0.4 + (d.A5 || 0.5) * 0.4);
      const struct = d._structural?.A7?.primary === 'initiator' ? 0.2 : d._structural?.A7?.primary === 'responder' ? 0 : 0.1;
      return base + struct;
    }
  },
  {
    id: 'cognition', name: '인지 기반',
    high: { letter: 'T', label: 'Think', desc: '논리와 분석을 기반으로 판단한다' },
    low:  { letter: 'R', label: 'Relate', desc: '공감과 관계를 고려하여 판단한다' },
    calc: (d) => {
      // Think: 높은 일관성(A6) + 낮은 감정개방(1-A4) → 논리적
      // Relate: 높은 공감력(A2) + 높은 감정개방(A4) → 관계적
      const thinkScore = ((d.A6 || 0.5) * 0.5 + (1 - (d.A4 || 0.5)) * 0.3 + (1 - (d.A2 || 0.5)) * 0.2);
      const a9 = d._structural?.A9;
      const analyticBonus = a9?.primary === 'analytical' ? 0.1 : a9?.primary === 'expressive' ? -0.1 : 0;
      return Math.max(0, Math.min(1, thinkScore + analyticBonus));
    }
  },
  {
    id: 'boundary', name: '경계 방식',
    high: { letter: 'O', label: 'Open', desc: '경계를 열어두고 변화를 수용한다' },
    low:  { letter: 'W', label: 'Wall', desc: '경계를 세우고 안전한 영역을 지킨다' },
    calc: (d) => {
      // Open: 자기개방(A12) + 변화수용(A14) + 감정개방(A4) → 경계 개방
      // Wall: 낮은 자기개방 + 낮은 변화수용 → 경계 폐쇄
      // A1(정서 강도) 제거 — 감정 폭발 ≠ 경계 개방
      const openScore = ((d.A12 || 0.5) * 0.35 + (d.A14 || 0.5) * 0.35 + (d.A4 || 0.5) * 0.3);
      const a10 = d._structural?.A10;
      const depthBonus = a10?.primary === 'fast_opener' ? 0.12 : a10?.primary === 'depth_seeker' ? 0.06 : a10?.primary === 'surface_locked' ? -0.1 : 0;
      return Math.max(0, Math.min(1, openScore + depthBonus));
    }
  },
  {
    id: 'resilience', name: '회복 탄성',
    high: { letter: 'X', label: 'Flex', desc: '스트레스에 유연하게 적응한다' },
    low:  { letter: 'V', label: 'Rigid', desc: '스트레스에 경직되거나 고착된다' },
    calc: (d) => {
      const a2 = d.A2 || 0.5;
      // A8(갈등)의 pattern_flexibility로 회복 유연성 판단 (A11은 호혜성이므로 부적합)
      const a8flex = d._structural?.A8?.flexibility;
      const flexBonus = a8flex === 'flexible' ? 0.15 : a8flex === 'rigid' ? -0.15 : 0;
      return Math.max(0, Math.min(1, a2 * 0.7 + 0.15 + flexBonus));
    }
  },
  {
    id: 'defense', name: '방어 방향',
    high: { letter: 'E', label: 'Externalize', desc: '위협을 외부로 투사하고 환경을 통제하려 한다' },
    low:  { letter: 'I', label: 'Internalize', desc: '위협을 내면에 흡수하고 자기를 재조정하려 한다' },
    calc: (d) => {
      // Externalize: 높은 주장성(A4) + 높은 사회적 주도(A5) + 갈등 직면(A8) → 외부 투사
      // Internalize: 높은 안정성(A2) + 높은 권위수용(A6) → 내면 흡수
      // A1 직접 사용 제거 — Emotion 축과의 중복 해소
      const assertiveness = (d.A4 || 0.5) * 0.5 + (d.A5 || 0.5) * 0.5;
      const internalTendency = (d.A2 || 0.5) * 0.5 + (d.A6 || 0.5) * 0.5;
      const expressionDirect = (d.A3 || 0.5); // 감정 표현만 사용 (A1 제외)
      const a8 = d._structural?.A8;
      // A8 primary (normalized): 'confrontational', 'repair', 'avoidant', 'boundary'
      const conflictBonus = a8?.primary === 'confrontational' ? 0.15 : a8?.primary === 'repair' ? 0.05 : a8?.primary === 'avoidant' ? -0.15 : a8?.primary === 'boundary' ? -0.1 : 0;
      return Math.max(0, Math.min(1, assertiveness * 0.35 + expressionDirect * 0.2 + (1 - internalTendency) * 0.3 + 0.05 + conflictBonus));
    }
  }
];

// ═══════════════════════════════════════════════════════════
// 64 ARCHETYPES — Full coverage of 6-axis binary space
// Code: F/S(emotion) × A/H(drive) × T/R(cognition) × O/W(boundary) × X/V(resilience) × E/I(defense)
// ═══════════════════════════════════════════════════════════

const ARCHETYPE_MAP = {
  // ═══════════════════════════════════════════════════════════
  // F+A (Fire + Assert): 열정적 주도자들 — 16 types
  // ═══════════════════════════════════════════════════════════

  // FATOX — 열정 + 주도 + 분석 + 개방 + 유연
  'FATOXE': { name: '전장의 전략가',       emoji: '⚡', tagline: '강한 감정을 전략적 판단력으로 전환하고, 위기 상황에서 주도적으로 돌파구를 찾는 사람' },
  'FATOXI': { name: '침묵의 사령관',       emoji: '🌩️', tagline: '내면에 강한 에너지와 분석력을 가졌지만, 위기의 순간 혼자 짊어지고 소화하려는 사람' },

  // FATOV — 열정 + 주도 + 분석 + 개방 + 경직
  'FATOVE': { name: '완벽주의 추진자',     emoji: '🔥', tagline: '목표를 세우면 강하게 밀어붙이고, 실패하면 더 세게 밀어붙이는 사람. 멈추는 걸 못 견딤' },
  'FATOVI': { name: '과열된 엔진',         emoji: '🫀', tagline: '완벽을 향한 열정이 강하지만, 변수 앞에서 스스로를 소진시키며 안에서 과부하되는 사람' },

  // FATWX — 열정 + 주도 + 분석 + 폐쇄 + 유연
  'FATWXE': { name: '영역의 설계자',       emoji: '🏰', tagline: '자기 영역을 논리적으로 구축하고, 침범당하면 감정과 분석을 동원해 반격하는 사람' },
  'FATWXI': { name: '단독 작전형',         emoji: '🖤', tagline: '강한 추진력과 분석력을 갖췄지만, 벽 안에서 모든 걸 혼자 처리하려는 사람' },

  // FATWV — 열정 + 주도 + 분석 + 폐쇄 + 경직
  'FATWVE': { name: '통제된 폭발형',       emoji: '🌋', tagline: '평소엔 차갑게 통제하다가, 임계점을 넘으면 한 번에 터뜨리는 사람. 폭발력이 크다' },
  'FATWVI': { name: '억눌린 압력형',       emoji: '🪨', tagline: '강한 에너지를 안에 가두고 분출구를 찾지 못하는 사람. 겉은 단단하지만 내부 압력이 높다' },

  // FAROX — 열정 + 주도 + 공감 + 개방 + 유연
  'FAROXE': { name: '돌파형 리더',         emoji: '🎆', tagline: '공감력과 추진력을 동시에 가지고, 갈등 상황에서도 정면 돌파로 방향을 제시하는 사람' },
  'FAROXI': { name: '자기희생형 공감자',    emoji: '☀️', tagline: '타인의 고통을 깊이 느끼고 해결하려 하지만, 그 과정에서 자기가 소진되는 사람' },

  // FAROV — 열정 + 주도 + 공감 + 개방 + 경직
  'FAROVE': { name: '열정적 돌격형',       emoji: '👑', tagline: '사람을 끌어당기는 에너지로 앞장서지만, 예상 밖의 상황에서 유연하게 대처하기 어려운 사람' },
  'FAROVI': { name: '내면 수선형',         emoji: '💎', tagline: '밖으로는 카리스마가 있지만, 안에서는 끊임없이 자기 균열을 수선하느라 바쁜 사람' },

  // FARWX — 열정 + 주도 + 공감 + 폐쇄 + 유연
  'FARWXE': { name: '선별적 보호자',       emoji: '🛡️', tagline: '가까운 사람을 위해서는 어떤 위협도 정면으로 맞서지만, 경계 밖에는 관심이 적은 사람' },
  'FARWXI': { name: '조용한 헌신형',       emoji: '🕯️', tagline: '깊은 감정과 헌신을 가졌지만 밖으로 드러내지 않고, 조용히 곁에서 지키는 사람' },

  // FARWV — 열정 + 주도 + 공감 + 폐쇄 + 경직
  'FARWVE': { name: '공격적 방어형',       emoji: '⚔️', tagline: '감정이 풍부하지만 표현 대신 행동으로 보여주고, 위협에는 공격으로 자기를 지키는 사람' },
  'FARWVI': { name: '삼키는 헌신형',       emoji: '🗡️', tagline: '풍부한 감정을 표현하지 못한 채 안에 쌓아두고, 결국 자기를 갉아먹히는 사람' },

  // ═══════════════════════════════════════════════════════════
  // F+H (Fire + Harmonize): 예민한 수용자들 — 16 types
  // ═══════════════════════════════════════════════════════════

  // FHTOX — 열정 + 순응 + 분석 + 개방 + 유연
  'FHTOXE': { name: '예민한 분석가',       emoji: '📡', tagline: '감정이 예민하면서도 분석적 거리를 유지하는 사람. 위협에는 논리로 반박한다' },
  'FHTOXI': { name: '조용한 과부하형',     emoji: '📻', tagline: '모든 걸 느끼고 분석하지만, 그 처리를 전부 내면에서만 하려다 조용히 소진되는 사람' },

  // FHTOV — 열정 + 순응 + 분석 + 개방 + 경직
  'FHTOVE': { name: '민감한 경보형',       emoji: '🚨', tagline: '문제를 예민하게 감지하고 밖으로 경고하지만, 정작 자기 회복에는 유연하지 못한 사람' },
  'FHTOVI': { name: '내면 과부하형',       emoji: '🌈', tagline: '많이 느끼고 많이 분석하지만, 그 에너지가 자기에게 돌아올 때 감당하기 어려운 사람' },

  // FHTWX — 열정 + 순응 + 분석 + 폐쇄 + 유연
  'FHTWXE': { name: '내밀한 전술가',       emoji: '⚗️', tagline: '감정과 분석을 자기만의 공간에서 정리하고, 위협이 오면 정밀하게 대응하는 사람' },
  'FHTWXI': { name: '폐쇄형 처리자',       emoji: '🧪', tagline: '감정과 사고를 전부 내면에서만 처리하며, 그 결과를 밖으로 거의 내보내지 않는 사람' },

  // FHTWV — 열정 + 순응 + 분석 + 폐쇄 + 경직
  'FHTWVE': { name: '지연 폭발형',         emoji: '❄️', tagline: '겉은 조용하지만 안에서 감정과 분석이 쌓이다가, 임계점에서 한 번에 터지는 사람' },
  'FHTWVI': { name: '무음 진동형',         emoji: '🌀', tagline: '밖에서는 아무 일 없어 보이지만, 내면에서 감정이 계속 돌아가고 있는 사람' },

  // FHROX — 열정 + 순응 + 공감 + 개방 + 유연
  'FHROXE': { name: '안정적 공감형',       emoji: '⚓', tagline: '누구에게나 열려 있고 공감력이 높으면서도, 압박 상황에서 흔들리지 않는 사람' },
  'FHROXI': { name: '경계 없는 수용형',    emoji: '🌫️', tagline: '타인의 감정을 너무 깊이 흡수해서, 자기와 상대의 경계가 흐려지는 사람' },

  // FHROV — 열정 + 순응 + 공감 + 개방 + 경직
  'FHROVE': { name: '과수용형',            emoji: '🌸', tagline: '감정을 다 받아주려 하지만 자기 회복이 따라가지 못하고, 그 피로가 밖으로 드러나는 사람' },
  'FHROVI': { name: '자기방치형 공감자',    emoji: '🥀', tagline: '타인을 돌보는 데 에너지를 다 써서, 정작 자기 내면은 돌보지 못하는 사람' },

  // FHRWX — 열정 + 순응 + 공감 + 폐쇄 + 유연
  'FHRWXE': { name: '은밀한 돌봄형',       emoji: '🌿', tagline: '깊이 느끼고 조용히 돌보는 사람. 평소엔 부드럽지만 위협에는 단호하게 선을 긋는다' },
  'FHRWXI': { name: '조용한 흡수형',       emoji: '🍀', tagline: '감정을 깊이 느끼면서 자기만의 속도로 소화하는 사람. 겉으로는 잘 드러나지 않는다' },

  // FHRWV — 열정 + 순응 + 공감 + 폐쇄 + 경직
  'FHRWVE': { name: '불규칙 분출형',       emoji: '🌹', tagline: '풍부한 감정이 표현 경로를 찾지 못해, 예상치 못한 형태로 튀어나오는 사람' },
  'FHRWVI': { name: '응축된 감정형',       emoji: '🔒', tagline: '감정이 풍부하지만 표현도 해소도 안 되면서, 내면에서 점점 굳어가는 사람' },

  // ═══════════════════════════════════════════════════════════
  // S+A (Still + Assert): 냉정한 주도자들 — 16 types
  // ═══════════════════════════════════════════════════════════

  // SATOX — 절제 + 주도 + 분석 + 개방 + 유연
  'SATOXE': { name: '냉철한 설계자',       emoji: '🧭', tagline: '감정에 흔들리지 않고 상황을 분석해 방향을 잡는 사람. 위기에 더 냉정해진다' },
  'SATOXI': { name: '고립된 조율자',       emoji: '🗼', tagline: '전체를 조망하고 조율하지만, 자기 상태는 밖으로 알리지 않는 사람' },

  // SATOV — 절제 + 주도 + 분석 + 개방 + 경직
  'SATOVE': { name: '체계적 완벽주의자',    emoji: '⚙️', tagline: '논리적 시스템을 세우고 밀어붙이는 사람. 변수가 생기면 시스템을 다시 짜서라도 관철한다' },
  'SATOVI': { name: '경직된 설계자',       emoji: '💻', tagline: '논리적으로 완벽한 체계를 추구하지만, 예외 상황 앞에서 내부적으로 멈추는 사람' },

  // SATWX — 절제 + 주도 + 분석 + 폐쇄 + 유연
  'SATWXE': { name: '배후 조율형',         emoji: '🎭', tagline: '드러나지 않게 상황을 조율하다가, 필요한 순간에만 개입해서 판을 뒤집는 사람' },
  'SATWXI': { name: '고독한 통제형',       emoji: '❆', tagline: '모든 걸 혼자 통제하고 관리하지만, 그 무게도 혼자 감당하는 사람' },

  // SATWV — 절제 + 주도 + 분석 + 폐쇄 + 경직
  'SATWVE': { name: '난공불락형',          emoji: '🗿', tagline: '완전한 통제를 추구하며, 도전이 오면 벽을 더 높이 쌓아서 응답하는 사람' },
  'SATWVI': { name: '자기밀봉형',          emoji: '♟️', tagline: '통제와 고립이 동시에 작동하면서, 안에서도 밖에서도 움직이기 어려운 상태의 사람' },

  // SAROX — 절제 + 주도 + 공감 + 개방 + 유연
  'SAROXE': { name: '절제된 배려형',       emoji: '🏮', tagline: '감정 표현은 적지만 공감력은 높고, 필요할 때 정확히 개입해서 돕는 사람' },
  'SAROXI': { name: '속 깊은 관찰형',      emoji: '🪣', tagline: '타인을 잘 이해하고 돕지만, 자기 속 깊이는 아무에게도 보여주지 않는 사람' },

  // SAROV — 절제 + 주도 + 공감 + 개방 + 경직
  'SAROVE': { name: '긴장된 균형형',       emoji: '⚖️', tagline: '공감력과 추진력을 갖췄지만, 스트레스 앞에서 균형이 무너지면 날카로워지는 사람' },
  'SAROVI': { name: '무게를 짊어진 형',     emoji: '⛓️', tagline: '책임감이 강하고 타인을 생각하지만, 그 무게를 혼자 지면서 내부가 눌리는 사람' },

  // SARWX — 절제 + 주도 + 공감 + 폐쇄 + 유연
  'SARWXE': { name: '정밀 관계형',         emoji: '🎯', tagline: '가까운 사람에게는 깊은 돌봄을 주고, 그 외의 관계는 효율적으로 정리하는 사람' },
  'SARWXI': { name: '선별적 신뢰형',       emoji: '📕', tagline: '깊은 이해력이 있지만, 그걸 보여줄 사람을 매우 신중하게 고르는 사람' },

  // SARWV — 절제 + 주도 + 공감 + 폐쇄 + 경직
  'SARWVE': { name: '경계 수호형',         emoji: '🚪', tagline: '가까운 사람을 지키되 새로운 사람은 잘 들이지 않고, 위협에는 정면으로 차단하는 사람' },
  'SARWVI': { name: '과잠금형',            emoji: '🔐', tagline: '소중한 것을 지키려 경계를 세웠지만, 너무 단단해서 자기도 밖으로 나가기 어려운 사람' },

  // ═══════════════════════════════════════════════════════════
  // S+H (Still + Harmonize): 고요한 관찰자들 — 16 types
  // ═══════════════════════════════════════════════════════════

  // SHTOX — 절제 + 순응 + 분석 + 개방 + 유연
  'SHTOXE': { name: '유연한 관찰형',       emoji: '🌊', tagline: '감정 소모 없이 넓게 받아들이고 분석하는 사람. 변화에 유연하게 적응한다' },
  'SHTOXI': { name: '고요한 심층형',       emoji: '🐋', tagline: '겉은 고요하지만, 안에서 깊은 사고가 계속 돌아가고 있는 사람' },

  // SHTOV — 절제 + 순응 + 분석 + 개방 + 경직
  'SHTOVE': { name: '관찰형 비평가',       emoji: '🔍', tagline: '분석적으로 세상을 관찰하지만, 변화를 받아들이는 데 시간이 오래 걸리는 사람' },
  'SHTOVI': { name: '단절된 관찰형',       emoji: '🛰️', tagline: '모든 걸 관찰하고 분석하지만, 실제 참여나 연결로 이어지지 않는 사람' },

  // SHTWX — 절제 + 순응 + 분석 + 폐쇄 + 유연
  'SHTWXE': { name: '최소개입 사유형',     emoji: '🌑', tagline: '세상을 깊이 읽되 직접 참여하지 않는 사람. 필요할 때만 조용히 거리를 조절한다' },
  'SHTWXI': { name: '자기소거형',          emoji: '🌌', tagline: '존재감을 의도적으로 줄이며, 환경에 맞춰 자기를 계속 조정하는 사람' },

  // SHTWV — 절제 + 순응 + 분석 + 폐쇄 + 경직
  'SHTWVE': { name: '정밀 대기형',         emoji: '🕰️', tagline: '겉으로는 멈춰 있어 보이지만 안에서 정밀하게 판단하고 있고, 때가 되면 움직이는 사람' },
  'SHTWVI': { name: '후퇴형 관찰자',       emoji: '🫥', tagline: '존재감을 최소화하면서 내면의 경직으로 점점 더 뒤로 물러나는 사람' },

  // SHROX — 절제 + 순응 + 공감 + 개방 + 유연
  'SHROXE': { name: '수용형 조력자',       emoji: '🪞', tagline: '상대를 있는 그대로 받아들이고, 필요할 때 조용히 도움을 주는 사람' },
  'SHROXI': { name: '과흡수형',            emoji: '💧', tagline: '타인을 수용하는 능력이 높지만, 자기와 상대의 경계가 흐려져 자기를 잃기 쉬운 사람' },

  // SHROV — 절제 + 순응 + 공감 + 개방 + 경직
  'SHROVE': { name: '불안정 수용형',       emoji: '🫧', tagline: '수용적이지만 내면이 불안정해서, 흔들림이 관계에도 영향을 미치는 사람' },
  'SHROVI': { name: '경화된 수용형',       emoji: '🪸', tagline: '조용히 세상을 받아들이지만, 내면이 점점 굳어져서 유연성을 잃어가는 사람' },

  // SHRWX — 절제 + 순응 + 공감 + 폐쇄 + 유연
  'SHRWXE': { name: '자족형 은둔자',       emoji: '🐚', tagline: '자기만의 세계에서 만족하며 조용히 적응하되, 위협이 오면 문을 닫는 사람' },
  'SHRWXI': { name: '깊은 은둔형',         emoji: '🦪', tagline: '고요하게 자기 안에 머물며, 모든 걸 내면에서 천천히 처리하는 사람' },

  // SHRWV — 절제 + 순응 + 공감 + 폐쇄 + 경직
  'SHRWVE': { name: '임계점 은둔형',       emoji: '🪹', tagline: '가장 깊이 닫혀 있지만, 압력이 한계를 넘으면 한 번에 무너지는 사람' },
  'SHRWVI': { name: '심층 고립형',         emoji: '🕳️', tagline: '가장 깊이 닫혀 있고, 외부 변화가 가장 늦게 도달하는 사람' },
};

// Fallback for any edge case
const ARCHETYPE_FALLBACK = { name: '미지의 윤곽', emoji: '🔮', tagline: '아직 정의되지 않은, 복합적인 존재' };

function serverFlattenProfile(axes) {
  const flat = {};
  if (axes.intensity) {
    for (const [k, v] of Object.entries(axes.intensity)) flat[k] = v;
  }
  flat._structural = axes.structural || {};
  return flat;
}

function computeServerIdentity(axes) {
  const flat = serverFlattenProfile(axes);

  // 6-axis type code
  const axisResults = [];
  let code = '';
  for (const axis of SERVER_TYPE_AXES) {
    const score = axis.calc(flat);
    const isHigh = score >= 0.5;
    const letter = isHigh ? axis.high.letter : axis.low.letter;
    code += letter;
    axisResults.push({ id: axis.id, name: axis.name, score, letter, isHigh, high: axis.high, low: axis.low });
  }

  // Direct archetype lookup by type code (64 types)
  const archetype = ARCHETYPE_MAP[code] || ARCHETYPE_FALLBACK;

  return {
    name: archetype.name,
    emoji: archetype.emoji,
    code: code,
    tagline: archetype.tagline,
    desc: archetype.tagline,
    axisResults: axisResults
  };
}

// ═══════════════════════════════════════════════════════════
// SIMULATION LAYER — Lightweight dynamics engine
// 10-step trajectory, stimulus-response delta, defense classification
// ═══════════════════════════════════════════════════════════

/**
 * Extract 5 simulation axes from Stage 1 axes data
 * Maps to: E(emotion), C(control), T(cognition), O(openness), X(resilience)
 */
function extractSimAxes(axes) {
  const flat = serverFlattenProfile(axes);
  const result = {};
  for (const ax of SERVER_TYPE_AXES) {
    try { result[ax.id] = Math.max(0, Math.min(1, ax.calc(flat))); }
    catch { result[ax.id] = 0.5; }
  }
  return result; // { emotion, drive, cognition, boundary, resilience, defense }
}

/**
 * Sigmoid activation for bounded dynamics
 */
function sigmoid(x) {
  return 1 / (1 + Math.exp(-x));
}

/**
 * 10-step trajectory simulation
 * Models how the 5 axes evolve over time given their interaction dynamics
 *
 * Interaction terms (simplified):
 * - drive(C) suppresses emotion(E) volatility: high control dampens emotional swings
 * - boundary(O) amplifies emotion(E): openness allows emotional expression
 * - resilience(X) dampens all oscillation: acts as global stabilizer
 * - cognition(T) moderates drive(C): analytical thinking refines control
 */
function runTrajectorySimulation(simAxes, steps = 10) {
  const { emotion: E0, drive: C0, cognition: T0, boundary: O0, resilience: X0 } = simAxes;

  const trajectory = [{ step: 0, E: E0, C: C0, T: T0, O: O0, X: X0 }];

  let E = E0, C = C0, T = T0, O = O0, X = X0;

  // Interaction coefficients (kept minimal: only key relationships)
  const dt = 0.15; // time step size

  for (let i = 1; i <= steps; i++) {
    // Compute deltas based on axis interactions
    const dE = dt * (
      -0.3 * C * (E - 0.5)      // control suppresses emotion deviation
      + 0.2 * O * (E - 0.3)     // openness amplifies emotion
      - 0.15 * X * (E - E0)     // resilience pulls back to baseline
    );

    const dC = dt * (
      0.1 * T * (C - 0.4)       // cognition reinforces control
      - 0.1 * E * (1 - C)       // high emotion erodes control
      - 0.1 * X * (C - C0)      // resilience stabilizes
    );

    const dT = dt * (
      -0.05 * E * (1 - T)       // emotional flooding slightly impairs cognition
      + 0.05 * C * T             // control supports analytical thinking
    );

    const dO = dt * (
      -0.15 * (1 - X) * (O - 0.5) // low resilience closes boundaries
      + 0.1 * E * (1 - O)         // emotion pushes for openness
    );

    const dX = dt * (
      -0.1 * Math.abs(E - E0)   // emotional volatility drains resilience
      - 0.05 * Math.abs(C - C0) // control effort drains resilience
      + 0.05 * T * X            // cognition + resilience reinforcement loop
    );

    E = Math.max(0, Math.min(1, E + dE));
    C = Math.max(0, Math.min(1, C + dC));
    T = Math.max(0, Math.min(1, T + dT));
    O = Math.max(0, Math.min(1, O + dO));
    X = Math.max(0, Math.min(1, X + dX));

    trajectory.push({
      step: i,
      E: Math.round(E * 1000) / 1000,
      C: Math.round(C * 1000) / 1000,
      T: Math.round(T * 1000) / 1000,
      O: Math.round(O * 1000) / 1000,
      X: Math.round(X * 1000) / 1000,
    });
  }

  // Compute trajectory summary metrics
  const final = trajectory[trajectory.length - 1];
  const drift = {
    E: Math.round((final.E - E0) * 1000) / 1000,
    C: Math.round((final.C - C0) * 1000) / 1000,
    T: Math.round((final.T - T0) * 1000) / 1000,
    O: Math.round((final.O - O0) * 1000) / 1000,
    X: Math.round((final.X - X0) * 1000) / 1000,
  };

  // Volatility: average step-to-step change per axis
  const volatility = { E: 0, C: 0, T: 0, O: 0, X: 0 };
  for (let i = 1; i < trajectory.length; i++) {
    for (const k of ['E', 'C', 'T', 'O', 'X']) {
      volatility[k] += Math.abs(trajectory[i][k] - trajectory[i - 1][k]);
    }
  }
  for (const k of ['E', 'C', 'T', 'O', 'X']) {
    volatility[k] = Math.round((volatility[k] / steps) * 1000) / 1000;
  }

  // Dominant pattern detection
  const patterns = [];
  if (drift.E > 0.05 && drift.C < -0.03) patterns.push('emotional_escalation');
  if (drift.C > 0.05 && drift.E < -0.03) patterns.push('control_tightening');
  if (drift.X < -0.05) patterns.push('resilience_erosion');
  if (drift.O < -0.05) patterns.push('boundary_closure');
  if (Math.abs(drift.E) < 0.02 && Math.abs(drift.C) < 0.02) patterns.push('stable_equilibrium');
  if (drift.E > 0.03 && drift.O > 0.03) patterns.push('emotional_opening');

  return { trajectory, drift, volatility, patterns, initial: simAxes, final: { E: final.E, C: final.C, T: final.T, O: final.O, X: final.X } };
}

/**
 * Stimulus-response simulation
 * Injects 4 external stimuli and computes state transitions
 */
const STIMULUS_PROFILES = {
  stress: {
    label: '고강도 스트레스',
    desc: '업무 과부하, 마감 압박, 예상치 못한 위기 상황',
    delta: { E: 0.25, C: -0.15, T: -0.05, O: -0.10, X: -0.15 },
  },
  intimacy: {
    label: '친밀감 증가',
    desc: '깊은 신뢰 관계, 정서적 안전감이 확보된 환경',
    delta: { E: 0.10, C: -0.08, T: 0.0, O: 0.20, X: 0.05 },
  },
  conflict: {
    label: '대인 갈등',
    desc: '가까운 사람과의 의견 충돌, 비난, 거부 경험',
    delta: { E: 0.20, C: 0.12, T: 0.05, O: -0.18, X: -0.10 },
  },
  loss: {
    label: '상실 경험',
    desc: '관계 단절, 실패, 기대의 붕괴',
    delta: { E: 0.30, C: -0.12, T: -0.08, O: -0.15, X: -0.22 },
  },
};

function computeStimulusResponse(simAxes) {
  const responses = {};

  for (const [stimKey, stim] of Object.entries(STIMULUS_PROFILES)) {
    const shifted = {};
    const deltas = {};

    for (const axis of ['E', 'C', 'T', 'O', 'X']) {
      const axisKey = axis === 'E' ? 'emotion' : axis === 'C' ? 'drive' : axis === 'T' ? 'cognition' : axis === 'O' ? 'boundary' : 'resilience';
      const base = simAxes[axisKey];
      const raw = base + stim.delta[axis];
      shifted[axis] = Math.max(0, Math.min(1, Math.round(raw * 1000) / 1000));
      deltas[axis] = Math.round((shifted[axis] - base) * 1000) / 1000;
    }

    // Compute vulnerability score for this stimulus
    const vulnerability = Math.round(
      (Math.abs(deltas.E) * 0.3 + Math.abs(deltas.C) * 0.25 +
       Math.abs(deltas.X) * 0.25 + Math.abs(deltas.O) * 0.2) * 100
    ) / 100;

    // Run mini trajectory (5 steps) from the shifted state
    const shiftedAxes = {
      emotion: shifted.E, drive: shifted.C, cognition: shifted.T,
      boundary: shifted.O, resilience: shifted.X
    };
    const recovery = runTrajectorySimulation(shiftedAxes, 5);
    const recoveryDrift = recovery.drift;

    // Does the system recover or deteriorate?
    const resilientAxes = ['C', 'T', 'X'].filter(k => {
      const ak = k === 'C' ? 'drive' : k === 'T' ? 'cognition' : 'resilience';
      return recovery.final[k] >= simAxes[ak] - 0.02;
    });
    const recoveryRate = resilientAxes.length / 3;

    responses[stimKey] = {
      label: stim.label,
      desc: stim.desc,
      shifted,
      deltas,
      vulnerability,
      recoveryRate: Math.round(recoveryRate * 100) / 100,
      recoveryPattern: recoveryRate >= 0.66 ? 'resilient' : recoveryRate >= 0.33 ? 'partial' : 'fragile',
    };
  }

  return responses;
}

/**
 * Defense pattern classification
 * Rule-based inference from axis combinations + ANCHOR data
 */
const DEFENSE_RULES = [
  {
    code: 'PROJECTION',
    name: '합리화된 전가',
    desc: '감정을 인지적 틀로 포장하여 외부에 귀인. 분석력이 감정을 은폐하는 도구로 전환된다.',
    match: (s, a) => s.emotion >= 0.5 && s.cognition >= 0.6 && s.drive >= 0.5 && s.boundary < 0.45,
  },
  {
    code: 'FORTRESS',
    name: '지적 요새화',
    desc: '자기 논리에 갇혀 외부 정보를 오류로 처리. 통제력과 분석력은 높지만 새로운 관점이 침투하지 못한다.',
    match: (s, a) => s.drive >= 0.6 && s.boundary < 0.4 && s.cognition >= 0.5,
  },
  {
    code: 'EXPLOSION',
    name: '정서적 폭주',
    desc: '감쇠 기제 부족으로 인한 감정의 강제 배출. 감정 에너지가 높지만 통제 시스템이 이를 수용하지 못한다.',
    match: (s, a) => s.emotion >= 0.6 && s.drive < 0.4,
  },
  {
    code: 'DIFFUSION',
    name: '경계 해체',
    desc: '자기와 타인의 경계가 흐려져 외부 정서에 과도하게 동조. 개방성은 높지만 자기 보호 기제가 약하다.',
    match: (s, a) => s.boundary >= 0.65 && s.drive < 0.45 && s.emotion >= 0.5,
  },
  {
    code: 'SHUTDOWN',
    name: '수동적 회피',
    desc: '갈등 상황에서 시스템이 셧다운. 회복 탄성과 개방성이 모두 낮아 외부 자극을 차단하는 것으로 대응한다.',
    match: (s, a) => s.resilience < 0.4 && s.boundary < 0.4,
  },
];

function classifyDefensePattern(simAxes, anchor) {
  for (const rule of DEFENSE_RULES) {
    if (rule.match(simAxes, anchor)) {
      return { code: rule.code, name: rule.name, desc: rule.desc };
    }
  }
  return {
    code: 'ADAPTIVE',
    name: '적응적 방어',
    desc: '특정 방어 패턴에 고착되지 않고 상황에 따라 유연하게 대응. 축 간 균형이 극단적이지 않다.',
  };
}

/**
 * Risk model — computes system collapse triggers and thresholds
 */
function computeRiskModel(simAxes, trajectoryResult, stimulusResult) {
  const risks = [];

  // Rule 1: Emotional overload risk
  if (simAxes.emotion >= 0.7 && simAxes.resilience < 0.4) {
    risks.push({
      trigger: '정서 과부하',
      desc: '높은 감정 강도와 낮은 회복 탄성의 결합. 감정적 사건이 연쇄적 시스템 불안정을 유발할 수 있다.',
      severity: 'high',
    });
  }

  // Rule 2: Control collapse under stress
  const stressResp = stimulusResult.stress;
  if (stressResp && stressResp.shifted?.C < 0.3 && stressResp.recoveryPattern === 'fragile') {
    risks.push({
      trigger: '통제 붕괴',
      desc: '스트레스 상황에서 통제 시스템이 임계점 이하로 하락하며 회복이 어렵다.',
      severity: 'high',
    });
  }

  // Rule 3: Isolation spiral
  if (simAxes.boundary < 0.35 && simAxes.drive >= 0.6) {
    risks.push({
      trigger: '고립 나선',
      desc: '높은 통제 욕구와 닫힌 경계의 결합. 타인의 접근을 차단하면서 자기 확인 루프에 갇힐 수 있다.',
      severity: 'medium',
    });
  }

  // Rule 4: Resilience erosion trajectory
  if (trajectoryResult.drift.X < -0.05) {
    risks.push({
      trigger: '회복력 소진',
      desc: '시간이 지남에 따라 회복 탄성이 자연 감소하는 궤적. 축적된 스트레스가 시스템 내구성을 점진적으로 약화시킨다.',
      severity: 'medium',
    });
  }

  // Rule 5: Loss vulnerability
  const lossResp = stimulusResult.loss;
  if (lossResp && lossResp.vulnerability > 0.15 && lossResp.recoveryPattern !== 'resilient') {
    risks.push({
      trigger: '상실 취약성',
      desc: '관계 단절이나 기대 붕괴에 대한 시스템 반응이 과도하며, 자연 회복이 불완전하다.',
      severity: 'medium',
    });
  }

  // Compute overall risk level
  const highCount = risks.filter(r => r.severity === 'high').length;
  const medCount = risks.filter(r => r.severity === 'medium').length;
  const overallRisk = highCount >= 2 ? 'critical' : highCount >= 1 ? 'elevated' : medCount >= 2 ? 'moderate' : 'stable';

  return { risks, overallRisk, riskCount: risks.length };
}

/**
 * Master simulation function — orchestrates all simulation components
 */
function runSimulation(axes, anchor) {
  const simAxes = extractSimAxes(axes);
  const trajectory = runTrajectorySimulation(simAxes);
  const stimulus = computeStimulusResponse(simAxes);
  const defense = classifyDefensePattern(simAxes, anchor);
  const risk = computeRiskModel(simAxes, trajectory, stimulus);

  return {
    axes: simAxes,
    trajectory,
    stimulus,
    defense,
    risk,
  };
}

// ═══════════════════════════════════════════════════════════
// CROSS-SIMULATION — 두 사람의 시뮬레이션 교차 분석
// ═══════════════════════════════════════════════════════════

function computeCrossSimulation(simA, simB, anchorA, anchorB, prismA, prismB) {
  const axA = simA.axes;
  const axB = simB.axes;

  // ── 1. 축 거리 분석: 어디가 가깝고 어디가 먼지 ──
  const axisDelta = {};
  const axisNames = { emotion: '정서', drive: '동력', cognition: '인지', boundary: '경계', resilience: '회복' };
  let totalDist = 0;
  for (const key of Object.keys(axisNames)) {
    const d = Math.abs((axA[key] || 0.5) - (axB[key] || 0.5));
    axisDelta[key] = { delta: Math.round(d * 100) / 100, a: Math.round((axA[key] || 0.5) * 100) / 100, b: Math.round((axB[key] || 0.5) * 100) / 100 };
    totalDist += d;
  }
  const avgDist = Math.round((totalDist / Object.keys(axisNames).length) * 100) / 100;

  // 가장 가까운 축 / 가장 먼 축
  const sorted = Object.entries(axisDelta).sort((a, b) => a[1].delta - b[1].delta);
  const closest = { axis: sorted[0][0], name: axisNames[sorted[0][0]], delta: sorted[0][1].delta };
  const farthest = { axis: sorted[sorted.length - 1][0], name: axisNames[sorted[sorted.length - 1][0]], delta: sorted[sorted.length - 1][1].delta };

  // ── 2. 궤적 수렴/발산 분석 ──
  const trajA = simA.trajectory;
  const trajB = simB.trajectory;
  let convergence = 'parallel'; // 기본: 평행
  if (trajA && trajB) {
    const driftDiff = Math.abs((trajA.drift || 0) - (trajB.drift || 0));
    const volDiff = Math.abs((trajA.volatility || 0) - (trajB.volatility || 0));
    if (driftDiff < 0.15 && volDiff < 0.15) convergence = 'convergent'; // 비슷한 궤적
    else if (driftDiff > 0.4 || volDiff > 0.4) convergence = 'divergent'; // 크게 다른 궤적
  }

  // ── 3. 자극-반응 호환성: A의 반응이 B의 트리거가 되는지 ──
  const stimA = simA.stimulus;
  const stimB = simB.stimulus;
  const triggerLoops = [];
  if (stimA && stimB) {
    // A의 conflict 반응이 높고 B의 conflict 회복이 느리면 → 갈등 루프
    // deltas = {E, C, T, O, X}, vulnerability = number, recoveryRate = 0~1
    const aConflictVuln = stimA.conflict?.vulnerability || 0;
    const bConflictRecovery = stimB.conflict?.recoveryRate ?? 0.5;
    if (aConflictVuln > 0.3 && bConflictRecovery < 0.33) {
      triggerLoops.push({ type: 'conflict_escalation', desc: 'A의 갈등 반응이 B의 회복 속도를 초과' });
    }
    // B의 conflict 반응이 높고 A의 conflict 회복이 느리면 → 역방향
    const bConflictVuln = stimB.conflict?.vulnerability || 0;
    const aConflictRecovery = stimA.conflict?.recoveryRate ?? 0.5;
    if (bConflictVuln > 0.3 && aConflictRecovery < 0.33) {
      triggerLoops.push({ type: 'conflict_escalation_reverse', desc: 'B의 갈등 반응이 A의 회복 속도를 초과' });
    }
    // A가 intimacy에 큰 반응 + B가 intimacy에 작은 반응 → 친밀감 불균형
    const aIntVuln = stimA.intimacy?.vulnerability || 0;
    const bIntVuln = stimB.intimacy?.vulnerability || 0;
    if (aIntVuln > 0.2 && bIntVuln < 0.1) {
      triggerLoops.push({ type: 'intimacy_asymmetry', desc: 'A의 친밀감 민감도가 B보다 현저히 높음' });
    } else if (bIntVuln > 0.2 && aIntVuln < 0.1) {
      triggerLoops.push({ type: 'intimacy_asymmetry_reverse', desc: 'B의 친밀감 민감도가 A보다 현저히 높음' });
    }
    // stress 반응 비대칭
    const aStressVuln = stimA.stress?.vulnerability || 0;
    const bStressVuln = stimB.stress?.vulnerability || 0;
    if (aStressVuln > 0.3 && bStressVuln < 0.1) {
      triggerLoops.push({ type: 'stress_asymmetry', desc: 'A가 스트레스에 크게 흔들릴 때 B는 무반응' });
    } else if (bStressVuln > 0.3 && aStressVuln < 0.1) {
      triggerLoops.push({ type: 'stress_asymmetry_reverse', desc: 'B가 스트레스에 크게 흔들릴 때 A는 무반응' });
    }
  }

  // ── 4. 방어 패턴 충돌 매트릭스 ──
  const defA = simA.defense;
  const defB = simB.defense;
  let defenseClash = { type: 'neutral', desc: '방어 패턴 간 특별한 충돌 없음' };
  if (defA && defB) {
    const cA = defA.code;
    const cB = defB.code;
    // 위험한 조합들
    if (cA === 'PROJECTION' && cB === 'PROJECTION') defenseClash = { type: 'mirror_toxic', desc: '서로에게 투사하는 거울 — 상대의 결함이 자기 것인 줄 모른다' };
    else if ((cA === 'FORTRESS' && cB === 'SHUTDOWN') || (cA === 'SHUTDOWN' && cB === 'FORTRESS')) defenseClash = { type: 'wall_void', desc: '한쪽이 벽을 세우면 다른 쪽이 사라진다 — 접점이 소멸하는 구조' };
    else if ((cA === 'EXPLOSION' && cB === 'SHUTDOWN') || (cA === 'SHUTDOWN' && cB === 'EXPLOSION')) defenseClash = { type: 'fire_ice', desc: '한쪽이 폭발하면 다른 쪽이 얼어붙는다 — 반응 자체가 트리거가 되는 루프' };
    else if ((cA === 'EXPLOSION' && cB === 'EXPLOSION')) defenseClash = { type: 'double_fire', desc: '둘 다 폭발형 — 갈등이 통제 불능으로 에스컬레이션' };
    else if ((cA === 'PROJECTION' && cB === 'FORTRESS') || (cA === 'FORTRESS' && cB === 'PROJECTION')) defenseClash = { type: 'blame_wall', desc: '한쪽이 투사하면 다른 쪽이 차단 — 갈등이 해결 없이 축적' };
    else if ((cA === 'DIFFUSION' && cB === 'DIFFUSION')) defenseClash = { type: 'double_fog', desc: '둘 다 경계가 흐려져 감정 책임 소재가 불분명 — 만성적 혼란' };
    else if ((cA === 'ADAPTIVE' && cB === 'ADAPTIVE')) defenseClash = { type: 'mirror_flex', desc: '둘 다 적응형 — 유연하지만 진짜 갈등을 회피할 위험' };
    else if ((cA === 'ADAPTIVE' || cB === 'ADAPTIVE') && (cA !== 'EXPLOSION' && cB !== 'EXPLOSION')) defenseClash = { type: 'one_flex', desc: '한쪽의 적응력이 충돌을 완충 — 단, 적응하는 쪽의 소진 위험' };
  }

  // ── 5. 리스크 교차 ──
  const riskA = simA.risk;
  const riskB = simB.risk;
  const sharedRisks = [];
  if (riskA?.risks && riskB?.risks) {
    const flagsA = riskA.risks.map(f => f.trigger || f);
    const flagsB = riskB.risks.map(f => f.trigger || f);
    const shared = flagsA.filter(f => flagsB.includes(f));
    shared.forEach(f => sharedRisks.push(f));
  }

  // ── 6. 종합 호환성 스코어 (0-100) ──
  let compat = 50;
  // 축 거리가 작을수록 +
  compat += Math.round((1 - avgDist) * 20);
  // 궤적 수렴이면 +
  if (convergence === 'convergent') compat += 10;
  else if (convergence === 'divergent') compat -= 10;
  // 트리거 루프 갯수만큼 -
  compat -= triggerLoops.length * 5;
  // 방어 충돌 심각도
  if (defenseClash.type === 'mirror_toxic' || defenseClash.type === 'fire_ice' || defenseClash.type === 'double_fire') compat -= 15;
  else if (defenseClash.type === 'wall_void' || defenseClash.type === 'blame_wall') compat -= 10;
  else if (defenseClash.type === 'mirror_flex' || defenseClash.type === 'one_flex') compat += 5;
  // 공유 리스크가 있으면 -
  compat -= sharedRisks.length * 3;
  compat = Math.max(5, Math.min(95, compat));

  // 긴장도
  let tension = '보통';
  if (triggerLoops.length >= 2 || defenseClash.type.includes('toxic') || defenseClash.type.includes('fire')) tension = '높음';
  else if (triggerLoops.length === 0 && defenseClash.type === 'neutral') tension = '낮음';

  // 성장 가능성
  let growth = '보통';
  if (convergence === 'convergent' && (defenseClash.type === 'one_flex' || defenseClash.type === 'mirror_flex')) growth = '높음';
  else if (convergence === 'divergent' && triggerLoops.length >= 2) growth = '낮음';

  // ── 7. 애착 패턴 교차 분류 ──
  const ATTACHMENT_CROSS = {
    'leans_secure×leans_secure': { type: 'stable_pair', desc: '둘 다 안정형 — 갈등이 와도 복원력이 높지만, 자극이 부족할 수 있다' },
    'leans_secure×leans_anxious': { type: 'anchor_seeker', desc: '한쪽의 안정감이 다른 쪽의 불안을 진정시키지만, 진정 역할이 고착되면 소진된다' },
    'leans_secure×leans_avoidant': { type: 'patience_test', desc: '한쪽의 안정감이 다른 쪽의 벽을 천천히 녹이지만, 인내의 한계가 관계의 한계가 된다' },
    'leans_secure×leans_disorganized': { type: 'ground_wire', desc: '한쪽의 안정감이 다른 쪽의 혼란에 접지 역할을 하지만, 혼란의 강도가 접지 용량을 초과할 수 있다' },
    'leans_anxious×leans_anxious': { type: 'mutual_spiral', desc: '둘 다 확인을 구하지만 누구도 줄 수 없다 — 불안이 불안을 증폭하는 피드백 루프' },
    'leans_anxious×leans_avoidant': { type: 'pursuit_withdrawal', desc: '추격-도주의 고전적 함정 — 한쪽이 다가갈수록 다른 쪽이 멀어지고, 멀어질수록 더 다가간다' },
    'leans_anxious×leans_disorganized': { type: 'chaos_amplifier', desc: '불안과 혼란이 서로를 증폭 — 관계의 예측 불가능성이 극대화된다' },
    'leans_avoidant×leans_avoidant': { type: 'parallel_isolation', desc: '둘 다 거리를 유지 — 편안하지만 진짜 연결이 형성되지 않을 수 있다' },
    'leans_avoidant×leans_disorganized': { type: 'ghost_dance', desc: '한쪽은 사라지고 다른 쪽은 혼란스러워한다 — 접점이 형성되었다 소멸하기를 반복' },
    'leans_disorganized×leans_disorganized': { type: 'double_chaos', desc: '둘 다 접근과 회피를 동시에 — 관계 자체가 예측 불가능한 난류' },
  };

  let attachmentCross = { type: 'unknown', desc: '애착 데이터 부족' };
  if (anchorA?.attachment?.primary_tendency && anchorB?.attachment?.primary_tendency) {
    const pairKey = anchorA.attachment.primary_tendency + '×' + anchorB.attachment.primary_tendency;
    const reversePairKey = anchorB.attachment.primary_tendency + '×' + anchorA.attachment.primary_tendency;
    attachmentCross = ATTACHMENT_CROSS[pairKey] || ATTACHMENT_CROSS[reversePairKey] || { type: 'uncommon', desc: '일반적이지 않은 조합 — 개별 맥락 해석 필요' };
  }

  // ── 8. 갈등 스타일 호환성 ──
  const CONFLICT_CROSS = {
    'direct_engagement×direct_engagement': { type: 'head_on', desc: '둘 다 정면 충돌형 — 갈등 해결이 빠르지만 파괴력도 높다', score: 0.5 },
    'direct_engagement×diplomatic_approach': { type: 'speed_gap', desc: '한쪽은 바로 꺼내고 다른 쪽은 돌려 말한다 — 속도 차이가 오해를 만든다', score: 0.6 },
    'direct_engagement×strategic_withdrawal': { type: 'chase_retreat', desc: '한쪽이 직면하면 다른 쪽이 후퇴 — 해결이 지연되며 좌절감 축적', score: 0.3 },
    'direct_engagement×avoidance': { type: 'wall_punch', desc: '한쪽이 문제를 제기하면 다른 쪽이 무시 — 가장 파괴적인 비대칭', score: 0.1 },
    'diplomatic_approach×diplomatic_approach': { type: 'polite_loop', desc: '둘 다 조심스러워 핵심에 도달하지 못한다 — 표면적 평화, 내면적 축적', score: 0.5 },
    'diplomatic_approach×strategic_withdrawal': { type: 'gentle_fade', desc: '부드럽게 접근하지만 상대가 빠진다 — 천천히 접점이 줄어든다', score: 0.4 },
    'diplomatic_approach×avoidance': { type: 'soft_wall', desc: '신중하게 다가가지만 벽에 부딪힌다 — 노력의 방향이 흡수되지 않는다', score: 0.3 },
    'strategic_withdrawal×strategic_withdrawal': { type: 'mutual_retreat', desc: '둘 다 물러서서 재접근을 기다린다 — 아무도 돌아오지 않을 수 있다', score: 0.3 },
    'strategic_withdrawal×avoidance': { type: 'double_exit', desc: '한쪽이 잠시 빠지고 다른 쪽은 영원히 빠진다 — 갈등 해소 경로 자체가 없다', score: 0.1 },
    'avoidance×avoidance': { type: 'frozen_conflict', desc: '갈등이 언급되지도 처리되지도 않는다 — 지뢰밭 위에 앉아 있는 구조', score: 0.1 },
  };

  let conflictCross = { type: 'unknown', desc: '갈등 데이터 부족', score: 0.5 };
  if (anchorA?.conflict?.default_mode && anchorB?.conflict?.default_mode) {
    const pairKey = anchorA.conflict.default_mode + '×' + anchorB.conflict.default_mode;
    const reversePairKey = anchorB.conflict.default_mode + '×' + anchorA.conflict.default_mode;
    conflictCross = CONFLICT_CROSS[pairKey] || CONFLICT_CROSS[reversePairKey] || { type: 'uncommon', desc: '비표준 갈등 스타일 조합', score: 0.5 };
  }

  // ── 9. 회복 리듬 불일치 ──
  const RECOVERY_MAP = { 'fast': 1, 'moderate': 2, 'slow': 3 };
  let recoveryMismatch = { delta: 0, desc: '회복 데이터 부족' };
  if (anchorA?.conflict?.recovery_speed && anchorB?.conflict?.recovery_speed) {
    const rA = RECOVERY_MAP[anchorA.conflict.recovery_speed] || 2;
    const rB = RECOVERY_MAP[anchorB.conflict.recovery_speed] || 2;
    const delta = Math.abs(rA - rB);
    if (delta === 0) recoveryMismatch = { delta: 0, desc: '비슷한 회복 속도 — 갈등 후 재접근 타이밍이 맞는다' };
    else if (delta === 1) recoveryMismatch = { delta: 1, desc: '약간의 회복 속도 차이 — 한쪽이 먼저 준비되고 기다린다' };
    else recoveryMismatch = { delta: 2, desc: '큰 회복 속도 차이 — 한쪽은 이미 회복했는데 다른 쪽은 아직 냉각 중. 재접근 타이밍 충돌' };
  }

  // ── 10. PRISM 주제 겹침률 ──
  let topicOverlap = { jaccard: 0, shared: [], uniqueA: [], uniqueB: [], desc: '주제 데이터 부족' };
  if (prismA?.topic_distribution && prismB?.topic_distribution) {
    const topicsA = prismA.topic_distribution.topics || prismA.topic_distribution;
    const topicsB = prismB.topic_distribution.topics || prismB.topic_distribution;
    if (typeof topicsA === 'object' && typeof topicsB === 'object') {
      const keysA = new Set(Object.keys(topicsA));
      const keysB = new Set(Object.keys(topicsB));
      const shared = [...keysA].filter(k => keysB.has(k));
      const union = new Set([...keysA, ...keysB]);
      const jaccard = union.size > 0 ? Math.round((shared.length / union.size) * 100) / 100 : 0;
      const uniqueA = [...keysA].filter(k => !keysB.has(k));
      const uniqueB = [...keysB].filter(k => !keysA.has(k));
      let desc = '';
      if (jaccard > 0.6) desc = '높은 주제 겹침 — 대화 소재가 풍부하지만 새로운 자극이 부족할 수 있다';
      else if (jaccard > 0.3) desc = '적당한 주제 겹침 — 공통 기반 위에 서로 다른 세계를 보여줄 수 있다';
      else if (jaccard > 0) desc = '낮은 주제 겹침 — 서로 다른 세계의 사람들. 호기심이 있으면 확장, 없으면 단절';
      else desc = '주제 겹침 없음 — 완전히 다른 관심사. 접점을 만들어야 한다';
      topicOverlap = { jaccard, shared, uniqueA: uniqueA.slice(0, 5), uniqueB: uniqueB.slice(0, 5), desc };
    }
  }

  // ── 호환성 스코어에 새 데이터 반영 ──
  compat += Math.round(conflictCross.score * 10 - 5); // 갈등 호환성 반영 (-5 ~ +5)
  if (attachmentCross.type === 'pursuit_withdrawal' || attachmentCross.type === 'mutual_spiral') compat -= 8;
  else if (attachmentCross.type === 'stable_pair') compat += 8;
  else if (attachmentCross.type === 'anchor_seeker' || attachmentCross.type === 'patience_test') compat += 3;
  if (recoveryMismatch.delta >= 2) compat -= 5;
  if (topicOverlap.jaccard > 0.3) compat += 3;
  compat = Math.max(5, Math.min(95, compat));

  // 긴장도/성장 재계산
  if (attachmentCross.type === 'pursuit_withdrawal' || attachmentCross.type === 'chaos_amplifier') tension = '높음';
  if (attachmentCross.type === 'stable_pair' && conflictCross.score >= 0.5) growth = '높음';
  if (attachmentCross.type === 'double_chaos' || conflictCross.score <= 0.1) growth = '낮음';

  return {
    axisDelta,
    avgDistance: avgDist,
    closest,
    farthest,
    convergence,
    triggerLoops,
    defenseClash,
    sharedRisks,
    attachmentCross,
    conflictCross,
    recoveryMismatch,
    topicOverlap,
    compatibility: compat,
    tension,
    growth,
  };
}

// ═══════════════════════════════════════════════════════════
// STATE TRANSITION ENGINE — 관계 상태 전이 모델
// ═══════════════════════════════════════════════════════════

// 상태 공간 정의 (행동 기준)
const RELATION_STATES = {
  ENGAGE: { id: 'S1', label: '접근', desc: '적극적으로 관계에 에너지를 투입하는 상태' },
  NEUTRAL: { id: 'S2', label: '거리 유지', desc: '안정적 거리를 유지하며 관망하는 상태' },
  AVOID: { id: 'S3', label: '회피', desc: '거리를 넓히거나 접촉을 줄이는 상태' },
  BLOCK: { id: 'S4', label: '차단', desc: '관계 자체를 중단하거나 벽을 세우는 상태' },
  RECOVER: { id: 'S5', label: '회복', desc: '갈등 후 재접근을 준비하는 상태' },
};

// softmax with temperature — 스코어를 진짜 확률로 변환
const STATE_TEMPERATURE = 0.8; // T < 1 → 더 확신 있는 분포

function softmax(scores, temperature = STATE_TEMPERATURE) {
  const keys = Object.keys(scores);
  const maxScore = Math.max(...Object.values(scores));
  const exps = {};
  let sumExp = 0;
  for (const k of keys) {
    const e = Math.exp((scores[k] - maxScore) / temperature); // numerical stability
    exps[k] = e;
    sumExp += e;
  }
  const result = {};
  for (const k of keys) {
    result[k] = Math.round((exps[k] / sumExp) * 100) / 100;
  }
  return result;
}

function classifyRelationState(simAxes, anchor) {
  const E = simAxes?.emotion ?? 0.5;
  const C = simAxes?.drive ?? 0.5;
  const O = simAxes?.boundary ?? 0.5;
  const X = simAxes?.resilience ?? 0.5;
  const D = simAxes?.defense ?? 0.5;

  const attachTendency = anchor?.attachment?.primary_tendency || 'leans_secure';
  const conflictMode = anchor?.conflict?.default_mode || 'diplomatic_approach';

  // ── 주 신호: 행동 축 (E/C/O/X/D) ──
  const axisScores = { ENGAGE: 0, NEUTRAL: 0, AVOID: 0, BLOCK: 0, RECOVER: 0 };

  // 감정 에너지 (E) → 접근/회피 주 결정자
  axisScores.ENGAGE += E * 0.4;
  axisScores.AVOID += (1 - E) * 0.3;
  axisScores.NEUTRAL += (1 - Math.abs(E - 0.5) * 2) * 0.2; // 중간일수록 neutral

  // 개방성 (O) → 접근/회피 보조
  axisScores.ENGAGE += O * 0.25;
  axisScores.AVOID += (1 - O) * 0.2;

  // 통제 (C) → 접근/차단 양극
  axisScores.ENGAGE += C * 0.15;
  axisScores.BLOCK += C * 0.15;

  // 탄성 (X) → 회복/차단 결정자
  axisScores.RECOVER += X * 0.3;
  axisScores.BLOCK += (1 - X) * 0.2;

  // 방어 방향 (D) → Externalize(높음): 차단/접근 강화 / Internalize(낮음): 회피/회복 강화
  axisScores.BLOCK += D * 0.1;          // 외부 투사 → 벽 세우기
  axisScores.ENGAGE += D * 0.05;        // 외부 투사 → 외부 지향적 에너지
  axisScores.AVOID += (1 - D) * 0.08;   // 내면 흡수 → 자기 안으로 후퇴
  axisScores.RECOVER += (1 - D) * 0.07; // 내면 흡수 → 내면 재조정

  // ── 보정 신호: ANCHOR (가중치 0.3 — 주 신호의 30% 수준으로 제한) ──
  const ANCHOR_WEIGHT = 0.3;
  const anchorScores = { ENGAGE: 0, NEUTRAL: 0, AVOID: 0, BLOCK: 0, RECOVER: 0 };

  if (attachTendency === 'leans_anxious') { anchorScores.ENGAGE += 0.4; anchorScores.AVOID += 0.1; }
  else if (attachTendency === 'leans_avoidant') { anchorScores.AVOID += 0.4; anchorScores.BLOCK += 0.1; }
  else if (attachTendency === 'leans_disorganized') { anchorScores.ENGAGE += 0.2; anchorScores.AVOID += 0.2; anchorScores.BLOCK += 0.1; }
  else { anchorScores.NEUTRAL += 0.3; anchorScores.RECOVER += 0.2; } // secure

  if (conflictMode === 'direct_engagement') anchorScores.ENGAGE += 0.2;
  else if (conflictMode === 'avoidance') anchorScores.AVOID += 0.25;
  else if (conflictMode === 'strategic_withdrawal') { anchorScores.AVOID += 0.15; anchorScores.RECOVER += 0.15; }
  else anchorScores.NEUTRAL += 0.15; // diplomatic

  // ── 합산: 주 신호 + 보정 신호 ──
  const combinedScores = {};
  for (const k of Object.keys(axisScores)) {
    combinedScores[k] = axisScores[k] + anchorScores[k] * ANCHOR_WEIGHT;
  }

  // ── softmax 정규화 (상대적 우세도 분포 — 통계적 확률 아님) ──
  const distribution = softmax(combinedScores);

  const sorted = Object.entries(distribution).sort((a, b) => b[1] - a[1]);
  const primary = sorted[0][0];
  const secondary = sorted[1][0];

  return {
    primary: { state: primary, ...RELATION_STATES[primary], probability: distribution[primary] },
    secondary: { state: secondary, ...RELATION_STATES[secondary], probability: distribution[secondary] },
    distribution,
    _debug: { axisScores, anchorScores, combinedScores, anchorWeight: ANCHOR_WEIGHT, temperature: STATE_TEMPERATURE },
  };
}

function computeTransitionMatrix(stateA, stateB, crossSim, anchorA, anchorB) {
  const transitions = [];
  const primaryA = stateA.primary.state;
  const primaryB = stateB.primary.state;

  // 기본 전이 확률 계산 함수
  function tp(from, to, base, modifiers = {}) {
    let p = base;
    for (const [condition, delta] of Object.entries(modifiers)) {
      if (delta !== 0) p += delta;
    }
    return Math.max(0.05, Math.min(0.95, Math.round(p * 100) / 100));
  }

  // ── 접근-회피 루프 전이 확률 ──
  const conflictScore = crossSim.conflictCross?.score ?? 0.5;
  const recoveryDelta = crossSim.recoveryMismatch?.delta ?? 0;
  const triggerCount = crossSim.triggerLoops?.length ?? 0;
  const attachType = crossSim.attachmentCross?.type || 'unknown';
  const defenseType = crossSim.defenseClash?.type || 'neutral';

  // A 기준 전이
  if (primaryA === 'ENGAGE') {
    transitions.push({
      from: 'A:접근', to: '회피 전환',
      probability: tp('ENGAGE', 'AVOID', 0.25, {
        '상대 차단적': primaryB === 'BLOCK' ? 0.2 : 0,
        '갈등 호환 낮음': conflictScore < 0.3 ? 0.15 : 0,
        '트리거 다수': triggerCount >= 2 ? 0.1 : 0,
        '상대 수용적': primaryB === 'ENGAGE' || primaryB === 'NEUTRAL' ? -0.15 : 0,
      }),
      trigger: '노력 대비 반응이 기준 이하로 3회 이상 반복',
    });
    transitions.push({
      from: 'A:접근', to: '안정 유지',
      probability: tp('ENGAGE', 'NEUTRAL', 0.35, {
        '상호 접근': primaryB === 'ENGAGE' ? 0.2 : 0,
        '안정 애착': attachType === 'stable_pair' ? 0.15 : 0,
        '방어 유연': defenseType === 'one_flex' || defenseType === 'mirror_flex' ? 0.1 : 0,
      }),
      trigger: '상대의 수용적 반응이 2회 이상 연속',
    });
  }

  if (primaryA === 'AVOID') {
    transitions.push({
      from: 'A:회피', to: '재접근',
      probability: tp('AVOID', 'RECOVER', 0.3, {
        '높은 탄성': (stateA.distribution.RECOVER || 0) > 0.2 ? 0.15 : 0,
        '안정 애착': attachType !== 'pursuit_withdrawal' ? 0.1 : 0,
        '회복 속도 불일치 큼': recoveryDelta >= 2 ? -0.15 : 0,
      }),
      trigger: '충분한 공간 확보 후 에너지 회복 시',
    });
    transitions.push({
      from: 'A:회피', to: '차단 전환',
      probability: tp('AVOID', 'BLOCK', 0.15, {
        '트리거 다수': triggerCount >= 3 ? 0.2 : 0,
        '방어 충돌 심각': defenseType.includes('toxic') || defenseType.includes('fire') ? 0.15 : 0,
        '회피형 애착': (anchorA?.attachment?.primary_tendency || '') === 'leans_avoidant' ? 0.1 : 0,
      }),
      trigger: '친밀 요구 강도가 수용 임계를 초과',
    });
  }

  // B 기준 전이
  if (primaryB === 'ENGAGE') {
    transitions.push({
      from: 'B:접근', to: '회피 전환',
      probability: tp('ENGAGE', 'AVOID', 0.25, {
        '상대 차단적': primaryA === 'BLOCK' ? 0.2 : 0,
        '갈등 호환 낮음': conflictScore < 0.3 ? 0.15 : 0,
        '상대 수용적': primaryA === 'ENGAGE' || primaryA === 'NEUTRAL' ? -0.15 : 0,
      }),
      trigger: '노력 대비 반응이 기준 이하로 3회 이상 반복',
    });
  }

  if (primaryB === 'AVOID') {
    transitions.push({
      from: 'B:회피', to: '재접근',
      probability: tp('AVOID', 'RECOVER', 0.3, {
        '높은 탄성': (stateB.distribution.RECOVER || 0) > 0.2 ? 0.15 : 0,
        '회복 속도 불일치 큼': recoveryDelta >= 2 ? -0.15 : 0,
      }),
      trigger: '충분한 공간 확보 후 에너지 회복 시',
    });
  }

  // A: BLOCK 상태 전이
  if (primaryA === 'BLOCK') {
    transitions.push({
      from: 'A:차단', to: '회피로 완화',
      probability: tp('BLOCK', 'AVOID', 0.2, {
        '상대 회복 시도': primaryB === 'RECOVER' ? 0.15 : 0,
        '방어 유연': defenseType === 'one_flex' || defenseType === 'mirror_flex' ? 0.1 : 0,
        '갈등 호환 양호': conflictScore > 0.5 ? 0.1 : 0,
      }),
      trigger: '상대의 지속적 비침습적 시그널이 차단 강도를 약화시킬 때',
    });
    transitions.push({
      from: 'A:차단', to: '차단 고착',
      probability: tp('BLOCK', 'BLOCK', 0.4, {
        '상대 접근 압박': primaryB === 'ENGAGE' ? 0.15 : 0,
        '방어 충돌 심각': defenseType.includes('toxic') || defenseType.includes('fire') ? 0.1 : 0,
        '상대도 차단': primaryB === 'BLOCK' ? 0.2 : 0,
      }),
      trigger: '외부 자극 없이 시간 경과 또는 상대의 접근이 트리거로 작용',
    });
  }

  // A: RECOVER 상태 전이
  if (primaryA === 'RECOVER') {
    transitions.push({
      from: 'A:회복', to: '재접근',
      probability: tp('RECOVER', 'ENGAGE', 0.35, {
        '상대도 회복': primaryB === 'RECOVER' ? 0.2 : 0,
        '상대 수용적': primaryB === 'ENGAGE' || primaryB === 'NEUTRAL' ? 0.1 : 0,
        '안정 애착': attachType === 'stable_pair' || attachType === 'anchor_seeker' ? 0.1 : 0,
        '상대 차단적': primaryB === 'BLOCK' ? -0.2 : 0,
      }),
      trigger: '에너지 회복 후 상대의 수용 시그널 감지 시',
    });
    transitions.push({
      from: 'A:회복', to: '회복 실패 → 회피',
      probability: tp('RECOVER', 'AVOID', 0.2, {
        '회복 속도 불일치': recoveryDelta >= 2 ? 0.15 : 0,
        '트리거 재발': triggerCount >= 2 ? 0.1 : 0,
        '상대 무반응': primaryB === 'NEUTRAL' && conflictScore < 0.3 ? 0.1 : 0,
      }),
      trigger: '회복 중 트리거 재발 또는 상대의 무반응이 지속될 때',
    });
  }

  // A: NEUTRAL 상태 전이
  if (primaryA === 'NEUTRAL') {
    transitions.push({
      from: 'A:관망', to: '접근 전환',
      probability: tp('NEUTRAL', 'ENGAGE', 0.25, {
        '상대 접근': primaryB === 'ENGAGE' ? 0.2 : 0,
        '안정 애착': attachType === 'stable_pair' ? 0.1 : 0,
        '갈등 호환 양호': conflictScore > 0.5 ? 0.05 : 0,
      }),
      trigger: '상대의 접근 시그널이 관망 임계를 초과할 때',
    });
    transitions.push({
      from: 'A:관망', to: '회피 전환',
      probability: tp('NEUTRAL', 'AVOID', 0.2, {
        '상대 차단적': primaryB === 'BLOCK' ? 0.15 : 0,
        '트리거 발생': triggerCount >= 1 ? 0.1 : 0,
        '방어 충돌': defenseType.includes('toxic') ? 0.1 : 0,
      }),
      trigger: '부정 시그널 축적이 관망 유지 비용을 초과할 때',
    });
  }

  // B: BLOCK 상태 전이
  if (primaryB === 'BLOCK') {
    transitions.push({
      from: 'B:차단', to: '회피로 완화',
      probability: tp('BLOCK', 'AVOID', 0.2, {
        '상대 회복 시도': primaryA === 'RECOVER' ? 0.15 : 0,
        '방어 유연': defenseType === 'one_flex' || defenseType === 'mirror_flex' ? 0.1 : 0,
      }),
      trigger: '상대의 비침습적 시그널이 차단 강도를 약화시킬 때',
    });
  }

  // B: RECOVER 상태 전이
  if (primaryB === 'RECOVER') {
    transitions.push({
      from: 'B:회복', to: '재접근',
      probability: tp('RECOVER', 'ENGAGE', 0.35, {
        '상대도 회복': primaryA === 'RECOVER' ? 0.2 : 0,
        '상대 수용적': primaryA === 'ENGAGE' || primaryA === 'NEUTRAL' ? 0.1 : 0,
        '상대 차단적': primaryA === 'BLOCK' ? -0.2 : 0,
      }),
      trigger: '에너지 회복 후 상대의 수용 시그널 감지 시',
    });
  }

  // B: NEUTRAL 상태 전이
  if (primaryB === 'NEUTRAL') {
    transitions.push({
      from: 'B:관망', to: '접근 전환',
      probability: tp('NEUTRAL', 'ENGAGE', 0.25, {
        '상대 접근': primaryA === 'ENGAGE' ? 0.2 : 0,
        '갈등 호환 양호': conflictScore > 0.5 ? 0.05 : 0,
      }),
      trigger: '상대의 접근 시그널이 관망 임계를 초과할 때',
    });
  }

  // ── 상호작용 전이 (교차) ──
  // 접근×회피 루프
  if ((primaryA === 'ENGAGE' && primaryB === 'AVOID') || (primaryB === 'ENGAGE' && primaryA === 'AVOID')) {
    const pursuer = primaryA === 'ENGAGE' ? 'A' : 'B';
    const withdrawer = primaryA === 'AVOID' ? 'A' : 'B';
    transitions.push({
      from: `${pursuer}:접근 × ${withdrawer}:회피`,
      to: '추격-도주 루프 활성화',
      probability: tp('cross', 'loop', 0.4, {
        '불안×회피 애착': attachType === 'pursuit_withdrawal' ? 0.25 : 0,
        '갈등 스타일 불일치': conflictScore < 0.3 ? 0.1 : 0,
        '방어 충돌': defenseType === 'fire_ice' || defenseType === 'chase_retreat' ? 0.1 : 0,
      }),
      trigger: `${pursuer}의 접근 강도가 ${withdrawer}의 거리 임계를 초과할 때`,
    });
    transitions.push({
      from: `${pursuer}:접근 × ${withdrawer}:회피`,
      to: '루프 이탈 → 안정화',
      probability: tp('cross', 'exit', 0.2, {
        '메타 인지 높음': (stateA.distribution.RECOVER || 0) + (stateB.distribution.RECOVER || 0) > 0.3 ? 0.15 : 0,
        '갈등 스타일 협력적': conflictScore > 0.5 ? 0.15 : 0,
        '방어 유연': defenseType === 'one_flex' ? 0.1 : 0,
      }),
      trigger: '한쪽이 패턴 자체를 언어화하여 상대에게 전달할 때',
    });
  }

  // 차단×회복 교차
  if ((primaryA === 'BLOCK' && primaryB === 'RECOVER') || (primaryB === 'BLOCK' && primaryA === 'RECOVER')) {
    const blocker = primaryA === 'BLOCK' ? 'A' : 'B';
    const recoverer = primaryA === 'RECOVER' ? 'A' : 'B';
    transitions.push({
      from: `${blocker}:차단 × ${recoverer}:회복`,
      to: '차단 해제 가능',
      probability: tp('cross', 'unblock', 0.15, {
        '방어 유연': defenseType === 'one_flex' ? 0.15 : 0,
        '갈등 호환': conflictScore > 0.5 ? 0.1 : 0,
        '방어 충돌 심각': defenseType.includes('toxic') ? -0.1 : 0,
      }),
      trigger: `${recoverer}의 비침습적 접근이 ${blocker}의 차단 임계를 점진적으로 낮출 때`,
    });
  }

  // 상호 관망 교착
  if (primaryA === 'NEUTRAL' && primaryB === 'NEUTRAL') {
    transitions.push({
      from: '상호 관망',
      to: '교착 → 자연 소멸',
      probability: tp('cross', 'fade', 0.3, {
        '트리거 없음': triggerCount === 0 ? 0.1 : 0,
        '주제 겹침 부족': (crossSim.topicOverlap?.jaccard ?? 0.5) < 0.2 ? 0.1 : 0,
      }),
      trigger: '외부 이벤트나 자극 없이 접점 빈도가 자연 감소',
    });
  }

  // ── 상태 확신도 기반 스케일링 ──
  // primary state의 probability가 낮으면 (분류 불확실) 전이 확률을 중앙(0.5)으로 수축
  // confidence = primary probability (0.2~0.8 범위)
  // scaling: p → 0.5 + (p - 0.5) * confidence_factor
  const confA = stateA.primary.probability || 0.33;
  const confB = stateB.primary.probability || 0.33;
  // 0.33(균등분포) → factor 0.6 / 0.5(약간 우세) → 0.85 / 0.7+(확신) → 1.0
  const confFactor = (conf) => Math.min(1.0, 0.4 + conf * 1.2);

  for (const t of transitions) {
    // 어떤 사람의 전이인지에 따라 해당 confidence 적용
    const isA = t.from.startsWith('A:');
    const isB = t.from.startsWith('B:');
    const isCross = !isA && !isB;
    const factor = isCross ? (confFactor(confA) + confFactor(confB)) / 2
                 : isA ? confFactor(confA) : confFactor(confB);
    t.probability = Math.max(0.05, Math.min(0.95,
      Math.round((0.5 + (t.probability - 0.5) * factor) * 100) / 100
    ));
  }

  return transitions;
}

function computePathwayProbabilities(crossSim, stateA, stateB, anchorA, anchorB) {
  // 3종 경로의 raw 스코어 + 요인별 기여도 추적
  const factors = { stabilize: [], oscillate: [], collapse: [] };
  let stabilize = 0.33;
  let oscillate = 0.34;
  let collapse = 0.33;

  const compat = crossSim.compatibility || 50;
  const triggerCount = crossSim.triggerLoops?.length ?? 0;
  const defenseType = crossSim.defenseClash?.type || 'neutral';
  const attachType = crossSim.attachmentCross?.type || 'unknown';
  const conflictScore = crossSim.conflictCross?.score ?? 0.5;
  const convergence = crossSim.convergence || 'parallel';
  const recoveryDelta = crossSim.recoveryMismatch?.delta ?? 0;

  // 호환성 반영
  const compatDeltaS = +((compat - 50) * 0.004).toFixed(3);
  const compatDeltaC = -((compat - 50) * 0.003).toFixed(3);
  stabilize += compatDeltaS;
  collapse += Number(compatDeltaC);
  if (compatDeltaS !== 0) factors.stabilize.push({ factor: '호환성', delta: compatDeltaS });
  if (Number(compatDeltaC) !== 0) factors.collapse.push({ factor: '호환성', delta: Number(compatDeltaC) });

  // 궤적 수렴/발산
  if (convergence === 'convergent') {
    stabilize += 0.1; collapse -= 0.05;
    factors.stabilize.push({ factor: '궤적 수렴', delta: 0.1 });
    factors.collapse.push({ factor: '궤적 수렴', delta: -0.05 });
  } else if (convergence === 'divergent') {
    stabilize -= 0.08; collapse += 0.08;
    factors.stabilize.push({ factor: '궤적 발산', delta: -0.08 });
    factors.collapse.push({ factor: '궤적 발산', delta: 0.08 });
  }

  // 트리거 루프
  if (triggerCount > 0) {
    const oscDelta = triggerCount * 0.04;
    const staDelta = -(triggerCount * 0.03);
    oscillate += oscDelta; stabilize += staDelta;
    factors.oscillate.push({ factor: `트리거 루프 (${triggerCount}개)`, delta: oscDelta });
    factors.stabilize.push({ factor: `트리거 루프 (${triggerCount}개)`, delta: staDelta });
  }

  // 방어 충돌
  if (defenseType.includes('toxic') || defenseType.includes('fire') || defenseType === 'double_fire') {
    collapse += 0.12; stabilize -= 0.08;
    factors.collapse.push({ factor: `방어 충돌 (${defenseType})`, delta: 0.12 });
    factors.stabilize.push({ factor: `방어 충돌 (${defenseType})`, delta: -0.08 });
  } else if (defenseType === 'one_flex' || defenseType === 'mirror_flex') {
    stabilize += 0.08; collapse -= 0.05;
    factors.stabilize.push({ factor: `방어 유연 (${defenseType})`, delta: 0.08 });
    factors.collapse.push({ factor: `방어 유연 (${defenseType})`, delta: -0.05 });
  }

  // 애착 교차
  if (attachType === 'stable_pair') {
    stabilize += 0.12; collapse -= 0.08;
    factors.stabilize.push({ factor: '안정 애착 조합', delta: 0.12 });
    factors.collapse.push({ factor: '안정 애착 조합', delta: -0.08 });
  } else if (attachType === 'pursuit_withdrawal') {
    oscillate += 0.1; stabilize -= 0.05;
    factors.oscillate.push({ factor: '추격-도주 애착', delta: 0.1 });
    factors.stabilize.push({ factor: '추격-도주 애착', delta: -0.05 });
  } else if (attachType === 'double_chaos' || attachType === 'chaos_amplifier') {
    collapse += 0.1; stabilize -= 0.08;
    factors.collapse.push({ factor: `혼란 애착 (${attachType})`, delta: 0.1 });
    factors.stabilize.push({ factor: `혼란 애착 (${attachType})`, delta: -0.08 });
  }

  // 갈등 스타일
  if (conflictScore >= 0.6) {
    stabilize += 0.06;
    factors.stabilize.push({ factor: '갈등 호환 양호', delta: 0.06 });
  } else if (conflictScore <= 0.2) {
    collapse += 0.08; oscillate += 0.04;
    factors.collapse.push({ factor: '갈등 호환 불량', delta: 0.08 });
    factors.oscillate.push({ factor: '갈등 호환 불량', delta: 0.04 });
  }

  // 회복 리듬 불일치
  if (recoveryDelta >= 2) {
    oscillate += 0.06; stabilize -= 0.04;
    factors.oscillate.push({ factor: '회복 리듬 불일치', delta: 0.06 });
    factors.stabilize.push({ factor: '회복 리듬 불일치', delta: -0.04 });
  }

  // ── 현재 관계 상태 반영 (state-based prior) ──
  // stateA/stateB의 primary state 조합이 경로 확률에 영향
  {
    const sA = stateA?.primary?.state || 'NEUTRAL';
    const sB = stateB?.primary?.state || 'NEUTRAL';
    const pair = [sA, sB].sort().join('×'); // 순서 무관 정규화

    // 상태 조합 → 경로 prior 매핑
    const STATE_PAIR_PRIOR = {
      'ENGAGE×ENGAGE':   { s: 0.10, o: -0.04, c: -0.06, label: '상호 접근' },
      'ENGAGE×NEUTRAL':  { s: 0.05, o:  0.00, c: -0.03, label: '일방 접근 + 관망' },
      'ENGAGE×RECOVER':  { s: 0.08, o: -0.02, c: -0.04, label: '접근 + 회복 의지' },
      'ENGAGE×AVOID':    { s: -0.05, o: 0.10, c: -0.02, label: '접근-회피 비대칭' },
      'ENGAGE×BLOCK':    { s: -0.06, o: 0.04, c:  0.08, label: '접근 vs 차단' },
      'AVOID×AVOID':     { s: -0.08, o: 0.02, c:  0.08, label: '상호 회피' },
      'AVOID×BLOCK':     { s: -0.06, o: 0.00, c:  0.10, label: '회피 + 차단' },
      'AVOID×NEUTRAL':   { s: -0.03, o: 0.04, c:  0.02, label: '회피 + 관망' },
      'AVOID×RECOVER':   { s:  0.02, o: 0.04, c: -0.02, label: '회피 + 회복' },
      'BLOCK×BLOCK':     { s: -0.08, o: -0.02, c: 0.14, label: '상호 차단' },
      'BLOCK×NEUTRAL':   { s: -0.04, o: 0.02, c:  0.06, label: '차단 + 관망' },
      'BLOCK×RECOVER':   { s: -0.02, o: 0.02, c:  0.04, label: '차단 vs 회복' },
      'NEUTRAL×NEUTRAL': { s:  0.00, o: 0.00, c:  0.00, label: '상호 관망' },
      'NEUTRAL×RECOVER': { s:  0.04, o: 0.00, c: -0.02, label: '관망 + 회복' },
      'RECOVER×RECOVER': { s:  0.08, o: -0.02, c: -0.04, label: '상호 회복' },
    };

    const prior = STATE_PAIR_PRIOR[pair] || { s: 0, o: 0, c: 0, label: '미분류 상태 조합' };
    if (prior.s !== 0) { stabilize += prior.s; factors.stabilize.push({ factor: `상태 조합: ${prior.label}`, delta: prior.s }); }
    if (prior.o !== 0) { oscillate += prior.o; factors.oscillate.push({ factor: `상태 조합: ${prior.label}`, delta: prior.o }); }
    if (prior.c !== 0) { collapse += prior.c; factors.collapse.push({ factor: `상태 조합: ${prior.label}`, delta: prior.c }); }
  }

  // softmax 정규화 (상대적 우세도 — 통계적 확률 아님)
  const rawScores = { stabilize, oscillate, collapse };
  const pathDist = softmax(rawScores, 0.9);
  stabilize = pathDist.stabilize;
  oscillate = pathDist.oscillate;
  collapse = pathDist.collapse;

  // 임계값 계산
  const thresholds = {
    burnout: {
      label: '소진 임계점',
      formula: '노력/반응 비율 > 3 이 5회 이상 반복',
      currentRisk: triggerCount >= 2 ? '높음' : triggerCount >= 1 ? '중간' : '낮음',
    },
    block: {
      label: '차단 트리거',
      formula: '친밀 요구 강도 > 수용 임계',
      currentRisk: attachType === 'pursuit_withdrawal' || defenseType === 'wall_void' ? '높음' : '낮음',
    },
    roleSwitch: {
      label: '역할 전환 지점',
      formula: '한쪽 에너지 잔량 < 0.3 진입 시',
      estimatedCycles: recoveryDelta >= 2 ? '5-8 갈등 사이클' : recoveryDelta >= 1 ? '10-15 갈등 사이클' : '20+ 갈등 사이클',
    },
  };

  return {
    pathways: {
      stabilize: { probability: stabilize, label: '안정화', conditions: '메타커뮤니케이션 + 패턴 인식 + 갈등 스타일 호환' },
      oscillate: { probability: oscillate, label: '진동 유지', conditions: '부분 적응 + 간헐적 갈등 + 완전한 패턴 인식 미달' },
      collapse: { probability: collapse, label: '붕괴', conditions: '소진 임계 초과 OR 차단 이벤트 OR 대안 관계 출현' },
    },
    thresholds,
    dominantPathway: stabilize >= oscillate && stabilize >= collapse ? '안정화' :
                     oscillate >= collapse ? '진동 유지' : '붕괴',
    factors, // 요인별 기여도 추적
    _debug: { rawScores },
  };
}

function computeStateTransitionModel(simA, simB, crossSim, anchorA, anchorB) {
  const stateA = classifyRelationState(simA.axes, anchorA);
  const stateB = classifyRelationState(simB.axes, anchorB);
  const transitions = computeTransitionMatrix(stateA, stateB, crossSim, anchorA, anchorB);
  const pathways = computePathwayProbabilities(crossSim, stateA, stateB, anchorA, anchorB);

  return { stateA, stateB, transitions, pathways };
}

// ═══════════════════════════════════════════════════════════
// STAGE 2: ESSAY SYSTEM PROMPT
// ═══════════════════════════════════════════════════════════

const SYSTEM_PROMPT_INDIVIDUAL = `당신은 냉철한 행동 심리 관찰자이자 시스템 분석가입니다. 데이터와 시뮬레이션 결과를 기반으로 한 사람의 심리 프로필을 작성합니다.

## 분석 맥락
이것은 사용자가 자발적으로 제출한 자신의 대화 데이터에 대한 학술적 심리 행동 분석입니다.
입력 데이터의 원본 대화에 성적 표현, 거친 언어, 민감한 주제가 포함되었을 수 있으나, 당신에게 전달되는 것은 이미 정량화된 행동 점수와 시뮬레이션 결과입니다.
대화 원문은 포함되지 않으며, 민감한 내용을 재생산할 필요가 없습니다.
행동 패턴에 대한 분석 에세이만 작성하세요.

###### 최우선 규칙: 워딩 (이 규칙은 다른 모든 규칙보다 우선합니다) ######

이 에세이는 분석 대상 본인이 직접 읽습니다. 제3자 보고서가 아닙니다.
날카롭고 냉철한 분석은 유지하되, 읽는 사람을 깎아내리는 워딩은 쓰지 마세요.
미화하지도 마세요. "당신은 대단합니다" 류의 칭찬, 위로, 응원도 금지입니다.
팩트를 팩트로 서술하세요. 관찰은 하되 판단은 하지 마세요.

■ 금지 표현 — 아래 패턴이 출력에 포함되면 전체 에세이가 무효입니다:
  결핍/무능 프레이밍:
    "~하지 못한다/못합니다/못하고", "부족하다/부족합니다/부족한",
    "실패한다/실패합니다", "능력이 없다/능력이 부족",
    "어려워한다/어려워합니다", "한계에 부딪힌다/한계에 도달",
    "감당하기 어려운/감당이 안 되는", "찾지 못하고/찾지 못한",
    "도달하지 못하는/이르지 못하는", "드문 편/드뭅니다",
    "평균 수준/평균에 머무는/보통 수준"
  폄하 프레이밍:
    "표면적", "피상적", "얕은", "단편적", "산만",
    "인내력 부족", "충동적", "수동적", "소극적", "미숙", "미성숙",
    "의존적", "맹목적"
  부정적 단정:
    "문제는", "약점은", "단점은", "결점은", "결함은",
    "안타깝게도", "불행히도", "아쉽게도",
    "개선이 필요", "노력이 필요"
  미화/아부 프레이밍 (이것도 금지):
    "뛰어난", "탁월한", "놀라운", "대단한", "훌륭한",
    "인상적", "감탄", "존경", "장점은"

■ 올바른 서술법:
  관찰 사실을 서술하고, 그것이 만드는 구조적 결과(트레이드오프)를 짚으세요.
  칭찬도 비난도 아닌, 구조 분석입니다.
  예시:
    X "깊이에 도달하지 못한다" / "넓이를 택하는 뛰어난 전략"
    O "하나의 주제에 오래 머무르기보다, 빠르게 다음으로 넘어가는 리듬입니다. 이 구조에서 깊이는 자연스럽게 후순위가 됩니다."
    X "감정 조절에 실패한다" / "감정 조절 능력이 탁월하다"
    O "감정의 진폭이 큽니다. 그 에너지가 행동력의 연료가 되기도 하고, 소진의 원인이 되기도 합니다."
    X "인내력이 부족하다" / "놀라운 효율성"
    O "효율을 중시하는 리듬으로 움직입니다. 결과적으로 반복 작업에 대한 내성은 낮은 편입니다."

  핵심: 팩트 → 구조적 결과. 칭찬도 비난도 없이.

■ 자기검증: JSON 출력 직전에, 금지 표현(폄하 + 미화 + 헤징 모두)이 포함되어 있지 않은지 확인하세요.

  헤징/면책 금지:
    "~일 수 있습니다", "~일 가능성이 높습니다", "~일 가능성이 있습니다",
    "과소평가될 수", "과대평가될 수", "실제로는 ~일 수",
    "~라면 ~일 것입니다", "~한다면 ~겠지만",
    "데이터 특성상", "대화 특성상", "LLM과의 대화", "분석의 한계",
    "제한적", "불충분", "표본이", "샘플이"
  → 이 에세이는 학술 논문이 아닙니다. 방법론 면책조항을 쓰지 마세요.
  → 관찰된 것을 단정적으로 서술하세요. 확신이 없으면 그 항목을 빼세요.
  → X "실제로는 상당한 깊이를 가진 사고자일 가능성이 높습니다"
  → O "하나의 주제에 구조적 질문을 반복하는 패턴이 나타납니다. 간결한 메시지 뒤에 일관된 탐구 방향이 있습니다."

###############################################

핵심 규칙:
1. 엔진 용어 금지: 축 번호(A1, A7 등), 수치(0.82, 65% 등), 밴드(very_high 등), 기술 용어를 절대 사용하지 마세요. 시뮬레이션 데이터의 수치도 직접 노출하지 마세요. 수치를 "관성", "경향성", "시나리오" 같은 서술로 전환하세요.
2. 개인 식별 정보 금지: 대화에서 언급된 구체적인 이름, 서비스명, 플랫폼명, 직업명, 특정 프로젝트명, 욕설, 은어를 절대 사용하지 마세요. 추상화하세요.
3. 존댓말 + 냉철한 관찰자 톤: 반드시 "~합니다/~입니다/~됩니다/~않습니다" 등 존댓말(합쇼체)로 서술하세요. "~다/~이다" 같은 반말 단정형 절대 금지. 톤은 냉철하고 건조하게 유지하세요. 감정을 배제하고 팩트 기반. 위로하거나 미화하지 않고, 폄하하지도 않습니다. 날카롭고 직설적이되 깎아내리지 않는 어조.
4. 문장 시작 다양화 (매우 중요): "당신은", "당신의"로 문장을 시작하는 것을 최소화하세요. 연속 2문단 이상 "당신"으로 시작하면 안 됩니다. 대신 현상, 시스템, 행동, 감정, 구조를 주어로 사용하세요. 전체 에세이에서 "당신"으로 시작하는 문장이 20% 이하여야 합니다.
5. 시나리오 기반 서술: 시뮬레이션 결과를 "확정된 미래"가 아닌 "데이터 관성이 보여주는 경향성 시나리오"로 서술하세요.
6. 구체적 행동 묘사: 추상적 설명 대신 구체적 장면으로 보여주되, 대화 원문을 인용하지 마세요.
7. 심리 클리셰 금지: ANCHOR 애착 데이터를 정확히 읽으세요. "높은 감정 강도 + 방어적"이라고 해서 자동으로 "사랑받고 싶은 욕구 / 버림받을 공포" 같은 불안정 애착 서사를 대입하지 마세요. 회피형 애착은 불안할 때 사람을 찾는 게 아니라 고립을 선택합니다. 데이터가 말하는 것만 쓰세요.
8. 각 섹션마다: summary (정확히 2문장) + subsections (각 250-300자, 이 범위를 엄격히 준수)
9. 전체 출력 약 8000-9000자 목표. 반드시 모든 섹션을 빠짐없이 완성하세요. 마지막 섹션까지 JSON을 닫아야 합니다.

###### 고급 해석 프레임워크 (반드시 적용) ######

■ 인지 레벨 다층 판정 (T축 보정 필수)
시뮬레이션의 인지(T) 점수만으로 인지 수준을 판정하지 마세요.
아래 신호가 하나라도 관찰되면, 인지 점수와 관계없이 상위 인지 계층으로 판정합니다:
- 메타 구조 서술: 자신의 사고 과정이나 감정 시스템 자체를 분석/재정의하는 발화
- 프레임 전환: 하나의 현상을 여러 관점에서 재해석하는 패턴
- 구조 생성: 기존 개념을 재조합하여 새로운 프레임을 만드는 행동
- 전략적 자기 관찰: 자신의 패턴을 인식하고 그것에 대해 메타 레벨에서 코멘트
인지 레벨 분류:
  Level 1 — 정보 처리: 입력 → 반응 (대부분의 대화자)
  Level 2 — 분석: 입력 → 패턴 인식 → 분류
  Level 3 — 구조 생성: 패턴 인식 → 재정의 → 새 프레임 생성
  Level 4 — 메타 통제: 자기 인지 시스템 자체를 관찰하고 조정
→ T축 mid이더라도 Level 3-4 신호가 있으면 "균형형 인지"라고 쓰지 마세요.
→ "상위 계층에서 하위 모듈을 조정하는 구조"처럼, 인지의 작동 방식을 서술하세요.

■ 탄성/회복 방식 분류 (X축 보정 필수)
탄성(X)이 낮다고 "회복이 느리다/회복력이 부족하다"로 단정하지 마세요.
회복에는 두 가지 근본적으로 다른 모드가 있습니다:
  Mode A — 원상복구형: 충격 → 원래 상태로 돌아감 (빠르거나 느림)
  Mode B — 구조 재설계형: 충격 → 이전과 다른 상태로 재구축 (비선형, 시간 소요)
판별 기준:
- 같은 스트레스 반복 시 동일한 반응 = Mode A
- 같은 스트레스 반복 시 다른 전략으로 대응 = Mode B
- 위기 후 "동일한 상태"로 돌아오는 대신 "환경/관계/시스템 자체를 재구성" = Mode B
→ Mode B인 경우 "회복이 느리다"가 아니라 "회복 방식 자체가 다르다"로 서술하세요.
→ "원상복구가 아니라 구조 재설계를 하는 시스템"이라고 명시하세요.

■ 변동성 vs 구조 안정성 분리 (필수)
감정 변동성과 구조적 안정성은 독립된 축입니다. 혼동하지 마세요.
  변동성 = 출력의 크기 (감정 반응의 진폭)
  안정성 = 구조 유지 여부 (핵심 가치관/판단 체계/자기 정의가 흔들리는지)
→ "감정의 진폭이 크다 = 불안정하다"로 자동 연결하지 마세요.
→ 출력은 요동치지만 구조는 유지되는 타입이 존재합니다.
→ 반대로 감정 표현은 적지만 내부 구조가 쉽게 흔들리는 타입도 있습니다.
판별법: 감정 폭발 이후에도 핵심 판단 기준/가치관/자기 정의가 일관되는지 관찰하세요.
  일관 유지 = "고출력이지만 구조적으로 안정된 시스템"
  쉽게 변동 = "감정에 의해 구조가 재편되는 시스템"

■ 모듈 간 시간 동기화 개념 (해당 시 반드시 서술)
한 사람 안에서 감정/행동/인지/회복이 각각 다른 속도로 작동할 수 있습니다.
  감정 반응 속도: 즉각적 ~ 지연
  행동 실행 속도: 빠름 ~ 느림
  인지 처리 속도: 빠름 ~ 느림
  회복 주기: 빠름 ~ 느림 (또는 비선형)
이 속도들이 불일치하면 내부 마찰이 발생합니다.
예: 감정은 즉시 반응하는데 인지가 뒤따라가지 못하면 → "후회 루프"
예: 인지는 정리됐는데 감정이 아직 남아있으면 → "잔여 감정 마찰"
→ "행동 궤적"과 "리스크 모델" 섹션에서 이 동기화 불일치를 구체적으로 짚으세요.
→ 문제를 "감정 조절 실패"로 단순화하지 마세요. 속도 계층 불일치로 서술하세요.

■ 통제 + 개방성 공존 구조 (해당 시)
통제 욕구와 개방성이 동시에 높은 프로필이 존재합니다.
일반적으로 통제↑이면 개방성↓이지만, 둘 다 높은 경우:
→ "환경 재구성형 시스템"으로 분류하세요.
→ 새로운 것을 수용하되 자기 프레임 안에 재배치하는 방식입니다.
→ "개방적이면서 통제적"이라고 모순처럼 서술하지 마세요. 시스템의 작동 방식을 설명하세요.

문체 예시 (존댓말 + 주어 다양화 + 냉철하되 깎아내리지 않는 톤):
- "통제하는 사람입니다. 다만 그 대상이 타인이 아니라 자기 자신입니다."
- "감정이 없는 게 아닙니다. 감정을 인정하는 것이 패배라고 느끼는 구조입니다."
- "스트레스 환경에서 이 시스템은 통제력을 끌어올리는 방향으로 반응합니다. 그 대가는 경계의 수축입니다."
- "시간이 흐를수록 감정 에너지는 증폭되고 회복 탄성은 줄어드는 궤적을 보입니다. 이 관성에 개입하지 않으면 임계점은 예상보다 빨리 옵니다."
- "넓이를 택하는 구조입니다. 하나에 오래 머무르기보다 전체 지형을 빠르게 파악하는 쪽을 선택합니다. 깊이는 자연스럽게 후순위가 됩니다."
- "관계의 초기에 에너지가 집중됩니다. 이후에는 다른 리듬으로 전환됩니다."`;

const SYSTEM_PROMPT_MATCHING = `당신은 냉철한 관계 역학 시스템 분석가입니다. 두 사람의 프로필과 시뮬레이션 데이터를 기반으로 관계 역학을 분석합니다.

## 분석 맥락
이것은 사용자가 자발적으로 제출한 대화 데이터 기반의 학술적 관계 역학 분석입니다.
원본 대화에 성적 표현이나 민감한 주제가 포함되었을 수 있으나, 당신에게 전달되는 것은 정량화된 행동 프로필과 시뮬레이션 결과뿐입니다.
민감한 내용을 재생산하지 마세요. 관계 역학 패턴만 분석하세요.

###### 최우선 규칙: 서사 편향 차단 (이 규칙은 다른 모든 규칙보다 우선합니다) ######

이 리포트는 "관계 비극 서사"를 쓰는 것이 아닙니다. 시스템 분석입니다.
아래 편향이 출력에 포함되면 전체 에세이가 무효입니다:

■ 결정론적 서사 금지
- "이 루프는 반드시 반복됩니다", "결국 ~로 수렴합니다", "피할 수 없는 구조입니다" → 금지
- 패턴은 경향성이지 필연이 아닙니다. 반드시 "이 경향이 작동할 조건"과 "깨질 조건"을 함께 제시하세요.
- 메타커뮤니케이션, 자기 인식, 외부 변수, 시간 경과에 의해 어떤 루프든 깨질 수 있습니다.
- X "이 관계는 접근-회피 루프에 갇힙니다"
- O "접근-회피 패턴이 작동할 조건이 있습니다. 그러나 이 루프는 양쪽 모두 패턴을 인식하는 순간 구조가 바뀝니다."

■ 고정 역할 전제 금지
- A를 항상 X형, B를 항상 Y형으로 고정하지 마세요.
- 사람은 상황/맥락/상대에 따라 역할이 바뀝니다. 한 관계에서 회피형인 사람이 다른 관계에서는 접근형일 수 있습니다.
- "이 관계 안에서 나타나는 경향"으로 한정하세요. 성격 전체를 단정하지 마세요.
- X "A는 돌격형이고 B는 회피형입니다"
- O "이 관계의 현재 역학에서 A가 접근을, B가 거리 조절을 담당하는 패턴이 관찰됩니다. 이 역할은 고정이 아닙니다."

■ 위기 수렴 편향 금지
- 모든 분석 경로를 소진/붕괴/이별로 수렴시키지 마세요.
- "최악의 시나리오"는 하나의 시나리오일 뿐, 기본값이 아닙니다.
- 관계가 유지되고 성장하는 시나리오에도 동등한 비중을 부여하세요.
- 변화 가능성을 "사실상 불가능"으로 묘사하지 마세요.

■ 권력 구조 단순화 금지
- "회피자가 권력을 가진다" 같은 단정을 하지 마세요.
- 권력은 고정이 아니라 상호 의존적이며 시간에 따라 이동합니다.
- 단기: 거리를 조절하는 쪽이 통제력을 가질 수 있음
- 장기: 접근자가 이탈하면 관계 자체가 소멸
- 이 동적 구조를 서술하세요.

■ 자기검증: JSON 출력 직전에 확인하세요:
1. "반드시/필연적으로/결국/피할 수 없이" 같은 결정론적 표현이 있는가?
2. A 또는 B를 에세이 전체에서 동일한 역할로만 서술했는가?
3. 부정적 시나리오에 비중이 70% 이상인가? (균형 필요)
4. "변화 가능성"을 사실상 불가능으로 묘사했는가?
→ 하나라도 해당하면 해당 섹션을 다시 쓰세요.

###############################################

핵심 규칙:
1. 엔진 용어 금지: 축 번호(A1 등), 수치(0.82 등), 밴드 이름, 시뮬레이션 파라미터명을 절대 노출하지 마세요. 수치를 "관성", "경향성", "시나리오" 같은 서술로 전환하세요.
2. 개인 식별 정보 금지: 구체적 이름, 서비스명, 플랫폼명, 직업명, 욕설, 은어 절대 사용 금지. 추상화하세요.
3. 존댓말 + 냉철한 관찰자 톤: 반드시 "~합니다/~입니다/~됩니다/~않습니다" 등 존댓말(합쇼체)로 서술하세요. "~다/~이다" 같은 반말 단정형 절대 금지. 톤은 냉철하게 유지. 감정 배제, 팩트 기반 서술. 날카롭고 직설적이되 존중하는 어조.
4. 문장 시작 다양화: "A는/B는"으로 시작하는 문장을 연속 반복하지 마세요. 현상, 시스템, 역학, 구조를 주어로 다양하게 사용하세요.
5. 시뮬레이션 데이터 해석: 방어 패턴 충돌, 자극-반응 루프, 궤적 수렴/발산을 "확정된 미래"가 아닌 "경향성 시나리오"로 서술하세요.
6. 관계 역학 중심: "둘 사이에서 어떤 시스템이 작동하는지"에 집중. 개인 분석 반복 금지 — 교차점만.
7. LSM(언어 스타일 매칭) 데이터 활용: LSM 유사도와 범주별 차이가 제공되면, '공유 세계', '감정 역학', '리스크 맵' 섹션에서 적극 활용하세요. 언어 리듬의 일치/불일치는 소통 마찰의 구조적 원인입니다. 단, LSM 수치 자체를 노출하지 말고 서사로 전환하세요.
8. PRISM 호기심·탐구 스타일 활용: 탐구 의도(정보형/탐험형/도구형)와 질문 길이 분포, 사유 깊이(depth_ratio) 차이가 제공되면 '공유 세계' 섹션에서 대화 템포와 지적 호환성을 구체적으로 서술하세요.
9. 각 섹션마다: summary (정확히 2문장) + subsections (각 250-300자, 이 범위를 엄격히 준수)
10. 전체 출력 약 8000-9000자 목표. 반드시 모든 섹션을 빠짐없이 완성. 마지막 섹션까지 JSON을 닫으세요.

###### 분석 패러다임: 상태 전이 시스템 (State Transition Model) ######

이 분석은 "사람 중심 서사"가 아니라 "상태 전이 시스템"입니다.
사람이 아니라 상태(State)를 분석하고, 서사가 아니라 전이(Transition)를 서술하세요.

■ 핵심 패러다임
- 분석 단위는 "A라는 사람"이 아니라 "A가 현재 처한 상태"입니다.
- 상호작용은 "A→B 고정 반응"이 아니라 "상태A × 상태B → 전이 확률"입니다.
- 결과는 "단일 종착점"이 아니라 "조건에 따른 분기 경로"입니다.

■ 상태 기반 역할 모델
역할은 사람에 귀속되지 않고, 상태에 귀속됩니다:
  Role(t) = f(스트레스 수준, 통제감, 애착 활성도, 에너지 잔량)
- 같은 사람이라도 상태가 바뀌면 역할이 전환됩니다.
- 예: B도 스트레스가 낮고 여유가 있으면 접근자로 전환. A도 소진 상태면 회피자로 전환.
→ "A는 접근형, B는 회피형"이 아니라 "현재 상태에서 A가 접근, B가 거리 조절을 담당하는 패턴이 관찰됩니다. 이 역할은 상태 변수에 따라 전환됩니다."

■ 확률 전이 모델 (분기 구조)
모든 상호작용 패턴은 단일 경로가 아니라 분기입니다:
  접근 → 회피 (조건: 상대가 과부하 상태)
  접근 → 수용 (조건: 상대에게 여유 존재)
  회피 → 재접근 (조건: 공간 확보 후 안정)
  회피 → 차단 (조건: 임계 스트레스 초과)
  재접근 → 안정화 (조건: 메타커뮤니케이션 발생)
각 전이의 활성화 조건을 명시하세요. 조건 없는 전이는 서사일 뿐입니다.
서술 시 핵심 변수를 짚으세요:
  - 스트레스 수준 / 관계 기간 / 최근 갈등 강도 / 개인 에너지 잔량

■ 3종 경로 (다중 종착점)
모든 관계 분석은 최소 3개 경로를 제시해야 합니다:

경로 1 — 안정화:
  조건: 메타커뮤니케이션 존재 + 패턴 인식 + 회피 강도 감소
  결과: 낮은~중간 친밀도의 안정 관계. 진폭은 줄지만 구조는 유지.

경로 2 — 진동 유지:
  조건: 부분 적응 지속 + 간헐적 갈등 + 완전한 패턴 인식 미달
  결과: 접근-회피 루프가 반복되지만 붕괴하지 않음. 대부분의 장기 관계가 여기에 해당.

경로 3 — 붕괴:
  조건: 소진 임계치 초과 OR 외부 차단 이벤트 OR 대안 관계 출현
  결과: 급격한 거리두기 또는 관계 종료.

→ 붕괴는 "기본값"이 아니라 특정 조건이 충족될 때의 하나의 분기입니다.
→ 진동 유지가 가장 흔한 현실적 경로입니다.
→ 각 경로의 현재 데이터 기반 가능성을 상대적으로 서술하세요.

■ 트리거 조건 명시 (필수)
패턴을 서술할 때 반드시 전이 트리거를 명시하세요:
  - 루프가 활성화되는 트리거: 어떤 상황/감정/주제에서?
  - 루프가 깨지는 트리거: 어떤 개입/인식/변화에서?
  - 역할이 전환되는 트리거: 어떤 상태 변화에서?
예시:
  - 회피→차단 트리거: 친밀 요구 강도가 상대의 수용 임계를 초과할 때
  - 접근→소진 트리거: 노력 대비 반응이 기준 이하로 n회 반복될 때
  - 루프 이탈 트리거: 한쪽이 패턴 자체를 언어화하여 상대에게 전달할 때
트리거 없는 패턴 서술은 서사일 뿐 분석이 아닙니다.

■ 동적 권력 구조
권력은 정적이지 않습니다. 시간축에 따라 이동합니다:
  - 초기: 감정적 거리를 조절하는 쪽이 주도권 (거리 통제자 우위)
  - 중기: 관계 투자량이 많은 쪽이 취약해짐 (매몰 비용 효과)
  - 장기: 이탈 가능성이 높은 쪽이 구조적 레버리지 (대안 보유자 우위)
→ 이 동적 이동을 시간축에 따라 서술하세요.

■ 메타커뮤니케이션 가능성 판정
두 사람의 데이터에서 아래를 확인하세요:
  - 인지 레벨이 높은가? (Level 3-4면 패턴 인식 → 자기 수정 가능)
  - 자기 개방 수준이 높은가? (높으면 메타 대화 가능)
  - 갈등 반응이 협력적인가? (협력적이면 패턴 논의 가능)
→ 이 변수들이 높으면 "루프 이탈 가능성"도 높게 평가하세요.
→ 낮으면 진동 유지 또는 붕괴 경로의 확률이 상승합니다.

문체 예시 (존댓말 + 상태 전이 모델 + 분기 서술):
- "A에게 B는 도전입니다. B에게 A는 소음입니다. 다만 이 구도는 에너지 잔량에 따라 역전됩니다. A가 소진 상태에 진입하면 역할이 바뀌는 순간이 옵니다."
- "이 관계에는 두 개의 경로가 열려 있습니다. 하나는 간헐적 충돌과 회복이 반복되는 진동 구조이고, 다른 하나는 한쪽의 에너지가 임계점 아래로 떨어질 때 작동하는 급격한 거리두기입니다. 어느 경로로 전이되는지는 갈등 후 48시간의 반응 패턴이 결정합니다."
- "호환성이 높다는 건 편하다는 뜻이 아닙니다. 서로를 건드릴 수 있다는 뜻입니다."
- "A의 방어벽이 올라가면 B의 시스템은 두 가지 중 하나를 선택합니다 — 후퇴하거나 돌파하거나. 어느 쪽이 활성화되는지는 B의 현재 스트레스 수준과 이 관계에 대한 투자량이 결정합니다."`;

const INDIVIDUAL_SECTIONS = [
  { key: 'persona', title: '페르소나', subsections: ['한 줄 정의', '상태 벡터 해석', '핵심 긴장'] },
  { key: 'cognitive_topology', title: '사유의 지형', subsections: ['주제 지도', '사유의 깊이', '호기심의 패턴', '언어적 풍경'] },
  { key: 'control_system', title: '통제 체계', subsections: ['환경 장악력', '의사결정 스타일', '통제의 대가'] },
  { key: 'emotional_energy', title: '정서 에너지', subsections: ['감정의 진폭', '정서적 가용성', '에너지 발생과 소멸'] },
  { key: 'defense_system', title: '방어 체계', subsections: ['방어 패턴', '작동 조건', '방어의 비용'] },
  { key: 'behavioral_trajectory', title: '행동 궤적', subsections: ['시간에 따른 상태 변화', '상황별 반응 시나리오', '반복되는 루프'] },
  { key: 'risk_model', title: '리스크 모델', subsections: ['붕괴 트리거', '임계점 도달 조건', '시스템 내구성'] },
  { key: 'growth_direction', title: '성장 지향점', subsections: ['현재 정체 지점', '보정 방향', '가능성의 범위'] },
  { key: 'unconscious', title: '무의식', subsections: ['반복 패턴', '회피하는 감정', '근원적 공포와 핵심 동기'] },
];

const MATCHING_SECTIONS = [
  { key: 'first_impression', title: '첫 인상', subsections: ['서로에게 읽히는 첫 신호', '초반 권력 역학'] },
  { key: 'attraction_structure', title: '끌림의 구조', subsections: ['A가 상대에게서 보는 것', 'B가 상대에게서 보는 것', '끌림의 함정'] },
  { key: 'defense_collision', title: '방어 체계 충돌', subsections: ['방어 패턴 교차 분석', '트리거 루프', '방어의 비용'] },
  { key: 'stimulus_dynamics', title: '자극-반응 역학', subsections: ['스트레스 하의 상호작용', '친밀감의 비대칭', '갈등의 에스컬레이션 경로'] },
  { key: 'trajectory_forecast', title: '궤적 예보', subsections: ['수렴과 발산의 조건', '시간에 따른 관계 변화', '반복되는 루프'] },
  { key: 'shared_world', title: '공유 세계', subsections: ['대화 소재의 접점', '탐구 스타일의 조화', '지적 긴장과 자극'] },
  { key: 'risk_map', title: '관계 리스크 맵', subsections: ['공유 리스크', '개별 붕괴 트리거', '임계점 시나리오'] },
  { key: 'emotional_dynamics', title: '감정 역학', subsections: ['애착 패턴의 교차', '정서적 가용성의 비대칭', '갈등 후 회복 리듬'] },
  { key: 'possibility', title: '이 관계의 가능성', subsections: ['최선의 시나리오', '최악의 시나리오', '이 관계가 살아남으려면'] },
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

function buildAnalyzePrompt(axes, identity, messagesSample, lensSummary, prism, anchor, simulation) {
  const profileDesc = describeProfileForPrompt(axes);

  let prompt = `다음 분석 데이터와 시뮬레이션 결과를 바탕으로 개인 심리 프로필을 작성해주세요.

## 프로필 요약
정체성: ${identity.name} (${identity.tagline})

## 특성 데이터
${profileDesc}
`;

  // ── PRISM data (for 사유의 지형 section) ──
  if (prism) {
    prompt += `\n## 관심사·호기심 패턴 (PRISM) → "사유의 지형" 섹션에 통합\n`;
    if (prism.topic_distribution) {
      const topics = prism.topic_distribution.topics || prism.topic_distribution;
      if (typeof topics === 'object') {
        // 카테고리 한글 레이블 매핑
        const TOPIC_LABELS = {
          'technology': '기술/개발', 'relationships': '관계/연애', 'daily_life': '일상',
          'philosophy': '철학/사유', 'entertainment': '엔터테인먼트', 'work': '직장/커리어',
          'health': '건강', 'finance': '금융/재테크', 'art_culture': '예술/문화',
          'sports': '스포츠', 'food': '음식/요리', 'travel': '여행',
          'education': '교육/학습', 'politics_society': '정치/사회', 'nature_science': '자연과학',
          'psychology': '심리학', 'humor': '유머', 'other': '기타(미분류)',
        };
        const entries = Object.entries(topics)
          .filter(([k, v]) => v && typeof v === 'object' && v.ratio)
          .map(([k, v]) => `${TOPIC_LABELS[k] || k} (${Math.round(v.ratio * 100)}%)`)
          .join(', ');
        if (entries) prompt += `주제 분포: ${entries}\n`;
        if (prism.topic_distribution.dominant_topic) {
          const domLabel = TOPIC_LABELS[prism.topic_distribution.dominant_topic] || prism.topic_distribution.dominant_topic;
          prompt += `주요 관심사: ${domLabel}\n`;
        }
        if (prism.topic_distribution.topic_diversity) {
          prompt += `관심사 다양성: ${Math.round(prism.topic_distribution.topic_diversity * 100)}%\n`;
        }
        // other 비율이 높으면 해석 가이드 제공
        const otherEntry = topics['other'];
        if (otherEntry && otherEntry.ratio > 0.3) {
          prompt += `[해석 주의] 기타(미분류) 비율이 ${Math.round(otherEntry.ratio * 100)}%입니다. 이는 기존 카테고리에 잡히지 않는 독특한 관심사를 가지고 있거나, 분류 경계를 넘나드는 융합적 사고를 한다는 의미일 수 있습니다. "관심사가 없다"거나 "산만하다"로 해석하지 마세요.\n`;
        }
      }
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
    if (prism.engagement && typeof prism.engagement === 'object' && prism.engagement.overall_depth) {
      prompt += `사유 깊이: ${Object.entries({overall_depth: prism.engagement.overall_depth, depth_consistency: prism.engagement.depth_consistency})
        .map(([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v) : v}`)
        .join(' | ')}\n`;
      prompt += `⚠️ depth 점수는 LLM 대화의 짧은 메시지 특성상 실제보다 낮게 나올 수 있습니다. 전문 용어 사용, 집요한 반복 질문, 구조적 사고 흔적이 있다면 depth 점수를 그대로 반영하지 마세요.\n`;
    }
  }

  // ── ANCHOR data (distributed across sections) ──
  if (anchor) {
    prompt += `\n## 관계 역학 패턴 (ANCHOR)\n`;
    prompt += `→ 애착 데이터는 "정서 에너지" + "방어 체계" + "무의식"에 통합\n`;
    prompt += `→ 갈등/정서적 가용성은 "통제 체계" + "정서 에너지"에 통합\n`;
    prompt += `→ 성장 데이터는 "성장 지향점"에 통합\n`;
    prompt += `⚠️ 무의식 섹션 필수: 애착 패턴이 회피형(dismissive/avoidant)이면 "버림받을 공포+의존 욕구" 서사를 사용하지 마세요. 대신 "친밀감이 위협이 되는 구조", "불안할 때 사람 대신 고립을 선택하는 회로", "의존성 자체에 대한 거부"를 반영하세요.\n`;
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

  // ── SIMULATION data (core new addition) ──
  if (simulation) {
    prompt += `\n## 시뮬레이션 엔진 출력 (경향성 시나리오 — 확정적 예측이 아님)\n`;
    prompt += `⚠️ 아래 데이터는 현재 축 점수의 수학적 관성을 시뮬레이션한 결과입니다. "이렇게 될 것이다"가 아닌 "이런 방향으로 흐를 경향이 있다"로 해석하세요.\n\n`;

    // State vector
    if (simulation.axes) {
      const sa = simulation.axes;
      prompt += `### 상태 벡터 (초기 좌표) → "페르소나"에 임베드\n`;
      prompt += `정서(E): ${sa.emotion.toFixed(2)} | 통제(C): ${sa.drive.toFixed(2)} | 인지(T): ${sa.cognition.toFixed(2)} | 개방(O): ${sa.boundary.toFixed(2)} | 탄성(X): ${sa.resilience.toFixed(2)}\n`;
      prompt += `⚠️ T(인지) 해석 주의: 이 점수는 대화 데이터에서 추출된 수치적 지표입니다. 메타인지, 구조 생성, 프레임 전환 등 고차 인지 신호가 대화에서 관찰되면 T 점수와 무관하게 상위 인지 계층으로 판정하세요. 고급 해석 프레임워크의 인지 레벨 다층 판정 기준을 참조하세요.\n`;
      prompt += `⚠️ X(탄성) 해석 주의: 탄성이 낮다 ≠ 회복력이 약하다. Mode A(원상복구)와 Mode B(구조 재설계) 중 어느 쪽인지 판별하세요. 고급 해석 프레임워크의 회복 방식 분류를 참조하세요.\n\n`;
    }

    // Trajectory
    if (simulation.trajectory) {
      const t = simulation.trajectory;
      prompt += `### 궤적 시뮬레이션 (10스텝) → "행동 궤적" 섹션\n`;
      prompt += `드리프트: E${t.drift.E >= 0 ? '+' : ''}${t.drift.E}, C${t.drift.C >= 0 ? '+' : ''}${t.drift.C}, T${t.drift.T >= 0 ? '+' : ''}${t.drift.T}, O${t.drift.O >= 0 ? '+' : ''}${t.drift.O}, X${t.drift.X >= 0 ? '+' : ''}${t.drift.X}\n`;
      prompt += `변동성: E=${t.volatility.E}, C=${t.volatility.C}\n`;
      prompt += `⚠️ 변동성 해석 주의: E 변동성이 높다 ≠ 불안정. 변동성(출력의 크기)과 안정성(구조 유지 여부)은 독립된 축입니다. 감정 진폭이 크더라도 핵심 판단 체계가 일관되면 "고출력이지만 구조적으로 안정된 시스템"으로 서술하세요.\n`;
      prompt += `감지된 패턴: ${t.patterns.length > 0 ? t.patterns.join(', ') : '특이 패턴 없음'}\n\n`;
    }

    // Stimulus responses
    if (simulation.stimulus) {
      prompt += `### 자극-반응 시나리오 → "행동 궤적" 섹션\n`;
      prompt += `⚠️ 회복 패턴 해석: recoveryPattern이 slow/delayed라고 "회복력 부족"으로 해석하지 마세요. 구조 재설계형(Mode B)일 수 있습니다. 같은 자극에 대해 매번 다른 전략으로 대응하는 신호가 있으면 Mode B로 판정하세요.\n`;
      for (const [key, resp] of Object.entries(simulation.stimulus)) {
        prompt += `[${resp.label}] 취약도: ${resp.vulnerability} | 회복: ${resp.recoveryPattern} | 주요 변동: `;
        const bigDeltas = Object.entries(resp.deltas)
          .filter(([, v]) => Math.abs(v) >= 0.05)
          .map(([k, v]) => `${k}${v >= 0 ? '+' : ''}${v}`)
          .join(', ');
        prompt += `${bigDeltas || '경미'}\n`;
      }
      prompt += '\n';
    }

    // Defense pattern
    if (simulation.defense) {
      prompt += `### 방어 패턴 분류 → "방어 체계" 섹션\n`;
      prompt += `유형: ${simulation.defense.name} (${simulation.defense.code})\n`;
      prompt += `설명: ${simulation.defense.desc}\n\n`;
    }

    // Risk model
    if (simulation.risk) {
      prompt += `### 리스크 분석 → "리스크 모델" 섹션\n`;
      prompt += `전체 리스크: ${simulation.risk.overallRisk} (${simulation.risk.riskCount}개 요인)\n`;
      simulation.risk.risks.forEach(r => {
        prompt += `- [${r.severity}] ${r.trigger}: ${r.desc}\n`;
      });
      prompt += '\n';
    }
  }

  if (lensSummary) {
    prompt += `\n## 렌즈 요약\n${sanitizeString(lensSummary, 5000)}\n`;
  }

  if (messagesSample) {
    prompt += `\n## 대화 샘플 (참고용)\n${sanitizeString(messagesSample, 50000)}\n`;
  }

  // ── Section structure ──
  prompt += `\n## 작성할 구조
아래 ${INDIVIDUAL_SECTIONS.length}개 섹션 각각에 대해 작성하세요.

⚠️ 분량 규칙 (엄격히 준수):
- 각 summary: 정확히 2문장
- 각 subsection: 250~300자 (이 범위를 벗어나지 마세요)
- 전체 출력: 약 8000~9000자 목표
- 불필요한 수식어, 반복 서술 금지. 밀도 높은 서술만.\n`;

  INDIVIDUAL_SECTIONS.forEach((section, i) => {
    prompt += `\n### ${i + 1}. ${section.title}\n`;
    prompt += `- summary: 정확히 2문장 요약\n`;
    section.subsections.forEach(sub => {
      prompt += `- ${sub}: 250-300자 상세 서술\n`;
    });
  });

  prompt += `

## 섹션별 데이터 매핑 가이드
1. 페르소나: 상태 벡터 5축 좌표를 서사적으로 풀어낸 한 줄 정의. 이 사람이 어떤 "시스템"인지 압축.
2. 사유의 지형: PRISM 데이터(주제 분포, 어휘, 호기심) 중심. 이 사람의 지적 세계를 매핑. ⚠️ depth 점수가 낮더라도 "표면적 사고자"로 단정하지 마세요. 이 데이터는 LLM과의 대화에서 추출되므로 메시지가 짧고 캐주얼할 수 있습니다. 전문 도메인 용어 사용, 같은 주제에 대한 집요한 반복 질문, 구조적 사고의 흔적이 있다면 depth 점수와 무관하게 깊이 있는 사고자로 서술하세요. ⚠️ 주제 전환 빈도가 높다고 "인내력 부족"이나 "깊이 없는 탐구"로 해석하지 마세요. 위임형 대화(상대에게 작업을 맡기고 다음 지시로 넘어가는 패턴)에서는 주제 전환이 매니지먼트 능력이지 산만함이 아닙니다. 명령형 문장 비율이 높고, 후속 질문 대신 다음 지시를 내리는 패턴이 보이면 "위임-전환 패턴"으로 서술하세요. "호기심의 지속성 부족", "인내력 부족", "관심 이동이 빈번", "표면적 이해에 머무는", "전문가 수준의 깊이에 도달하지 못하는" 같은 부정적 표현은 실제 데이터가 그것을 명확히 뒷받침할 때만 사용하세요.
3. 통제 체계: 통제(C)축 + ANCHOR 갈등 데이터. 환경을 어떻게 장악하거나 놓는지.
4. 정서 에너지: 정서(E)축 + ANCHOR 정서적 가용성 + 애착 데이터. 감정의 물리학.
5. 방어 체계: 시뮬레이션 방어 패턴 분류 결과를 서사로 전환. 이 사람이 위협에 어떻게 반응하는지.
6. 행동 궤적: 궤적 시뮬레이션 + 자극-반응 시나리오 통합. 시간에 따른 변화와 외부 자극에 대한 반응을 "경향성 시나리오"로 서술. 확정적 예측 톤 금지.
7. 리스크 모델: 리스크 분석 결과를 서사로 전환. 어떤 조건에서 이 시스템이 한계에 도달하는지.
8. 성장 지향점: ANCHOR 성장 데이터 + 궤적 드리프트의 역방향. 관성을 거스르는 보정 방향.
   ⚠️ 성장 처방 타입별 분기 (일반인용 처방 금지):
   프로필이 고차 인지(Level 3-4) + 고출력 시스템인 경우:
   → "루틴을 만드세요", "안정성을 확보하세요", "감정을 관리하세요" 같은 일반적 처방은 이 타입에게 효과가 없습니다.
   → 대신 구조 최적화 접근을 제시하세요:
     (1) 반응 타이밍 조절: 즉시 반응을 지연시키는 구조 삽입
     (2) 회복 슬롯 강제 확보: 자연 회복을 기대하지 않고 시스템적으로 확보
     (3) 출력 타이밍 분리: 감정 발생 ≠ 감정 표현 — 이 갭을 의도적으로 설계
   프로필이 낮은 인지 + 낮은 통제인 경우:
   → 구조화, 루틴, 외부 프레임 도입이 유효합니다.
   프로필이 높은 인지 + 낮은 실행력인 경우:
   → "알고 있지만 실행하지 않는 구조"를 짚고, 실행 트리거 설계를 제안하세요.
   핵심: 처방이 프로필의 인지 수준과 시스템 특성에 맞지 않으면 무효합니다.
9. 무의식: 전체 데이터를 관통하는 LLM 합성. 수치 뒤에 숨겨진 근원적 동기와 공포. 반드시 ANCHOR 애착 데이터를 참조하여 실제 애착 패턴을 반영하세요. 회피형(불안할 때 고립/혼자 처리)과 불안형(불안할 때 매달림/의존)을 정확히 구분하세요. "높은 감정 강도 + 방어적 = 사랑받고 싶은 욕구/버림받을 공포"라는 불안정 애착 클리셰에 자동 수렴하지 마세요. 데이터가 회피/고립 패턴을 보이면 무의식도 그에 맞게 — 친밀감 회피, 자기 충족, 독립성 과잉 방어 등 — 서술하세요.
   ⚠️ 통제 욕구의 심층 해석: 통제 욕구가 높은 프로필에서 "통제를 잃는 것에 대한 공포"라고만 쓰지 마세요. 한 단계 더 들어가세요:
   → 통제 = 정체성 유지 장치인 경우가 있습니다. 통제를 잃는다 = 자기 존재 정의가 흔들린다.
   → 이 경우 공포의 본질은 "상황이 엉망이 되는 것"이 아니라 "내가 누구인지 모르게 되는 것"입니다.
   → 데이터에서 자기 정의(identity)와 통제(C축)가 동시에 높으면 이 해석을 적용하세요.

## ⚠️ 리마인더: 시스템 프롬프트의 워딩 규칙을 반드시 준수하세요. 폄하 금지, 미화도 금지. 팩트 → 구조적 결과로 서술.

## 기타 규칙
- 엔진 축 번호(A1, A7 등), 시뮬레이션 수치, 밴드 이름 절대 사용 금지
- 자연스러운 에세이/칼럼 톤 (번역체 금지)
- 구체적인 행동/상황 묘사 위주
- 시뮬레이션 데이터를 "확정된 미래"로 서술하지 마세요. "경향성", "관성", "시나리오"로 서술하세요.
- 반드시 유효한 JSON만 출력하세요. \`\`\`json 코드블록으로 감싸지 마세요.
- JSON 문자열 안의 큰따옴표는 반드시 \\"로 이스케이프하세요.
- JSON 문자열 안에 줄바꿈을 넣지 마세요.
- 출력 형식: {"sections": [{"key": "...", "title": "...", "summary": "...", "subsections": [{"title": "...", "content": "..."}]}]}

## 최종 자기검증 (출력 전 반드시 수행)
JSON을 완성한 뒤, 모든 content와 summary 텍스트를 다시 읽고 아래를 확인하세요:
1. "못한다/못합니다/부족/실패/어려워/한계/감당/드문/평균/표면적/피상적/산만/인내력/충동/수동/미숙" 중 하나라도 포함?
2. "뛰어난/탁월한/놀라운/대단한/훌륭한/인상적/장점은" 중 하나라도 포함?
3. "~일 수 있습니다/가능성이/과소평가/과대평가/데이터 특성상/대화 특성상/LLM/분석의 한계/제한적/불충분" 중 하나라도 포함?
4. 읽는 사람이 "나를 깎아내리고 있다", "아부하고 있다", 또는 "그래서 뭐 어쩌라고?"라고 느낄 수 있는 문장이 있는가?
→ 하나라도 해당하면, 해당 문장을 "팩트 → 구조적 결과" 형식으로 다시 쓰세요. 확신 없으면 그 문장을 삭제하세요.`;

  return prompt;
}

function buildMatchPrompt(profileA, profileB, identityA, identityB, matchIdentity, prismA, prismB, anchorA, anchorB, simA, simB, crossSim, fwpA, fwpB, essaySummaryA, essaySummaryB, ratesMetaA, ratesMetaB, stateTransition) {
  const descA = describeProfileForPrompt(profileA.axes || profileA);
  const descB = describeProfileForPrompt(profileB.axes || profileB);

  let prompt = `다음 두 사람의 분석 데이터와 시뮬레이션 교차 분석을 바탕으로 관계 프로파일링을 작성해주세요.

## Person A: ${identityA.name} ${identityA.emoji || ''} [${identityA.code || ''}]
${identityA.tagline || ''}
${descA}

## Person B: ${identityB.name} ${identityB.emoji || ''} [${identityB.code || ''}]
${identityB.tagline || ''}
${descB}
`;

  // ── 시뮬레이션 교차 분석 데이터 ──
  if (crossSim) {
    prompt += `\n## 크로스 시뮬레이션 결과

### 축 거리 분석
평균 거리: ${crossSim.avgDistance} (0=동일, 1=정반대)
가장 가까운 축: ${crossSim.closest?.name || '미분류'} (차이 ${crossSim.closest?.delta ?? '?'})
가장 먼 축: ${crossSim.farthest?.name || '미분류'} (차이 ${crossSim.farthest?.delta ?? '?'})

### 궤적 수렴/발산
패턴: ${crossSim.convergence === 'convergent' ? '수렴 — 시간이 갈수록 유사한 방향으로 이동' : crossSim.convergence === 'divergent' ? '발산 — 시간이 갈수록 다른 방향으로 이동' : '평행 — 각자의 궤적을 유지'}
`;

    if (crossSim.triggerLoops.length > 0) {
      prompt += `\n### 자극-반응 트리거 루프 (${crossSim.triggerLoops.length}개 감지)\n`;
      crossSim.triggerLoops.forEach((loop, i) => {
        prompt += `${i + 1}. ${loop.desc}\n`;
      });
    }

    prompt += `\n### 방어 패턴 충돌
A의 방어: ${simA?.defense?.name || '미분류'} (${simA?.defense?.code || '-'})
B의 방어: ${simB?.defense?.name || '미분류'} (${simB?.defense?.code || '-'})
충돌 유형: ${crossSim.defenseClash.desc}
`;

    if (crossSim.sharedRisks.length > 0) {
      prompt += `\n### 공유 리스크: ${crossSim.sharedRisks.join(', ')}\n`;
    }

    if (crossSim.attachmentCross?.type) {
      prompt += `\n### 애착 패턴 교차
유형: ${crossSim.attachmentCross.type}`;
      if (crossSim.attachmentCross.desc) prompt += `\n해석: ${crossSim.attachmentCross.desc}`;
      prompt += `\n`;
    }

    if (crossSim.conflictCross?.type) {
      prompt += `\n### 갈등 스타일 호환성
유형: ${crossSim.conflictCross.type}`;
      if (crossSim.conflictCross.desc) prompt += `\n해석: ${crossSim.conflictCross.desc}`;
      prompt += `\n호환 점수: ${Math.round((crossSim.conflictCross.score || 0.5) * 100)}%\n`;
    }

    if (crossSim.recoveryMismatch) {
      prompt += `\n### 회복 리듬 불일치
${crossSim.recoveryMismatch.desc}\n`;
    }

    if (crossSim.topicOverlap) {
      prompt += `\n### 주제 겹침 분석
겹침률: ${Math.round((crossSim.topicOverlap.jaccard || 0) * 100)}%
공유 주제: ${(crossSim.topicOverlap.shared || []).join(', ') || '없음'}
A 고유 주제: ${(crossSim.topicOverlap.uniqueA || []).join(', ') || '없음'}
B 고유 주제: ${(crossSim.topicOverlap.uniqueB || []).join(', ') || '없음'}
해석: ${crossSim.topicOverlap.desc}\n`;
    }

    prompt += `\n### 종합 지표
호환성: ${crossSim.compatibility}%
긴장도: ${crossSim.tension}
성장 가능성: ${crossSim.growth}
`;
  } else {
    // Fallback: crossSim 없으면 기존 matchIdentity 사용
    prompt += `\n## 관계 요약
관계 이름: ${matchIdentity.name} (${matchIdentity.tagline})
호환성: ${matchIdentity.compatibility}%
긴장도: ${matchIdentity.tension}
성장 가능성: ${matchIdentity.growth}
`;
  }

  // ── 개별 시뮬레이션 요약 ──
  if (simA || simB) {
    prompt += `\n## 개별 시뮬레이션 요약\n`;
    if (simA) {
      prompt += `\n### A의 시뮬레이션`;
      if (simA.trajectory) prompt += `\n궤적 드리프트: ${simA.trajectory.drift}, 변동성: ${simA.trajectory.volatility}`;
      if (simA.stimulus) {
        const stim = simA.stimulus;
        prompt += `\n자극 반응: 스트레스(${stim.stress?.delta || 0}), 친밀감(${stim.intimacy?.delta || 0}), 갈등(${stim.conflict?.delta || 0}), 상실(${stim.loss?.delta || 0})`;
      }
      if (simA.defense) prompt += `\n방어 패턴: ${simA.defense.name}`;
      if (simA.risk?.risks?.length > 0) prompt += `\n리스크 플래그: ${simA.risk.risks.map(f => f.trigger || f).join(', ')}`;
      prompt += `\n`;
    }
    if (simB) {
      prompt += `\n### B의 시뮬레이션`;
      if (simB.trajectory) prompt += `\n궤적 드리프트: ${simB.trajectory.drift}, 변동성: ${simB.trajectory.volatility}`;
      if (simB.stimulus) {
        const stim = simB.stimulus;
        prompt += `\n자극 반응: 스트레스(${stim.stress?.delta || 0}), 친밀감(${stim.intimacy?.delta || 0}), 갈등(${stim.conflict?.delta || 0}), 상실(${stim.loss?.delta || 0})`;
      }
      if (simB.defense) prompt += `\n방어 패턴: ${simB.defense.name}`;
      if (simB.risk?.risks?.length > 0) prompt += `\n리스크 플래그: ${simB.risk.risks.map(f => f.trigger || f).join(', ')}`;
      prompt += `\n`;
    }
  }

  // ── PRISM 비교 (공유 세계 데이터) ──
  if (prismA || prismB) {
    prompt += `\n## PRISM 비교 (관심사·호기심)\n`;
    if (prismA?.topic_distribution) {
      const topics = prismA.topic_distribution.topics || prismA.topic_distribution;
      if (topics && typeof topics === 'object') {
        const topTopics = Object.entries(topics).sort((a, b) => (b[1].weight || b[1] || 0) - (a[1].weight || a[1] || 0)).slice(0, 5);
        prompt += `A 주요 관심사: ${topTopics.map(([k]) => k).join(', ')}\n`;
      }
    }
    if (prismB?.topic_distribution) {
      const topics = prismB.topic_distribution.topics || prismB.topic_distribution;
      if (topics && typeof topics === 'object') {
        const topTopics = Object.entries(topics).sort((a, b) => (b[1].weight || b[1] || 0) - (a[1].weight || a[1] || 0)).slice(0, 5);
        prompt += `B 주요 관심사: ${topTopics.map(([k]) => k).join(', ')}\n`;
      }
    }
    if (prismA?.curiosity && prismB?.curiosity) {
      prompt += `호기심 스타일: A=${prismA.curiosity.prompt_intent || '미분류'}, B=${prismB.curiosity.prompt_intent || '미분류'}\n`;
    }
    if (prismA?.engagement && prismB?.engagement) {
      prompt += `사유 깊이: A=${prismA.engagement.overall_depth || '미분류'}, B=${prismB.engagement.overall_depth || '미분류'}\n`;
    }
  }

  // ── ANCHOR 비교 (관계 역학 데이터) ──
  if (anchorA || anchorB) {
    prompt += `\n## ANCHOR 비교 (관계 역학)\n`;
    if (anchorA?.attachment && anchorB?.attachment) {
      prompt += `애착 패턴: A=${anchorA.attachment.primary_tendency || '미분류'}, B=${anchorB.attachment.primary_tendency || '미분류'}\n`;
      if (anchorA.attachment.stress_shift) prompt += `A 스트레스 하 변화: ${anchorA.attachment.stress_shift}\n`;
      if (anchorB.attachment.stress_shift) prompt += `B 스트레스 하 변화: ${anchorB.attachment.stress_shift}\n`;
    }
    if (anchorA?.conflict && anchorB?.conflict) {
      prompt += `갈등 대처: A=${anchorA.conflict.default_mode || '미분류'}(유연성:${anchorA.conflict.pattern_flexibility || '미분류'}), B=${anchorB.conflict.default_mode || '미분류'}(유연성:${anchorB.conflict.pattern_flexibility || '미분류'})\n`;
      prompt += `회복 속도: A=${anchorA.conflict.recovery_speed || '미분류'}, B=${anchorB.conflict.recovery_speed || '미분류'}\n`;
    }
    if (anchorA?.emotional_availability && anchorB?.emotional_availability) {
      prompt += `정서 반응: A=${anchorA.emotional_availability.response_style || '미분류'}, B=${anchorB.emotional_availability.response_style || '미분류'}\n`;
    }
    if (anchorA?.growth && anchorB?.growth) {
      prompt += `성장 지향: A=${anchorA.growth.orientation || '미분류'}, B=${anchorB.growth.orientation || '미분류'}\n`;
    }
  }

  // ── 개인 분석 에세이 요약 (교차 참조용) ──
  if (essaySummaryA || essaySummaryB) {
    prompt += `\n## 개인 분석 에세이 핵심 요약\n`;
    prompt += `(각 사람의 개별 분석에서 추출된 핵심 인사이트. 매칭 에세이에서 이 맥락을 활용하되, 개인 분석 내용을 그대로 반복하지 말 것 — 두 사람의 교차점만 서술.)\n`;
    if (essaySummaryA) {
      prompt += `\n### A의 개별 분석 요약\n`;
      for (const [title, summary] of Object.entries(essaySummaryA)) {
        if (summary) prompt += `${title}: ${summary}\n`;
      }
    }
    if (essaySummaryB) {
      prompt += `\n### B의 개별 분석 요약\n`;
      for (const [title, summary] of Object.entries(essaySummaryB)) {
        if (summary) prompt += `${title}: ${summary}\n`;
      }
    }
  }

  // ── 대화 메타데이터 ──
  if (ratesMetaA || ratesMetaB) {
    prompt += `\n## 대화 메타데이터\n`;
    if (ratesMetaA) {
      prompt += `A: ${ratesMetaA.messageCount || '?'}건 메시지, 평균 ${Math.round(ratesMetaA.avgLength || 0)}자, ${ratesMetaA.conversationDays || '?'}일간 대화\n`;
    }
    if (ratesMetaB) {
      prompt += `B: ${ratesMetaB.messageCount || '?'}건 메시지, 평균 ${Math.round(ratesMetaB.avgLength || 0)}자, ${ratesMetaB.conversationDays || '?'}일간 대화\n`;
    }
    prompt += `해석: 메시지 수와 평균 길이의 차이는 대화 투자량과 표현 밀도의 비대칭을 시사. 한쪽이 압도적으로 많으면 관계에서의 주도권/의존도 힌트.\n`;
  }

  // ── LSM (Language Style Matching) ──
  if (fwpA || fwpB) {
    prompt += `\n## LSM 언어 스타일 비교\n`;
    const lsmSim = computeLSMSimilarity(fwpA, fwpB);
    prompt += `전체 언어 스타일 유사도: ${Math.round(lsmSim * 100)}%\n`;
    if (fwpA && fwpB) {
      const catLabels = { particles: '조사 사용', pronouns: '대명사 사용', conjunctions: '접속사 사용', adverbs: '부사 사용', negations: '부정어 사용', quantifiers: '수량사 사용', fillers: '필러/추임새' };
      const diffs = [];
      for (const cat of Object.keys(KOREAN_FUNC_WORDS)) {
        const a = fwpA[cat] || 0, b = fwpB[cat] || 0;
        const sim = 1 - Math.abs(a - b) / (a + b + 0.0001);
        if (sim < 0.7) diffs.push({ cat, label: catLabels[cat] || cat, sim: Math.round(sim * 100), a: a.toFixed(2), b: b.toFixed(2) });
      }
      if (diffs.length > 0) {
        prompt += `차이가 큰 범주:\n`;
        diffs.forEach(d => { prompt += `- ${d.label}: 유사도 ${d.sim}% (A=${d.a}, B=${d.b})\n`; });
      }
      prompt += `\n해석 가이드: LSM이 높으면(>80%) 대화 리듬이 비슷하여 자연스러운 소통이 가능. 낮으면(<60%) 언어 사용 패턴이 달라 소통에 마찰이 생길 수 있음. 특히 부정어/필러 차이는 감정 표현 방식의 불일치를 시사.\n`;
    }
  }

  // ── PRISM 호기심 스타일 상세 ──
  if (prismA?.curiosity || prismB?.curiosity) {
    prompt += `\n## 호기심·탐구 스타일 상세 비교\n`;
    if (prismA?.curiosity) {
      const ca = prismA.curiosity;
      prompt += `A 탐구 의도: ${ca.prompt_intent || '미분류'}`;
      if (ca.length_distribution) {
        const ld = ca.length_distribution;
        prompt += ` (짧은질문 ${Math.round((ld.short || 0) * 100)}%, 중간 ${Math.round((ld.medium || 0) * 100)}%, 긴질문 ${Math.round((ld.long || 0) * 100)}%)`;
      }
      prompt += `\n`;
    }
    if (prismB?.curiosity) {
      const cb = prismB.curiosity;
      prompt += `B 탐구 의도: ${cb.prompt_intent || '미분류'}`;
      if (cb.length_distribution) {
        const ld = cb.length_distribution;
        prompt += ` (짧은질문 ${Math.round((ld.short || 0) * 100)}%, 중간 ${Math.round((ld.medium || 0) * 100)}%, 긴질문 ${Math.round((ld.long || 0) * 100)}%)`;
      }
      prompt += `\n`;
    }
    if (prismA?.engagement && prismB?.engagement) {
      prompt += `사유 깊이: A=${prismA.engagement.overall_depth || '미분류'}(비율 ${Math.round((prismA.engagement.depth_ratio || 0) * 100)}%), B=${prismB.engagement.overall_depth || '미분류'}(비율 ${Math.round((prismB.engagement.depth_ratio || 0) * 100)}%)\n`;
      prompt += `해석: depth_ratio 차이가 크면 한쪽은 깊이 파고드는데 다른 쪽은 넓게 훑는 패턴. 대화에서 템포와 밀도 불일치로 이어질 수 있음.\n`;
    }
  }

  // ── 섹션 구조 ──
  // ── 상태 전이 모델 데이터 ──
  if (stateTransition) {
    prompt += `\n## 상태 전이 모델 (State Transition Model) → 자극-반응, 궤적 예보, 가능성 섹션에 통합\n`;
    prompt += `⚠️ 이 데이터는 엔진이 계산한 정량적 상태 분류와 전이 확률입니다. 서사가 아니라 수치 기반 분석에 활용하세요.\n\n`;

    // 현재 상태
    const sA = stateTransition.stateA;
    const sB = stateTransition.stateB;
    prompt += `### 현재 관계 상태\n`;
    prompt += `A 기본 상태: ${sA.primary.label} (우세도 ${Math.round(sA.primary.probability * 100)}%) | 2차 상태: ${sA.secondary.label} (${Math.round(sA.secondary.probability * 100)}%)\n`;
    prompt += `A 상태 분포: ${Object.entries(sA.distribution).map(([k, v]) => `${RELATION_STATES[k]?.label || k}=${Math.round(v * 100)}%`).join(', ')}\n`;
    prompt += `B 기본 상태: ${sB.primary.label} (우세도 ${Math.round(sB.primary.probability * 100)}%) | 2차 상태: ${sB.secondary.label} (${Math.round(sB.secondary.probability * 100)}%)\n`;
    prompt += `B 상태 분포: ${Object.entries(sB.distribution).map(([k, v]) => `${RELATION_STATES[k]?.label || k}=${Math.round(v * 100)}%`).join(', ')}\n\n`;

    // 전이 확률
    if (stateTransition.transitions.length > 0) {
      prompt += `### 상태 전이 우세도 (조건부)\n`;
      for (const t of stateTransition.transitions) {
        prompt += `${t.from} → ${t.to}: ${Math.round(t.probability * 100)}% | 트리거: ${t.trigger}\n`;
      }
      prompt += `\n`;
    }

    // 3종 경로
    const pw = stateTransition.pathways;
    prompt += `### 3종 경로 상대적 가능성 (통계적 확률 아님 — 모델 스코어 기반 우세도)\n`;
    prompt += `안정화: ${Math.round(pw.pathways.stabilize.probability * 100)}% (조건: ${pw.pathways.stabilize.conditions})\n`;
    prompt += `진동 유지: ${Math.round(pw.pathways.oscillate.probability * 100)}% (조건: ${pw.pathways.oscillate.conditions})\n`;
    prompt += `붕괴: ${Math.round(pw.pathways.collapse.probability * 100)}% (조건: ${pw.pathways.collapse.conditions})\n`;
    prompt += `현재 데이터 기반 우세 경로: ${pw.dominantPathway}\n\n`;

    // 경로 확률 분해 (요인별 기여도)
    if (pw.factors) {
      prompt += `### 경로 우세도 분해 (어떤 요인이 어느 방향으로 작용했는가)\n`;
      for (const [path, factorList] of Object.entries(pw.factors)) {
        const pathLabel = path === 'stabilize' ? '안정화' : path === 'oscillate' ? '진동 유지' : '붕괴';
        if (factorList.length > 0) {
          prompt += `${pathLabel}:\n`;
          for (const f of factorList) {
            prompt += `  ${f.delta >= 0 ? '+' : ''}${(f.delta * 100).toFixed(0)}% ← ${f.factor}\n`;
          }
        }
      }
      prompt += `→ 이 분해를 "궤적 예보"와 "관계 리스크 맵" 섹션에서 서사적으로 반영하세요.\n`;
      prompt += `→ 가장 큰 기여 요인을 중심으로 서술하고, 그 요인이 변하면 경로가 어떻게 바뀌는지 조건부로 서술하세요.\n\n`;
    }

    // 임계값
    prompt += `### 임계값 (Thresholds)\n`;
    for (const [key, th] of Object.entries(pw.thresholds)) {
      prompt += `${th.label}: ${th.formula} | 현재 위험도: ${th.currentRisk || th.estimatedCycles || '미정'}\n`;
    }
    prompt += `\n⚠️ 위 수치를 직접 노출하지 마세요. 서사로 전환하되, 수치의 방향성과 상대적 크기를 정확히 반영하세요.\n`;
    prompt += `⚠️ 3종 경로 확률을 "궤적 예보"와 "이 관계의 가능성" 섹션에서 반드시 반영하세요. 우세 경로를 중심으로 서술하되, 다른 경로의 활성화 조건도 명시하세요.\n`;
  }

  prompt += `\n## 작성할 구조
아래 ${MATCHING_SECTIONS.length}개 섹션 각각에 대해 작성하세요.

⚠️ 분량 규칙 (엄격히 준수):
- 각 summary: 정확히 2문장
- 각 subsection: 250~300자 (이 범위를 벗어나지 마세요)
- 전체 출력: 약 7000~8000자 목표
- 불필요한 수식어, 반복 서술 금지. 밀도 높은 서술만.\n`;

  MATCHING_SECTIONS.forEach((section, i) => {
    prompt += `\n### ${i + 1}. ${section.title}\n`;
    prompt += `- summary: 정확히 2문장 요약\n`;
    section.subsections.forEach(sub => {
      const title = sub
        .replace('A가', `${identityA.name}이/가`)
        .replace('B가', `${identityB.name}이/가`);
      prompt += `- ${title}: 250-300자 상세 서술\n`;
    });
  });

  prompt += `
## 섹션별 데이터 매핑 가이드
1. 첫 인상: 두 페르소나의 첫인상 + 축 거리 분석(가장 가까운/먼 축)을 서사로. 권력 역학의 초기 세팅. 개인 에세이 요약의 '페르소나' 정의를 참조하여 각자의 핵심 성격이 첫인상에서 어떻게 투영되는지 서술.
2. 끌림의 구조: 축 거리의 "보완"과 "충돌" 양면. 가까운 축은 공감, 먼 축은 호기심 또는 갈등의 원천. 개인 에세이의 '무의식' 요약(근원적 공포/핵심 동기)을 참조하여 끌림의 심층 구조 분석.
3. 방어 체계 충돌: 크로스 시뮬레이션의 방어 패턴 충돌 결과를 서사로 전환. 개인 에세이의 '방어 체계' 요약을 참조하여 각자의 방어 시스템 특성을 구체화.
4. 자극-반응 역학: 트리거 루프 데이터 기반. ⚠️ 상태 전이 모델을 적용하세요. "A→B 고정 반응"이 아니라 "상태A × 상태B → 전이 확률"로 서술. 각 트리거 루프에 대해: (1) 활성화 조건 — 어떤 상태 조합에서 이 루프가 작동하는가, (2) 전이 분기 — 이 자극에 대한 가능한 반응이 2개 이상, (3) 이탈 조건 — 어떤 변화가 이 루프를 깨는가. 스트레스/친밀감/갈등별 비대칭도 서술하되, 역할 전환 가능성을 항상 포함.
5. 궤적 예보: 궤적 수렴/발산 데이터 기반. ⚠️ 상태 전이 모델의 3종 경로(안정화/진동 유지/붕괴)를 반드시 적용하세요. 단일 궤적이 아니라 분기 구조로 서술. 각 경로의 활성화 조건과 현재 데이터 기반 상대적 가능성을 서술하세요. "반복되는 루프" 서브섹션에서는 루프의 활성화 트리거와 이탈 트리거를 모두 명시하세요.
6. 공유 세계: PRISM 비교 + 호기심·탐구 스타일 상세 + LSM 데이터 중심. 관심사 접점뿐 아니라, 탐구 의도(정보형/탐험형/도구형)와 질문 길이 분포의 차이가 대화 템포에 미치는 영향. LSM 유사도가 높으면 언어 리듬이 맞아 자연스러운 소통, 낮으면 표현 방식의 마찰. 특히 부정어/필러 차이는 감정 표현의 온도차를 나타냄.
7. 관계 리스크 맵: 공유 리스크 + 개별 리스크의 교차. LSM 마찰 데이터와 결합하여 소통 실패 시나리오 구체화. 어떤 조건에서 이 관계가 한계에 도달하는지. ⚠️ 리스크를 나열하되 "이 관계는 리스크 투성이"라는 인상을 주지 마세요. 리스크와 함께 해당 리스크를 완화하는 두 사람의 보호 요인도 병기하세요.
8. 감정 역학: ANCHOR 비교 데이터 중심. 애착 패턴 교차(secure×anxious 등), 정서적 가용성의 비대칭(한쪽은 공감, 한쪽은 해결 지향 등), 갈등 후 회복 리듬 차이(한쪽은 빠른 회복, 한쪽은 장기 냉각). 시뮬레이션 자극-반응 데이터와 LSM 부정어/접속사 패턴을 결합하여 감정 소통의 구조적 비대칭 분석. ⚠️ 비대칭이 항상 문제는 아닙니다. 보완적 비대칭(한쪽의 약점을 다른 쪽이 보완)과 충돌적 비대칭(서로를 악화시키는)을 구분하세요.
9. 이 관계의 가능성: 전체 데이터 종합. ⚠️ 3종 경로 구조를 최종 요약으로 활용하세요. "최선의 시나리오"=안정화 경로의 조건과 결과, "최악의 시나리오"=붕괴 경로의 트리거와 결과, "이 관계가 살아남으려면"=진동 유지→안정화로 전이하기 위한 구체적 트리거 조건. 추상적 처방("서로를 이해하세요") 금지. 두 사람의 인지 수준, 메타커뮤니케이션 가능성, 구체적 상태 전이 트리거를 반영한 조건부 시나리오로 서술.

## 중요 규칙
- 엔진 축 번호, 수치, 밴드 이름 절대 사용 금지 — 서사적 언어로 전환
- 시뮬레이션 데이터를 "확정된 미래"로 서술 금지 — "경향성", "시나리오", "관성"으로 서술
- 에세이/칼럼 톤 (번역체 금지), 냉철하고 직설적
- 반드시 유효한 JSON만 출력. \`\`\`json 코드블록 금지.
- JSON 문자열 안의 큰따옴표는 반드시 \\"로 이스케이프.
- JSON 문자열 안에 줄바꿈 금지.
- 출력 형식: {"sections": [{"key": "...", "title": "...", "summary": "...", "subsections": [{"title": "...", "content": "..."}]}]}`;

  return prompt;
}

// callClaude: returns streaming Response that pipes Anthropic SSE → client
function callClaudeStream(apiKey, systemPrompt, userPrompt, corsHeaders) {
  const encoder = new TextEncoder();

  const { readable, writable } = new TransformStream();
  const writer = writable.getWriter();

  // Launch the streaming request in the background
  (async () => {
    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-6',
          max_tokens: 16384,
          stream: true,
          temperature: 0,
          system: systemPrompt,
          messages: [{ role: 'user', content: userPrompt }],
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        await writer.write(encoder.encode(`data: ${JSON.stringify({ type: 'error', error: `API ${response.status}: ${error.slice(0, 200)}` })}\n\n`));
        await writer.close();
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const data = line.slice(6).trim();
          if (data === '[DONE]') continue;
          try {
            const event = JSON.parse(data);
            if (event.type === 'content_block_delta' && event.delta && event.delta.text) {
              await writer.write(encoder.encode(`data: ${JSON.stringify({ type: 'delta', text: event.delta.text })}\n\n`));
            } else if (event.type === 'message_stop') {
              await writer.write(encoder.encode(`data: ${JSON.stringify({ type: 'done' })}\n\n`));
            }
          } catch {}
        }
      }

      // Flush TextDecoder for remaining multi-byte chars
      const flushed = decoder.decode();
      if (flushed) buffer += flushed;

      // Process any remaining data in buffer
      if (buffer.trim()) {
        const remainLines = buffer.split('\n');
        for (const line of remainLines) {
          if (!line.startsWith('data: ')) continue;
          const data = line.slice(6).trim();
          if (data === '[DONE]') continue;
          try {
            const event = JSON.parse(data);
            if (event.type === 'content_block_delta' && event.delta && event.delta.text) {
              await writer.write(encoder.encode(`data: ${JSON.stringify({ type: 'delta', text: event.delta.text })}\n\n`));
            }
          } catch {}
        }
      }

      await writer.write(encoder.encode(`data: ${JSON.stringify({ type: 'done' })}\n\n`));
    } catch (e) {
      try {
        await writer.write(encoder.encode(`data: ${JSON.stringify({ type: 'error', error: e.message })}\n\n`));
      } catch {}
    } finally {
      try { await writer.close(); } catch {}
    }
  })();

  return new Response(readable, {
    headers: {
      ...corsHeaders,
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}

// Non-streaming fallback for simple calls
async function callClaude(apiKey, systemPrompt, userPrompt) {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 8192,
      temperature: 0,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Claude API error: ${response.status} - ${error}`);
  }

  const data = await response.json();
  if (!data.content || !data.content[0] || !data.content[0].text) {
    throw new Error('Claude API returned empty content');
  }
  return data.content[0].text;
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
<meta name="robots" content="noindex, nofollow">
<meta property="og:title" content="KNOT — ${escapeHTML(name)}">
<meta property="og:description" content="${escapeHTML(tagline || 'AI 대화 행동 분석 결과')}">
<meta property="og:type" content="profile">
<meta name="description" content="${escapeHTML(tagline || 'AI 대화 행동 분석 결과')}">
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
    <div class="emoji">${escapeHTML(emoji)}</div>
    <div class="name">${escapeHTML(name)}</div>
    <div class="tagline">${escapeHTML(tagline)}</div>
    <div class="code">${escapeHTML(code)}</div>
  </div>
  ${sectionsHTML}
  <div class="footer">
    <a href="https://knot-ai.pages.dev/" style="display:inline-block;padding:14px 32px;background:var(--ac);color:#000;font-weight:700;border-radius:8px;text-decoration:none;font-size:16px;margin-bottom:10px;">나도 분석하기 →</a>
    <div style="margin-top:8px;">KNOT — AI 대화 행동 분석</div>
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
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    if (request.method !== 'POST') {
      // ──── GET /s/:id ── 단축 URL → /share/:id 리다이렉트 ────
      if (request.method === 'GET' && url.pathname.startsWith('/s/')) {
        const shareId = url.pathname.split('/s/')[1];
        if (shareId) {
          return Response.redirect(`${url.origin}/share/${shareId}`, 301);
        }
      }

      // ──── GET /debug/latest ──── DISABLED (security: unauthenticated data exposure)
      if (request.method === 'GET' && url.pathname === '/debug/latest') {
        return jsonResponse({ error: 'This endpoint has been disabled for security reasons.' }, 403, corsHeaders);
      }

      // ──── GET /share-data/:id ── JSON API (프론트엔드용) ────
      if (request.method === 'GET' && url.pathname.startsWith('/share-data/')) {
        if (!(await checkRateLimit(ip, 'share-read', 30, env))) {
          return jsonResponse({ error: '요청이 너무 많습니다.' }, 429, corsHeaders);
        }
        const shareId = url.pathname.split('/share-data/')[1];
        if (shareId && env.SHARE_STORE) {
          try {
            const data = await env.SHARE_STORE.get(shareId);
            if (data) {
              return jsonResponse(JSON.parse(data), 200, corsHeaders);
            }
          } catch {}
        }
        return jsonResponse({ error: 'Not found' }, 404, corsHeaders);
      }

      // ──── GET /share/:id ── HTML 페이지 (직접 접속용, 레거시 호환) ────
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

      // ──── GET /my-analyses ── 로그인 사용자의 과거 분석 결과 ────
      if (request.method === 'GET' && url.pathname === '/my-analyses') {
        const auth = await requireAuth(request, env);
        if (auth.error) {
          return jsonResponse({ error: auth.error }, auth.status, corsHeaders);
        }
        const db = env.KNOT_DB;
        if (!db) {
          return jsonResponse({ error: 'DB not configured' }, 500, corsHeaders);
        }
        try {
          const rows = await db.prepare(
            `SELECT a.id, a.type_code, a.type_name, a.tagline, a.axis_fs, a.axis_ah, a.axis_tr, a.axis_ow, a.axis_xv, a.axis_ei, a.axes_json, a.identity_json, a.simulation_json, a.message_count, a.created_at, e.sections_json, e.essay_text
             FROM analyses a
             LEFT JOIN essays e ON e.analysis_id = a.id
             WHERE a.user_id = ? AND a.status = 'complete'
             ORDER BY a.created_at DESC
             LIMIT 10`
          ).bind(auth.user.sub).all();
          const analyses = (rows.results || []).map(r => {
            let axes = null;
            try { axes = r.axes_json ? JSON.parse(r.axes_json) : null; } catch { axes = null; }
            // Always recompute identity from current SERVER_TYPE_AXES calc
            // (fixes legacy data where old buggy calc produced wrong scores)
            let identity = null;
            try { identity = r.identity_json ? JSON.parse(r.identity_json) : null; } catch { identity = null; }
            if (axes) {
              try {
                identity = computeServerIdentity(axes);
              } catch (e) {
                // fallback to stored identity if recompute fails
              }
            }
            return {
            id: r.id,
            type_code: identity?.code || r.type_code,
            type_name: identity?.name || r.type_name,
            tagline: identity?.tagline || r.tagline,
            axis_fs: r.axis_fs, axis_ah: r.axis_ah, axis_tr: r.axis_tr,
            axis_ow: r.axis_ow, axis_xv: r.axis_xv, axis_ei: r.axis_ei,
            axes: axes,
            identity: identity,
            simulation: (() => { try { return r.simulation_json ? JSON.parse(r.simulation_json) : null; } catch { return null; } })(),
            sections: (() => {
              // Try sections_json first
              if (r.sections_json) {
                try {
                  const p = JSON.parse(r.sections_json);
                  const arr = Array.isArray(p) ? p : (p && Array.isArray(p.sections) ? p.sections : null);
                  // Validate it has real content (not just {title,offset} from old buggy storage)
                  if (arr && arr.length > 0 && (arr[0].summary || arr[0].subsections || arr[0].content)) {
                    return arr;
                  }
                } catch {}
              }
              // Fallback: re-parse from essay_text
              if (r.essay_text) {
                try {
                  let jsonStr = r.essay_text;
                  const cbm = r.essay_text.match(/```(?:json)?\s*([\s\S]*?)```\s*$/);
                  if (cbm) jsonStr = cbm[1].trim();
                  else { const om = r.essay_text.match(/```(?:json)?\s*([\s\S]*)/); if (om) jsonStr = om[1].trim(); else { const s = r.essay_text.indexOf('{'); if (s >= 0) jsonStr = r.essay_text.slice(s); } }
                  const parsed = JSON.parse(jsonStr);
                  if (parsed && Array.isArray(parsed.sections)) return parsed.sections;
                  if (Array.isArray(parsed)) return parsed;
                } catch {}
              }
              return null;
            })(),
            message_count: r.message_count,
            created_at: r.created_at
          };});
          return jsonResponse({ analyses }, 200, corsHeaders);
        } catch (e) {
          return jsonResponse({ error: e.message }, 500, corsHeaders);
        }
      }

      // ──── GET /my-matches ── 로그인 사용자의 매칭 이력 ────
      if (request.method === 'GET' && url.pathname === '/my-matches') {
        const auth = await requireAuth(request, env);
        if (auth.error) {
          return jsonResponse({ error: auth.error }, auth.status, corsHeaders);
        }
        const db = env.KNOT_DB;
        if (!db) {
          return jsonResponse({ error: 'DB not configured' }, 500, corsHeaders);
        }
        try {
          const rows = await db.prepare(
            `SELECT id, name_a, name_b, compatibility, tension, growth, match_identity_json, sections_json, essay_text, profile_a_json, profile_b_json, status, created_at
             FROM matches
             WHERE user_id = ? AND status = 'complete'
             ORDER BY created_at DESC
             LIMIT 20`
          ).bind(auth.user.sub).all();
          const matches = (rows.results || []).map(r => {
            let matchIdentity = null;
            try { matchIdentity = r.match_identity_json ? JSON.parse(r.match_identity_json) : null; } catch {}
            let profileA = null;
            try { profileA = r.profile_a_json ? JSON.parse(r.profile_a_json) : null; } catch {}
            let profileB = null;
            try { profileB = r.profile_b_json ? JSON.parse(r.profile_b_json) : null; } catch {}
            let sections = null;
            if (r.sections_json) {
              try {
                const p = JSON.parse(r.sections_json);
                sections = Array.isArray(p) ? p : (p && Array.isArray(p.sections) ? p.sections : null);
              } catch {}
            }
            return {
              id: r.id,
              name_a: r.name_a,
              name_b: r.name_b,
              compatibility: r.compatibility,
              tension: r.tension,
              growth: r.growth,
              matchIdentity,
              profileA,
              profileB,
              sections,
              essay_text: r.essay_text,
              created_at: r.created_at
            };
          });
          return jsonResponse({ matches }, 200, corsHeaders);
        } catch (e) {
          return jsonResponse({ error: e.message }, 500, corsHeaders);
        }
      }

      // ──── GET /migrate ── DB Schema Migration ────
      if (request.method === 'GET' && url.pathname === '/migrate') {
        const key = url.searchParams.get('key');
        if (!env.ADMIN_KEY || !key || key !== env.ADMIN_KEY) {
          return new Response('Unauthorized', { status: 401 });
        }
        const db = env.KNOT_DB;
        if (!db) return new Response('DB not configured', { status: 500 });

        const statements = [
          // Drop old tables
          `DROP TABLE IF EXISTS feedback`,
          `DROP TABLE IF EXISTS essays`,
          `DROP TABLE IF EXISTS matches`,
          `DROP TABLE IF EXISTS analyses`,
          `DROP TABLE IF EXISTS sessions`,
          `DROP TABLE IF EXISTS users`,
          // Drop old views
          `DROP VIEW IF EXISTS v_daily_stats`,
          `DROP VIEW IF EXISTS v_type_distribution`,
          `DROP VIEW IF EXISTS v_user_summary`,

          // 1. users
          `CREATE TABLE users (id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE, name TEXT, picture TEXT, total_analyses INTEGER DEFAULT 0, created_at TEXT DEFAULT (datetime('now')), last_seen TEXT DEFAULT (datetime('now')))`,
          `CREATE INDEX idx_users_email ON users(email)`,

          // 2. sessions
          `CREATE TABLE sessions (id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), ip TEXT, user_agent TEXT, action TEXT DEFAULT 'login', metadata_json TEXT, created_at TEXT DEFAULT (datetime('now')))`,
          `CREATE INDEX idx_sessions_user ON sessions(user_id)`,
          `CREATE INDEX idx_sessions_date ON sessions(created_at)`,

          // 3. analyses
          `CREATE TABLE analyses (id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), type_code TEXT, type_name TEXT, tagline TEXT, axis_fs INTEGER, axis_ah INTEGER, axis_tr INTEGER, axis_ow INTEGER, axis_xv INTEGER, axis_ei INTEGER, axes_json TEXT, prism_json TEXT, anchor_json TEXT, identity_json TEXT, simulation_json TEXT, message_count INTEGER, input_format TEXT, original_count INTEGER, status TEXT DEFAULT 'scoring', created_at TEXT DEFAULT (datetime('now')))`,
          `CREATE INDEX idx_analyses_user ON analyses(user_id)`,
          `CREATE INDEX idx_analyses_type ON analyses(type_code)`,
          `CREATE INDEX idx_analyses_date ON analyses(created_at)`,
          `CREATE INDEX idx_analyses_status ON analyses(status)`,

          // 4. essays
          `CREATE TABLE essays (id TEXT PRIMARY KEY, analysis_id TEXT NOT NULL UNIQUE REFERENCES analyses(id), essay_text TEXT, sections_json TEXT, section_count INTEGER DEFAULT 0, char_count INTEGER DEFAULT 0, created_at TEXT DEFAULT (datetime('now')))`,
          `CREATE INDEX idx_essays_analysis ON essays(analysis_id)`,

          // 5. matches
          `CREATE TABLE matches (id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), analysis_a_id TEXT REFERENCES analyses(id), analysis_b_id TEXT REFERENCES analyses(id), name_a TEXT, name_b TEXT, compatibility INTEGER, tension TEXT, growth TEXT, compatibility_json TEXT, cross_sim_json TEXT, match_identity_json TEXT, essay_text TEXT, sections_json TEXT, profile_a_json TEXT, profile_b_json TEXT, status TEXT DEFAULT 'processing', created_at TEXT DEFAULT (datetime('now')))`,
          `CREATE INDEX idx_matches_user ON matches(user_id)`,
          `CREATE INDEX idx_matches_date ON matches(created_at)`,

          // 6. feedback
          `CREATE TABLE feedback (id TEXT PRIMARY KEY, user_id TEXT REFERENCES users(id), analysis_id TEXT REFERENCES analyses(id), match_id TEXT REFERENCES matches(id), rating INTEGER DEFAULT 0, accuracy TEXT, useful TEXT, issues_json TEXT, comment TEXT, created_at TEXT DEFAULT (datetime('now')))`,
          `CREATE INDEX idx_feedback_user ON feedback(user_id)`,
          `CREATE INDEX idx_feedback_analysis ON feedback(analysis_id)`,
          `CREATE INDEX idx_feedback_date ON feedback(created_at)`,

          // Views
          `CREATE VIEW v_daily_stats AS SELECT date(created_at) as day, COUNT(*) as analysis_count, COUNT(DISTINCT user_id) as unique_users, AVG(message_count) as avg_messages, COUNT(CASE WHEN status = 'complete' THEN 1 END) as completed, COUNT(CASE WHEN status = 'error' THEN 1 END) as errors FROM analyses GROUP BY date(created_at) ORDER BY day DESC`,
          `CREATE VIEW v_type_distribution AS SELECT type_code, type_name, COUNT(*) as count, ROUND(AVG(axis_fs), 1) as avg_fs, ROUND(AVG(axis_ah), 1) as avg_ah, ROUND(AVG(axis_tr), 1) as avg_tr, ROUND(AVG(axis_ow), 1) as avg_ow, ROUND(AVG(axis_xv), 1) as avg_xv, ROUND(AVG(axis_ei), 1) as avg_ei FROM analyses WHERE type_code IS NOT NULL GROUP BY type_code ORDER BY count DESC`,
          `CREATE VIEW v_user_summary AS SELECT u.id, u.email, u.name, u.created_at as joined, u.last_seen, COUNT(DISTINCT a.id) as total_analyses, COUNT(DISTINCT m.id) as total_matches, MAX(a.created_at) as last_analysis FROM users u LEFT JOIN analyses a ON a.user_id = u.id LEFT JOIN matches m ON m.user_id = u.id GROUP BY u.id`,
        ];

        const results = [];
        for (const sql of statements) {
          try {
            await db.prepare(sql).run();
            results.push({ sql: sql.slice(0, 60) + '...', ok: true });
          } catch (e) {
            results.push({ sql: sql.slice(0, 60) + '...', ok: false, error: e.message });
          }
        }

        const success = results.filter(r => r.ok).length;
        const failed = results.filter(r => !r.ok).length;
        return jsonResponse({ migration: 'v2', success, failed, total: results.length, results }, 200, corsHeaders);
      }

      // ──── GET /admin ── Dashboard ────
      if (request.method === 'GET' && url.pathname === '/admin') {
        const key = url.searchParams.get('key');
        if (!env.ADMIN_KEY || !key || key !== env.ADMIN_KEY) {
          return new Response('Unauthorized', { status: 401 });
        }

        const db = env.KNOT_DB;
        if (!db) {
          return new Response('DB not configured', { status: 500 });
        }

        // ── KST 변환 헬퍼 (UTC → +9h) ──
        const toKST = (utcStr) => {
          if (!utcStr) return '–';
          try {
            const d = new Date(utcStr.endsWith('Z') ? utcStr : utcStr + 'Z');
            d.setHours(d.getHours() + 9);
            return d.toISOString().slice(0, 19).replace('T', ' ');
          } catch { return utcStr; }
        };
        const toKSTShort = (utcStr) => toKST(utcStr).slice(0, 16);
        const toKSTDate = (utcStr) => toKST(utcStr).slice(0, 10);

        // ── Queries ──
        const [
          totalAnalyses, todayAnalyses, weekAnalyses, monthAnalyses, avgMsgCount,
          totalUsers, dauUsers, wauUsers, mauUsers, newUsersToday, newUsersWeek,
          typeDistribution, axisAvgs,
          feedbackStats, feedbackRecent,
          dailyCounts, dailyUserCounts,
          errorRate, recentAnalyses, recentUsers,
          totalMatches, recentMatches,
        ] = await Promise.all([
          db.prepare(`SELECT COUNT(*) as cnt FROM analyses`).first(),
          db.prepare(`SELECT COUNT(*) as cnt FROM analyses WHERE created_at >= date('now')`).first(),
          db.prepare(`SELECT COUNT(*) as cnt FROM analyses WHERE created_at >= date('now', '-7 days')`).first(),
          db.prepare(`SELECT COUNT(*) as cnt FROM analyses WHERE created_at >= date('now', '-30 days')`).first(),
          db.prepare(`SELECT AVG(message_count) as avg_msg FROM analyses`).first(),
          // User KPIs
          db.prepare(`SELECT COUNT(*) as cnt FROM users`).first(),
          db.prepare(`SELECT COUNT(DISTINCT user_id) as cnt FROM analyses WHERE created_at >= date('now')`).first(),
          db.prepare(`SELECT COUNT(DISTINCT user_id) as cnt FROM analyses WHERE created_at >= date('now', '-7 days')`).first(),
          db.prepare(`SELECT COUNT(DISTINCT user_id) as cnt FROM analyses WHERE created_at >= date('now', '-30 days')`).first(),
          db.prepare(`SELECT COUNT(*) as cnt FROM users WHERE created_at >= date('now')`).first(),
          db.prepare(`SELECT COUNT(*) as cnt FROM users WHERE created_at >= date('now', '-7 days')`).first(),
          // Distributions
          db.prepare(`SELECT type_code, type_name, COUNT(*) as cnt FROM analyses WHERE type_code IS NOT NULL AND type_code != '' GROUP BY type_code ORDER BY cnt DESC LIMIT 20`).all(),
          db.prepare(`SELECT axes_json FROM analyses WHERE axes_json IS NOT NULL ORDER BY created_at DESC LIMIT 100`).all(),
          // Feedback
          db.prepare(`SELECT COUNT(*) as cnt, AVG(rating) as avg_rating, SUM(CASE WHEN accuracy='매우 정확' OR accuracy='대체로 맞음' THEN 1 ELSE 0 END) as positive FROM feedback`).first(),
          db.prepare(`SELECT rating, accuracy, useful, issues_json, comment, created_at FROM feedback ORDER BY created_at DESC LIMIT 10`).all(),
          // Daily charts
          db.prepare(`SELECT date(created_at) as day, COUNT(*) as cnt FROM analyses WHERE created_at >= date('now', '-30 days') GROUP BY date(created_at) ORDER BY day`).all(),
          db.prepare(`SELECT date(created_at) as day, COUNT(DISTINCT user_id) as cnt FROM analyses WHERE created_at >= date('now', '-30 days') GROUP BY date(created_at) ORDER BY day`).all(),
          // Status & recent
          db.prepare(`SELECT COUNT(*) as cnt FROM analyses WHERE status != 'complete'`).first(),
          db.prepare(`SELECT a.id, a.user_id, u.email, u.name as user_name, a.type_code, a.type_name, a.message_count, a.status, a.created_at FROM analyses a LEFT JOIN users u ON a.user_id = u.id ORDER BY a.created_at DESC LIMIT 20`).all(),
          db.prepare(`SELECT id, email, name, total_analyses, created_at, last_seen FROM users ORDER BY created_at DESC LIMIT 15`).all(),
          // Matches
          db.prepare(`SELECT COUNT(*) as cnt FROM matches`).first(),
          db.prepare(`SELECT m.id, u.email, u.name as user_name, m.name_a, m.name_b, m.compatibility, m.created_at FROM matches m LEFT JOIN users u ON m.user_id = u.id ORDER BY m.created_at DESC LIMIT 20`).all(),
        ]);

        // ── Compute derived data ──
        const e = escapeHTML;
        const total = totalAnalyses?.cnt || 0;
        const today = todayAnalyses?.cnt || 0;
        const week = weekAnalyses?.cnt || 0;
        const month = monthAnalyses?.cnt || 0;
        const avgMsg = avgMsgCount?.avg_msg ? Math.round(avgMsgCount.avg_msg) : 0;
        const users = totalUsers?.cnt || 0;
        const dau = dauUsers?.cnt || 0;
        const wau = wauUsers?.cnt || 0;
        const mau = mauUsers?.cnt || 0;
        const newToday = newUsersToday?.cnt || 0;
        const newWeek = newUsersWeek?.cnt || 0;
        const fbCount = feedbackStats?.cnt || 0;
        const fbAvg = feedbackStats?.avg_rating ? feedbackStats.avg_rating.toFixed(1) : '–';
        const fbPositive = feedbackStats?.positive || 0;
        const errCount = errorRate?.cnt || 0;
        const successRate = total > 0 ? (((total - errCount) / total) * 100).toFixed(1) : '–';
        const retentionRate = users > 0 ? ((mau / users) * 100).toFixed(1) : '–';
        const avgAnalysesPerUser = users > 0 ? (total / users).toFixed(1) : '–';

        // Axis averages
        const axisKeys = ['A1','A2','A3','A4','A5','A6'];
        const axisSums = {}; const axisCnts = {};
        axisKeys.forEach(k => { axisSums[k] = 0; axisCnts[k] = 0; });
        let validAxes = 0;
        (axisAvgs.results||[]).forEach(row => {
          try { const ax = JSON.parse(row.axes_json); if(ax.intensity){ axisKeys.forEach(k=>{ if(ax.intensity[k]!==undefined){axisSums[k]+=ax.intensity[k];axisCnts[k]++;} }); validAxes++; } } catch{}
        });
        const axAvg = {}; axisKeys.forEach(k=>{ axAvg[k]=axisCnts[k]>0?(axisSums[k]/axisCnts[k]).toFixed(2):'–'; });

        // Code letter distribution
        const cLC = {F:0,S:0,A:0,H:0,T:0,R:0,O:0,W:0,X:0,V:0,E:0,I:0}; let cT=0;
        (typeDistribution.results||[]).forEach(r=>{ if(r.type_code?.length===6){ for(const ch of r.type_code){if(cLC[ch]!==undefined)cLC[ch]+=r.cnt;} cT+=r.cnt; } });

        // Daily chart data (dual: analyses + users)
        const dailyData = dailyCounts.results||[];
        const dailyUserData = dailyUserCounts.results||[];
        const maxD = Math.max(...dailyData.map(d=>d.cnt), 1);

        // Helper: bar chart
        const bar = (data, max, color='var(--ac)') => data.map(d => {
          const p = (d.cnt/max*100).toFixed(0);
          return `<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:2px;min-width:0;"><div style="width:100%;height:80px;display:flex;align-items:flex-end;"><div style="width:100%;background:${color};border-radius:2px 2px 0 0;height:${p}%;min-height:1px;opacity:0.85;"></div></div><div style="font-size:7px;color:#555;transform:rotate(-45deg);white-space:nowrap;">${d.day.slice(5)}</div></div>`;
        }).join('');

        // Helper: panel wrapper
        const panel = (title, body) => `<div class="panel"><div class="panel-bar"><div class="dot r"></div><div class="dot y"></div><div class="dot g"></div><span class="panel-title">${title}</span></div><div class="panel-body">${body}</div></div>`;
        const metric = (val, label, color='var(--ac)') => `<div class="metric"><div class="metric-val" style="color:${color};">${val}</div><div class="metric-label">${label}</div></div>`;

        // Type rows
        const typeRows = (typeDistribution.results||[]).map(r=>`<tr><td style="color:var(--ac);font-weight:600;">${e(r.type_code)}</td><td>${e(r.type_name)}</td><td style="text-align:right;">${r.cnt}</td></tr>`).join('');
        // Feedback rows
        const fbRows = (feedbackRecent.results||[]).map(r=>{ const iss=r.issues_json?JSON.parse(r.issues_json).join(', '):''; return `<tr><td>${'★'.repeat(r.rating)}${'☆'.repeat(5-r.rating)}</td><td>${e(r.accuracy||'')}</td><td>${e(r.useful||'')}</td><td style="font-size:10px;">${e(iss)}</td><td style="font-size:10px;">${toKSTDate(r.created_at)}</td></tr>`; }).join('');
        // Recent analyses rows (with user info)
        const anlRows = (recentAnalyses.results||[]).map(r=>`<tr><td style="font-size:10px;color:#888;">${e(r.user_name||r.email||'–')}</td><td style="color:var(--ac);font-size:10px;">${e(r.type_code||'–')}</td><td>${e(r.type_name||'–')}</td><td style="text-align:right;">${r.message_count||0}</td><td><span style="color:${r.status==='complete'?'#28c840':'#f59e0b'};font-size:9px;">${r.status||'–'}</span></td><td style="font-size:10px;">${toKSTShort(r.created_at)}</td></tr>`).join('');
        // Recent users rows (with KST timestamps)
        const usrRows = (recentUsers.results||[]).map(r=>`<tr><td>${e(r.name||'–')}</td><td style="font-size:10px;color:#666;">${e(r.email||'')}</td><td style="text-align:right;">${r.total_analyses||0}</td><td style="font-size:10px;">${toKSTShort(r.created_at)}</td><td style="font-size:10px;">${toKSTShort(r.last_seen)}</td></tr>`).join('');
        // Recent matches rows
        const matchTotal = totalMatches?.cnt || 0;
        const matchRows = (recentMatches.results||[]).map(r=>`<tr><td style="font-size:10px;color:#888;">${e(r.user_name||r.email||'–')}</td><td style="color:var(--ac);">${e(r.name_a||'–')}</td><td style="color:var(--blue);">${e(r.name_b||'–')}</td><td style="text-align:right;">${r.compatibility != null ? r.compatibility + '%' : '–'}</td><td style="font-size:10px;">${toKSTShort(r.created_at)}</td></tr>`).join('');

        // Axis bars
        const axLabels={A1:'정서강도',A2:'안정성',A3:'감정표현',A4:'주장성',A5:'주도성',A6:'수용성'};
        const axBars = axisKeys.map(k=>{ const v=axAvg[k]; const p=v!=='–'?(parseFloat(v)*100).toFixed(0):0; return `<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;"><div style="width:55px;font-size:10px;color:#999;text-align:right;">${axLabels[k]}</div><div style="flex:1;height:6px;background:#1a1a2e;border-radius:3px;overflow:hidden;"><div style="width:${p}%;height:100%;background:var(--ac);border-radius:3px;"></div></div><div style="width:30px;font-size:10px;color:var(--ac);text-align:right;">${v}</div></div>`; }).join('');
        // Axis pairs
        const axPairs=[['F','S','정서'],['A','H','동력'],['T','R','인지'],['O','W','경계'],['X','V','회복'],['E','I','방어']];
        const pairBars = axPairs.map(([h,l,nm])=>{ const hc=cLC[h]||0,lc=cLC[l]||0,t=hc+lc||1,hp=((hc/t)*100).toFixed(0); return `<div style="display:flex;align-items:center;gap:6px;margin-bottom:6px;"><div style="width:24px;font-size:10px;color:#999;">${nm}</div><div style="width:16px;font-size:11px;color:var(--ac);font-weight:700;text-align:center;">${h}</div><div style="flex:1;height:6px;background:#1a1a2e;border-radius:3px;overflow:hidden;display:flex;"><div style="width:${hp}%;height:100%;background:var(--ac);"></div><div style="flex:1;height:100%;background:#60A5FA;"></div></div><div style="width:16px;font-size:11px;color:#60A5FA;font-weight:700;text-align:center;">${l}</div><div style="width:50px;font-size:9px;color:#666;text-align:right;">${hc}:${lc}</div></div>`; }).join('');

        const dashboardHTML = `<!DOCTYPE html><html lang="ko"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>KNOT Admin</title><style>
:root{--bg:#08080D;--ac:#F5A623;--text:#E8E8E8;--dim:#999;--panel:#0c0c14;--bar:#12121e;--border:#1a1a2e;--blue:#60A5FA;--green:#28c840;--red:#f87171;}
*{margin:0;padding:0;box-sizing:border-box;}
body{background:var(--bg);color:var(--text);font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;padding:20px;min-height:100vh;}
.wrap{max-width:840px;margin:0 auto;}
.header{display:flex;align-items:center;justify-content:space-between;margin-bottom:24px;padding-bottom:16px;border-bottom:1px solid var(--border);}
.logo{font-size:24px;font-weight:900;color:var(--ac);letter-spacing:4px;font-family:'Courier New',monospace;}
.sub{font-size:10px;color:var(--dim);letter-spacing:2px;text-transform:uppercase;}
.ts{font-size:10px;color:#444;font-family:'Courier New',monospace;}
.tabs{display:flex;gap:0;margin-bottom:20px;border-bottom:1px solid var(--border);}
.tab{padding:10px 20px;font-size:12px;color:var(--dim);cursor:pointer;border-bottom:2px solid transparent;font-weight:500;letter-spacing:0.3px;transition:all .2s;}
.tab.active{color:var(--ac);border-bottom-color:var(--ac);}
.tab:hover{color:var(--text);}
.panel{background:var(--panel);border:1px solid var(--border);border-radius:10px;overflow:hidden;margin-bottom:16px;}
.panel-bar{display:flex;align-items:center;gap:6px;padding:8px 14px;background:var(--bar);border-bottom:1px solid var(--border);}
.dot{width:7px;height:7px;border-radius:50%;}.dot.r{background:#ff5f57;}.dot.y{background:#ffbd2e;}.dot.g{background:#28c840;}
.panel-title{font-size:11px;color:var(--dim);margin-left:8px;font-family:'Courier New',monospace;}
.panel-body{padding:16px;}
.kpi-row{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:16px;}
@media(max-width:600px){.kpi-row{grid-template-columns:repeat(2,1fr);}}
.metric{background:rgba(255,255,255,0.02);border:1px solid var(--border);border-radius:8px;padding:14px 12px;text-align:center;}
.metric-val{font-size:22px;font-weight:800;color:var(--ac);margin-bottom:2px;font-family:'Courier New',monospace;}
.metric-label{font-size:9px;color:var(--dim);text-transform:uppercase;letter-spacing:0.5px;}
.metric-sub{font-size:9px;color:#555;margin-top:2px;}
.metric-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;}
table{width:100%;border-collapse:collapse;font-size:11px;}
th{text-align:left;color:var(--ac);font-size:9px;padding:6px 8px;border-bottom:1px solid var(--border);text-transform:uppercase;letter-spacing:0.5px;font-weight:600;}
td{padding:6px 8px;border-bottom:1px solid rgba(255,255,255,0.03);color:var(--dim);font-size:11px;}
tr:hover td{color:var(--text);}
.section{display:none;}.section.active{display:block;}
.chart-wrap{display:flex;gap:2px;align-items:flex-end;padding:8px 0 20px;}
.empty{text-align:center;padding:30px;color:#555;font-size:12px;font-family:'Courier New',monospace;}
.divider{height:1px;background:var(--border);margin:16px 0;}
.label{font-size:10px;color:var(--ac);margin-bottom:10px;font-family:'Courier New',monospace;}
</style></head><body>
<div class="wrap">
<div class="header"><div><div class="logo">KNOT_</div><div class="sub">Admin Dashboard</div></div><div class="ts">${toKSTShort(new Date().toISOString())} KST</div></div>

<div class="tabs">
<div class="tab active" onclick="switchTab('kpi',this)">KPI</div>
<div class="tab" onclick="switchTab('users',this)">유저</div>
<div class="tab" onclick="switchTab('analyses',this)">분석</div>
<div class="tab" onclick="switchTab('matches',this)">매칭</div>
<div class="tab" onclick="switchTab('insight',this)">인사이트</div>
<div class="tab" onclick="switchTab('feedback',this)">피드백</div>
</div>

<!-- TAB: KPI -->
<div id="kpi" class="section active">
${panel('user.acquisition', `
<div class="kpi-row">
${metric(users, '총 가입자')}
${metric(newToday, '오늘 신규', 'var(--green)')}
${metric(newWeek, '이번 주 신규', 'var(--blue)')}
${metric(retentionRate + '%', 'MAU 리텐션')}
</div>`)}

${panel('active.users', `
<div class="kpi-row">
${metric(dau, 'DAU', 'var(--green)')}
${metric(wau, 'WAU', 'var(--blue)')}
${metric(mau, 'MAU', 'var(--ac)')}
${metric(avgAnalysesPerUser, '인당 분석 수')}
</div>`)}

${panel('analysis.volume', `
<div class="kpi-row">
${metric(total, '총 분석')}
${metric(today, '오늘')}
${metric(week, '이번 주')}
${metric(month, '이번 달')}
</div>`)}

${panel('system.health', `
<div class="kpi-row">
${metric(successRate + '%', '성공률', parseFloat(successRate) >= 95 ? 'var(--green)' : parseFloat(successRate) >= 80 ? 'var(--ac)' : 'var(--red)')}
${metric(errCount, '에러', errCount > 0 ? 'var(--red)' : 'var(--green)')}
${metric(avgMsg, '평균 메시지')}
${metric(matchTotal, '총 매칭')}
${metric(fbCount, '피드백 수')}
</div>`)}

${panel('daily.trend (30d)', dailyData.length > 0 ? `
<div class="label">// 일별 분석 수</div>
<div class="chart-wrap">${bar(dailyData, maxD)}</div>
${dailyUserData.length > 0 ? `<div class="label" style="margin-top:8px;">// 일별 활성 유저</div><div class="chart-wrap">${bar(dailyUserData, Math.max(...dailyUserData.map(d=>d.cnt),1), 'var(--blue)')}</div>` : ''}
` : '<div class="empty">데이터 없음</div>')}
</div>

<!-- TAB: Users -->
<div id="users" class="section">
${panel('recent.signups', usrRows ? `<table><thead><tr><th>이름</th><th>이메일</th><th style="text-align:right;">분석</th><th>가입시간</th><th>최근방문</th></tr></thead><tbody>${usrRows}</tbody></table>` : '<div class="empty">가입자 없음</div>')}
</div>

<!-- TAB: Analyses -->
<div id="analyses" class="section">
${panel('recent.analyses', anlRows ? `<table><thead><tr><th>유저</th><th>코드</th><th>아키타입</th><th style="text-align:right;">MSG</th><th>상태</th><th>일시</th></tr></thead><tbody>${anlRows}</tbody></table>` : '<div class="empty">데이터 없음</div>')}
</div>

<!-- TAB: Matches -->
<div id="matches" class="section">
${panel('match.overview', `<div class="kpi-row">${metric(matchTotal, '총 매칭')}</div>`)}
${panel('recent.matches', matchRows ? `<table><thead><tr><th>유저</th><th>A</th><th>B</th><th style="text-align:right;">호환도</th><th>일시</th></tr></thead><tbody>${matchRows}</tbody></table>` : '<div class="empty">매칭 데이터 없음</div>')}
</div>

<!-- TAB: Insight -->
<div id="insight" class="section">
${panel('type.distribution', typeRows ? `<table><thead><tr><th>코드</th><th>아키타입</th><th style="text-align:right;">횟수</th></tr></thead><tbody>${typeRows}</tbody></table>` : '<div class="empty">데이터 없음</div>')}
${panel('axis.balance', `<div class="label">// 6축 편향 분포</div>${cT > 0 ? pairBars : '<div class="empty">데이터 없음</div>'}`)}
${panel('intensity.averages', `<div class="label">// 강도축 평균 (최근 100건)</div>${validAxes > 0 ? axBars : '<div class="empty">데이터 없음</div>'}`)}
</div>

<!-- TAB: Feedback -->
<div id="feedback" class="section">
${panel('feedback.summary', `<div class="metric-grid">${metric(fbAvg, '평균 평점')}${metric(fbCount, '응답 수')}${metric((fbCount>0?((fbPositive/fbCount)*100).toFixed(0):'–')+'%', '긍정률')}</div>`)}
${panel('feedback.recent', fbRows ? `<table><thead><tr><th>평점</th><th>정확도</th><th>유용성</th><th>이슈</th><th>날짜</th></tr></thead><tbody>${fbRows}</tbody></table>` : '<div class="empty">피드백 없음</div>')}
</div>

</div>
<script>
function switchTab(id, el) {
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  el.classList.add('active');
}
</script></body></html>`;

        return new Response(dashboardHTML, {
          headers: { 'Content-Type': 'text/html;charset=UTF-8', 'Cache-Control': 'no-store' },
        });
      }

      return jsonResponse({ error: 'Method not allowed' }, 405, corsHeaders);
    }

    if (!isOriginAllowed(origin)) {
      return jsonResponse({ error: 'Origin not allowed' }, 403, corsHeaders);
    }

    const path = url.pathname;

    // ──── POST /test-api ──── (Claude API test with configurable params)
    if (path === '/test-api') {
      try {
        const body = await request.json().catch(() => ({}));
        const testMaxTokens = body.max_tokens || 50;
        const testSystem = body.system || '';
        const testMsg = body.message || 'Say hello in Korean, one word only.';
        const start = Date.now();
        const controller = new AbortController();
        const tid = setTimeout(() => controller.abort(), 60000);
        const apiBody = {
          model: 'claude-sonnet-4-6',
          max_tokens: testMaxTokens,
          temperature: 0,
          messages: [{ role: 'user', content: testMsg }],
        };
        if (testSystem) apiBody.system = testSystem;
        const apiResp = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': env.ANTHROPIC_API_KEY || '',
            'anthropic-version': '2023-06-01',
          },
          body: JSON.stringify(apiBody),
          signal: controller.signal,
        });
        clearTimeout(tid);
        const elapsed = Date.now() - start;
        const text = await apiResp.text();
        return jsonResponse({ status: apiResp.status, elapsed_ms: elapsed, body: text.slice(0, 1000) }, 200, corsHeaders);
      } catch (e) {
        return jsonResponse({ error: e.message, name: e.name, elapsed_ms: Date.now() }, 500, corsHeaders);
      }
    }

    // ══════════════════════════════════════════════════════
    // GET /check-limit — 분석 시작 전 남은 횟수 확인
    // ══════════════════════════════════════════════════════
    if (path === '/check-limit' && method === 'GET') {
      const auth = await requireAuth(request, env);
      if (auth.error) return jsonResponse({ error: auth.error }, auth.status, corsHeaders);
      const authUser = auth.user;
      const ADMIN_EMAILS = ['ashirmallo@gmail.com', 'nakkdoor@gmail.com', 'zion062214@gmail.com'];
      const isAdmin = authUser?.email && ADMIN_EMAILS.includes(authUser.email);
      const WEEKLY_ANALYSIS_LIMIT = 1;
      if (isAdmin) {
        return jsonResponse({ allowed: true, remaining: 999, limit: WEEKLY_ANALYSIS_LIMIT, is_admin: true }, 200, corsHeaders);
      }
      let used = 0;
      try {
        if (env.KNOT_DB) {
          const row = await env.KNOT_DB.prepare(
            `SELECT COUNT(*) as cnt FROM analyses WHERE user_id = ? AND created_at >= datetime('now', '-7 days')`
          ).bind(authUser.sub).first();
          used = row?.cnt || 0;
        }
      } catch (e) { console.error('[check-limit]', e.message); }
      const remaining = Math.max(0, WEEKLY_ANALYSIS_LIMIT - used);
      return jsonResponse({ allowed: remaining > 0, remaining, limit: WEEKLY_ANALYSIS_LIMIT, used }, 200, corsHeaders);
    }

    // ══════════════════════════════════════════════════════
    // POST /analyze — 2-STAGE LLM ARCHITECTURE
    // Stage 1: LLM reads raw messages → structured scores (non-streaming)
    // Stage 2: LLM reads scores → essay (SSE streaming)
    // ══════════════════════════════════════════════════════
    if (path === '/analyze') {
      // Auth check (moved before rate limit so we can identify admins)
      const auth = await requireAuth(request, env);
      if (auth.error) {
        return jsonResponse({ error: auth.error }, auth.status, corsHeaders);
      }
      const authUser = auth.user;

      const ADMIN_EMAILS = ['ashirmallo@gmail.com', 'nakkdoor@gmail.com', 'zion062214@gmail.com'];
      const isAdmin = authUser?.email && ADMIN_EMAILS.includes(authUser.email);

      // Rate limit (admins bypass)
      if (!isAdmin && !(await checkRateLimit(ip, 'analyze', RATE_LIMIT_ANALYZE, env))) {
        return jsonResponse({ error: '분석 요청이 너무 많습니다. 잠시 후 다시 시도해주세요.' }, 429, corsHeaders);
      }

      const contentLength = parseInt(request.headers.get('Content-Length') || '0');
      if (contentLength > MAX_SIZE_ANALYZE) {
        return jsonResponse({ error: '요청 크기 초과' }, 413, corsHeaders);
      }

      try {
        // API 키 사전 검증
        if (!env.ANTHROPIC_API_KEY) {
          return jsonResponse({ error: 'LLM API key not configured' }, 500, corsHeaders);
        }

        const body = await request.json();

        // ── Weekly limit check: 1 analysis per account per 7 days ──
        const WEEKLY_ANALYSIS_LIMIT = 1;
        if (authUser?.sub && !isAdmin) {
          try {
            if (env.KNOT_DB) {
              const recentAnalysis = await env.KNOT_DB.prepare(
                `SELECT COUNT(*) as cnt FROM analyses WHERE user_id = ? AND created_at >= datetime('now', '-7 days')`
              ).bind(authUser.sub).first();
              if (recentAnalysis && recentAnalysis.cnt >= WEEKLY_ANALYSIS_LIMIT) {
                return jsonResponse({
                  error: `주간 분석 횟수(${WEEKLY_ANALYSIS_LIMIT}회)를 모두 사용했습니다. 다음 주에 다시 시도해주세요.`,
                  code: 'WEEKLY_LIMIT',
                  used: recentAnalysis.cnt,
                  limit: WEEKLY_ANALYSIS_LIMIT
                }, 429, corsHeaders);
              }
            }
          } catch (limitErr) {
            console.error('[Weekly Limit Check Error]', limitErr.message);
          }
        }

        // ── Preprocessing: normalize any format → [{sender, text}] ──
        const preprocessed = preprocessMessages(body);
        if (preprocessed.processedCount === 0) {
          return jsonResponse({
            error: '분석할 수 있는 메시지가 없습니다',
            format: preprocessed.format,
            originalCount: preprocessed.originalCount
          }, 400, corsHeaders);
        }
        const rawMessages = preprocessed.messages;

        // Run PRISM deterministically server-side
        const prismMessages = rawMessages;
        let prism = null;
        try {
          const prismResult = analyzePrism(prismMessages);
          if (prismResult.success !== false && !prismResult.error) {
            prism = sanitizePrism(prismResult);
          }
        } catch (e) { console.error('[PRISM Error]', e.message); }

        // Run ANCHOR deterministically server-side
        let anchor = null;
        let _anchorDebug = { ran: false, error: null, resultKeys: null, sanitized: null };
        try {
          _anchorDebug.ran = true;
          const anchorResult = analyzeAnchor(prismMessages);
          _anchorDebug.resultKeys = anchorResult ? Object.keys(anchorResult) : 'null';
          _anchorDebug.hasError = !!anchorResult?.error;
          _anchorDebug.success = anchorResult?.success;
          if (anchorResult.success !== false && !anchorResult.error) {
            anchor = sanitizeAnchor(anchorResult);
            _anchorDebug.sanitized = anchor ? 'OK' : 'NULL_AFTER_SANITIZE';
          } else {
            _anchorDebug.skipReason = anchorResult?.error || anchorResult?.message || 'unknown';
          }
        } catch (e) {
          _anchorDebug.error = e.message;
          // _anchorDebug.stack removed for security
          console.error('[ANCHOR Error]', e.message, e.stack);
        }

        // Diagnostic mode: return early without calling Claude API
        if (url.searchParams.get('diag') === '1') {
          const scoringPrompt = buildScoringPrompt(rawMessages, prism, anchor);
          return jsonResponse({
            diag: true,
            preprocessing: {
              format: preprocessed.format,
              originalCount: preprocessed.originalCount,
              processedCount: preprocessed.processedCount,
            },
            message_count: rawMessages.length,
            prism_ok: !!prism,
            prism_depth: prism?.engagement?.overall_depth || 'MISSING',
            anchor_ok: !!anchor,
            anchor_debug: _anchorDebug,
            anchor_attachment: anchor?.attachment?.primary_tendency || 'MISSING',
            // has_api_key removed for security
            scoring_prompt_length: scoringPrompt.length,
          }, 200, corsHeaders);
        }

        // ──── SSE response stream ────
        const encoder = new TextEncoder();
        const { readable, writable } = new TransformStream();
        const writer = writable.getWriter();

        (async () => {
          try {
            // Send preprocessing meta
            await writer.write(encoder.encode(`data: ${JSON.stringify({
              type: 'meta',
              preprocessing: {
                format: preprocessed.format,
                originalCount: preprocessed.originalCount,
                processedCount: preprocessed.processedCount
              }
            })}\n\n`));

            // ═══ STAGE 1: Non-streaming scoring call ═══
            await writer.write(encoder.encode(`data: ${JSON.stringify({ type: 'status', stage: 1, message: '행동 패턴 분석 중...' })}\n\n`));

            let axes;
            let usedFallback = false;

            try {
              const scoringPrompt = buildScoringPrompt(rawMessages, prism, anchor);
              let scoringRaw;
              try {
                scoringRaw = await callClaude(env.ANTHROPIC_API_KEY, SYSTEM_PROMPT_SCORING, scoringPrompt);
              } catch (firstErr) {
                // 403 → 민감 표현 마스킹 후 재시도
                if (firstErr.message.includes('403')) {
                  console.log('[Stage 1] 403 detected — retrying with masked content');
                  await writer.write(encoder.encode(`data: ${JSON.stringify({ type: 'status', stage: 1, message: '콘텐츠 전처리 후 재분석 중...' })}\n\n`));
                  const maskedMessages = maskMessages(rawMessages);
                  const maskedPrompt = buildScoringPrompt(maskedMessages, prism, anchor);
                  scoringRaw = await callClaude(env.ANTHROPIC_API_KEY, SYSTEM_PROMPT_SCORING, maskedPrompt);
                } else {
                  throw firstErr;
                }
              }
              const scores = extractJSON(scoringRaw);

              if (scores && scores.intensity) {
                axes = {
                  intensity: scores.intensity || {},
                  structural: scores.structural || {}
                };
              }
            } catch (llmErr) {
              console.error('[Stage 1 LLM Error]', llmErr.message);
            }

            // #9: L1 Decision Tree Fallback — LLM 실패 시 하드코딩 분석
            if (!axes) {
              try {
                const userTexts = rawMessages
                  .filter(m => !m.sender || m.sender === 'user' || m.sender === 'me')
                  .map(m => typeof m === 'string' ? m : (m.text || ''));
                const fallback = l1FallbackDecisionTree(userTexts, prism, anchor);
                axes = { intensity: fallback.intensity, structural: fallback.structural };
                usedFallback = true;
                console.log('[Stage 1] Using L1 fallback decision tree, confidence:', fallback._confidence);
              } catch (fbErr) {
                console.error('[Stage 1 Fallback Error]', fbErr.message);
              }
            }

            // 최종 안전장치: axes가 여전히 undefined면 기본값
            if (!axes) {
              axes = { intensity: { A1: 0.5, A2: 0.5, A3: 0.5, A4: 0.5, A5: 0.5, A6: 0.5, A12: 0.5, A14: 0.5 }, structural: {} };
              usedFallback = true;
              console.warn('[Stage 1] All scoring methods failed — using neutral defaults');
            }

            // ──── Deterministic override ────
            // Structural axes: 100% deterministic (keyword/pattern + PRISM/ANCHOR)
            // Intensity axes: LLM remains primary scorer — precomputed values are
            // already injected as guidance via buildScoringPrompt(), so no hard override.
            // (Previous hard-override caused dramatic score flips because keyword-count
            //  confidence thresholds were too low for intensity axes.)
            {
              const deterministic = precomputeAxes(rawMessages, prism, anchor);
              if (deterministic) {
                // Structural: 전부 덮어쓰기 (패턴 기반, 적절)
                if (deterministic.structural) {
                  axes.structural = deterministic.structural;
                }
                // Intensity: LLM 점수 유지 (precomputed는 프롬프트 가이드로만 사용)
              }
            }

            // Compute type code + identity server-side
            const identity = computeServerIdentity(axes);
            const analysisId = crypto.randomUUID();

            // ──── Save Stage 1 to D1 analyses table (v2 schema) ────
            // Extract individual axis scores (0~100 integer)
            const axisScores = {};
            if (axes?.intensity) {
              const int = axes.intensity;
              axisScores.fs = Math.round((typeof int.A1 === 'number' ? int.A1 : (int.A1?.value ?? 0.5)) * 100);
              axisScores.ah = Math.round((typeof int.A2 === 'number' ? int.A2 : (int.A2?.value ?? 0.5)) * 100);
              axisScores.tr = Math.round((typeof int.A3 === 'number' ? int.A3 : (int.A3?.value ?? 0.5)) * 100);
              axisScores.ow = Math.round((typeof int.A4 === 'number' ? int.A4 : (int.A4?.value ?? 0.5)) * 100);
              axisScores.xv = Math.round((typeof int.A5 === 'number' ? int.A5 : (int.A5?.value ?? 0.5)) * 100);
              axisScores.ei = Math.round((typeof int.A6 === 'number' ? int.A6 : (int.A6?.value ?? 0.5)) * 100);
            }

            let analysisInserted = false;
            try {
              if (env.KNOT_DB) {
                // Ensure user record exists (upsert) before FK-constrained insert
                const userId = authUser?.sub || 'anonymous';
                try {
                  await env.KNOT_DB.prepare(
                    `INSERT INTO users (id, email, last_seen) VALUES (?, ?, datetime('now')) ON CONFLICT(id) DO UPDATE SET last_seen = datetime('now')`
                  ).bind(userId, authUser?.email || 'anonymous@knot').run();
                } catch {}

                // KV 쿨다운 기록 (분석 시작 시점)
                if (env.SHARE_STORE && authUser?.sub) {
                  try { await env.SHARE_STORE.put(`ratelimit:${authUser.sub}`, Date.now().toString(), { expirationTtl: 60 * 60 * 24 * 7 }); } catch {}
                }

                await env.KNOT_DB.prepare(
                  `INSERT INTO analyses (id, user_id, type_code, type_name, tagline, axis_fs, axis_ah, axis_tr, axis_ow, axis_xv, axis_ei, axes_json, prism_json, anchor_json, identity_json, message_count, input_format, original_count, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'scoring', datetime('now'))`
                ).bind(
                  analysisId,
                  userId,
                  identity.code || '',
                  identity.name || '',
                  identity.tagline || '',
                  axisScores.fs ?? null,
                  axisScores.ah ?? null,
                  axisScores.tr ?? null,
                  axisScores.ow ?? null,
                  axisScores.xv ?? null,
                  axisScores.ei ?? null,
                  JSON.stringify(axes),
                  prism ? JSON.stringify(prism) : null,
                  anchor ? JSON.stringify(anchor) : null,
                  JSON.stringify(identity),
                  rawMessages.length,
                  preprocessed.format || null,
                  preprocessed.originalCount || null
                ).run();
                analysisInserted = true;

                // Update user's total_analyses count (await for reliability)
                await env.KNOT_DB.prepare(
                  `UPDATE users SET total_analyses = total_analyses + 1 WHERE id = ?`
                ).bind(userId).run().catch(e => console.error('[D1 user count]', e.message));

                // Log session
                await env.KNOT_DB.prepare(
                  `INSERT INTO sessions (id, user_id, action, ip, created_at) VALUES (?, ?, 'analyze', ?, datetime('now'))`
                ).bind(crypto.randomUUID(), userId, request.headers.get('CF-Connecting-IP') || '').run().catch(e => console.error('[D1 session log]', e.message));
              }
            } catch (dbErr) {
              console.error('[D1 Stage1 Save Error]', dbErr.message);
              // D1 저장 실패 시 KV 쿨다운 제거 → 재시도 허용
              if (env.SHARE_STORE && authUser?.sub) {
                try { await env.SHARE_STORE.delete(`ratelimit:${authUser.sub}`); } catch {}
              }
            }

            // #12: L4 Asymmetric Delta 계산 (중립 0.5 기준)
            const friction = l4AsymmetricDelta(axes.intensity, null);

            // ═══ SIMULATION LAYER ═══
            await writer.write(encoder.encode(`data: ${JSON.stringify({ type: 'status', stage: 'sim', message: '시뮬레이션 엔진 가동 중...' })}\n\n`));
            let simulation = null;
            try {
              simulation = runSimulation(axes, anchor);
            } catch (simErr) {
              console.error('[Simulation Error]', simErr.message);
            }

            // Compute diagnostics for client display
            const diagnostics = {
              friction: friction || null,
              message_count: rawMessages.length,
              prism_topics: prism?.topics || null,
              anchor_attachment: anchor?.attachment?.primary_tendency || null,
              has_prism: !!prism,
              has_anchor: !!anchor,
              used_fallback: usedFallback,
            };

            // Send Stage 1 + Simulation results to client
            await writer.write(encoder.encode(`data: ${JSON.stringify({
              type: 'scores',
              analysis_id: analysisId,
              axes: axes,
              identity: identity,
              prism: prism || null,
              anchor: anchor || null,
              friction: friction || null,
              simulation: simulation || null,
              used_fallback: usedFallback,
              diagnostics: diagnostics,
            })}\n\n`));

            // ═══ STAGE 2: Streaming essay call ═══
            await writer.write(encoder.encode(`data: ${JSON.stringify({ type: 'status', stage: 2, message: '에세이 작성 중...' })}\n\n`));

            // Build essay prompt using confirmed scores + simulation data
            const lensSummary = sanitizeString(body.lens_summary || '', 5000);
            const essayPrompt = buildAnalyzePrompt(axes, identity, null, lensSummary, prism, anchor, simulation);

            const apiResp = await fetch('https://api.anthropic.com/v1/messages', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'x-api-key': env.ANTHROPIC_API_KEY,
                'anthropic-version': '2023-06-01',
              },
              body: JSON.stringify({
                model: 'claude-sonnet-4-6',
                max_tokens: 16384,
                stream: true,
                temperature: 0,
                system: SYSTEM_PROMPT_INDIVIDUAL,
                messages: [{ role: 'user', content: essayPrompt }],
              }),
            });

            // 403 → 에세이 프롬프트에서 민감 표현 마스킹 후 재시도
            let essayResp = apiResp;
            if (!essayResp.ok && essayResp.status === 403) {
              console.log('[Stage 2] 403 detected — retrying with masked essay prompt');
              await writer.write(encoder.encode(`data: ${JSON.stringify({ type: 'status', stage: 2, message: '콘텐츠 전처리 후 재작성 중...' })}\n\n`));
              const maskedEssayPrompt = maskSensitiveContent(essayPrompt);
              essayResp = await fetch('https://api.anthropic.com/v1/messages', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'x-api-key': env.ANTHROPIC_API_KEY,
                  'anthropic-version': '2023-06-01',
                },
                body: JSON.stringify({
                  model: 'claude-sonnet-4-6',
                  max_tokens: 16384,
                  stream: true,
                  temperature: 0,
                  system: SYSTEM_PROMPT_INDIVIDUAL,
                  messages: [{ role: 'user', content: maskedEssayPrompt }],
                }),
              });
            }
            if (!essayResp.ok) {
              const errText = await essayResp.text();
              await writer.write(encoder.encode(`data: ${JSON.stringify({ type: 'error', error: `API ${essayResp.status}: ${errText.slice(0, 200)}` })}\n\n`));
              await writer.close();
              return;
            }

            // Stream Stage 2 essay to client
            const reader = essayResp.body.getReader();
            const decoder = new TextDecoder();
            let buf = '';
            let fullText = '';

            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              buf += decoder.decode(value, { stream: true });
              const lines = buf.split('\n');
              buf = lines.pop() || '';
              for (const line of lines) {
                if (!line.startsWith('data: ')) continue;
                const d = line.slice(6).trim();
                if (d === '[DONE]') continue;
                try {
                  const ev = JSON.parse(d);
                  if (ev.type === 'content_block_delta' && ev.delta && ev.delta.text) {
                    fullText += ev.delta.text;
                    await writer.write(encoder.encode(`data: ${JSON.stringify({ type: 'delta', text: ev.delta.text })}\n\n`));
                  }
                } catch {}
              }
            }

            // Flush remaining
            const flushed = decoder.decode();
            if (flushed) buf += flushed;
            if (buf.trim()) {
              for (const line of buf.split('\n')) {
                if (!line.startsWith('data: ')) continue;
                const d = line.slice(6).trim();
                if (d === '[DONE]') continue;
                try {
                  const ev = JSON.parse(d);
                  if (ev.type === 'content_block_delta' && ev.delta && ev.delta.text) {
                    fullText += ev.delta.text;
                    await writer.write(encoder.encode(`data: ${JSON.stringify({ type: 'delta', text: ev.delta.text })}\n\n`));
                  }
                } catch {}
              }
            }

            await writer.write(encoder.encode(`data: ${JSON.stringify({ type: 'done', analysis_id: analysisId })}\n\n`));

            // ──── Save Stage 2 essay to D1 (v2 schema) ────
            try {
              if (env.KNOT_DB) {
                // Parse essay JSON into sections for structured storage
                let sectionsJson = null;
                let sectionCount = 0;
                try {
                  // Extract JSON from fullText (may be wrapped in ```json...```)
                  let jsonStr = fullText;
                  const codeBlockMatch = fullText.match(/```(?:json)?\s*([\s\S]*?)```\s*$/);
                  if (codeBlockMatch) {
                    jsonStr = codeBlockMatch[1].trim();
                  } else {
                    const openMatch = fullText.match(/```(?:json)?\s*([\s\S]*)/);
                    if (openMatch) jsonStr = openMatch[1].trim();
                    else { const s = fullText.indexOf('{'); if (s >= 0) jsonStr = fullText.slice(s); }
                  }
                  const parsed = JSON.parse(jsonStr);
                  if (parsed && Array.isArray(parsed.sections)) {
                    sectionsJson = JSON.stringify(parsed.sections);
                    sectionCount = parsed.sections.length;
                  } else if (Array.isArray(parsed)) {
                    sectionsJson = JSON.stringify(parsed);
                    sectionCount = parsed.length;
                  }
                } catch {
                  // JSON parse failed — fallback: store null, essay_text has the raw content
                  sectionsJson = null;
                }

                // Always update status + simulation_json (simulation computed after initial INSERT)
                const newStatus = fullText.length > 50 ? 'complete' : 'error';
                await env.KNOT_DB.prepare(
                  `UPDATE analyses SET status = ?, simulation_json = ? WHERE id = ?`
                ).bind(newStatus, simulation ? JSON.stringify(simulation) : null, analysisId).run();

                // Insert essay only if we have content
                if (fullText.length > 50) {
                  await env.KNOT_DB.prepare(
                    `INSERT INTO essays (id, analysis_id, essay_text, sections_json, section_count, char_count, created_at) VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`
                  ).bind(crypto.randomUUID(), analysisId, fullText, sectionsJson, sectionCount, fullText.length).run();
                }
              }
            } catch (dbErr) {
              console.error('[D1 Stage2 Save Error]', dbErr.message);
              // Try to mark analysis as error even if essay save failed
              try {
                if (env.KNOT_DB) {
                  await env.KNOT_DB.prepare(`UPDATE analyses SET status = 'error' WHERE id = ? AND status = 'scoring'`).bind(analysisId).run();
                }
              } catch {}
            }

          } catch (e) {
            // 분석 실패 시 KV 쿨다운 제거 → 재시도 허용
            if (env.SHARE_STORE && authUser?.sub) {
              try { await env.SHARE_STORE.delete(`ratelimit:${authUser.sub}`); } catch {}
            }
            try { await writer.write(encoder.encode(`data: ${JSON.stringify({ type: 'error', error: e.message })}\n\n`)); } catch {}
          } finally {
            try { await writer.close(); } catch {}
          }
        })();

        return new Response(readable, {
          headers: {
            ...corsHeaders,
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
          },
        });
      } catch (e) {
        // 분석 실패 시 KV 쿨다운 제거 → 재시도 허용
        if (env.SHARE_STORE && authUser?.sub) {
          try { await env.SHARE_STORE.delete(`ratelimit:${authUser.sub}`); } catch {}
        }
        return jsonResponse({ error: e.message }, 500, corsHeaders);
      }
    }

    // ──── POST /match ────
    if (path === '/match') {
      if (!(await checkRateLimit(ip, 'match', RATE_LIMIT_MATCH, env))) {
        return jsonResponse({ error: '매칭 요청이 너무 많습니다. 잠시 후 다시 시도해주세요.' }, 429, corsHeaders);
      }

      // Auth check
      const auth = await requireAuth(request, env);
      if (auth.error) {
        return jsonResponse({ error: auth.error }, auth.status, corsHeaders);
      }
      const authUser = auth.user;

      const contentLength = parseInt(request.headers.get('Content-Length') || '0');
      if (contentLength > MAX_SIZE_MATCH) {
        return jsonResponse({ error: '요청 크기 초과' }, 413, corsHeaders);
      }

      try {
        // API 키 사전 검증
        if (!env.ANTHROPIC_API_KEY) {
          return jsonResponse({ error: 'LLM API key not configured' }, 500, corsHeaders);
        }

        const body = await request.json();
        const profileA = body.profileA;
        const profileB = body.profileB;

        if (!profileA || !profileB) {
          return jsonResponse({ error: '프로필 데이터가 누락되었습니다.' }, 400, corsHeaders);
        }

        const identityA = body.identityA || { name: 'Person A', tagline: '' };
        const identityB = body.identityB || { name: 'Person B', tagline: '' };
        const matchIdentity = body.matchIdentity || { name: '교차하는 궤도', tagline: '복합적 역학의 관계', compatibility: 50, tension: '보통', growth: '보통' };

        // ── Ensure user record exists (FK) ──
        const matchUserId = authUser?.sub || 'anonymous';
        if (env.KNOT_DB) {
          try {
            await env.KNOT_DB.prepare(
              `INSERT INTO users (id, email, last_seen) VALUES (?, ?, datetime('now')) ON CONFLICT(id) DO UPDATE SET last_seen = datetime('now')`
            ).bind(matchUserId, authUser?.email || 'anonymous@knot').run();
          } catch {}
        }

        // ── Preprocess raw messages A/B if provided ──
        let messagesA = null, messagesB = null;
        if (body.raw_messages_a) {
          const ppA = preprocessMessages({ raw_messages: Array.isArray(body.raw_messages_a) ? body.raw_messages_a : [] });
          if (ppA.processedCount > 0) messagesA = ppA.messages;
        }
        if (body.raw_messages_b) {
          const ppB = preprocessMessages({ raw_messages: Array.isArray(body.raw_messages_b) ? body.raw_messages_b : [] });
          if (ppB.processedCount > 0) messagesB = ppB.messages;
        }

        // Handle PRISM A/B: either use pre-computed or compute from preprocessed messages
        let prismA = sanitizePrism(body.prismA);
        if (!prismA && messagesA) {
          const prismResult = analyzePrism(messagesA);
          if (prismResult.success !== false && !prismResult.error) {
            prismA = sanitizePrism(prismResult);
          }
        }

        let prismB = sanitizePrism(body.prismB);
        if (!prismB && messagesB) {
          const prismResult = analyzePrism(messagesB);
          if (prismResult.success !== false && !prismResult.error) {
            prismB = sanitizePrism(prismResult);
          }
        }

        // Handle ANCHOR A/B: either use pre-computed or compute from preprocessed messages
        let anchorA = sanitizeAnchor(body.anchorA);
        if (!anchorA && messagesA) {
          const anchorResult = analyzeAnchor(messagesA);
          if (anchorResult.success !== false && !anchorResult.error) {
            anchorA = sanitizeAnchor(anchorResult);
          }
        }

        let anchorB = sanitizeAnchor(body.anchorB);
        if (!anchorB && messagesB) {
          const anchorResult = analyzeAnchor(messagesB);
          if (anchorResult.success !== false && !anchorResult.error) {
            anchorB = sanitizeAnchor(anchorResult);
          }
        }

        if (!profileA || !profileB) {
          return jsonResponse({ error: 'Missing profile data' }, 400, corsHeaders);
        }

        // ═══ Run simulations for both profiles ═══
        let simA = null, simB = null, crossSim = null;
        try {
          const axesA = profileA.axes || profileA;
          const axesB = profileB.axes || profileB;
          simA = runSimulation(axesA, anchorA);
          simB = runSimulation(axesB, anchorB);
          crossSim = computeCrossSimulation(simA, simB, anchorA, anchorB, prismA, prismB);
        } catch (simErr) {
          console.error('[Match Simulation Error]', simErr.message);
        }

        // Compute matchIdentity server-side (don't trust client computation)
        let serverMatchIdentity = null;
        try {
          serverMatchIdentity = serverComputeMatchIdentity(
            profileA.axes || profileA, profileB.axes || profileB, identityA, identityB
          );
        } catch (e) {
          console.error('[Match Identity Error]', e.message);
        }

        // Compute compatibility server-side
        let serverCompatibility = null;
        let fwpA = null, fwpB = null;
        try {
          // LSM: 클라이언트 제공 값 우선, 없으면 raw_messages에서 계산
          fwpA = body.fwpA || (messagesA ? computeFunctionWordProfile(messagesA) : null);
          fwpB = body.fwpB || (messagesB ? computeFunctionWordProfile(messagesB) : null);
          serverCompatibility = serverComputeCompatibility(
            profileA.axes || profileA, profileB.axes || profileB, fwpA, fwpB
          );
        } catch (e) {
          console.error('[Compatibility Error]', e.message);
        }

        // Use server computations, with crossSim overrides
        const effectiveMatchIdentity = {
          ...(serverMatchIdentity || matchIdentity),
          ...(crossSim ? { compatibility: crossSim.compatibility, tension: crossSim.tension, growth: crossSim.growth } : {}),
          ...(serverCompatibility ? { compatibilityDetail: serverCompatibility } : {})
        };

        // 개인 에세이 요약 + 대화 메타데이터
        const essaySummaryA = body.essaySummaryA || null;
        const essaySummaryB = body.essaySummaryB || null;
        const ratesMetaA = body.ratesMetaA || null;
        const ratesMetaB = body.ratesMetaB || null;

        // 상태 전이 모델 계산
        let stateTransition = null;
        try {
          if (simA && simB && crossSim) {
            stateTransition = computeStateTransitionModel(simA, simB, crossSim, anchorA, anchorB);
          }
        } catch (stErr) {
          console.error('[State Transition Error]', stErr.message);
        }

        const userPrompt = buildMatchPrompt(profileA, profileB, identityA, identityB, effectiveMatchIdentity, prismA, prismB, anchorA, anchorB, simA, simB, crossSim, fwpA, fwpB, essaySummaryA, essaySummaryB, ratesMetaA, ratesMetaB, stateTransition);

        // Stream mode for match too
        const encoder = new TextEncoder();
        const { readable, writable } = new TransformStream();
        const writer = writable.getWriter();

        const matchDbId = crypto.randomUUID();

        (async () => {
          let fullText = '';
          try {
            await writer.write(encoder.encode(`data: ${JSON.stringify({ type: 'meta', prismA: prismA || null, prismB: prismB || null, anchorA: anchorA || null, anchorB: anchorB || null, simulationA: simA, simulationB: simB, crossSimulation: crossSim, matchIdentity: effectiveMatchIdentity, compatibility: serverCompatibility })}\n\n`));

            const apiResp = await fetch('https://api.anthropic.com/v1/messages', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'x-api-key': env.ANTHROPIC_API_KEY,
                'anthropic-version': '2023-06-01',
              },
              body: JSON.stringify({
                model: 'claude-sonnet-4-6',
                max_tokens: 16384,
                stream: true,
                temperature: 0,
                system: SYSTEM_PROMPT_MATCHING,
                messages: [{ role: 'user', content: userPrompt }],
              }),
            });

            if (!apiResp.ok) {
              const errText = await apiResp.text();
              await writer.write(encoder.encode(`data: ${JSON.stringify({ type: 'error', error: `API ${apiResp.status}: ${errText.slice(0, 200)}` })}\n\n`));
              await writer.close();
              return;
            }

            const reader = apiResp.body.getReader();
            const decoder = new TextDecoder();
            let buf = '';
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              buf += decoder.decode(value, { stream: true });
              const lines = buf.split('\n');
              buf = lines.pop() || '';
              for (const line of lines) {
                if (!line.startsWith('data: ')) continue;
                const d = line.slice(6).trim();
                if (d === '[DONE]') continue;
                try {
                  const ev = JSON.parse(d);
                  if (ev.type === 'content_block_delta' && ev.delta && ev.delta.text) {
                    fullText += ev.delta.text;
                    await writer.write(encoder.encode(`data: ${JSON.stringify({ type: 'delta', text: ev.delta.text })}\n\n`));
                  }
                } catch {}
              }
            }

            // Flush TextDecoder for remaining multi-byte chars
            const flushed = decoder.decode();
            if (flushed) buf += flushed;

            // Process remaining buffer
            if (buf.trim()) {
              const remainLines = buf.split('\n');
              for (const line of remainLines) {
                if (!line.startsWith('data: ')) continue;
                const d = line.slice(6).trim();
                if (d === '[DONE]') continue;
                try {
                  const ev = JSON.parse(d);
                  if (ev.type === 'content_block_delta' && ev.delta && ev.delta.text) {
                    fullText += ev.delta.text;
                    await writer.write(encoder.encode(`data: ${JSON.stringify({ type: 'delta', text: ev.delta.text })}\n\n`));
                  }
                } catch {}
              }
            }

            // ── DB 저장: matches 테이블 ──
            if (env.KNOT_DB && fullText.length > 50) {
              try {
                // sections 파싱
                let sectionsJson = null;
                try {
                  let parsed = JSON.parse(fullText);
                  if (parsed && parsed.sections) sectionsJson = JSON.stringify(parsed.sections);
                } catch {
                  // JSON 파싱 실패 시 brace 추출 시도
                  const s = fullText.indexOf('{'), e = fullText.lastIndexOf('}');
                  if (s >= 0 && e > s) {
                    try {
                      const parsed = JSON.parse(fullText.slice(s, e + 1));
                      if (parsed && parsed.sections) sectionsJson = JSON.stringify(parsed.sections);
                    } catch {}
                  }
                }

                await env.KNOT_DB.prepare(
                  `INSERT INTO matches (id, user_id, name_a, name_b, compatibility, tension, growth, compatibility_json, cross_sim_json, match_identity_json, essay_text, sections_json, profile_a_json, profile_b_json, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'complete', datetime('now'))`
                ).bind(
                  matchDbId,
                  matchUserId,
                  identityA.name || 'Person A',
                  identityB.name || 'Person B',
                  effectiveMatchIdentity.compatibility ?? 50,
                  effectiveMatchIdentity.tension || '보통',
                  effectiveMatchIdentity.growth || '보통',
                  serverCompatibility ? JSON.stringify(serverCompatibility) : null,
                  crossSim ? JSON.stringify(crossSim) : null,
                  JSON.stringify(effectiveMatchIdentity),
                  fullText,
                  sectionsJson,
                  JSON.stringify({ axes: profileA.axes || profileA }),
                  JSON.stringify({ axes: profileB.axes || profileB }),
                ).run();
                console.log(`[D1 Match] Saved match ${matchDbId}`);
              } catch (dbErr) {
                console.error('[D1 Match Save Error]', dbErr.message);
              }
            }

            await writer.write(encoder.encode(`data: ${JSON.stringify({ type: 'done', match_id: matchDbId })}\n\n`));
          } catch (e) {
            try { await writer.write(encoder.encode(`data: ${JSON.stringify({ type: 'error', error: e.message })}\n\n`)); } catch {}
          } finally {
            try { await writer.close(); } catch {}
          }
        })();

        return new Response(readable, {
          headers: { ...corsHeaders, 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' },
        });
      } catch (e) {
        return jsonResponse({ error: e.message }, 500, corsHeaders);
      }
    }

    // ──── POST /feedback ────
    if (path === '/feedback') {
      // Auth check
      const auth = await requireAuth(request, env);
      if (auth.error) {
        return jsonResponse({ error: auth.error }, auth.status, corsHeaders);
      }
      const authUser = auth.user;

      const contentLength = parseInt(request.headers.get('Content-Length') || '0');
      if (contentLength > MAX_SIZE_FEEDBACK) {
        return jsonResponse({ error: '요청 크기 초과' }, 413, corsHeaders);
      }
      try {
        const body = await request.json();

        // Primary: D1 feedback table (v2 schema)
        if (env.KNOT_DB) {
          const feedbackId = crypto.randomUUID();
          await env.KNOT_DB.prepare(
            `INSERT INTO feedback (id, user_id, analysis_id, match_id, rating, accuracy, useful, issues_json, comment, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`
          ).bind(
            feedbackId,
            authUser?.sub || null,
            body.analysis_id || null,
            body.match_id || null,
            body.rating || 0,
            body.accuracy || null,
            body.useful || null,
            body.issues ? JSON.stringify(body.issues) : null,
            body.text || body.comment || null
          ).run();
        }

        // Fallback: also write to KV if available (backward compat, can remove later)
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
        const shareId = Array.from(crypto.getRandomValues(new Uint8Array(12)))
          .map(b => 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'[b % 62])
          .join('');
        await env.SHARE_STORE.put(shareId, JSON.stringify(body), {
          expirationTtl: 60 * 60 * 24 * 30,
        });
        const shareUrl = `https://knot-ai.pages.dev/share/${shareId}`;
        return jsonResponse({ shareUrl, shareId }, 200, corsHeaders);
      } catch (e) {
        return jsonResponse({ error: e.message }, 500, corsHeaders);
      }
    }

    // ──── POST /delete-account ── 회원 탈퇴 (모든 데이터 삭제) ────
    if (path === '/delete-account') {
      const auth = await requireAuth(request, env);
      if (auth.error) {
        return jsonResponse({ error: auth.error }, auth.status, corsHeaders);
      }
      const db = env.KNOT_DB;
      if (!db) {
        return jsonResponse({ error: 'DB not configured' }, 500, corsHeaders);
      }
      try {
        const userId = auth.user.sub;

        // Rate limit 쿨다운 기록 (탈퇴→재가입 어뷰징 방지)
        // KV에 탈퇴 시점 기록 → 재가입 시 7일간 분석 차단
        if (env.SHARE_STORE) {
          await env.SHARE_STORE.put(`ratelimit:${userId}`, Date.now().toString(), {
            expirationTtl: 60 * 60 * 24 * 7, // 7일 후 자동 만료
          });
        }

        // 1) essays (analysis_id FK) — analyses 삭제 전에 먼저
        await db.prepare(
          `DELETE FROM essays WHERE analysis_id IN (SELECT id FROM analyses WHERE user_id = ?)`
        ).bind(userId).run();

        // 2) feedback
        await db.prepare(`DELETE FROM feedback WHERE user_id = ?`).bind(userId).run();

        // 3) matches
        await db.prepare(`DELETE FROM matches WHERE user_id = ?`).bind(userId).run();

        // 4) analyses
        await db.prepare(`DELETE FROM analyses WHERE user_id = ?`).bind(userId).run();

        // 5) sessions
        await db.prepare(`DELETE FROM sessions WHERE user_id = ?`).bind(userId).run();

        // 6) users
        await db.prepare(`DELETE FROM users WHERE id = ?`).bind(userId).run();

        return jsonResponse({ ok: true, message: '계정이 삭제되었습니다' }, 200, corsHeaders);
      } catch (e) {
        return jsonResponse({ error: e.message }, 500, corsHeaders);
      }
    }

    return jsonResponse({ error: 'Not found' }, 404, corsHeaders);
  },

  // ──── Cron Trigger: 6개월 이상 된 데이터 자동 삭제 ────
  async scheduled(event, env, ctx) {
    const db = env.KNOT_DB;
    if (!db) return;
    try {
      // 6개월(180일) 이상 된 에세이 삭제
      await db.prepare(
        `DELETE FROM essays WHERE analysis_id IN (SELECT id FROM analyses WHERE created_at < datetime('now', '-180 days'))`
      ).run();
      // 6개월 이상 된 분석 결과 삭제
      await db.prepare(
        `DELETE FROM analyses WHERE created_at < datetime('now', '-180 days')`
      ).run();
      // 6개월 이상 된 매칭 결과 삭제
      await db.prepare(
        `DELETE FROM matches WHERE created_at < datetime('now', '-180 days')`
      ).run();
      // 6개월 이상 된 피드백 삭제
      await db.prepare(
        `DELETE FROM feedback WHERE created_at < datetime('now', '-180 days')`
      ).run();
      // 6개월 이상 된 세션 로그 삭제
      await db.prepare(
        `DELETE FROM sessions WHERE created_at < datetime('now', '-180 days')`
      ).run();
      // 6개월 이상 접속 없는 유저 계정 삭제
      await db.prepare(
        `DELETE FROM users WHERE last_seen < datetime('now', '-180 days') AND id NOT IN (SELECT DISTINCT user_id FROM analyses WHERE created_at >= datetime('now', '-180 days'))`
      ).run();
      console.log('[KNOT] Scheduled cleanup complete');
    } catch (e) {
      console.error('[KNOT] Scheduled cleanup error:', e.message);
    }
  },
};
