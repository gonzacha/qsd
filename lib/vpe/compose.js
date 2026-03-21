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
        return { bg: '#15172b', accent: '#6c5ce7', tone: '#8b80f0' };
      case 'urgent':
        return { bg: '#24170f', accent: '#d39a3f', tone: '#f0c072' };
      case 'analisis':
        return { bg: '#0f2226', accent: '#37a3a5', tone: '#63c5c7' };
      case 'archivo':
        return { bg: '#131826', accent: '#394058', tone: '#6b738d' };
      default:
        return { bg: '#111627', accent: '#6c5ce7', tone: '#7d6ff0' };
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

    return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="640" height="360" viewBox="0 0 640 360" xmlns="http://www.w3.org/2000/svg">
  <rect width="640" height="360" fill="${palette.bg}"/>
  <rect x="0" y="0" width="8" height="360" fill="${palette.accent}"/>
  <rect x="24" y="24" width="160" height="6" fill="${palette.accent}" opacity="0.7"/>
  <text x="24" y="66" font-family="sans-serif" font-size="14" fill="${palette.tone}" letter-spacing="2">${escapeXml(truncate(category || 'QSD', 12)).toUpperCase()}</text>
  ${safeMeta ? `<text x="24" y="92" font-family="sans-serif" font-size="12" fill="#b4b6c2">${safeMeta}</text>` : ''}
  <text x="24" y="150" font-family="sans-serif" font-size="22" fill="#f5f2ec">
    <tspan x="24" dy="0">${escapeXml(titleLines[0] || '')}</tspan>
    ${titleLines[1] ? `<tspan x="24" dy="28">${escapeXml(titleLines[1])}</tspan>` : ''}
  </text>
  ${safeFooter ? `<text x="24" y="318" font-family="sans-serif" font-size="12" fill="#9aa0b5" letter-spacing="1">${safeFooter.toUpperCase()}</text>` : ''}
  <text x="612" y="332" font-family="sans-serif" font-size="12" fill="${palette.tone}" text-anchor="end">QSD</text>
</svg>`;
  }

  globalThis.composeCardSvg = composeCardSvg;
})();
