export const config = { runtime: 'edge' };

export default async function handler(req) {
  try {
    const url = new URL(req.url);
    const params = {
      edition: url.searchParams.get('edition') || '',
      category: url.searchParams.get('category') || '',
      date: url.searchParams.get('date') || ''
    };

    // Sanitize all params
    const sanitized = {
      edition: sanitize(params.edition, 24),
      category: sanitize(params.category, 24),
      date: sanitize(params.date, 20)
    };

    const edition = sanitized.edition || 'QSD';
    const category = sanitized.category || 'GENERAL';
    const date = sanitized.date;

    // Generate SVG
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

// Sanitize input: escape XML entities, remove newlines, truncate
function sanitize(text, maxLength) {
  if (!text) return '';

  // Replace newlines and tabs with space
  let cleaned = text.replace(/[\n\r\t]/g, ' ');

  // Escape XML entities
  cleaned = cleaned
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

  // Truncate
  if (cleaned.length > maxLength) {
    cleaned = cleaned.substring(0, maxLength);
  }

  return cleaned;
}

// Generate SVG
function generateSVG({ edition, category, date }) {
  // Top bar text
  const topBarLeft = date ? `${edition.toUpperCase()} · ${date}` : edition.toUpperCase();

  // Category pill dimensions (approximate)
  const categoryText = category.toUpperCase();
  const pillFontSize = 22;
  const pillPaddingX = 14;
  const pillPaddingY = 8;
  const pillHeight = pillFontSize + (pillPaddingY * 2);
  const pillWidth = categoryText.length * 10 + (pillPaddingX * 2);
  const pillX = 600 - pillWidth;
  const pillY = 22;
  const { start: gradientStart, end: gradientEnd } = getCategoryGradient(categoryText);

  return `<svg width="640" height="360" viewBox="0 0 640 360" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" style="stop-color:${gradientStart};stop-opacity:1" />
      <stop offset="100%" style="stop-color:${gradientEnd};stop-opacity:1" />
    </linearGradient>
  </defs>

  <!-- Background -->
  <rect width="640" height="360" fill="url(#bg)" />

  <!-- Left strip -->
  <rect x="0" y="0" width="14" height="360" fill="#c9953a" />

  <!-- TOP BAR -->
  <text x="24" y="46" font-family="sans-serif" font-size="24" fill="#8888a0">${topBarLeft}</text>

  <!-- Category pill -->
  <rect x="${pillX}" y="${pillY}" width="${pillWidth}" height="${pillHeight}" rx="10" fill="#c9953a20" stroke="#c9953a" stroke-width="2" />
  <text x="${pillX + pillWidth / 2}" y="${pillY + pillHeight / 2}" font-family="sans-serif" font-size="${pillFontSize}" fill="#c9953a" text-anchor="middle" dominant-baseline="middle">${categoryText}</text>

  <!-- LOGO -->
  <text x="620" y="346" font-family="monospace" font-size="16" fill="#c9953a50" text-anchor="end">QSD</text>
</svg>`;
}

function getCategoryGradient(category) {
  switch (category) {
    case 'POLÍTICA':
    case 'POLITICA':
      return { start: '#1a3a5c', end: '#0d1f33' };
    case 'ECONOMÍA':
    case 'ECONOMIA':
      return { start: '#3a2800', end: '#1f1500' };
    case 'SEGURIDAD':
      return { start: '#3a1a1a', end: '#1f0d0d' };
    case 'DEPORTES':
      return { start: '#0d2b1a', end: '#061510' };
    case 'CULTURA':
      return { start: '#2a1a4a', end: '#150d26' };
    case 'SOCIEDAD':
      return { start: '#1a2a3a', end: '#0d151f' };
    case 'GENERAL':
    default:
      return { start: '#2a2060', end: '#140f30' };
  }
}
