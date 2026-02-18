/**
 * Qué Se Dice — RSS Feed Aggregator
 * Vercel Edge Function
 * 
 * Agrega noticias de múltiples fuentes argentinas e internacionales
 * Cache: 10 minutos en CDN, stale-while-revalidate para UX instantáneo
 */

export const config = { runtime: 'edge' };

// ── Feed Sources ──────────────────────────────────────────────
const FEEDS = {
  portada: {
    label: 'Portada',
    feeds: [
      'https://news.google.com/rss?hl=es-419&gl=AR&ceid=AR:es',
    ]
  },
  argentina: {
    label: 'Argentina',
    feeds: [
      'https://news.google.com/rss/search?q=Argentina&hl=es-419&gl=AR&ceid=AR:es',
    ]
  },
  corrientes: {
    label: 'Corrientes',
    feeds: [
      'https://news.google.com/rss/search?q=Corrientes+Argentina&hl=es-419&gl=AR&ceid=AR:es',
      'https://news.google.com/rss/search?q=NEA+Nordeste+Argentino&hl=es-419&gl=AR&ceid=AR:es',
    ]
  },
  mundo: {
    label: 'Mundo',
    feeds: [
      'https://news.google.com/rss/topics/CAAqJggKIiBDQkFTRWdvSUwyMHZNRGx1YlY4U0FtVnpHZ0pCVWlnQVAB?hl=es-419&gl=AR&ceid=AR:es',
    ]
  },
  deportes: {
    label: 'Deportes',
    feeds: [
      'https://news.google.com/rss/topics/CAAqJggKIiBDQkFTRWdvSUwyMHZNRFp1ZEdvU0FtVnpHZ0pCVWlnQVAB?hl=es-419&gl=AR&ceid=AR:es',
    ]
  },
  economia: {
    label: 'Economía',
    feeds: [
      'https://news.google.com/rss/topics/CAAqJggKIiBDQkFTRWdvSUwyMHZNRGx6TVdZU0FtVnpHZ0pCVWlnQVAB?hl=es-419&gl=AR&ceid=AR:es',
    ]
  },
  tecnologia: {
    label: 'Tecnología',
    feeds: [
      'https://news.google.com/rss/topics/CAAqJggKIiBDQkFTRWdvSUwyMHZNRGRqTVhZU0FtVnpHZ0pCVWlnQVAB?hl=es-419&gl=AR&ceid=AR:es',
    ]
  },
  espectaculos: {
    label: 'Espectáculos',
    feeds: [
      'https://news.google.com/rss/topics/CAAqJggKIiBDQkFTRWdvSUwyMHZNREpxYW5RU0FtVnpHZ0pCVWlnQVAB?hl=es-419&gl=AR&ceid=AR:es',
    ]
  }
};

// ── XML Parser (lightweight, edge-compatible) ─────────────────
function parseRSSItems(xml) {
  const items = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/gi;
  let match;

  while ((match = itemRegex.exec(xml)) !== null) {
    const block = match[1];

    const title = extractTag(block, 'title');
    const link = extractTag(block, 'link');
    const pubDate = extractTag(block, 'pubDate');
    const description = extractTag(block, 'description');
    const source = extractTag(block, 'source');
    const sourceUrl = extractAttr(block, 'source', 'url');

    if (title && link) {
      const normalizedTitle = normalizeTitle(decodeEntities(title));
      items.push({
        title: normalizedTitle,
        link,
        pubDate: pubDate || null,
        timestamp: pubDate ? new Date(pubDate).getTime() : 0,
        description: description ? stripHtml(decodeEntities(description)) : '',
        source: source ? decodeEntities(source) : extractDomain(link),
        sourceUrl: sourceUrl || null,
      });
    }
  }

  return items.filter(item => validateItem(item));
}

function extractTag(xml, tag) {
  // Handle CDATA
  const cdataRegex = new RegExp(`<${tag}[^>]*>\\s*<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>\\s*</${tag}>`, 'i');
  const cdataMatch = xml.match(cdataRegex);
  if (cdataMatch) return cdataMatch[1].trim();

  const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'i');
  const match = xml.match(regex);
  return match ? match[1].trim() : '';
}

function extractAttr(xml, tag, attr) {
  const regex = new RegExp(`<${tag}[^>]*${attr}="([^"]*)"`, 'i');
  const match = xml.match(regex);
  return match ? match[1] : '';
}

function decodeEntities(str) {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, '/')
    .replace(/&apos;/g, "'");
}

function normalizeTitle(title) {
  if (!title) return '';
  let cleaned = title
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/\s+/g, ' ')
    .trim();

  const pipeCount = (cleaned.match(/\|/g) || []).length;
  if (pipeCount > 2) {
    cleaned = cleaned.split('|')[0].trim();
  }

  cleaned = cleaned.replace(/\s[-|]\s[^-|]+$/, '').trim();
  return cleaned;
}

function isRepeatedTitle(title) {
  const normalized = title.toLowerCase().trim();
  const separators = [' - ', ' | ', ' — ', ' – ', ' · '];
  for (const sep of separators) {
    if (!normalized.includes(sep)) continue;
    const parts = normalized.split(sep).map(p => p.trim()).filter(Boolean);
    if (parts.length === 2 && parts[0] === parts[1]) return true;
  }
  return false;
}

function validateItem(item) {
  const title = item && item.title ? item.title.trim() : '';
  if (!title) return false;
  const link = item && item.link ? item.link.trim() : '';
  if (!link) return false;
  try {
    new URL(link);
  } catch {
    return false;
  }
  if (isRepeatedTitle(title)) return false;
  return true;
}

function stripHtml(str) {
  return str.replace(/<[^>]*>/g, '').trim();
}

function extractDomain(url) {
  try {
    const hostname = new URL(url).hostname;
    return hostname.replace(/^www\./, '');
  } catch {
    return 'Fuente';
  }
}

// ── Deduplication ─────────────────────────────────────────────
function deduplicateItems(items) {
  const seen = new Set();
  const unique = [];

  for (const item of items) {
    const normalized = item.title.toLowerCase()
      .replace(/[^\w\s]/g, '')
      .replace(/\s+/g, ' ')
      .trim();

    const words = new Set(normalized.split(' ').filter(w => w.length >= 4));

    let isDupe = false;
    for (const seenWords of seen) {
      const intersection = [...words].filter(w => seenWords.has(w));
      const similarity = intersection.length / Math.min(words.size, seenWords.size);
      if (similarity > 0.55) {
        isDupe = true;
        break;
      }
    }

    if (!isDupe && words.size > 0) {
      seen.add(words);
      unique.push(item);
    }
  }

  return unique;
}

// ── Trending Keywords ─────────────────────────────────────────
function extractTrending(items, maxKeywords = 12) {
  const stopwords = new Set([
    'para', 'como', 'desde', 'hasta', 'sobre', 'entre', 'tras', 'ante',
    'bajo', 'contra', 'según', 'durante', 'mediante', 'sino', 'pero',
    'porque', 'cuando', 'donde', 'quien', 'cual', 'este', 'esta', 'esto',
    'estos', 'estas', 'aquel', 'aquella', 'todo', 'toda', 'todos', 'todas',
    'otro', 'otra', 'otros', 'otras', 'mismo', 'misma', 'cada', 'poco',
    'mucho', 'algo', 'nada', 'muy', 'más', 'menos', 'también', 'además',
    'después', 'antes', 'ahora', 'aquí', 'allí', 'así', 'bien', 'solo',
    'siempre', 'nunca', 'gran', 'nuevo', 'nueva', 'nuevos', 'nuevas',
    'dice', 'dijo', 'hizo', 'hacer', 'tiene', 'puede', 'será', 'está',
    'fue', 'ser', 'hay', 'son', 'han', 'van', 'qué', 'por', 'del', 'con',
    'una', 'los', 'las', 'que', 'the', 'and', 'for', 'with',
    'news', 'google', 'com', 'argentina', 'país', 'año', 'años', 'día',
    'hoy', 'ayer', 'semana', 'mes', 'tiempo', 'caso', 'parte', 'forma',
    'vez', 'vida', 'mundo', 'gobierno', 'país', 'últimas', 'última',
    'primera', 'primer', 'segundo', 'segunda', 'mejor', 'peor',
  ]);

  const freq = {};
  for (const item of items) {
    const words = item.title.toLowerCase()
      .replace(/[^\wáéíóúñü\s]/g, '')
      .split(/\s+/)
      .filter(w => w.length >= 3 && !stopwords.has(w) && !/^\d+$/.test(w));

    const uniqueInTitle = new Set(words);
    for (const word of uniqueInTitle) {
      freq[word] = (freq[word] || 0) + 1;
    }
  }

  return Object.entries(freq)
    .filter(([, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, maxKeywords)
    .map(([word, count]) => ({ word, count }));
}

// ── Handler ───────────────────────────────────────────────────
export default async function handler(req) {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const url = new URL(req.url);
  const category = url.searchParams.get('cat') || 'portada';
  const feedConfig = FEEDS[category];

  if (!feedConfig) {
    return new Response(JSON.stringify({ error: 'Categoría inválida', categories: Object.keys(FEEDS) }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }

  try {
    // Fetch all feeds in parallel
    const feedPromises = feedConfig.feeds.map(async (feedUrl) => {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 12000);

        const response = await fetch(feedUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Accept': 'application/rss+xml, application/xml, text/xml, */*',
          },
          signal: controller.signal,
        });

        clearTimeout(timeout);

        if (!response.ok) return [];
        const xml = await response.text();
        return parseRSSItems(xml);
      } catch (err) {
        console.error(`Feed error: ${feedUrl}`, err.message);
        return [];
      }
    });

    const feedResults = await Promise.all(feedPromises);
    let allItems = feedResults.flat();

    // Sort by date (newest first)
    allItems.sort((a, b) => b.timestamp - a.timestamp);

    // Deduplicate
    allItems = deduplicateItems(allItems);

    // Extract trending from all items
    const trending = extractTrending(allItems);

    // Limit results
    const items = allItems.slice(0, 50);

    return new Response(JSON.stringify({
      category,
      label: feedConfig.label,
      items,
      trending,
      total: items.length,
      timestamp: new Date().toISOString(),
      categories: Object.entries(FEEDS).map(([key, val]) => ({ key, label: val.label })),
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
        ...corsHeaders,
      },
    });
  } catch (error) {
    console.error('Feed handler error:', error);
    return new Response(JSON.stringify({ error: 'Error al obtener noticias', message: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }
}
