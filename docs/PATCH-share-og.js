/**
 * PATCH: Share con OG dinámico
 * 
 * Archivo: index.html (sección <script>)
 * 
 * INSTRUCCIONES PARA CLAUDE CODE CLI:
 * Reemplazar las funciones de share existentes con estas versiones
 * que usan /api/share para generar tarjetas dinámicas por noticia.
 */

// ═══════════════════════════════════════════
// REEMPLAZAR las funciones shareWhatsApp, shareTwitter, shareFacebook, copyLink
// con estas versiones que usan el share redirect:
// ═══════════════════════════════════════════

const SITE_DOMAIN = 'https://quesedice.com.ar';

// Genera la URL de share con OG dinámico
function shareUrl(title, originalUrl, source, description) {
  const params = new URLSearchParams();
  params.set('title', title);
  params.set('url', originalUrl);
  if (source) params.set('source', source);
  if (currentCategory) params.set('cat', currentCategory);
  if (description) params.set('desc', description.substring(0, 150));
  return `${SITE_DOMAIN}/api/share?${params.toString()}`;
}

function shareWhatsApp(title, url, source, description) {
  const sUrl = shareUrl(title, url, source, description);
  window.open(`https://wa.me/?text=${encodeURIComponent(title + '\n\n' + sUrl)}`, '_blank');
}

function shareTwitter(title, url, source, description) {
  const sUrl = shareUrl(title, url, source, description);
  window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(title)}&url=${encodeURIComponent(sUrl)}`, '_blank');
}

function shareFacebook(url, title, source, description) {
  const sUrl = shareUrl(title, url, source, description);
  window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(sUrl)}`, '_blank');
}

function copyLink(url, title, source, description) {
  const sUrl = shareUrl(title, url, source, description);
  navigator.clipboard.writeText(sUrl).then(() => showToast('Enlace copiado'));
}

// ═══════════════════════════════════════════
// REEMPLAZAR la función shareButtons() con esta versión
// que pasa source y description a los handlers:
// ═══════════════════════════════════════════

function shareButtons(title, url, source, description) {
  const t = escapeAttr(title);
  const u = escapeAttr(url);
  const s = escapeAttr(source || '');
  const d = escapeAttr((description || '').substring(0, 150));
  return `
    <button class="share-btn whatsapp" onclick="event.preventDefault();event.stopPropagation();shareWhatsApp('${t}','${u}','${s}','${d}')" title="Compartir en WhatsApp">${ICONS.whatsapp}</button>
    <button class="share-btn twitter" onclick="event.preventDefault();event.stopPropagation();shareTwitter('${t}','${u}','${s}','${d}')" title="Compartir en X">${ICONS.twitter}</button>
    <button class="share-btn facebook" onclick="event.preventDefault();event.stopPropagation();shareFacebook('${u}','${t}','${s}','${d}')" title="Compartir en Facebook">${ICONS.facebook}</button>
    <button class="share-btn copy" onclick="event.preventDefault();event.stopPropagation();copyLink('${u}','${t}','${s}','${d}')" title="Copiar enlace">${ICONS.copy}</button>
  `;
}

// ═══════════════════════════════════════════
// ACTUALIZAR las llamadas a shareButtons() en renderFeed()
// Pasar item.source e item.description:
// ═══════════════════════════════════════════

// En el hero card:
//   ${shareButtons(hero.title, hero.link, hero.source, hero.description)}

// En cada news card:
//   ${shareButtons(item.title, item.link, item.source, item.description)}

// ═══════════════════════════════════════════
// ACTUALIZAR las meta tags estáticas en <head>:
// ═══════════════════════════════════════════

/*
  Agregar o reemplazar en el <head> del index.html:

  <meta property="og:image" content="https://quesedice.com.ar/api/og">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta name="twitter:image" content="https://quesedice.com.ar/api/og">
*/
