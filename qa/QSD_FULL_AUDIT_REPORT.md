# QSD Full Local Audit (`vercel dev`)

Generated from real runtime checks on local environment using:
- `scripts/qsd-local-audit.sh`
- direct `curl` probes against `http://localhost:3000`
- static inspection of `vercel.json`, `/api/*`, `index.html`, `service-worker.js`

## Resumen Ejecutivo

- **Estado actual:** frontend (`/`) responde `index.html`, pero la capa de routing local está degradada: múltiples endpoints `/api/*` y `/sitemap.xml` quedan capturados por fallback HTML.
- **Qué funciona:** render estático principal, PWA base, JS frontend, algunos endpoints en procesos previos aislados.
- **Qué está roto (actual runtime audit):** `feeds`, `rank`, `story`, `resolve`, `notas`, `sitemap` no devuelven payload esperado; devuelven HTML de portada.
- **Riesgo actual para producción:** **ALTO** en consistencia operativa local (QA/editorial/testing engañosos), **MEDIO** en serverless safety, **MEDIO-ALTO** en performance para alto tráfico.
- **Readiness actual:** **No listo** para ciclo confiable de desarrollo local ni validación de release si se usa este `vercel.json` tal como está.

---

## 1) Auditoría de Routing (Vercel local)

### Configuración observada (`vercel.json`)

- `cleanUrls: true`
- `trailingSlash: false`
- `builds` explícitos (`@vercel/node` para `api/**/*.js` y `@vercel/static` para HTML)
- `routes`:
  1. `/sitemap\.xml -> /api/sitemap`
  2. `/story/... -> /api/story?id=...`
  3. `/r -> /api/r`
  4. `^/$ -> /index.html`
  5. `{ "handle": "filesystem" }`
  6. `^/(.*)$ -> /index.html` (fallback total)

### Mapa de resolución real (evidencia)

Resultados de `qa/local_audit_report.txt`:
- `/` => `200 text/html` (ok)
- `/api/feeds` => `200 text/html` (esperado JSON) **mismatch**
- `/api/rank?limit=5` => `200 text/html` (esperado JSON) **mismatch**
- `/api/story?id=test` => `200 text/html` (esperado JSON/404 de API) **mismatch**
- `/sitemap.xml` => `200 text/html` (esperado XML) **mismatch**
- `/api/resolve` => `200 text/html` (esperado JSON error 400 por param faltante) **mismatch**

### Diagnóstico de captura de rutas

- En runtime local auditado, el fallback `^/(.*)$ -> /index.html` está atrapando requests que deberían resolver API/XML.
- El comportamiento evidencia conflicto entre `routes` legacy + `builds` + `filesystem handler` en `vercel dev` actual.
- Se detectó además historial de procesos `vercel dev` concurrentes/zombie, que agrava la no determinación del resultado local.

---

## 2) Auditoría de APIs (runtime local real)

Fuente: `qa/local_audit_report.txt`.

### Estado por endpoint

- **`/api/feeds`**: `200`, `text/html`, ~103773 bytes, ~0.015s, responde `index.html` (incorrecto).
- **`/api/rank?limit=5`**: `200`, `text/html`, responde `index.html` (incorrecto).
- **`/api/story?id=test`**: `200`, `text/html`, responde `index.html` (incorrecto).
- **`/api/resolve`**: `200`, `text/html`, responde `index.html` (incorrecto).
- **`/api/notas`**: `200`, `text/html`, responde `index.html` (incorrecto).
- **`/api/r`**: `200`, `text/html`, responde `index.html` (debería ser redirect/400 según query).
- **`/sitemap.xml`**: `200`, `text/html`, responde `index.html` (incorrecto).
- **`/api/share`, `/api/og`, `/api/thumb`**: también `200 text/html`, pero aquí es ambiguo porque estos endpoints pueden entregar HTML/SVG en condiciones válidas; en este estado la señal es que responden el mismo documento de portada.

### Conclusión API local

- **No hay garantía de que los handlers serverless estén siendo ejecutados** en el estado auditado.
- La respuesta homogénea (`size 103773`, mismo head HTML) confirma captura por fallback de frontend.

---

## 3) Script de diagnóstico automático

Creado:
- `scripts/qsd-local-audit.sh`

Genera:
- `qa/local_audit_report.txt`

Qué registra:
- `status`, `content-type`, `time_total`, `size_download`
- mismatch entre tipo esperado y real
- firma de fallback HTML/NOT_FOUND
- muestra de encabezado de body

Tests incluidos:
- `/`
- `/api/feeds`
- `/api/rank?limit=5`
- `/api/story?id=test`
- `/sitemap.xml`
- y endpoints adicionales (`/api/r`, `/api/resolve`, `/api/share`, `/api/story-image`, `/api/thumb`, `/api/notas`, `/api/og`)

---

## 4) Auditoría Serverless Compatibility

## HIGH RISK

- `api/notas.js`: usa `fs.readdir` sobre `process.cwd()/notas`.
  - Compatible local/Node runtime, pero depende de filesystem deployado; no escalable para estado mutable.
- `api/ingesta-save.js`, `api/notas-save.js`: escriben en disco (`fs.writeFile`), aunque hoy están protegidos con `QSD_ALLOW_LOCAL_FS_WRITES`.
  - En Vercel serverless, escritura no persistente entre invocaciones.

## MEDIUM RISK

- `api/story.js`: usa cache mutable global (`globalThis.__qsdStoryCache`, TTL 60s).
  - Mejora latencia, pero añade comportamiento no determinista entre instancias/serverless cold starts.
- `api/story.js` y `api/sitemap.js`: dependen de `fetch` interno a `/api/rank`; acoplamiento API->API puede amplificar latencia/falla.

## SAFE / BAJO

- `api/feeds.js`, `api/rank.js`, `api/resolve.js`, `api/r.js`, `api/share.js`, `api/og.js`, `api/thumb.js`: Edge-friendly (sin FS write en path principal).

---

## 5) Auditoría Frontend

Hallazgos:

- `loadFeed()` hace fetch principal de portada a `/api/rank?limit=30` con `cache: 'no-store'` (correcto en intención).
- Auto-refresh activo cada 10 min (`setInterval(loadFeed)`).
- Retry automático ante error cada 15s (`setTimeout(loadFeed, 15000)`), sin backoff incremental.
- `resolveItemUrls(data.items)` se dispara en background luego de render: dependencia de red adicional post-render.
- Se usa `feedRequestSeq` para mitigar race de respuestas viejas (buena práctica).

Riesgos reales:

- Si `/api/*` devuelve HTML fallback, el frontend puede entrar en flujo de error/reintento continuo.
- Carga de background URL-resolve + image-resolve puede tensionar red en clientes lentos.

---

## 6) Auditoría Service Worker

Archivo: `service-worker.js`.

Estado:

- Versionado: `qsd-pwa-v0.0.3`.
- Precache: `/`, `/offline.html`, manifest, iconos, logo.
- Para `'/api/*'`: `event.respondWith(fetch(req))` (no cachea dinámicas).
- Navegación (`req.mode === 'navigate'`): network-first con fallback a cache `/` y luego `/offline.html`.

Riesgos:

- Si `/` está incorrectamente resuelto por routing local, el SW puede perpetuar una versión inválida de shell.
- No se observan estrategias de checksum/asset revisioning; la invalidez depende de `CACHE` version manual.

---

## 7) Auditoría Performance

## ALTO
- `index.html` inline monolítico (~103KB HTML/JS/CSS) impacta TTFB/parsing y dificulta cache granular.

## MEDIO
- `api/rank` y `api/feeds` realizan múltiples `fetch` RSS externos por request.
- `api/sitemap` chequea URLs vivas (`HEAD/GET`) por story; costoso si crece el pool.
- `resolve`/`story-image` introducen fetch remotos adicionales por item.

## BAJO
- Cache TTL en `api/story` reduce repetición inmediata de `/api/rank`.

---

## 8) Auditoría Editorial / Ranking

`api/rank.js`:
- ventana de frescura: `MAX_AGE_HOURS = 24`.
- scoring: convergencia + freshness + geo boost local.
- orden: `editorial_score DESC`, desempate por timestamp (`published_ts DESC`).

`api/feeds.js`:
- filtro de edad 24h y exclusión de timestamp inválido.
- deduplicación y clasificación.

Riesgo editorial actual (local):
- En entorno auditado, estos endpoints no se ejecutan por conflicto de rutas; no hay garantía de validar ranking real desde UI local.

---

## 9) Auditoría Seguridad

## CRÍTICO (histórico, mitigado parcialmente)
- Backup sensible `.env.local.backup` ya no presente en estado actual auditado.

## ALTO
- `api/resolve` permite fetch a URL arbitraria enviada por cliente (potencial vector de abuso SSRF-like outbound; no hay allowlist).

## MEDIO
- `api/r.js` tiene allowlist/suffix list (mejorado), pero política amplia por sufijos (`.com`, `.net`, etc.) sigue siendo permisiva.

## BAJO
- `share` y `og` escapan contenido antes de incrustar.

---

## Hallazgos por severidad

## CRÍTICO
1. **Routing local no determinista / captura indebida de API**: `/api/*` y `/sitemap.xml` responden `index.html`.

## ALTO
1. Proceso de desarrollo local contaminado por múltiples `vercel dev` históricos.
2. Acoplamiento API->API (`story`, `sitemap` dependen de `rank`) amplifica fallas.
3. `resolve` sin restricción estricta de dominios destino.

## MEDIO
1. Dependencia de filesystem en `notas`/save endpoints.
2. Retry frontend fijo (15s) sin backoff.
3. Cache global mutable en `story`.

## BAJO
1. Monolito HTML grande.
2. Estrategia SW dependiente de bump manual.

---

## Root Causes (causas reales)

1. **Configuración de routing con fallback total (`^/(.*)$ -> /index.html`) en combinación con `routes/builds` legacy** produce shadowing de rutas API en `vercel dev`.
2. **Ambiente local con procesos `vercel dev` simultáneos/históricos** genera resultados inconsistentes entre ejecuciones.
3. **Acoplamiento funcional fuerte** entre frontend y APIs críticas (`rank`/`feeds`) hace que un fallo de routing invalide gran parte del sistema visible.

---

## Quick Wins (sin reescritura mayor)

1. Estandarizar un único proceso `vercel dev` por puerto y agregar health-check al iniciar.
2. Ejecutar `scripts/qsd-local-audit.sh` en cada arranque local y en CI de smoke.
3. Añadir endpoint local de diagnóstico (`/api/health`) para distinguir fallback HTML vs runtime API real.
4. Endurecer validación/allowlist en `api/resolve`.

---

## Deuda Técnica

- Configuración de routing mezcla paradigmas (`builds` + `routes`) con comportamiento local no estable.
- API gateway implícito no formalizado; falta contrato explícito de prioridad de rutas para local/prod.
- Frontend single-file extenso, difícil de testear por partes.
- Observabilidad limitada (sin tracing estructurado de resolución de rutas ni métricas de endpoint por entorno).

---

## Recomendaciones priorizadas

1. **Estabilidad**: asegurar determinismo de routing local antes de cualquier ajuste funcional.
2. **Consistencia**: unificar estrategia de route resolution entre local y prod.
3. **Percepción de calidad**: evitar que frontend reciba HTML fallback cuando espera JSON (guardrails + auditoría automática).
4. **Performance**: reducir fetch en cascada y validar costos de `rank`/`sitemap`.
5. **Escalabilidad**: desacoplar progresivamente APIs críticas que hoy se llaman entre sí.

