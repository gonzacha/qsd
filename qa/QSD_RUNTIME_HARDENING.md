# QSD Runtime Hardening (Local Routing)

## Cambios aplicados

### 1) `vercel.json` simplificado y determinístico

- Se removió configuración compleja de `routes`/`builds` que estaba generando captura incorrecta.
- Se usa estrategia simple con `rewrites`:
  - `/sitemap.xml` -> `/api/sitemap`
  - `/story/:id` y `/story/:id/:slug` -> `/api/story?id=:id`
  - `/r` -> `/api/r`
  - `/` -> `/index.html`
  - `/((?!api/).*)` -> `/index.html` (SPA fallback sin atrapar `/api/*`)

### 2) Smoke tests reproducibles

- Nuevo script: `scripts/dev-smoke.sh`
- Valida:
  - `/`
  - `/api/feeds`
  - `/api/rank?limit=5`
  - `/api/story?id=test`
  - `/sitemap.xml`
- Reporta:
  - status
  - content-type
  - tiempo
  - tamaño
  - señal de fallback HTML inesperado

### 3) Diagnóstico de runtime local

- Nuevo script: `scripts/dev-reset.sh`
- Muestra:
  - procesos `vercel dev` activos
  - puertos dev frecuentes en escucha
  - recomendaciones operativas para entorno limpio

### 4) Seguridad operativa de QA con SW

- Nueva guía: `qa/SW_QA_GUIDE.md`
- Define:
  - cuándo desconfiar del browser por cache SW
  - limpieza de SW/caché
  - criterio `curl` primero, browser después

## Reasoning técnico

- El root cause local era un fallback catch-all que terminaba devolviendo HTML también para endpoints que debían resolver serverless.
- El rewrite negativo `/(?!api/)` reduce ese riesgo y mantiene comportamiento SPA.
- Separar validación terminal (`curl`) de validación browser evita diagnósticos contaminados por SW.

## Riesgos mitigados

- Captura accidental de `/api/*` por fallback de SPA.
- QA inconsistente por procesos `vercel dev` duplicados.
- Falsos positivos de frontend por caché de service worker.

## Validación local recomendada

1. `./scripts/dev-reset.sh`
2. Levantar limpio: `npx vercel dev --listen 3000`
3. `./scripts/dev-smoke.sh http://localhost:3000`
4. Si browser difiere: seguir `qa/SW_QA_GUIDE.md`
