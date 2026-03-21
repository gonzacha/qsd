export const config = { runtime: 'edge' };

const SITE_URL = 'https://quesedice.com.ar';

const URLS = [
  {
    loc: `${SITE_URL}/`,
    changefreq: 'hourly',
    priority: '1.0',
    lastmod: new Date().toISOString().split('T')[0],
  },
];

function escapeXml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function buildSitemapXml(urls) {
  const lines = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
  ];
  for (const entry of urls) {
    lines.push('  <url>');
    lines.push(`    <loc>${escapeXml(entry.loc)}</loc>`);
    if (entry.lastmod) lines.push(`    <lastmod>${escapeXml(entry.lastmod)}</lastmod>`);
    if (entry.changefreq) lines.push(`    <changefreq>${escapeXml(entry.changefreq)}</changefreq>`);
    if (entry.priority) lines.push(`    <priority>${escapeXml(entry.priority)}</priority>`);
    lines.push('  </url>');
  }
  lines.push('</urlset>');
  return `${lines.join('\n')}\n`;
}

export default async function handler() {
  const xml = buildSitemapXml(URLS);
  return new Response(xml, {
    status: 200,
    headers: {
      'Content-Type': 'application/xml',
      'Cache-Control': 'public, max-age=0, must-revalidate',
      'CDN-Cache-Control': 's-maxage=3600, stale-while-revalidate=86400',
    },
  });
}
