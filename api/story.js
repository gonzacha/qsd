import '../lib/resolve-story-image.js';

export const config = { runtime: 'edge' };

const SITE_URL = 'https://www.quesedice.com.ar';
const STORIES_LIMIT = 120;
const resolveStoryImage = globalThis.resolveStoryImage || (async () => '');

function normalizeUrl(raw) {
  try {
    const url = new URL(raw);
    url.hash = '';
    const params = new URLSearchParams(url.searchParams);
    for (const key of [...params.keys()]) {
      const k = key.toLowerCase();
      if (k.startsWith('utm_') || k === 'gclid' || k === 'fbclid') {
        params.delete(key);
      }
    }
    const entries = [...params.entries()].sort(([a], [b]) => a.localeCompare(b));
    url.search = entries.length
      ? `?${entries.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&')}`
      : '';
    return url.toString();
  } catch {
    return raw;
  }
}

async function sha256Hex(input) {
  const data = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(hash)].map(b => b.toString(16).padStart(2, '0')).join('');
}

async function buildStoryId(url) {
  if (!url) return '';
  const normalized = normalizeUrl(url);
  const hex = await sha256Hex(normalized);
  return hex.slice(0, 16);
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function decodeHtmlEntities(value) {
  return String(value || '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/gi, "'")
    .replace(/&#x2f;/gi, '/')
    .replace(/&apos;/gi, "'");
}

function stripHtmlTags(value) {
  return String(value || '').replace(/<[^>]*>/g, ' ');
}

function normalizeWhitespace(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function splitSentences(text) {
  return text
    .split(/(?<=[.!?])\s+/)
    .map(part => part.trim())
    .filter(Boolean);
}

function dedupeSentences(sentences) {
  const seen = new Set();
  const result = [];
  for (const sentence of sentences) {
    const key = sentence.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(sentence);
  }
  return result;
}

function buildParagraphs(text) {
  const sentences = dedupeSentences(splitSentences(text));
  if (sentences.length === 0) return [];
  const paragraphs = [];
  let buffer = [];
  let size = 0;
  for (const sentence of sentences) {
    buffer.push(sentence);
    size += sentence.length;
    if (buffer.length >= 2 || size >= 220) {
      paragraphs.push(buffer.join(' '));
      buffer = [];
      size = 0;
    }
  }
  if (buffer.length) paragraphs.push(buffer.join(' '));
  return paragraphs;
}

function cleanText(value) {
  const decoded = decodeHtmlEntities(value);
  const withoutTags = stripHtmlTags(decoded.replace(/<br\s*\/?>/gi, ' '));
  return normalizeWhitespace(withoutTags);
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const t = new Date(dateStr).getTime();
  if (Number.isNaN(t)) return '';
  return new Date(t).toLocaleDateString('es-AR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function buildHtml({ title, description, source, publishedAt, url, category, canonical, imageUrl }) {
  const cleanedTitle = cleanText(title || 'Historia');
  const cleanedDesc = cleanText(description || 'Cobertura destacada en Qué Se Dice.');
  const paragraphs = buildParagraphs(cleanedDesc);
  const fallbackDesc = cleanedDesc || 'Cobertura destacada en Qué Se Dice.';
  const safeTitle = escapeHtml(cleanedTitle || 'Historia');
  const safeDesc = escapeHtml(fallbackDesc);
  const safeSource = escapeHtml(source || 'Fuente');
  const safeDate = escapeHtml(formatDate(publishedAt));
  const safeUrl = escapeHtml(url || SITE_URL);
  const safeCanonical = escapeHtml(canonical);
  const safeImage = imageUrl ? escapeHtml(imageUrl) : '';

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${safeTitle} — Qué Se Dice</title>
  <meta name="description" content="${safeDesc}">
  <link rel="canonical" href="${safeCanonical}">
  <meta property="og:type" content="article">
  <meta property="og:title" content="${safeTitle}">
  <meta property="og:description" content="${safeDesc}">
  <meta property="og:url" content="${safeCanonical}">
  ${safeImage ? `<meta property="og:image" content="${safeImage}">` : ''}
  <meta name="twitter:card" content="summary_large_image">
  <meta name="robots" content="index, follow">
  <style>
    :root {
      --bg: #0b0f1a;
      --text: #f2f1ed;
      --muted: #b6b3ad;
      --accent: #c9953a;
      --card: #141a2a;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: "Source Sans 3", "Segoe UI", sans-serif;
      background: var(--bg);
      color: var(--text);
      line-height: 1.6;
      display: flex;
      justify-content: center;
      padding: 32px 16px 64px;
    }
    main {
      width: 100%;
      max-width: 760px;
      background: var(--card);
      padding: 32px;
      border-radius: 18px;
      border: 1px solid rgba(201, 149, 58, 0.15);
      box-shadow: 0 18px 60px rgba(0, 0, 0, 0.35);
    }
    .kicker {
      font-size: 0.75rem;
      letter-spacing: 0.3em;
      text-transform: uppercase;
      color: var(--muted);
      margin-bottom: 12px;
    }
    h1 {
      font-family: "Playfair Display", Georgia, serif;
      font-size: clamp(1.6rem, 4vw, 2.4rem);
      margin: 0 0 16px;
      color: var(--text);
    }
    .meta {
      color: var(--muted);
      font-size: 0.9rem;
      margin-bottom: 20px;
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
    }
    .hero {
      width: 100%;
      height: auto;
      border-radius: 16px;
      margin-bottom: 20px;
      border: 1px solid rgba(201, 149, 58, 0.12);
      object-fit: cover;
    }
    .source {
      color: var(--accent);
      font-weight: 600;
    }
    .desc {
      font-size: 1.05rem;
      color: var(--text);
      margin-bottom: 28px;
    }
    .cta {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      text-decoration: none;
      color: var(--bg);
      background: var(--accent);
      padding: 10px 16px;
      border-radius: 999px;
      font-weight: 600;
    }
    footer {
      margin-top: 32px;
      color: var(--muted);
      font-size: 0.85rem;
    }
    a { color: inherit; }
  </style>
</head>
<body>
  <main>
    <div class="kicker">Qué Se Dice — Historia</div>
    ${safeImage ? `<img class="hero" src="${safeImage}" alt="${safeTitle}" loading="eager" decoding="async" onerror="this.remove()">` : ''}
    <h1>${safeTitle}</h1>
    <div class="meta">
      ${safeDate ? `<span>${safeDate}</span>` : ''}
      <span class="source">${safeSource}</span>
    </div>
    ${
      paragraphs.length
        ? paragraphs.map(p => `<p class="desc">${escapeHtml(p)}</p>`).join('')
        : `<p class="desc">${safeDesc}</p>`
    }
    ${safeUrl ? `<a class="cta" href="${safeUrl}" rel="noopener noreferrer" target="_blank">Leer fuente original</a>` : ''}
    <footer>
      <div>URL canónica: ${safeCanonical}</div>
    </footer>
  </main>
</body>
</html>`;
}

async function fetchStories(origin) {
  const res = await fetch(`${origin}/api/rank?limit=${STORIES_LIMIT}`, {
    headers: { 'Accept': 'application/json' },
  });
  if (!res.ok) return [];
  const data = await res.json();
  return Array.isArray(data.items) ? data.items : [];
}

export default async function handler(req) {
  const { searchParams } = new URL(req.url);
  const storyId = (searchParams.get('id') || '').trim();
  const origin = new URL(req.url).origin;

  if (!storyId) {
    return new Response('Not Found', { status: 404 });
  }

  const stories = await fetchStories(origin);
  for (const item of stories) {
    const itemId = await buildStoryId(item.url || item.link || '');
    if (itemId !== storyId) continue;

    const canonical = `${SITE_URL}/story/${storyId}`;
    const imageUrl = await resolveStoryImage(item, { timeoutMs: 6000 });
    const html = buildHtml({
      title: item.title,
      description: item.description || '',
      source: item.source,
      publishedAt: item.publishedAt || item.pubDate,
      url: item.url,
      category: item.category,
      canonical,
      imageUrl: imageUrl || '',
    });

    return new Response(html, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'public, max-age=0, must-revalidate',
        'CDN-Cache-Control': 's-maxage=1800, stale-while-revalidate=86400',
      },
    });
  }

  return new Response('Not Found', { status: 404, headers: { 'Cache-Control': 'no-store' } });
}
