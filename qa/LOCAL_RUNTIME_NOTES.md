# QSD Local Runtime Notes (Temporary Workaround)

## Problema original

- Inicialmente, rutas API quedaban capturadas por fallback SPA y devolvían HTML.
- Luego de endurecer routing, APIs volvieron a resolver, pero `/` y `/index.html` quedaron en `404` en `vercel dev`.

## Root cause resumido

- Diferencias entre resolución de rutas en `vercel dev` y runtime productivo.
- Rewrites de fallback demasiado amplios pueden reescribirse sobre `/index.html` y terminar en loop/no match.
- Múltiples procesos `vercel dev` en paralelo contaminan QA y hacen no determinista el resultado local.

## Fix temporal aplicado

- Se mantiene rewrite explícito:
  - `/` -> `/index.html`
- Se limita el fallback SPA para **excluir**:
  - `/api/*`
  - `/index.html`
- Regla aplicada:
  - `/((?!api/|index\.html$).*)` -> `/index.html`

Alcance:
- Ajuste operativo para estabilizar local runtime.
- No modifica lógica de negocio, APIs ni flujo editorial.

## Qué NO tocar

- Fallback SPA base (solo ajustar alcance, no eliminar arquitectura).
- Rewrites de APIs (`/api/*`, `sitemap`, `story`, `/r`).
- Comportamiento productivo de service worker.
- Filesystem routing interno de Vercel.

## Cómo validar

```bash
./scripts/dev-reset.sh
npx vercel dev --listen 3000
./scripts/dev-smoke.sh http://localhost:3000
```

Validación puntual:

```bash
curl -i http://localhost:3000/
curl -i http://localhost:3000/index.html
curl -i http://localhost:3000/api/feeds
```

## Criterio de éxito

- `/` y `/index.html` responden `text/html`.
- `/api/*` mantiene `application/json` (sin fallback HTML accidental).
- `sitemap.xml` responde XML real.

## Reevaluación futura

Revisar este workaround si:
- se desacopla frontend/API para local;
- se deja de usar `vercel dev`;
- se migra el runtime o la estrategia de serving local.

Nota: `vercel.json` es JSON puro y no admite comentarios inline; la documentación de intención queda en este archivo.
