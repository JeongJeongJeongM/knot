-- ============================================================
-- KNOT DB Schema v2 — Full Redesign
-- D1 (SQLite) / Cloudflare Workers
-- ============================================================

-- 기존 테이블 제거 (테스트 데이터 3건뿐이라 안전)
DROP TABLE IF EXISTS feedback;
DROP TABLE IF EXISTS essays;
DROP TABLE IF EXISTS matches;
DROP TABLE IF EXISTS analyses;
DROP TABLE IF EXISTS sessions;
DROP TABLE IF EXISTS users;

-- ============================================================
-- 1. users — Google OAuth 유저
-- ============================================================
CREATE TABLE users (
  id            TEXT PRIMARY KEY,                         -- google_id (sub)
  email         TEXT NOT NULL UNIQUE,
  name          TEXT,
  picture       TEXT,                                     -- 프로필 이미지 URL
  total_analyses INTEGER DEFAULT 0,                       -- 누적 분석 횟수 (캐시)
  created_at    TEXT DEFAULT (datetime('now')),
  last_seen     TEXT DEFAULT (datetime('now'))
);

CREATE INDEX idx_users_email ON users(email);

-- ============================================================
-- 2. sessions — 로그인/접속 기록
-- ============================================================
CREATE TABLE sessions (
  id            TEXT PRIMARY KEY,                         -- UUID
  user_id       TEXT NOT NULL REFERENCES users(id),
  ip            TEXT,
  user_agent    TEXT,
  action        TEXT DEFAULT 'login',                     -- login / analyze / match / feedback
  metadata_json TEXT,                                     -- 추가 정보 (기기, 브라우저 등)
  created_at    TEXT DEFAULT (datetime('now'))
);

CREATE INDEX idx_sessions_user ON sessions(user_id);
CREATE INDEX idx_sessions_date ON sessions(created_at);

-- ============================================================
-- 3. analyses — 분석 결과 (핵심)
-- ============================================================
CREATE TABLE analyses (
  id              TEXT PRIMARY KEY,                       -- UUID
  user_id         TEXT NOT NULL REFERENCES users(id),

  -- 유형 결과
  type_code       TEXT,                                   -- 6자리 코드 (FSTHXE 등)
  type_name       TEXT,                                   -- "조용한 관찰자" 등
  tagline         TEXT,                                   -- 한줄 설명

  -- 6축 점수 (정수 0~100) — 개별 컬럼으로 쿼리 가능
  axis_fs         INTEGER,                                -- F(감정) vs S(사고)
  axis_ah         INTEGER,                                -- A(능동) vs H(수동)
  axis_tr         INTEGER,                                -- T(신뢰) vs R(경계)
  axis_ow         INTEGER,                                -- O(개방) vs W(방어)
  axis_xv         INTEGER,                                -- X(표현) vs V(관찰)
  axis_ei         INTEGER,                                -- E(외향) vs I(내향)

  -- 상세 JSON 데이터
  axes_json       TEXT,                                   -- 축 상세 (intensity, confidence 등)
  prism_json      TEXT,                                   -- PRISM 언어패턴 분석
  anchor_json     TEXT,                                   -- ANCHOR 고정점 분석
  identity_json   TEXT,                                   -- 정체성/유형 상세
  simulation_json TEXT,                                   -- 시뮬레이션 결과

  -- 입력 메타
  message_count   INTEGER,                                -- 입력 메시지 수
  input_format    TEXT,                                   -- 전처리 감지 포맷 (claude/chatgpt/raw 등)
  original_count  INTEGER,                                -- 전처리 전 원본 메시지 수

  -- 상태
  status          TEXT DEFAULT 'scoring',                  -- scoring → essay → complete / error

  created_at      TEXT DEFAULT (datetime('now'))
);

CREATE INDEX idx_analyses_user ON analyses(user_id);
CREATE INDEX idx_analyses_type ON analyses(type_code);
CREATE INDEX idx_analyses_date ON analyses(created_at);
CREATE INDEX idx_analyses_status ON analyses(status);

-- ============================================================
-- 4. essays — 에세이/섹션 출력 텍스트
-- ============================================================
CREATE TABLE essays (
  id              TEXT PRIMARY KEY,                       -- UUID
  analysis_id     TEXT NOT NULL UNIQUE REFERENCES analyses(id),

  -- 에세이 내용
  essay_text      TEXT,                                   -- 전체 에세이 원문 (plain text)
  sections_json   TEXT,                                   -- 섹션별 구조화 JSON
  section_count   INTEGER DEFAULT 0,                      -- 섹션 수
  char_count      INTEGER DEFAULT 0,                      -- 총 글자 수

  created_at      TEXT DEFAULT (datetime('now'))
);

CREATE INDEX idx_essays_analysis ON essays(analysis_id);

-- ============================================================
-- 5. matches — 궁합/매칭 결과
-- ============================================================
CREATE TABLE matches (
  id              TEXT PRIMARY KEY,                       -- UUID
  user_id         TEXT NOT NULL REFERENCES users(id),     -- 매칭 요청한 유저

  -- 매칭 대상 (A/B)
  analysis_a_id   TEXT REFERENCES analyses(id),           -- A의 분석 ID (있으면)
  analysis_b_id   TEXT REFERENCES analyses(id),           -- B의 분석 ID (있으면)
  name_a          TEXT,                                   -- A 이름/별명
  name_b          TEXT,                                   -- B 이름/별명

  -- 궁합 점수
  compatibility   INTEGER,                                -- 종합 궁합 점수 (0~100)
  tension         TEXT,                                   -- 긴장도 (낮음/보통/높음)
  growth          TEXT,                                   -- 성장 가능성 (낮음/보통/높음)

  -- 상세 데이터
  compatibility_json TEXT,                                -- 궁합 상세 JSON
  cross_sim_json     TEXT,                                -- 교차 시뮬레이션 결과
  match_identity_json TEXT,                               -- 관계 유형 정보

  -- 에세이 텍스트 (매칭 결과 글)
  essay_text      TEXT,
  sections_json   TEXT,

  -- 입력 프로필 스냅샷 (분석 ID 없이 직접 입력한 경우)
  profile_a_json  TEXT,                                   -- A 프로필 스냅샷
  profile_b_json  TEXT,                                   -- B 프로필 스냅샷

  status          TEXT DEFAULT 'processing',              -- processing → complete / error
  created_at      TEXT DEFAULT (datetime('now'))
);

CREATE INDEX idx_matches_user ON matches(user_id);
CREATE INDEX idx_matches_date ON matches(created_at);

-- ============================================================
-- 6. feedback — 유저 피드백
-- ============================================================
CREATE TABLE feedback (
  id              TEXT PRIMARY KEY,                       -- UUID
  user_id         TEXT REFERENCES users(id),
  analysis_id     TEXT REFERENCES analyses(id),
  match_id        TEXT REFERENCES matches(id),            -- 궁합 피드백이면

  -- 피드백 내용
  rating          INTEGER DEFAULT 0,                      -- 별점 (1~5)
  accuracy        TEXT,                                   -- 정확도 평가
  useful          TEXT,                                   -- 유용함 평가
  issues_json     TEXT,                                   -- 문제점 배열
  comment         TEXT,                                   -- 자유 코멘트

  created_at      TEXT DEFAULT (datetime('now'))
);

CREATE INDEX idx_feedback_user ON feedback(user_id);
CREATE INDEX idx_feedback_analysis ON feedback(analysis_id);
CREATE INDEX idx_feedback_date ON feedback(created_at);

-- ============================================================
-- 뷰: 대시보드용 집계
-- ============================================================

-- 일별 분석 통계
CREATE VIEW v_daily_stats AS
SELECT
  date(created_at) as day,
  COUNT(*) as analysis_count,
  COUNT(DISTINCT user_id) as unique_users,
  AVG(message_count) as avg_messages,
  COUNT(CASE WHEN status = 'complete' THEN 1 END) as completed,
  COUNT(CASE WHEN status = 'error' THEN 1 END) as errors
FROM analyses
GROUP BY date(created_at)
ORDER BY day DESC;

-- 유형 분포 통계
CREATE VIEW v_type_distribution AS
SELECT
  type_code,
  type_name,
  COUNT(*) as count,
  ROUND(AVG(axis_fs), 1) as avg_fs,
  ROUND(AVG(axis_ah), 1) as avg_ah,
  ROUND(AVG(axis_tr), 1) as avg_tr,
  ROUND(AVG(axis_ow), 1) as avg_ow,
  ROUND(AVG(axis_xv), 1) as avg_xv,
  ROUND(AVG(axis_ei), 1) as avg_ei
FROM analyses
WHERE type_code IS NOT NULL
GROUP BY type_code
ORDER BY count DESC;

-- 유저별 분석 요약
CREATE VIEW v_user_summary AS
SELECT
  u.id,
  u.email,
  u.name,
  u.created_at as joined,
  u.last_seen,
  COUNT(a.id) as total_analyses,
  COUNT(m.id) as total_matches,
  MAX(a.created_at) as last_analysis
FROM users u
LEFT JOIN analyses a ON a.user_id = u.id
LEFT JOIN matches m ON m.user_id = u.id
GROUP BY u.id;
