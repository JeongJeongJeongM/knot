// Pages Function: /share/:id
// - Worker API에서 shareData 가져와서 OG 메타 주입 후 index.html 반환
// - _redirects의 /share/* → /index.html 200 규칙보다 Functions가 우선 적용됨
const WORKER_URL = 'https://knot-exodia.ashirmallo.workers.dev';

function escapeHTML(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function buildOGMeta(shareData, shareId) {
  const defaultImg = 'https://knot-ai.pages.dev/og-default.png';
  const shareUrl = `https://knot-ai.pages.dev/share/${shareId}`;
  let title = 'KNOT — AI 행동 분석';
  let desc = '대화에서 읽어내는 당신의 인지·정서·관계 구조 분석';

  try {
    if (shareData.type === 'match') {
      const mi = shareData.matchIdentity || {};
      const idA = (shareData.profileA && shareData.profileA.identity) || shareData.identityA || {};
      const idB = (shareData.profileB && shareData.profileB.identity) || shareData.identityB || {};
      const nameA = idA.archetype || idA.name || idA.code || 'A';
      const nameB = idB.archetype || idB.name || idB.code || 'B';
      title = `${nameA} × ${nameB} — ${mi.name || '호환성 분석'}`;
      const tag = (mi.tagline || '').trim();
      desc = tag + (shareData.compatibility ? ` · COMPAT ${shareData.compatibility}` : '');
      desc = desc.trim() || '두 사람의 관계 구조 심층 분석';
    } else {
      const id = shareData.identity || {};
      const name = id.archetype || id.name || 'KNOT 분석 결과';
      const code = id.code || '';
      const tag = id.tagline || '';
      title = `${name}${code ? ' · ' + code : ''}`;
      desc = tag || '대화에서 읽어내는 당신의 인지·정서·관계 구조';
    }
  } catch {}

  return `
<meta property="og:type" content="article">
<meta property="og:site_name" content="KNOT">
<meta property="og:title" content="${escapeHTML(title)}">
<meta property="og:description" content="${escapeHTML(desc)}">
<meta property="og:image" content="${escapeHTML(defaultImg)}">
<meta property="og:url" content="${escapeHTML(shareUrl)}">
<meta property="og:locale" content="ko_KR">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${escapeHTML(title)}">
<meta name="twitter:description" content="${escapeHTML(desc)}">
<meta name="twitter:image" content="${escapeHTML(defaultImg)}">
<meta name="description" content="${escapeHTML(desc)}">`;
}

export async function onRequestGet(context) {
  const { request, params, env } = context;
  const shareId = params.id;

  if (!shareId || !/^[a-zA-Z0-9_-]{4,32}$/.test(shareId)) {
    return new Response('Invalid share id', { status: 400 });
  }

  // 1) Worker API에서 shareData 조회
  let shareData = null;
  try {
    const apiResp = await fetch(`${WORKER_URL}/share-data/${encodeURIComponent(shareId)}`, {
      headers: { 'Accept': 'application/json' }
    });
    if (apiResp.ok) shareData = await apiResp.json();
  } catch (e) {}

  // 2) index.html 로드 (Pages asset)
  let html = null;
  try {
    const assetResp = await env.ASSETS.fetch(new URL('/index.html', request.url));
    if (assetResp.ok) html = await assetResp.text();
  } catch (e) {}

  if (!html) {
    return new Response('Service unavailable', { status: 503 });
  }

  // 3) shareData 없으면 기본 index.html 그대로 반환 (client checkShareRoute가 404 처리)
  if (!shareData) {
    return new Response(html, {
      headers: { 'Content-Type': 'text/html;charset=UTF-8', 'Cache-Control': 'no-cache' }
    });
  }

  // 4) OG 메타 주입
  const newMeta = buildOGMeta(shareData, shareId);
  const patched = html.replace(
    /<!-- OG_META_START -->[\s\S]*?<!-- OG_META_END -->/,
    `<!-- OG_META_START -->${newMeta}<!-- OG_META_END -->`
  );

  return new Response(patched, {
    headers: {
      'Content-Type': 'text/html;charset=UTF-8',
      'Cache-Control': 'public, max-age=300'
    }
  });
}
