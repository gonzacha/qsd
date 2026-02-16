# OG Image Generator — Guía de integración

## Qué es
Edge function que genera tarjetas SVG dinámicas (1200x630) para social sharing.
Cuando alguien comparte una noticia de quesedice.com.ar en WhatsApp, Twitter o Facebook,
aparece una tarjeta profesional con branding QSD + titular + fuente + categoría.

## Archivo
- `api/og.js` — Vercel Edge Function, zero dependencies

## Endpoint
```
GET /api/og?title=...&source=...&cat=...&desc=...
```

### Parámetros (todos opcionales, URL-encoded)
| Param    | Descripción                          | Default      |
|----------|--------------------------------------|--------------|
| `title`  | Titular de la noticia                | (genérica)   |
| `source` | Fuente (ej: "Infobae", "La Nación") | quesedice... |
| `cat`    | Categoría (portada, argentina, etc.) | portada      |
| `desc`   | Descripción/bajada                   | (vacío)      |

### Ejemplo
```
/api/og?title=El+Gobierno+anunció+nuevas+medidas+económicas&source=Infobae&cat=economia
```

Sin parámetros genera una tarjeta genérica del portal (para home y fallback).

## Integración con index.html

### Paso 1: Meta tags estáticas (fallback)
Ya están en el index.html actual. Cambiar la og:image a:
```html
<meta property="og:image" content="https://quesedice.com.ar/api/og">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:type" content="image/svg+xml">
<meta name="twitter:image" content="https://quesedice.com.ar/api/og">
```

### Paso 2: Share dinámico por noticia
En el JS del frontend, las funciones de share ya generan URLs.
Modificar para incluir OG-aware share URLs:

```javascript
// Generar URL de OG image para una noticia específica
function ogImageUrl(item) {
  const params = new URLSearchParams();
  if (item.title) params.set('title', item.title);
  if (item.source) params.set('source', item.source);
  if (currentCategory) params.set('cat', currentCategory);
  if (item.description) params.set('desc', item.description.substring(0, 150));
  return `https://quesedice.com.ar/api/og?${params.toString()}`;
}
```

### Paso 3 (opcional avanzado): Redirect pages para SEO
Para que cada noticia compartida tenga su propia og:image dinámica,
se puede crear un endpoint `/api/share.js` que genera una mini HTML page
con las meta tags correctas y luego redirige al link original:

```
/api/share?title=...&source=...&cat=...&url=LINK_ORIGINAL
```

Esto es útil porque WhatsApp/Twitter leen las meta tags de la URL que
se comparte, no del link final. Así cada noticia tiene su propia card.

## Colores por categoría
| Categoría    | Accent color |
|-------------|-------------|
| portada     | #c9953a (dorado) |
| argentina   | #75aadb (celeste) |
| corrientes  | #c9953a (dorado) |
| mundo       | #6b9bd2 (azul) |
| deportes    | #3ec470 (verde) |
| economia    | #e4b65c (dorado claro) |
| tecnologia  | #8b5cf6 (violeta) |
| espectaculos| #e4587a (rosa) |

## Features
- Word wrapping automático del título (max 4 líneas con truncate)
- Word wrapping de descripción (max 2 líneas)
- Branding consistente: tipografía Georgia serif + gold gradient
- Grid sutil de fondo (patrón de World Monitor)
- Top gold line + left accent bar
- Footer con Q icon, nombre, CTA "LEER NOTA →"
- Live dot verde junto a la fuente
- Category pill coloreado
- Cache 24h en CDN de Vercel
- Sin dependencias — SVG puro, ~3KB por imagen

## Testing
Abrir en browser:
```
http://localhost:3000/api/og?title=Prueba+de+titular+largo+para+ver+el+word+wrapping&source=Infobae&cat=deportes
```

O después del deploy:
```
https://quesedice.com.ar/api/og?title=Test&source=Test&cat=portada
```

## Validación social
Después de deployar, testear con:
- https://cards-dev.twitter.com/validator (Twitter)
- https://developers.facebook.com/tools/debug/ (Facebook)
- Enviar link por WhatsApp a uno mismo
