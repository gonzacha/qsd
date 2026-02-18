/**
 * Qué Se Dice — Dynamic OG Image Generator
 * 
 * Genera tarjetas SVG 1200x630 para social sharing.
 * Cada noticia compartida en WhatsApp/Twitter/Facebook
 * muestra una tarjeta con branding QSD + titular + fuente.
 * 
 * Uso:
 *   /api/og?title=El+titular+de+la+noticia&source=Infobae&cat=argentina
 *   /api/og (sin params = tarjeta genérica del portal)
 * 
 * Zero dependencies — SVG puro, edge-compatible.
 * Cache: 24h en CDN.
 * 
 * INTEGRACIÓN:
 * En index.html, las meta tags og:image deben apuntar a este endpoint.
 * Para share dinámico por noticia, el JS puede generar URLs tipo:
 *   https://tu-dominio.com/api/og?title=...&source=...&cat=...
 */

export const config = { runtime: 'edge' };

// ── Category config ───────────────────────────────────────────
const CATEGORIES = {
  portada:      { label: 'PORTADA',       accent: '#c9953a' },
  argentina:    { label: 'ARGENTINA',     accent: '#75aadb' },
  corrientes:   { label: 'CORRIENTES',    accent: '#c9953a' },
  mundo:        { label: 'MUNDO',         accent: '#6b9bd2' },
  deportes:     { label: 'DEPORTES',      accent: '#3ec470' },
  economia:     { label: 'ECONOMÍA',      accent: '#e4b65c' },
  tecnologia:   { label: 'TECNOLOGÍA',    accent: '#8b5cf6' },
  espectaculos: { label: 'ESPECTÁCULOS',  accent: '#e4587a' },
};

// ── Text utilities ────────────────────────────────────────────
function escapeXml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Word-wrap text into lines that fit a given character width.
 * Returns array of lines. SVG has no native text wrapping.
 */
function wrapText(text, maxCharsPerLine = 38) {
  const words = text.split(/\s+/);
  const lines = [];
  let current = '';

  for (const word of words) {
    const test = current ? `${current} ${word}` : word;
    if (test.length > maxCharsPerLine && current) {
      lines.push(current);
      current = word;
    } else {
      current = test;
    }
  }
  if (current) lines.push(current);

  // Max 4 lines, truncate with ellipsis
  if (lines.length > 4) {
    lines.length = 4;
    lines[3] = lines[3].substring(0, lines[3].length - 3) + '...';
  }

  return lines;
}

/**
 * Word-wrap for description (smaller font, more chars per line)
 */
function wrapDesc(text, maxCharsPerLine = 65) {
  if (!text) return [];
  const words = text.split(/\s+/);
  const lines = [];
  let current = '';

  for (const word of words) {
    const test = current ? `${current} ${word}` : word;
    if (test.length > maxCharsPerLine && current) {
      lines.push(current);
      current = word;
    } else {
      current = test;
    }
  }
  if (current) lines.push(current);

  if (lines.length > 2) {
    lines.length = 2;
    lines[1] = lines[1].substring(0, lines[1].length - 3) + '...';
  }

  return lines;
}

// ── SVG Generator ─────────────────────────────────────────────
function generateOG({ title, source, category, description, host }) {
  const cat = CATEGORIES[category] || CATEGORIES.portada;
  const accent = cat.accent;
  const catLabel = cat.label;
  const dateStr = new Date().toLocaleDateString('es-AR', { 
    day: 'numeric', month: 'long', year: 'numeric' 
  });
  const hasTitle = title && title.length > 0;
  const siteHost = host || 'localhost';

  // Title lines
  const titleLines = hasTitle
    ? wrapText(title, 36)
    : ['El pulso informativo', 'de Corrientes y el mundo'];
  
  const titleFontSize = titleLines.length > 3 ? 38 : titleLines.length > 2 ? 42 : 48;
  const titleLineHeight = titleFontSize * 1.25;
  const titleStartY = hasTitle ? 220 : 260;

  // Description lines
  const descLines = description ? wrapDesc(description, 62) : [];
  const descStartY = titleStartY + (titleLines.length * titleLineHeight) + 20;

  // Source display
  const sourceText = source || siteHost;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0.3" y2="1">
      <stop offset="0%" stop-color="#0f1220"/>
      <stop offset="100%" stop-color="#080a12"/>
    </linearGradient>
    <linearGradient id="gold" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#e4b65c"/>
      <stop offset="50%" stop-color="#c9953a"/>
      <stop offset="100%" stop-color="#8a6828"/>
    </linearGradient>
    <linearGradient id="accent" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="${accent}"/>
      <stop offset="100%" stop-color="${accent}88"/>
    </linearGradient>
    <linearGradient id="topline" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="${accent}"/>
      <stop offset="50%" stop-color="#e4b65c"/>
      <stop offset="100%" stop-color="${accent}"/>
    </linearGradient>
  </defs>

  <!-- Background -->
  <rect width="1200" height="630" fill="url(#bg)"/>

  <!-- Subtle grid texture -->
  <g opacity="0.015">
    ${Array.from({length: 31}, (_, i) => `<line x1="${i*40}" y1="0" x2="${i*40}" y2="630" stroke="#fff" stroke-width="1"/>`).join('\n    ')}
    ${Array.from({length: 16}, (_, i) => `<line x1="0" y1="${i*40}" x2="1200" y2="${i*40}" stroke="#fff" stroke-width="1"/>`).join('\n    ')}
  </g>

  <!-- Top gold line -->
  <rect x="0" y="0" width="1200" height="4" fill="url(#topline)"/>

  <!-- Left accent bar -->
  <rect x="0" y="4" width="6" height="626" fill="url(#accent)" opacity="0.6"/>

  <!-- ═══ HEADER ═══ -->
  
  <!-- Brand: QUÉ SE DICE -->
  <text x="60" y="62" 
    font-family="Georgia, 'Times New Roman', serif" 
    font-size="28" font-weight="700" fill="url(#gold)" letter-spacing="4"
    >QUÉ SE DICE</text>

  <!-- Category pill -->
  <rect x="340" y="40" width="${catLabel.length * 11 + 28}" height="30" rx="15" 
    fill="${accent}" opacity="0.12"/>
  <text x="${340 + (catLabel.length * 11 + 28) / 2}" y="61" 
    font-family="system-ui, -apple-system, sans-serif" 
    font-size="13" font-weight="700" fill="${accent}" 
    text-anchor="middle" letter-spacing="2"
    >${escapeXml(catLabel)}</text>

  <!-- Date -->
  <text x="1140" y="62" 
    font-family="system-ui, sans-serif" 
    font-size="15" fill="#555" text-anchor="end"
    >${escapeXml(dateStr)}</text>

  <!-- Separator -->
  <line x1="60" y1="86" x2="1140" y2="86" stroke="#1a1f30" stroke-width="1"/>

  ${hasTitle ? `
  <!-- ═══ SOURCE BADGE ═══ -->
  <rect x="60" y="110" width="${sourceText.length * 9 + 24}" height="28" rx="4" 
    fill="${accent}" opacity="0.1"/>
  <text x="72" y="130" 
    font-family="system-ui, -apple-system, sans-serif" 
    font-size="14" font-weight="700" fill="${accent}" 
    letter-spacing="1" text-transform="uppercase"
    >${escapeXml(sourceText.toUpperCase())}</text>

  <!-- Live dot -->
  <circle cx="46" cy="124" r="4" fill="#3ec470" opacity="0.8"/>

  <!-- ═══ TITLE ═══ -->
  ${titleLines.map((line, i) => `
  <text x="60" y="${titleStartY + i * titleLineHeight}" 
    font-family="Georgia, 'Times New Roman', serif" 
    font-size="${titleFontSize}" font-weight="700" fill="#f0ede6" 
    letter-spacing="-0.5"
    >${escapeXml(line)}</text>`).join('')}

  ${descLines.length > 0 ? `
  <!-- ═══ DESCRIPTION ═══ -->
  ${descLines.map((line, i) => `
  <text x="60" y="${descStartY + i * 26}" 
    font-family="system-ui, -apple-system, sans-serif" 
    font-size="19" fill="#777" 
    letter-spacing="0.3"
    >${escapeXml(line)}</text>`).join('')}
  ` : ''}

  ` : `
  <!-- ═══ GENERIC / NO TITLE ═══ -->
  
  <!-- Large brand text -->
  <text x="600" y="240" 
    font-family="Georgia, 'Times New Roman', serif" 
    font-size="72" font-weight="700" fill="url(#gold)" 
    text-anchor="middle" letter-spacing="6"
    >QUÉ SE DICE</text>

  <!-- Tagline -->
  <text x="600" y="300" 
    font-family="Georgia, serif" 
    font-size="26" fill="#777" font-style="italic"
    text-anchor="middle"
    >El pulso informativo de Corrientes y el mundo</text>

  <!-- Feature pills -->
  <g transform="translate(600, 370)">
    <rect x="-310" y="-16" width="120" height="32" rx="16" fill="#c9953a" opacity="0.1"/>
    <text x="-250" y="5" font-family="system-ui, sans-serif" font-size="13" font-weight="600" fill="#c9953a" text-anchor="middle">NOTICIAS</text>
    
    <rect x="-170" y="-16" width="140" height="32" rx="16" fill="#c9953a" opacity="0.1"/>
    <text x="-100" y="5" font-family="system-ui, sans-serif" font-size="13" font-weight="600" fill="#c9953a" text-anchor="middle">TENDENCIAS</text>
    
    <rect x="-10" y="-16" width="120" height="32" rx="16" fill="#c9953a" opacity="0.1"/>
    <text x="50" y="5" font-family="system-ui, sans-serif" font-size="13" font-weight="600" fill="#c9953a" text-anchor="middle">OPINIÓN</text>
    
    <rect x="130" y="-16" width="170" height="32" rx="16" fill="#c9953a" opacity="0.1"/>
    <text x="215" y="5" font-family="system-ui, sans-serif" font-size="13" font-weight="600" fill="#c9953a" text-anchor="middle">CORRIENTES</text>
  </g>
  `}

  <!-- ═══ FOOTER BAR ═══ -->
  <rect x="0" y="510" width="1200" height="120" fill="#060810"/>
  <line x1="0" y1="510" x2="1200" y2="510" stroke="#1a1f30" stroke-width="1"/>

  <!-- Footer gold accent -->
  <rect x="0" y="510" width="1200" height="2" fill="url(#topline)" opacity="0.3"/>

  <!-- Q icon (simplified) -->
  <circle cx="88" cy="565" r="26" fill="none" stroke="url(#gold)" stroke-width="2.5"/>
  <text x="88" y="573" 
    font-family="Georgia, 'Times New Roman', serif" 
    font-size="24" font-weight="700" fill="#c9953a" text-anchor="middle"
    >Q</text>
  <!-- Q tail -->
  <line x1="106" y1="583" x2="118" y2="596" stroke="#c9953a" stroke-width="2.5" stroke-linecap="round"/>

  <!-- Footer text -->
  <text x="136" y="558" 
    font-family="Georgia, 'Times New Roman', serif" 
    font-size="20" font-weight="700" fill="#e0ddd5" letter-spacing="2"
    >QUÉ SE DICE</text>
  <text x="136" y="582" 
    font-family="system-ui, -apple-system, sans-serif" 
    font-size="14" fill="#666"
    >Noticias de Corrientes, Argentina y el mundo</text>

  <!-- CTA button -->
  <rect x="920" y="544" width="220" height="42" rx="21" fill="${accent}"/>
  <text x="1030" y="571" 
    font-family="system-ui, -apple-system, sans-serif" 
    font-size="15" font-weight="700" fill="#fff" text-anchor="middle"
    >LEER NOTA →</text>

  <!-- URL -->
  <text x="60" y="618" 
    font-family="system-ui, sans-serif" 
    font-size="13" fill="#444"
    >${escapeXml(siteHost)} · Desde 2004 · Antonio &amp; Gonzalo Haedo</text>
</svg>`;
}

// ── Handler ───────────────────────────────────────────────────
export default async function handler(req) {
  const url = new URL(req.url);
  const format = url.searchParams.get('format') || '';
  const title = url.searchParams.get('title') || '';
  const source = url.searchParams.get('source') || '';
  const category = url.searchParams.get('cat') || 'portada';
  const description = url.searchParams.get('desc') || '';
  const host = req.headers.get('host');

  if (format.toLowerCase() === 'png') {
    try {
      const logoUrl = new URL('/Logo_qsd.png', url);
      const logoResponse = await fetch(logoUrl);
      if (logoResponse.ok) {
        const body = await logoResponse.arrayBuffer();
        return new Response(body, {
          status: 200,
          headers: {
            'Content-Type': 'image/png',
            'Cache-Control': 'public, max-age=86400, s-maxage=86400, stale-while-revalidate=3600',
            'Access-Control-Allow-Origin': '*',
          },
        });
      }
    } catch {
      // Fall back to SVG response below
    }
  }

  const svg = generateOG({
    title: decodeURIComponent(title),
    source: decodeURIComponent(source),
    category,
    description: decodeURIComponent(description),
    host,
  });

  return new Response(svg, {
    status: 200,
    headers: {
      'Content-Type': 'image/svg+xml',
      'Cache-Control': 'public, max-age=86400, s-maxage=86400, stale-while-revalidate=3600',
      'Access-Control-Allow-Origin': '*',
    },
  });
}
