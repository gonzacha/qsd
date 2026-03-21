const DEFAULT_PROXY_PATH = '/api/story-image';

function isHttpUrl(raw) {
  try {
    const url = new URL(raw);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

function normalizeImageUrl(raw, baseUrl) {
  if (!raw) return '';
  const trimmed = String(raw).trim();
  if (!trimmed) return '';
  if (trimmed.startsWith('//')) return `https:${trimmed}`;
  try {
    return new URL(trimmed, baseUrl).toString();
  } catch {
    return '';
  }
}

function extractMetaContent(html, key) {
  const re = new RegExp(
    `<meta[^>]+(?:property|name)=[\"']${key}[\"'][^>]*content=[\"']([^\"']+)[\"'][^>]*>`,
    'i'
  );
  const match = html.match(re);
  return match ? match[1].trim() : '';
}

function extractLinkImage(html) {
  const re = /<link[^>]+rel=[\"']image_src[\"'][^>]*href=[\"']([^\"']+)[\"'][^>]*>/i;
  const match = html.match(re);
  return match ? match[1].trim() : '';
}

function pickDirectImage(item) {
  const candidates = [
    item.image,
    item.image_url,
    item.imageUrl,
    item.thumbnail,
    item.thumbnail_url,
    item.media,
    item.media_url,
    item.enclosure,
    item.enclosure_url,
    item['media:content'],
    item['media:thumbnail'],
  ];
  return candidates.find(isHttpUrl) || '';
}

async function fetchHtml(url, timeoutMs = 6000) {
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    'Accept': 'text/html,application/xhtml+xml',
  };
  if (typeof AbortController === 'undefined') {
    const res = await fetch(url, { headers });
    if (!res.ok) return '';
    return res.text();
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { headers, signal: controller.signal });
    if (!res.ok) return '';
    return await res.text();
  } finally {
    clearTimeout(timer);
  }
}

async function resolveStoryImage(item, options = {}) {
  if (!item) return '';
  const direct = pickDirectImage(item);
  if (direct) return normalizeImageUrl(direct, item.url || item.link);

  const link = item.url || item.link || '';
  if (!isHttpUrl(link)) return '';

  if (options.useProxy && options.origin) {
    try {
      const proxyUrl = `${options.origin}${DEFAULT_PROXY_PATH}?u=${encodeURIComponent(link)}`;
      const res = await fetch(proxyUrl, { headers: { 'Accept': 'application/json' } });
      if (!res.ok) return '';
      const data = await res.json();
      return isHttpUrl(data.image) ? data.image : '';
    } catch {
      return '';
    }
  }

  try {
    const html = await fetchHtml(link, options.timeoutMs || 6000);
    if (!html) return '';
    const slice = html.slice(0, 200000);
    const og = extractMetaContent(slice, 'og:image');
    const tw = extractMetaContent(slice, 'twitter:image');
    const linkImage = extractLinkImage(slice);
    const candidate = og || tw || linkImage;
    return normalizeImageUrl(candidate, link);
  } catch {
    return '';
  }
}

globalThis.resolveStoryImage = resolveStoryImage;
