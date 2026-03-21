export const config = { runtime: 'edge' };

const SITE_URL = 'https://quesedice.com.ar';
const STORIES_LIMIT = 120;

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
  const normalized = normalizeUrl(url);
  const hex = await sha256Hex(normalized);
  return hex.slice(0, 16);
}

function formatLastmod(dateStr) {
  if (!dateStr) return null;
  const t = new Date(dateStr).getTime();
  if (Number.isNaN(t)) return null;
  return new Date(t).toISOString().split('T')[0];
}

async function fetchStories(origin) {
  const res = await fetch(`${origin}/api/rank?limit=${STORIES_LIMIT}`, {
    headers: { 'Accept': 'application/json' },
  });
  if (!res.ok) return [];
  const data = await res.json();
  return Array.isArray(data.items) ? data.items : [];
}

function escapeXml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function buildSitemapXml(urls) {
  const lines = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
  ];
  for (const entry of urls) {
    lines.push('  <url>');
    lines.push(`    <loc>${escapeXml(entry.loc)}</loc>`);
    if (entry.lastmod) lines.push(`    <lastmod>${escapeXml(entry.lastmod)}</lastmod>`);
    if (entry.changefreq) lines.push(`    <changefreq>${escapeXml(entry.changefreq)}</changefreq>`);
    if (entry.priority) lines.push(`    <priority>${escapeXml(entry.priority)}</priority>`);
    lines.push('  </url>');
  }
  lines.push('</urlset>');
  return `${lines.join('\n')}\n`;
}

export default async function handler(req) {
  const origin = new URL(req.url).origin;
  const stories = await fetchStories(origin);
  const storyUrls = await Promise.all(
    stories.map(async item => {
      const storyId = await buildStoryId(item.url || item.link || '');
      if (!storyId) return null;
      return {
        loc: `${SITE_URL}/story/${storyId}`,
        changefreq: 'daily',
        priority: '0.6',
        lastmod: formatLastmod(item.publishedAt || item.pubDate),
      };
    })
  );
  const urls = [
    {
      loc: `${SITE_URL}/`,
      changefreq: 'hourly',
      priority: '1.0',
      lastmod: new Date().toISOString().split('T')[0],
    },
    ...storyUrls.filter(Boolean),
  ];
  const xml = buildSitemapXml(urls);
  return new Response(xml, {
    status: 200,
    headers: {
      'Content-Type': 'application/xml',
      'Cache-Control': 'public, max-age=0, must-revalidate',
      'CDN-Cache-Control': 's-maxage=3600, stale-while-revalidate=86400',
    },
  });
}
