# QSD / RQSD — Phase 0 stabilization audit

**Date:** 2026-05-12  
**Mission:** Runtime stabilization + operational reliability (“salida de la ignominia”).  
**Scope:** No product redesign; nervous-system hardening only.

---

## 1. Runtime state (summary)

| Layer | Mechanism | Notes |
|--------|-----------|--------|
| **Deploy** | Vercel static + serverless `api/*` | SPA rewrite excludes `lib/`, `rqsd/`, `manifest.webmanifest`, logos, `service-worker.js`, etc. |
| **Client shell** | Single-page `index.html` | Portada tries `/api/rank`, then `/api/feeds?cat=…` |
| **PWA** | `service-worker.js` | Precache + fetch handler; version bump invalidates old caches |
| **Local memory** | IndexedDB `qsd_ledger` | Append-only events; export JSONL from Backup |

---

## 2. Service worker (`service-worker.js`)

| Topic | Behavior |
|-------|-----------|
| **Cache key** | `qsd-pwa-v0.0.7` — bump on each stabilization deploy that must flush clients |
| **Activate** | Deletes all caches whose name ≠ current |
| **Navigate** | **Network-only for HTML documents** — response is **not** written to Cache Storage (avoids stale `index.html` after deploy). Offline still falls back to cached `/` or `/offline.html` |
| **Assets** | `.css`, `.js`, `.png`, `.svg`, `.woff2`, `.webmanifest` — cache on success |
| **API** | Passthrough `fetch`, never cached |

**Production header:** `vercel.json` sets `Cache-Control: no-cache, no-store, must-revalidate` for `/service-worker.js` so browsers pick up new SW logic.

---

## 3. Vercel runtime

- **Rewrites:** Catch-all SPA → `index.html` except listed static/editorial paths (`rqsd/` included).
- **Manifest:** Explicit `Content-Type: application/manifest+json` for `/manifest.webmanifest`.
- **Preview vs production:** Preview deployments may use Deployment Protection → occasional **401** on subresources; validate on `www` for authoritative behavior.

---

## 4. APIs

| Route | Role | Empty / failure |
|-------|------|------------------|
| `/api/rank` | Portada primary | If zero items or non-OK → client falls back to `/api/feeds?cat=portada` (console warning) |
| `/api/feeds` | RSS aggregation per category | Filters items **≤24h** server-side; may return empty set → UI shows empty state |

**Client-side:** No silent success on empty rank for portada — fallback path is explicit.

---

## 5. UI runtime

| Surface | Check |
|---------|--------|
| **Hero** | First ranked item + wheel; `data-qsd-hero-stale="1"` when watchdog fires |
| **Stream rail** | `renderStream` from same item list |
| **Ticker** | `renderSignalTicker`; CSS marquee; hidden if no items |
| **Mobile** | `@media` collapse of grid; stream height capped |

---

## 6. Freshness watchdog (TASK-0002)

**Rule:** On **Portada**, if the **hero (first item)** is older than **24h** (`hours_since_publish` or derived from `pubDate`):

1. **`console.warn`** with `{ age_hours, item_id, title_snip }`
2. **`CustomEvent` `qsd:freshness-stale`** on `window` — optional hook for Telegram/server later:
   ```js
   window.addEventListener('qsd:freshness-stale', (e) => { /* e.detail */ });
   ```
3. **Ledger:** At most **one** `freshness_stale` event per **calendar day** per browser (`localStorage` key `qsd_fw_ledger_YYYY-MM-DD`), stored in IndexedDB via existing `ledgerAppend`.

This does **not** fix editorial lag; it **surfaces** decay for operators.

---

## 7. RQSD (`/rqsd/`)

| Check | Status |
|-------|--------|
| Loads from HTTP(S) | Required — `file://` blocked with explicit message |
| Candidate rail | `/api/rank?limit=60` then **`/api/feeds?cat=portada`** with `cache: 'no-store'` |
| Preview / iframe | Deterministic URLs from selected item |

**Principle:** Operational routing surface, not a generic CMS.

---

## 8. Known blockers / risks

1. **Rank pipeline stale** — UI can render but watchdog warns; editorial fix is upstream ingestion/rank.
2. **Feeds 24h filter** — If all sources are old, `/api/feeds` returns empty → empty UI even when rank fallback runs.
3. **Preview 401** — Environment-specific; not a bug in app logic.
4. **`Logo_qsd.png` / manifest** — Must be deployed and excluded from SPA rewrite (see `vercel.json`).

---

## 9. Operational checklist (post-deploy)

```bash
curl -sI https://www.quesedice.com.ar/service-worker.js | head -5
curl -sI https://www.quesedice.com.ar/manifest.webmanifest | head -5
curl -sS "https://www.quesedice.com.ar/api/rank?limit=3" | head -c 400
curl -sS "https://www.quesedice.com.ar/api/feeds?cat=portada" | head -c 400
```

Browser: DevTools → Application → Service Workers + Cache Storage version.

---

## 10. Files touched in Phase 0 pass

- `service-worker.js` — v0.0.7, navigate no longer caches document into shell cache
- `vercel.json` — `service-worker.js` no-cache headers
- `index.html` — portada rank→feeds fallback, freshness watchdog
- `rqsd/index.html` — explicit `?cat=portada` + `no-store` on feeds fetch

---

*End of audit document. Update on next stabilization milestone.*
