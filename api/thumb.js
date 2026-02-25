export const config = { runtime: 'edge' };

export default async function handler(req) {
  try {
    const url = new URL(req.url);
    const params = {
      title: url.searchParams.get('title') || '',
      edition: url.searchParams.get('edition') || '',
      category: url.searchParams.get('category') || '',
      date: url.searchParams.get('date') || ''
    };

    // Sanitize all params
    const sanitized = {
      title: sanitize(params.title, 120),
      edition: sanitize(params.edition, 24),
      category: sanitize(params.category, 24),
      date: sanitize(params.date, 20)
    };

    // Validate title - if >50% non-alphanumeric, use fallback
    const title = validateTitle(sanitized.title) ? sanitized.title : 'QSD';
    const edition = sanitized.edition || 'QSD';
    const category = sanitized.category || 'GENERAL';
    const date = sanitized.date;

    // Generate SVG
    const svg = generateSVG({ title, edition, category, date });

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

// Validate title - reject if >50% non-alphanumeric
function validateTitle(title) {
  if (!title) return false;

  const alphanumeric = title.replace(/[^a-zA-Z0-9]/g, '').length;
  const total = title.length;

  return total > 0 && (alphanumeric / total) >= 0.5;
}

// Split title into short version (first 4 words, max 2 lines of 16 chars)
function getTitleShort(title) {
  if (!title) return ['QSD'];

  const words = title.split(/\s+/).filter(w => w.length > 0);
  const first4 = words.slice(0, 4).join(' ').toUpperCase();

  // Deterministic split: build line 1 until >16 chars
  const lines = [];
  let currentLine = '';

  const tokens = first4.split(/\s+/);
  for (const token of tokens) {
    const testLine = currentLine ? `${currentLine} ${token}` : token;

    if (testLine.length <= 16) {
      currentLine = testLine;
    } else {
      // Current line is full, push it
      if (currentLine) {
        lines.push(currentLine);
      }

      // If single token >16 chars, truncate with hyphen
      if (token.length > 16) {
        lines.push(token.substring(0, 15) + '-');
        break;
      } else {
        currentLine = token;
      }
    }

    // Max 2 lines
    if (lines.length >= 2) break;
  }

  // Push remaining
  if (currentLine && lines.length < 2) {
    lines.push(currentLine);
  }

  return lines.length > 0 ? lines : ['QSD'];
}

// Truncate full title to 90 chars
function getTitleFull(title) {
  if (!title) return '';
  if (title.length <= 90) return title;
  return title.substring(0, 90) + '…';
}

// Generate SVG
function generateSVG({ title, edition, category, date }) {
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
