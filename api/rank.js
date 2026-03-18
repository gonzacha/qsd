/**
 * Qué Se Dice — Nordia Quality Rank
 * Vercel Edge Function
 *
 * Pipeline: RSS fetch → Quality Enrich → Factos Score → Editorial Rank
 * Compatible with /api/feeds.js (same RSS sources, no shared imports needed).
 */

export const config = { runtime: 'edge' };

// ── Corrientes 2.5 Dictionaries (deterministic) ───────────────
const DICT_CAPITAL = [
  'polich',
  'claudio polich',
  'intendente',
  'intendencia',
  'municipalidad',
  'municipio',
  'concejo deliberante',
  'concejales',
  'ediles',
  'ciudad de corrientes',
  'ejecutivo municipal',
  'comuna',
];

const DICT_PROVINCIA = [
  'valdés',
  'gustavo valdés',
  'gobernador',
  'tassano',
  'eduardo tassano',
  'diputados',
  'cámara de diputados',
  'senado',
  'senadores',
  'legislatura',
  'legisladores',
  'proyecto de ley',
  'ley provincial',
  'gobierno provincial',
  'ministerio provincial',
  'palacio legislativo',
];

const DICT_CORRIENTES_GENERAL = [
  'corrientes',
  'provincia de corrientes',
  'capital correntina',
  'resistencia',
  'chaco',
  'formosa',
  'misiones',
  'posadas',
  'nordeste',
  'nea',
  'litoral',
  'paraná',
  'iberá',
  'mercedes',
  'goya',
  'curuzú cuatiá',
  'paso de los libres',
  'bella vista',
  'santo tomé',
  'mburucuyá',
  'ituzaingó',
];

// ── Source Tiering (deterministic v0.1) ───────────────────────
const SOURCE_TIER_CONFIG = {
  tiers: [
    {
      id: 'tier_1',
      weight: 1.0,
      meaning: 'strong primary/provincial reporting',
      sources: [
        'lanacion.com.ar',
        'la nacion',
        'clarin.com',
        'clarin',
        'infobae.com',
        'infobae',
        'perfil.com',
        'perfil',
        'eldiarioar.com',
        'el diario ar',
      ],
    },
    {
      id: 'tier_2',
      weight: 0.7,
      meaning: 'credible secondary/local coverage',
      sources: [
        'argentina.gob.ar',
        'argentina gob ar',
        'ellitoral.com.ar',
        'el litoral',
        'nordesteya.com',
        'nordeste ya',
        'diarioellibertador.com.ar',
        'diario el libertador',
        'diarioprimeralinea.com.ar',
        'primera linea',
        'radiosudamericana.com',
        'radio sudamericana',
      ],
    },
    {
      id: 'tier_3',
      weight: 0.4,
      meaning: 'municipal or low-originality coverage',
      sources: [
        'municipalidad',
        'prensa',
        'gobierno',
      ],
    },
    {
      id: 'tier_4',
      weight: 0.2,
      meaning: 'repost/weak signal source',
      sources: [
        'facebook',
        'twitter',
        'blogspot',
      ],
    },
  ],
  unknown_default: 0.5,
};

// ── Feed Sources (all categories for maximum pool) ────────────
const FEED_SOURCES = [
  { url: 'https://news.google.com/rss?hl=es-419&gl=AR&ceid=AR:es', category: 'portada' },
  { url: 'https://news.google.com/rss/search?q=Argentina&hl=es-419&gl=AR&ceid=AR:es', category: 'argentina' },
  { url: 'https://news.google.com/rss/search?q=Corrientes+Argentina&hl=es-419&gl=AR&ceid=AR:es', category: 'corrientes' },
  { url: 'https://news.google.com/rss/topics/CAAqJggKIiBDQkFTRWdvSUwyMHZNRGx1YlY4U0FtVnpHZ0pCVWlnQVAB?hl=es-419&gl=AR&ceid=AR:es', category: 'mundo' },
  { url: 'https://news.google.com/rss/topics/CAAqJggKIiBDQkFTRWdvSUwyMHZNRFp1ZEdvU0FtVnpHZ0pCVWlnQVAB?hl=es-419&gl=AR&ceid=AR:es', category: 'deportes' },
  { url: 'https://news.google.com/rss/topics/CAAqJggKIiBDQkFTRWdvSUwyMHZNRGx6TVdZU0FtVnpHZ0pCVWlnQVAB?hl=es-419&gl=AR&ceid=AR:es', category: 'economia' },
];

// ── RSS helpers (edge-compatible, no imports) ─────────────────
function extractTag(xml, tag) {
  const cdata = xml.match(new RegExp(`<${tag}[^>]*>\\s*<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>\\s*</${tag}>`, 'i'));
  if (cdata) return cdata[1].trim();
  const plain = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'i'));
  return plain ? plain[1].trim() : '';
}

function extractAttr(xml, tag, attr) {
  const m = xml.match(new RegExp(`<${tag}[^>]*${attr}="([^"]*)"`, 'i'));
  return m ? m[1] : '';
}

function decodeEntities(str) {
  return str
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, '/').replace(/&apos;/g, "'");
}

function normalizeTitle(title) {
  if (!title) return '';
  let s = title.replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&').replace(/\s+/g, ' ').trim();
  if ((s.match(/\|/g) || []).length > 2) s = s.split('|')[0].trim();
  return s.replace(/\s[-|]\s[^-|]+$/, '').trim();
}

function normalizeText(text) {
  if (!text) return '';
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeSourceKey(source) {
  if (!source) return '';
  return normalizeText(source);
}

function buildSourceWeightMap(config) {
  const map = {};
  for (const tier of config.tiers) {
    for (const source of tier.sources) {
      const key = normalizeSourceKey(source);
      if (key) map[key] = tier.weight;
    }
  }
  return map;
}

const SOURCE_WEIGHT_MAP = buildSourceWeightMap(SOURCE_TIER_CONFIG);

const DICT_CAPITAL_NORM = DICT_CAPITAL.map(term => normalizeText(term));
const DICT_PROVINCIA_NORM = DICT_PROVINCIA.map(term => normalizeText(term));
const DICT_CORRIENTES_GENERAL_NORM = DICT_CORRIENTES_GENERAL.map(term => normalizeText(term));

function countHits(normalizedText, dict) {
  let hits = 0;
  for (const term of dict) {
    if (normalizedText.includes(term)) hits += 1;
  }
  return hits;
}

function detectCorrientesEdition(text) {
  const normalized = normalizeText(text);
  const capitalHits = countHits(normalized, DICT_CAPITAL_NORM);
  const provinciaHits = countHits(normalized, DICT_PROVINCIA_NORM);
  if (capitalHits >= 2 && provinciaHits < 2) return 'corrientes_capital';
  if (provinciaHits >= 2 && capitalHits < 2) return 'corrientes_provincia';
  return 'corrientes';
}

function stripHtml(str) { return str.replace(/<[^>]*>/g, '').trim(); }

function extractDomain(url) {
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return 'Fuente'; }
}

function getSourceWeight(item) {
  const candidates = [
    item.source,
    item.sourceUrl ? extractDomain(item.sourceUrl) : '',
    item.link ? extractDomain(item.link) : '',
  ].filter(Boolean);
  for (const candidate of candidates) {
    const key = normalizeSourceKey(candidate);
    if (key && Object.prototype.hasOwnProperty.call(SOURCE_WEIGHT_MAP, key)) {
      return SOURCE_WEIGHT_MAP[key];
    }
  }
  return SOURCE_TIER_CONFIG.unknown_default;
}

function isRepeatedTitle(title) {
  const norm = title.toLowerCase().trim();
  for (const sep of [' - ', ' | ', ' — ', ' – ', ' · ']) {
    if (!norm.includes(sep)) continue;
    const parts = norm.split(sep).map(p => p.trim()).filter(Boolean);
    if (parts.length === 2 && parts[0] === parts[1]) return true;
  }
  return false;
}

function parseRSSItems(xml, category) {
  const items = [];
  const re = /<item>([\s\S]*?)<\/item>/gi;
  let m;
  while ((m = re.exec(xml)) !== null) {
    const b = m[1];
    const title = extractTag(b, 'title');
    const link  = extractTag(b, 'link');
    if (!title || !link) continue;
    const normalTitle = normalizeTitle(decodeEntities(title));
    if (!normalTitle || isRepeatedTitle(normalTitle)) continue;
    try { new URL(link); } catch { continue; }
    const pubDate = extractTag(b, 'pubDate') || null;
    const description = extractTag(b, 'description');
    const source = extractTag(b, 'source');
    const descriptionText = description ? stripHtml(decodeEntities(description)) : '';
    const edition = category === 'corrientes'
      ? detectCorrientesEdition(`${normalTitle} ${descriptionText}`)
      : category || null;
    items.push({
      title: normalTitle,
      link,
      pubDate,
      timestamp: pubDate ? new Date(pubDate).getTime() : 0,
      description: descriptionText,
      source: source ? decodeEntities(source) : extractDomain(link),
      sourceUrl: extractAttr(b, 'source', 'url') || null,
      category: category || null,
      edition,
    });
  }
  return items;
}

function deduplicateItems(items) {
  const seen = [];
  const unique = [];
  for (const item of items) {
    const norm = item.title.toLowerCase().replace(/[^\w\s]/g, '').replace(/\s+/g, ' ').trim();
    const words = new Set(norm.split(' ').filter(w => w.length >= 4));
    if (words.size === 0) continue;
    let isDupe = false;
    for (const seenWords of seen) {
      const inter = [...words].filter(w => seenWords.has(w));
      if (inter.length / Math.min(words.size, seenWords.size) > 0.55) { isDupe = true; break; }
    }
    if (!isDupe) { seen.push(words); unique.push(item); }
  }
  return unique;
}

// ── Quality Enrich ────────────────────────────────────────────
const CONTRADICTION_WORDS = ['desmiente', 'niega', 'fake', 'falso'];

// High-frequency words that appear in almost every Argentina news title —
// useless as cluster signals; mirror the stopwords from feeds.js trending.
const CLUSTER_STOPWORDS = new Set([
  'para', 'como', 'desde', 'hasta', 'sobre', 'entre', 'tras', 'ante',
  'bajo', 'contra', 'según', 'durante', 'sino', 'pero', 'porque',
  'cuando', 'donde', 'este', 'esta', 'esto', 'estos', 'estas',
  'todo', 'toda', 'todos', 'todas', 'otro', 'otra', 'otros', 'otras',
  'mismo', 'misma', 'cada', 'mucho', 'algo', 'nada', 'también',
  'después', 'antes', 'ahora', 'aquí', 'allí', 'bien', 'solo',
  'siempre', 'nunca', 'gran', 'nuevo', 'nueva', 'nuevos', 'nuevas',
  'dice', 'dijo', 'hizo', 'hacer', 'tiene', 'puede', 'será', 'está',
  'fue', 'ser', 'hay', 'son', 'han', 'van', 'por', 'del', 'con',
  'una', 'los', 'las', 'que', 'news', 'google', 'argentina',
  'país', 'año', 'años', 'día', 'hoy', 'ayer', 'semana', 'mes',
  'caso', 'parte', 'forma', 'vez', 'vida', 'mundo', 'gobierno',
  'última', 'primera', 'primer', 'segundo', 'mejor', 'peor',
]);

function computeClusterSizes(items) {
  const n = items.length;
  const sameEdition = (a, b) => (items[a].edition || '') === (items[b].edition || '');
  const tokenSets = items.map(item =>
    new Set(
      item.title.toLowerCase().split(/\s+/)
        .filter(w => w.length >= 4 && !CLUSTER_STOPWORDS.has(w))
    )
  );
  const parent = Array.from({ length: n }, (_, i) => i);
  const sourceWeights = items.map(item => getSourceWeight(item));

  function find(x) {
    while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x]; }
    return x;
  }
  function union(x, y) {
    const [px, py] = [find(x), find(y)];
    if (px !== py) parent[px] = py;
  }

  // Pass 1: threshold = 2
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (!sameEdition(i, j)) continue;
      let shared = 0;
      for (const w of tokenSets[i]) { if (tokenSets[j].has(w) && ++shared >= 2) break; }
      if (shared >= 2) union(i, j);
    }
  }

  // Pass 2: mega-cluster splitter — re-cluster any cluster > 20 with threshold = 3
  const roots1 = Array.from({ length: n }, (_, i) => find(i));
  const megaMap = {};
  roots1.forEach((r, i) => { (megaMap[r] = megaMap[r] || []).push(i); });
  for (const members of Object.values(megaMap)) {
    if (members.length <= 20) continue;
    const lp = {};
    members.forEach(i => { lp[i] = i; });
    const lFind = x => { while (lp[x] !== x) { lp[x] = lp[lp[x]]; x = lp[x]; } return x; };
    const lUnion = (x, y) => { const [px, py] = [lFind(x), lFind(y)]; if (px !== py) lp[px] = py; };
    for (let a = 0; a < members.length; a++) {
      for (let b = a + 1; b < members.length; b++) {
        const [i, j] = [members[a], members[b]];
        if (!sameEdition(i, j)) continue;
        let shared = 0;
        for (const w of tokenSets[i]) { if (tokenSets[j].has(w) && ++shared >= 3) break; }
        if (shared >= 3) lUnion(i, j);
      }
    }
    for (const i of members) parent[i] = lFind(i);
  }

  const roots = Array.from({ length: n }, (_, i) => find(i));
  const sizes = {};
  const weightedSizes = {};
  roots.forEach((r, i) => {
    sizes[r] = (sizes[r] || 0) + 1;
    weightedSizes[r] = (weightedSizes[r] || 0) + sourceWeights[i];
  });
  return {
    sizes: roots.map(r => sizes[r]),
    weightedSizes: roots.map(r => weightedSizes[r]),
    sourceWeights,
  };
}

function qualityEnrich(items) {
  const clusterStats = computeClusterSizes(items);
  return items.map((item, i) => {
    const publishedAt = item.pubDate || item.date || item.isoDate || null;
    const sources_count = clusterStats.sizes[i];
    const weighted_sources_count = clusterStats.weightedSizes[i];
    const sources_effective = Math.min(sources_count, 5);
    const weighted_sources_effective = Math.min(weighted_sources_count, 5);
    const agreement_ratio = Math.min(sources_effective / 5, 1);
    const weighted_agreement_ratio = Math.min(weighted_sources_effective / 5, 1);
    const contradiction_flag = CONTRADICTION_WORDS.some(w => item.title.toLowerCase().includes(w));
    const quality_flags = Array.isArray(item.quality_flags) ? [...item.quality_flags] : [];
    let quality_penalty = Number.isFinite(item.quality_penalty) ? item.quality_penalty : 0;
    const descriptionText = item.description || item.summary || item.snippet || '';
    const normTitle = normalizeText(item.title);
    const normDesc = normalizeText(descriptionText);
    if (descriptionText && descriptionText.trim() && normTitle && normDesc && normDesc.includes(normTitle)) {
      if (!quality_flags.includes('title_echo_desc')) quality_flags.push('title_echo_desc');
      quality_penalty += 10;
    }
    if (item.edition === 'corrientes_capital') {
      const driftText = normalizeText(`${item.title} ${descriptionText}`);
      const provinciaHits = countHits(driftText, DICT_PROVINCIA_NORM);
      if (provinciaHits >= 2) {
        if (!quality_flags.includes('power_branch_drift')) quality_flags.push('power_branch_drift');
        quality_penalty += 15;
      }
    }
    return {
      ...item,
      publishedAt,
      sources_count,
      weighted_sources_count,
      sources_effective,
      weighted_sources_effective,
      agreement_ratio,
      weighted_agreement_ratio,
      contradiction_flag,
      quality_flags,
      quality_penalty,
      source_weight: clusterStats.sourceWeights[i],
    };
  });
}

// ── Factos Score ──────────────────────────────────────────────
function parseHoursSince(publishedAt) {
  if (!publishedAt) return 24;
  try {
    const t = new Date(publishedAt).getTime();
    if (isNaN(t)) return 24;
    return Math.max(0, (Date.now() - t) / 3_600_000);
  } catch { return 24; }
}

function convergenceScore(sources_count, agreement_ratio, contradiction_flag, hours) {
  if (sources_count <= 0) return 0;
  const ar = Math.max(0, Math.min(1, agreement_ratio));
  const h  = Math.max(0, hours);
  const base      = Math.min(sources_count / 5, 1);
  const freshness = Math.max(0, Math.min(1, 1 - h / 24));
  const penalty   = contradiction_flag ? 0.4 : 0;
  return Math.max(0, Math.min(1, (base * 0.4) + (ar * 0.4) + (freshness * 0.2) - penalty));
}

// ── Editorial Rank ────────────────────────────────────────────
function rankItems(enriched) {
  const scored = enriched.map(item => {
    const hours_since_publish = parseHoursSince(item.publishedAt);
    const se = item.sources_effective ?? Math.min(item.sources_count, 5);
    const seWeighted = Number.isFinite(item.weighted_sources_effective)
      ? item.weighted_sources_effective
      : se;
    const arWeighted = Number.isFinite(item.weighted_agreement_ratio)
      ? item.weighted_agreement_ratio
      : item.agreement_ratio;
    const factos_final = convergenceScore(
      seWeighted, arWeighted, item.contradiction_flag, hours_since_publish
    );
    const freshness = Math.max(0, 1 - hours_since_publish / 24);

    // Geo-boost: contenido de Corrientes/NEA sube en portada
    const text = normalizeText(`${item.title} ${item.description || ''}`);
    const isLocal = countHits(text, DICT_CORRIENTES_GENERAL_NORM) >= 1 ||
                    countHits(text, DICT_CAPITAL_NORM) >= 1 ||
                    countHits(text, DICT_PROVINCIA_NORM) >= 1;
    const geoBoost = isLocal ? 0.15 : 0;

    const editorial_score = Math.min(1, (factos_final * 0.7) + (freshness * 0.3) + geoBoost);

    return {
      factos_final,
      editorial_score,
      hours_since_publish,
      sources_count: item.sources_count,
      weighted_sources_count: item.weighted_sources_count,
      sources_effective: se,
      weighted_sources_effective: seWeighted,
      weighted_agreement_ratio: arWeighted,
      quality_flags: item.quality_flags || [],
      quality_penalty: item.quality_penalty || 0,
      edition: item.edition || null,
      category: item.category || null,
      title: item.title,
      description: item.description || null,
      url: item.link,
      publishedAt: item.publishedAt,
      source: item.source,
    };
  });

  scored.sort((a, b) => b.editorial_score - a.editorial_score);
  return scored.map((item, i) => ({ rank: i + 1, ...item }));
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

  const params  = new URL(req.url).searchParams;
  const cat      = params.get('cat') || params.get('category') || '';
  const limit    = Math.max(1, parseInt(params.get('limit') || '30', 10));
  const minScore = parseFloat(params.get('min') || '0');
  const format   = params.get('format') || 'json';

  try {
    const sources = cat
      ? FEED_SOURCES.filter(feed => feed.category === cat)
      : FEED_SOURCES;

    // Fetch feed URLs in parallel
    const results = await Promise.all(
      sources.map(async feed => {
        try {
          const ctrl = new AbortController();
          const timer = setTimeout(() => ctrl.abort(), 12000);
          const res = await fetch(feed.url, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
              'Accept': 'application/rss+xml, application/xml, text/xml, */*',
            },
            signal: ctrl.signal,
          });
          clearTimeout(timer);
          if (!res.ok) return [];
          return parseRSSItems(await res.text(), feed.category);
        } catch { return []; }
      })
    );

    // Merge, sort newest-first, deduplicate
    let items = results.flat();
    if (cat) {
      items = items.filter(item => (item.category || '') === cat);
    }
    items.sort((a, b) => b.timestamp - a.timestamp);

    items = items.map(item => ({
      ...item,
      edition: item.edition || item.category || cat || 'unknown',
    }));

    // Quality enrich (cluster before dedup so sources_count reflects raw pool)
    const enriched = qualityEnrich(items);

    // Deduplicate (preserves per-item sources_count already set)
    const deduped = deduplicateItems(enriched);

    // Score and rank
    let ranked = rankItems(deduped);

    // Filter and limit
    if (minScore > 0) ranked = ranked.filter(r => r.editorial_score >= minScore);
    ranked = ranked.slice(0, limit);

    const generatedAt = new Date().toISOString();

    if (format === 'jsonl') {
      return new Response(
        ranked.map(r => JSON.stringify(r)).join('\n'),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/x-ndjson',
            'Cache-Control': 'no-store',
            'CDN-Cache-Control': 's-maxage=60, stale-while-revalidate=300, stale-if-error=86400',
            ...corsHeaders,
          },
        }
      );
    }

    return new Response(
      JSON.stringify({ generatedAt, items: ranked }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store',
          'CDN-Cache-Control': 's-maxage=60, stale-while-revalidate=300, stale-if-error=86400',
          ...corsHeaders,
        },
      }
    );

  } catch (error) {
    return new Response(
      JSON.stringify({ error: 'Rank pipeline error', message: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  }
}
