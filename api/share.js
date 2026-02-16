/**
 * Qué Se Dice — Share Redirect
 * 
 * Este es el truco que hace funcionar las OG images dinámicas.
 * 
 * Problema: WhatsApp/Twitter/Facebook leen las meta tags de la URL
 * que se comparte. Si compartís "quesedice.com.ar" siempre van a 
 * ver la misma imagen genérica del index.html.
 * 
 * Solución: En vez de compartir el link directo al artículo,
 * compartimos /api/share?title=...&url=LINK_ORIGINAL
 * Este endpoint genera un HTML mínimo con las og:image correctas
 * y un redirect automático al artículo original.
 * 
 * Los crawlers de redes sociales leen las meta tags → ven la tarjeta.
 * Los humanos son redirigidos instantáneamente al artículo.
 * 
 * Uso:
 *   /api/share?title=El+titular&source=Infobae&cat=economia&url=https://infobae.com/...
 */

export const config = { runtime: 'edge' };

// Domain is detected dynamically from the request
// Works on qsd-seven.vercel.app, localhost, or quesedice.com.ar

function getDomain(req) {
  const url = new URL(req.url);
  return `${url.protocol}//${url.host}`;
}

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export default async function handler(req) {
  const DOMAIN = getDomain(req);
  const { searchParams } = new URL(req.url);
  
  const title = searchParams.get('title') || 'Qué Se Dice — Noticias';
  const source = searchParams.get('source') || '';
  const cat = searchParams.get('cat') || 'portada';
  const desc = searchParams.get('desc') || 'Noticias de Corrientes, Argentina y el mundo';
  const url = searchParams.get('url') || DOMAIN;

  // Build OG image URL
  const ogParams = new URLSearchParams();
  if (title) ogParams.set('title', title);
  if (source) ogParams.set('source', source);
  if (cat) ogParams.set('cat', cat);
  if (desc) ogParams.set('desc', desc);
  const ogImageUrl = `${DOMAIN}/api/og?${ogParams.toString()}`;

  const safeTitle = escapeHtml(title);
  const safeDesc = escapeHtml(desc);
  const safeUrl = escapeHtml(url);
  const safeOgImage = escapeHtml(ogImageUrl);
  const safeSource = source ? ` — ${escapeHtml(source)}` : '';

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  
  <title>${safeTitle}${safeSource} | Qué Se Dice</title>
  <meta name="description" content="${safeDesc}">
  
  <!-- Open Graph -->
  <meta property="og:type" content="article">
  <meta property="og:title" content="${safeTitle}">
  <meta property="og:description" content="${safeDesc}">
  <meta property="og:image" content="${safeOgImage}">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:url" content="${safeUrl}">
  <meta property="og:site_name" content="Qué Se Dice">
  <meta property="og:locale" content="es_AR">
  
  <!-- Twitter -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${safeTitle}">
  <meta name="twitter:description" content="${safeDesc}">
  <meta name="twitter:image" content="${safeOgImage}">
  
  <!-- Redirect (humanos) -->
  <meta http-equiv="refresh" content="0;url=${safeUrl}">
  <link rel="canonical" href="${safeUrl}">
  
  <style>
    body {
      font-family: -apple-system, system-ui, sans-serif;
      background: #080a12;
      color: #e8e4dc;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      margin: 0;
      text-align: center;
    }
    a { color: #c9953a; }
    .loading { opacity: 0.6; font-size: 0.9rem; }
  </style>
</head>
<body>
  <div>
    <p class="loading">Redirigiendo a la nota...</p>
    <p><a href="${safeUrl}">Click aquí si no redirige automáticamente</a></p>
  </div>
  <script>window.location.replace(${JSON.stringify(url)});</script>
</body>
</html>`;

  return new Response(html, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, s-maxage=3600',
      'Access-Control-Allow-Origin': '*',
    },
  });
}
