export const config = { runtime: 'edge' };

export default async function handler(req) {
  try {
    const url = new URL(req.url);
    const params = {
      edition: url.searchParams.get('edition') || '',
      category: url.searchParams.get('category') || '',
      date: url.searchParams.get('date') || ''
    };

    const sanitized = {
      edition: sanitize(params.edition, 24),
      category: sanitize(params.category, 24),
      date: sanitize(params.date, 20)
    };

    const edition = sanitized.edition || 'QSD';
    const category = sanitized.category || '';
    const date = sanitized.date;

    const svg = generateSVG({ edition, category, date });

    return new Response(svg, {
      headers: {
        'Content-Type': 'image/svg+xml',
        'Cache-Control': 'public, max-age=86400'
      }
    });
  } catch (err) {
    return new Response('Error generating thumbnail', { status: 500 });
  }
}

function sanitize(text, maxLength) {
  if (!text) return '';
  let cleaned = text.replace(/[\n\r\t]/g, ' ');
  cleaned = cleaned
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
  if (cleaned.length > maxLength) {
    cleaned = cleaned.substring(0, maxLength);
  }
  return cleaned;
}

function generateSVG({ edition, category, date }) {
  const topBarLeft = date ? `${edition.toUpperCase()} · ${date}` : edition.toUpperCase();
  const categoryText = (category || '').toUpperCase();
  const showCategory = categoryText && categoryText !== 'GENERAL';
  const pillFontSize = 20;
  const pillPaddingX = 16;
  const pillPaddingY = 8;
  const pillHeight = pillFontSize + (pillPaddingY * 2);
  const pillWidth = Math.min(280, Math.max(120, categoryText.length * 11 + (pillPaddingX * 2)));
  const pillX = 620 - pillWidth;
  const pillY = 28;
  const { start: gradientStart, end: gradientEnd } = getCategoryGradient(categoryText || 'GENERAL');

  const gridLines = `
    <g opacity="0.12" stroke="#ffffff" stroke-width="0.5">
      ${Array.from({ length: 9 }, (_, i) => {
        const x = 40 + i * 68;
        return `<line x1="${x}" y1="72" x2="${x}" y2="340" />`;
      }).join('')}
      ${Array.from({ length: 5 }, (_, i) => {
        const y = 88 + i * 56;
        return `<line x1="24" y1="${y}" x2="616" y2="${y}" />`;
      }).join('')}
    </g>
  `;

  const accentBar = '#b8924a';

  return `<svg width="640" height="360" viewBox="0 0 640 360" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:${gradientStart};stop-opacity:1" />
      <stop offset="100%" style="stop-color:${gradientEnd};stop-opacity:1" />
    </linearGradient>
    <pattern id="fine" width="8" height="8" patternUnits="userSpaceOnUse">
      <circle cx="1" cy="1" r="0.8" fill="#ffffff" opacity="0.04"/>
    </pattern>
  </defs>

  <rect width="640" height="360" fill="url(#bg)" />
  <rect width="640" height="360" fill="url(#fine)" />
  ${gridLines}

  <rect x="0" y="0" width="5" height="360" fill="${accentBar}" opacity="0.95" />

  <text x="24" y="42" font-family="system-ui, -apple-system, sans-serif" font-size="11" letter-spacing="0.28em" fill="#8a90a8">VISUAL DE CONTEXTO · NO ES FOTO DE NOTA</text>
  <text x="24" y="64" font-family="system-ui, -apple-system, sans-serif" font-size="18" fill="#c8cdd8">${topBarLeft}</text>

  ${showCategory ? `
  <rect x="${pillX}" y="${pillY}" width="${pillWidth}" height="${pillHeight}" rx="8" fill="rgba(185,146,74,0.12)" stroke="${accentBar}" stroke-width="1.5" />
  <text x="${pillX + pillWidth / 2}" y="${pillY + pillHeight / 2 + 7}" font-family="system-ui, -apple-system, sans-serif" font-size="${pillFontSize}" font-weight="600" fill="#e8d4b0" text-anchor="middle">${categoryText}</text>
  ` : `
  <text x="24" y="120" font-family="system-ui, -apple-system, sans-serif" font-size="14" fill="#7a8198">Feed sin miniatura nativa · bloque editorial QSD</text>
  `}

  <text x="616" y="342" font-family="ui-monospace, monospace" font-size="13" letter-spacing="0.12em" fill="#6c7388" text-anchor="end">QSD</text>
</svg>`;
}

function getCategoryGradient(category) {
  switch (category) {
    case 'POLÍTICA':
    case 'POLITICA':
      return { start: '#1e4068', end: '#0a1424' };
    case 'ECONOMÍA':
    case 'ECONOMIA':
      return { start: '#4a3814', end: '#1a1308' };
    case 'SEGURIDAD':
      return { start: '#4a2222', end: '#180a0a' };
    case 'DEPORTES':
      return { start: '#143828', end: '#081810' };
    case 'CULTURA':
      return { start: '#352858', end: '#140c28' };
    case 'SOCIEDAD':
      return { start: '#243848', end: '#0c141c' };
    case 'GENERAL':
    default:
      return { start: '#302858', end: '#120c28' };
  }
}
