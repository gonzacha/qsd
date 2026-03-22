(() => {
  function escapeXml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  function truncate(value, max = 60) {
    const text = String(value || '').trim();
    if (text.length <= max) return text;
    return `${text.slice(0, max - 1)}…`;
  }

  function splitTitle(title) {
    const clean = truncate(title, 80);
    const words = clean.split(/\s+/);
    const lines = [];
    let current = '';

    for (const word of words) {
      const next = current ? `${current} ${word}` : word;
      if (next.length > 36 && current) {
        lines.push(current);
        current = word;
      } else {
        current = next;
      }
      if (lines.length === 2) break;
    }

    if (lines.length < 2 && current) lines.push(current);
    return lines.slice(0, 2);
  }

  function getPalette(variant) {
    switch (variant) {
      case 'signal':
        return { bg: '#15172b', accent: '#6c5ce7', tone: '#8b80f0', text: '#f5f2ec', meta: '#b4b6c2', footer: '#9aa0b5' };
      case 'urgent':
        return { bg: '#24170f', accent: '#d39a3f', tone: '#f0c072', text: '#f5ead7', meta: '#c6b49a', footer: '#a99478' };
      case 'analisis':
        return { bg: '#0f2226', accent: '#37a3a5', tone: '#63c5c7', text: '#ecf4f2', meta: '#a9bcbc', footer: '#89a3a4' };
      case 'archivo':
        return { bg: '#131826', accent: '#394058', tone: '#6b738d', text: '#dddfe7', meta: '#9ba3b8', footer: '#7f879b' };
      default: // filo
        return { bg: '#111627', accent: '#6c5ce7', tone: '#7d6ff0', text: '#f1eef9', meta: '#b1b5c8', footer: '#8f95aa' };
    }
  }

  function getMotif(variant, palette) {
    switch (variant) {
      case 'signal':
        return `
  <polygon points="640,0 640,150 448,0" fill="#1d1840" opacity="0.95"/>
  <polygon points="640,0 640,210 548,0" fill="#282053" opacity="0.72"/>
  <rect x="0" y="220" width="640" height="1" fill="#1e1a3a" opacity="0.75"/>
  <rect x="0" y="352" width="320" height="2" fill="${palette.accent}" opacity="0.65"/>`;

      case 'urgent':
        return `
  <rect x="0" y="0" width="640" height="4" fill="${palette.accent}"/>
  <rect x="70" y="48" width="2" height="86" fill="#7a5a10" opacity="0.55"/>
  <rect x="80" y="60" width="2" height="68" fill="#7a5a10" opacity="0.35"/>
  <rect x="90" y="52" width="2" height="80" fill="#7a5a10" opacity="0.45"/>
  <rect x="100" y="66" width="2" height="60" fill="#7a5a10" opacity="0.28"/>
  <circle cx="26" cy="236" r="5" fill="${palette.accent}"/>
  <rect x="0" y="220" width="640" height="1" fill="#1e180a" opacity="0.75"/>
  <rect x="0" y="352" width="260" height="2" fill="${palette.accent}" opacity="0.65"/>`;

      case 'analisis':
        return `
  <rect x="0" y="0" width="3" height="360" fill="#183028"/>
  <line x1="96" y1="20" x2="620" y2="20" stroke="#1a2e28" stroke-width="0.8"/>
  <line x1="96" y1="36" x2="600" y2="36" stroke="#1a2e28" stroke-width="0.8"/>
  <line x1="96" y1="52" x2="610" y2="52" stroke="#1a2e28" stroke-width="0.8"/>
  <line x1="96" y1="68" x2="580" y2="68" stroke="#1a2e28" stroke-width="0.8"/>
  <line x1="96" y1="84" x2="600" y2="84" stroke="#1a2e28" stroke-width="0.8"/>
  <line x1="96" y1="100" x2="612" y2="100" stroke="#1a2e28" stroke-width="0.8"/>
  <line x1="96" y1="116" x2="560" y2="116" stroke="#1a2e28" stroke-width="0.8"/>
  <rect x="0" y="220" width="640" height="1" fill="#121e1a" opacity="0.75"/>
  <rect x="0" y="352" width="320" height="2" fill="${palette.accent}" opacity="0.55"/>`;

      case 'archivo':
        return `
  <rect x="0" y="0" width="6" height="360" fill="#2b3146" opacity="0.72"/>
  <rect x="24" y="30" width="120" height="4" fill="#2b3146" opacity="0.5"/>
  <rect x="0" y="220" width="640" height="1" fill="#1b2033" opacity="0.82"/>
  <rect x="0" y="352" width="140" height="2" fill="#2b3146" opacity="0.45"/>`;

      default: // filo
        return `
  <rect x="0" y="0" width="4" height="360" fill="#26203f" opacity="0.9"/>
  <rect x="112" y="24" width="420" height="1" fill="#24203c" opacity="0.72"/>
  <rect x="112" y="44" width="360" height="1" fill="#24203c" opacity="0.62"/>
  <rect x="112" y="64" width="390" height="1" fill="#24203c" opacity="0.54"/>
  <rect x="112" y="84" width="300" height="1" fill="#24203c" opacity="0.48"/>
  <rect x="112" y="104" width="340" height="1" fill="#24203c" opacity="0.42"/>
  <rect x="0" y="220" width="640" height="1" fill="#16152a" opacity="0.75"/>
  <rect x="0" y="352" width="220" height="2" fill="${palette.accent}" opacity="0.38"/>`;
    }
  }

  function composeCardSvg({ title, source, category, score, hours, variant } = {}) {
    const palette = getPalette(variant);
    const titleLines = splitTitle(title || 'Sin título');
    const meta = [category, source].filter(Boolean).join(' · ');
    const scoreText = Number.isFinite(score) ? `score ${Math.round(score)}` : '';
    const hoursText = Number.isFinite(hours) ? `${Math.round(hours)}h` : '';
    const footer = [scoreText, hoursText].filter(Boolean).join(' · ');
    const safeMeta = escapeXml(truncate(meta, 42));
    const safeFooter = escapeXml(footer);
    const safeCategory = escapeXml(truncate(category || 'QSD', 12)).toUpperCase();
    const motif = getMotif(variant, palette);

    return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="640" height="360" viewBox="0 0 640 360" xmlns="http://www.w3.org/2000/svg">
  <rect width="640" height="360" fill="${palette.bg}"/>
  <rect x="0" y="0" width="8" height="360" fill="${palette.accent}"/>
  ${motif}
  <rect x="24" y="24" width="160" height="6" fill="${palette.accent}" opacity="0.7"/>
  <text x="24" y="66" font-family="sans-serif" font-size="14" fill="${palette.tone}" letter-spacing="2">${safeCategory}</text>
  ${safeMeta ? `<text x="24" y="92" font-family="sans-serif" font-size="12" fill="${palette.meta}">${safeMeta}</text>` : ''}
  <text x="24" y="150" font-family="sans-serif" font-size="22" fill="${palette.text}">
    <tspan x="24" dy="0">${escapeXml(titleLines[0] || '')}</tspan>
    ${titleLines[1] ? `<tspan x="24" dy="28">${escapeXml(titleLines[1])}</tspan>` : ''}
  </text>
  ${safeFooter ? `<text x="24" y="318" font-family="sans-serif" font-size="12" fill="${palette.footer}" letter-spacing="1">${safeFooter.toUpperCase()}</text>` : ''}
  <text x="612" y="332" font-family="sans-serif" font-size="12" fill="${palette.tone}" text-anchor="end">QSD</text>
</svg>`;
  }

  globalThis.composeCardSvg = composeCardSvg;
})();
