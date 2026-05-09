# Qué Se Dice

Portal informativo automático — Corrientes, Argentina y el Mundo.

Proyecto editorial independiente enfocado en noticias, tendencias y conversación digital.

---

## 🌐 Sitio
https://www.quesedice.com.ar

## ⚙️ Stack
- Static HTML
- Edge Functions (Vercel)
- RSS aggregation

## 🧭 Estado
V2 — Portal en evolución continua.

## 🛡️ Producción (hardening)
- `/api/rank` y `/api/feeds` trabajan con ventana temporal de 24h y controles de frescura para primer render.
- El `service-worker` no cachea endpoints `/api/*` para evitar datos stale en portada.
- `/api/r` aplica whitelist de dominios para bloquear redirects arbitrarios.
- `/api/story` usa cache en memoria con TTL de 60s para reducir fetches repetidos al ranking.
- `/api/ingesta-save` y `/api/notas-save` quedan deshabilitados por defecto en serverless.
  - Solo se habilitan con `QSD_ALLOW_LOCAL_FS_WRITES=1` en entornos locales controlados.

---

© Qué Se Dice
