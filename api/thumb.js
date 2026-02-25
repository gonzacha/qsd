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
  const pillWidth = categoryText.length * 7 + 16;
  const pillX = 610 - pillWidth;

  return `<svg width="640" height="360" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" style="stop-color:#0f1623;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#090d14;stop-opacity:1" />
    </linearGradient>
  </defs>

  <!-- Background -->
  <rect width="640" height="360" fill="url(#bg)" />

  <!-- Left strip -->
  <rect x="0" y="0" width="4" height="360" fill="#c9953a" />

  <!-- TOP BAR -->
  <text x="24" y="40" font-family="sans-serif" font-size="12" fill="#8888a0">${topBarLeft}</text>

  <!-- Category pill -->
  <rect x="${pillX}" y="28" width="${pillWidth}" height="20" rx="4" fill="#c9953a20" stroke="#c9953a" stroke-width="1" />
  <text x="${pillX + pillWidth / 2}" y="41" font-family="sans-serif" font-size="11" fill="#c9953a" text-anchor="middle">${categoryText}</text>

  <!-- LOGO -->
  <text x="618" y="348" font-family="monospace" font-size="11" fill="#c9953a50" text-anchor="end">QSD</text>
</svg>`;
}
