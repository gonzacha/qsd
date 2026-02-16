/**
 * Qué Se Dice — Google News URL Resolver
 * 
 * Google News RSS devuelve URLs encriptadas tipo:
 * https://news.google.com/rss/articles/CBMi5wFBVV95cUxN...
 * 
 * Este endpoint sigue el redirect y devuelve la URL real del artículo:
 * https://www.infobae.com/teleshow/2026/02/15/juana-repetto...
 * 
 * Uso:
 *   GET /api/resolve?url=https://news.google.com/rss/articles/...
 *   → { "resolved": "https://www.infobae.com/...", "source": "infobae.com" }
 * 
 * También acepta POST con array de URLs para resolver en batch.
 */

export const config = { runtime: 'edge' };

async function resolveUrl(googleNewsUrl) {
  try {
    // Follow redirects manually to get final URL
    const response = await fetch(googleNewsUrl, {
      method: 'HEAD',
      redirect: 'follow',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
      signal: AbortSignal.timeout(8000),
    });

    const finalUrl = response.url;

    // If we got redirected to the actual article
    if (finalUrl && !finalUrl.includes('news.google.com')) {
      return {
        resolved: finalUrl,
        source: extractDomain(finalUrl),
      };
    }

    // Fallback: try GET and look for meta refresh or canonical
    const getResponse = await fetch(googleNewsUrl, {
      redirect: 'follow',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
      signal: AbortSignal.timeout(8000),
    });

    const finalGetUrl = getResponse.url;
    if (finalGetUrl && !finalGetUrl.includes('news.google.com')) {
      return {
        resolved: finalGetUrl,
        source: extractDomain(finalGetUrl),
      };
    }

    // Last resort: return original
    return { resolved: googleNewsUrl, source: 'news.google.com' };
  } catch (err) {
    return { resolved: googleNewsUrl, source: 'news.google.com', error: err.message };
  }
}

function extractDomain(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

export default async function handler(req) {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  // Single URL resolve (GET)
  if (req.method === 'GET') {
    const { searchParams } = new URL(req.url);
    const url = searchParams.get('url');

    if (!url) {
      return new Response(JSON.stringify({ error: 'Missing url parameter' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    const result = await resolveUrl(url);

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=86400, s-maxage=86400',
        ...corsHeaders,
      },
    });
  }

  // Batch resolve (POST)
  if (req.method === 'POST') {
    try {
      const { urls } = await req.json();

      if (!Array.isArray(urls) || urls.length === 0) {
        return new Response(JSON.stringify({ error: 'Expected { urls: [...] }' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }

      // Resolve in parallel, max 10 concurrent
      const MAX_CONCURRENT = 10;
      const results = [];

      for (let i = 0; i < urls.length; i += MAX_CONCURRENT) {
        const batch = urls.slice(i, i + MAX_CONCURRENT);
        const batchResults = await Promise.all(batch.map(resolveUrl));
        results.push(...batchResults);
      }

      return new Response(JSON.stringify({ results }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'public, max-age=86400, s-maxage=86400',
          ...corsHeaders,
        },
      });
    } catch (err) {
      return new Response(JSON.stringify({ error: 'Invalid request body' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }
  }

  return new Response('Method not allowed', { status: 405, headers: corsHeaders });
}
