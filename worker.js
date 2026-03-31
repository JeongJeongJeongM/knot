/**
 * KNOT EXODIA v3 — Cloudflare Worker
 * Proxy to Anthropic Claude API with rate limiting, CORS, v3 interpretation system.
 */

// ═══════════ Security Constants ═══════════
const RATE_LIMIT_ANALYZE = 10;  // per minute
const RATE_LIMIT_MATCH = 10;
const RATE_LIMIT_WINDOW = 60;   // seconds
const MAX_SIZE_ANALYZE = 500 * 1024;  // 500KB
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

// ═══════════ Rate Limiting (KV-backed) ═══════════
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

// ═══════════ Input Sanitization ═══════════
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

// ═══════════ V3 System Prompts ═══════════

const SYSTEM_PROMPT_INDIVIDUAL = `당신은 행동 심리 분석 전문가입니다. 주어진 분석 데이터를 바탕으로 한 사람의 심리 프로필을 에세이/칼럼 톤으로 작성합니다.

핵심 규칙:
1. 엔진 용어 금지: 축 번호(A1, A7 등), 수치(0.82, 65% 등), 밴드(very_high 등), 기술 용어를 절대 사용하지 마세요.
2. 자연스러운 한국어: 번역체("~를 의미한다", "~에 가깝다" 반복)를 피하고, 칼럼니스트가 쓴 글처럼 자연스럽게 쓰세요.
3. 구체적 행동 묘사: 추상적 설명 대신 "밤에 잠이 안 오거나", "갑자기 말수가 줄거나" 같은 구체적 장면으로 보여주세요.
4. 각 섹션마다: summary (2-3문장 요약) + subsections (각 200-400자 상세)

문체 예시 (이 톤을 유지):
- "이 사람이 있으면 공기가 좀 달라진다."
- "근데 이건 지배하고 싶어서가 아니다. 불안해서다."
- "겉과 속이 극단적으로 다르다."`;

const SYSTEM_PROMPT_MATCHING = `당신은 관계 역학 분석 전문가입니다. 두 사람의 분석 데이터를 바탕으로 관계 프로파일링을 에세이/칼럼 톤으로 작성합니다.

핵심 규칙:
1. 엔진 용어 금지: 축 번호, 수치, 밴드, 기술 용어를 절대 사용하지 마세요.
2. 자연스러운 한국어: 번역체를 피하고 칼럼 톤으로.
3. 관계 역학 중심: 개인 분석이 아니라 "둘 사이에서 무슨 일이 벌어지는지"에 집중.
4. 각 섹션마다: summary (2-3문장) + subsections (각 200-400자)
5. 판단이 아닌 관찰: "위험하다"가 아니라 "이런 패턴이 반복될 수 있다."

문체 예시:
- "이 사람한테 배신은 상처이기 전에 버그다."
- "좋아하니까 무서운 거고, 무서우니까 공격하는 거다."`;

// ═══════════ V3 Section Definitions ═══════════

const INDIVIDUAL_SECTIONS = [
  { key: 'first_impression', title: '첫인상', subsections: ['에너지 유형', '대인 시그널', '오해받기 쉬운 지점'] },
  { key: 'mechanism', title: '작동원리', subsections: ['핵심 동기', '방어 전략', '의사결정 구조'] },
  { key: 'crack', title: '균열', subsections: ['주요 모순', '파급 효과', '본인의 자각 수준'] },
  { key: 'contextual_faces', title: '맥락별 얼굴', subsections: ['혼자일 때', '친밀한 관계에서', '집단 속에서'] },
  { key: 'simulation', title: '시뮬레이션', subsections: ['배신당했을 때', '사랑에 빠졌을 때', '권력을 쥐었을 때', '실패했을 때'] },
  { key: 'unconscious', title: '무의식', subsections: ['반복 패턴', '회피하는 감정', '인정하지 않는 욕구'] },
  { key: 'growth', title: '성장 방향', subsections: ['현재 정체 지점', '성장 조건', '가능성의 범위'] },
];

const MATCHING_SECTIONS = [
  { key: 'first_meeting', title: '첫 만남', subsections: ['서로에게 읽히는 첫 신호', '초반 역학'] },
  { key: 'attraction', title: '끌림의 구조', subsections: ['A가 상대에게서 보는 것', 'B가 상대에게서 보는 것'] },
  { key: 'collision', title: '충돌 지점', subsections: ['거리 조절 전쟁', '싸우는 방식의 충돌', '지뢰밭'] },
  { key: 'trap', title: '관계의 함정', subsections: ['추격-도주의 고착', '역할 고정'] },
  { key: 'needs', title: '서로에게 필요한 것', subsections: ['A가 이 관계에서 얻을 수 있는 것', 'B가 이 관계에서 얻을 수 있는 것'] },
  { key: 'possibility', title: '이 관계의 가능성', subsections: ['최선의 시나리오', '최악의 시나리오', '이 관계를 유지하려면'] },
];

// ═══════════ Axis Description Helpers ═══════════

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

  // Intensity axes
  for (const [axis, name] of Object.entries(INTENSITY_AXIS_NAMES)) {
    const val = intensity[axis];
    if (val === undefined || val === null) continue;
    const band = getIntensityBand(val);
    const word = (INTENSITY_WORDS[axis] || {})[band] || band;
    lines.push(`- ${name}: ${word} (${band})`);
  }

  // Structural axes
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

// ═══════════ Prompt Builders ═══════════

function buildAnalyzePrompt(axes, identity, messagesSample, lensSummary) {
  const profileDesc = describeProfileForPrompt(axes);

  let prompt = `다음 분석 데이터를 바탕으로 개인 심리 프로필을 작성해주세요.

## 프로필 요약
정체성: ${identity.name} (${identity.tagline})

## 특성 데이터
${profileDesc}
`;

  if (lensSummary) {
    prompt += `\n## 렌즈 요약\n${sanitizeString(lensSummary, 5000)}\n`;
  }

  if (messagesSample) {
    prompt += `\n## 대화 샘플 (참고용)\n${sanitizeString(messagesSample, 50000)}\n`;
  }

  prompt += `\n## 작성할 구조
아래 7개 섹션 각각에 대해 작성하세요:\n`;

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
- JSON 형식으로 출력: {"sections": [{"key": "...", "title": "...", "summary": "...", "subsections": [{"title": "...", "content": "..."}]}]}`;

  return prompt;
}

function buildMatchPrompt(profileA, profileB, identityA, identityB, matchIdentity) {
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

## 작성할 구조
아래 6개 섹션 각각에 대해 작성하세요:\n`;

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
- JSON 형식으로 출력: {"sections": [{"key": "...", "title": "...", "summary": "...", "subsections": [{"title": "...", "content": "..."}]}]}`;

  return prompt;
}

// ═══════════ Claude API Call ═══════════

async function callClaude(apiKey, systemPrompt, userPrompt) {
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
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Claude API error: ${response.status} - ${error}`);
  }

  const data = await response.json();
  return data.content[0].text;
}

// ═══════════ Helpers ═══════════

function extractJSON(text) {
  // Try direct parse
  try { return JSON.parse(text); } catch {}
  // Try extracting from markdown code block
  const match = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (match) {
    try { return JSON.parse(match[1].trim()); } catch {}
  }
  // Try finding first { to last }
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

// ═══════════ Share Page HTML Builder ═══════════

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

// ═══════════ Main Handler ═══════════

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get('Origin') || '';
    const ip = request.headers.get('CF-Connecting-IP') || '0.0.0.0';

    // CORS headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': isOriginAllowed(origin) ? origin : ALLOWED_ORIGINS[0],
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400',
    };

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    // Only accept POST
    if (request.method !== 'POST') {
      // GET /share/:id — serve share page
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

    // Validate origin
    if (!isOriginAllowed(origin)) {
      return jsonResponse({ error: 'Origin not allowed' }, 403, corsHeaders);
    }

    const path = url.pathname;

    // ──── POST /analyze ────
    if (path === '/analyze') {
      // Rate limit
      if (!(await checkRateLimit(ip, 'analyze', RATE_LIMIT_ANALYZE, env))) {
        return jsonResponse({ error: '분석 요청이 너무 많습니다. 잠시 후 다시 시도해주세요.' }, 429, corsHeaders);
      }

      // Size check
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

        const userPrompt = buildAnalyzePrompt(axes, identity, messagesSample, lensSummary);
        const rawResponse = await callClaude(env.ANTHROPIC_API_KEY, SYSTEM_PROMPT_INDIVIDUAL, userPrompt);
        const parsed = extractJSON(rawResponse);

        if (!parsed) {
          return jsonResponse({ error: 'Failed to parse AI response', raw: rawResponse.slice(0, 500) }, 500, corsHeaders);
        }

        return jsonResponse(parsed, 200, corsHeaders);
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

        if (!profileA || !profileB) {
          return jsonResponse({ error: 'Missing profile data' }, 400, corsHeaders);
        }

        const userPrompt = buildMatchPrompt(profileA, profileB, identityA, identityB, matchIdentity);
        const rawResponse = await callClaude(env.ANTHROPIC_API_KEY, SYSTEM_PROMPT_MATCHING, userPrompt);
        const parsed = extractJSON(rawResponse);

        if (!parsed) {
          return jsonResponse({ error: 'Failed to parse AI response', raw: rawResponse.slice(0, 500) }, 500, corsHeaders);
        }

        return jsonResponse(parsed, 200, corsHeaders);
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
        // Store feedback if KV available
        if (env.FEEDBACK_STORE) {
          const key = `fb:${Date.now()}:${ip.replace(/\./g, '_')}`;
          await env.FEEDBACK_STORE.put(key, JSON.stringify({
            ...body,
            ip: ip,
            timestamp: new Date().toISOString(),
          }), { expirationTtl: 60 * 60 * 24 * 90 }); // 90 days
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
          expirationTtl: 60 * 60 * 24 * 30, // 30 days
        });
        const shareUrl = `${url.origin}/share/${shareId}`;
        return jsonResponse({ shareUrl }, 200, corsHeaders);
      } catch (e) {
        return jsonResponse({ error: e.message }, 500, corsHeaders);
      }
    }

    // 404
    return jsonResponse({ error: 'Not found' }, 404, corsHeaders);
  },
};
