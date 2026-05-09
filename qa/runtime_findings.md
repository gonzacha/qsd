# QSD runtime findings (auto-generated)

**Generated (UTC):** 2026-05-09T12:10:40Z  
**Base URL:** `http://localhost:3000`  
**Tooling:** `scripts/runtime-audit.sh` (curl + python3 JSON).  

## Measurement limits (no false confidence)

| Topic | Status |
|-------|--------|
| Service Worker cache | **NOT measured** here. curl does not register SW; browser may differ. See `qa/SW_QA_GUIDE.md`. |
| HTTP intermediary cache | Partially bypassed via `Cache-Control: no-cache` on requests. |
| Production vs local | This audit targets the URL you pass (e.g. `vercel dev`). Production is a separate run. |

## Reproduce

```bash
cd "/home/gonza/dev/editorial/quesedice"
./scripts/runtime-clean.sh
# start a single dev server, then:
./scripts/runtime-audit.sh http://127.0.0.1:3000
```

## Environment snapshot

See `qa/runtime_report.txt` section `environment (local)`.

## Deterministic results

- **Overall:** `FAIL` — at least one FAIL below; do not treat as green build.

### Issues (ordered)

- `FAIL: / curl error (exit 7)`
- `FAIL: /index.html curl error (exit 7)`
- `FAIL: /api/feeds curl error (exit 7) curl: (7) Failed to connect to localhost port 3000 after 0 ms: Couldn't connect to server `
- `FAIL: /api/rank?limit=5 curl error (exit 7) curl: (7) Failed to connect to localhost port 3000 after 0 ms: Couldn't connect to server `
- `FAIL: /api/story?id=test curl error (exit 7)`
- `FAIL: /sitemap.xml curl error (exit 7)`

## Risk priority (how to read)

1. **FAIL: `/api/*` … content-type … application/json** — Often SPA rewrite or dev static root wrong; same symptom as “APIs simuladas por rewrite”.
2. **FAIL: … HTML document while path is /api/** — Strong signal of fallback HTML.
3. **FAIL: Vercel NOT_FOUND** — Route exists in browser expectation but dev server has no file/handler.
4. **WARN: multiple vercel dev** — Port contamination; see `runtime-clean.sh`.

