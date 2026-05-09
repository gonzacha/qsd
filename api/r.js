/**
 * Qué Se Dice — Redirect Tracker
 *
 * /r?u=<original_url>
 * Resolves Google News redirects and sends 302 to final URL.
 */

export const config = { runtime: 'edge' };

const ALLOWED_HOSTS = new Set([
  'news.google.com',
  'google.com',
  'www.google.com',
  'quesedice.com.ar',
  'www.quesedice.com.ar',
  'qsd-seven.vercel.app',
]);

const ALLOWED_SUFFIXES = [
  '.com.ar',
  '.com',
  '.org',
  '.net',
  '.gob.ar',
  '.gov.ar',
  '.tv',
  '.es',
  '.co',
  '.io',
  '.news',
];

function isHttpUrl(raw) {
  try {
    const url = new URL(raw);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

function isAllowedHost(raw) {
  try {
    const url = new URL(raw);
    const host = url.hostname.toLowerCase();
    if (ALLOWED_HOSTS.has(host)) return true;
    return ALLOWED_SUFFIXES.some(suffix => host.endsWith(suffix));
  } catch {
    return false;
  }
}

async function resolveFinalUrl(url) {
  try {
    const head = await fetch(url, {
      method: 'HEAD',
      redirect: 'follow',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
      signal: AbortSignal.timeout(8000),
    });
    if (head.url && !head.url.includes('news.google.com')) return head.url;

    const getRes = await fetch(url, {
      redirect: 'follow',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
      signal: AbortSignal.timeout(8000),
    });
    if (getRes.url) return getRes.url;
  } catch {}
  return url;
}

export default async function handler(req) {
  const { searchParams } = new URL(req.url);
  const rawUrl = searchParams.get('u');

  if (!rawUrl || !isHttpUrl(rawUrl) || !isAllowedHost(rawUrl)) {
    return new Response('Bad Request', {
      status: 400,
      headers: { 'Cache-Control': 'no-store' },
    });
  }

  const finalUrl = await resolveFinalUrl(rawUrl);
  if (!isHttpUrl(finalUrl) || !isAllowedHost(finalUrl)) {
    return new Response('Bad Request', {
      status: 400,
      headers: { 'Cache-Control': 'no-store' },
    });
  }
  return new Response(null, {
    status: 302,
    headers: {
      'Location': finalUrl,
      'Cache-Control': 'no-store',
    },
  });
}
