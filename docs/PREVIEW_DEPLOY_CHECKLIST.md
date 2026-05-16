# QSD — Preview deploy validation checklist

Use after deploying the **preview** environment (not production). Run in order; stop if a blocking item fails.

## Browser — homepage

- [ ] Open preview URL (root `/`)
- [ ] Hard refresh (`Ctrl+Shift+R` / `Cmd+Shift+R`)
- [ ] Repeat in **incognito** / private window
- [ ] Mobile viewport (375px): nav, hero, stream readable
- [ ] No red errors in DevTools console (warnings OK if known)

## Service worker & cache

- [ ] Application → Service Workers: new SW version active after refresh
- [ ] Unregister SW once, hard refresh, re-register — homepage still loads
- [ ] After deploy bump: old cache names gone (check Cache Storage)
- [ ] Homepage not stuck on stale title/hero from previous deploy

## APIs (network tab)

- [ ] `GET /api/feeds?cat=portada` → 200, JSON, `items[]` with `link` + `pubDate`
- [ ] `GET /api/rank?limit=30` → 200, JSON, `items[]` with `url` + `publishedAt`
- [ ] Empty category still returns 200 with `items: []` (no 500)

## Editorial surfaces

- [ ] Portada renders cards (rank or feeds fallback)
- [ ] Switch category (Argentina, Corrientes, etc.)
- [ ] Story route: `/story/:id` opens HTML
- [ ] Share/redirect: `/r` or card links open external URL
- [ ] Images/thumbs load (or graceful placeholder)

## Freshness & ranking

- [ ] Hero item pub date looks recent (< 24h ideal for portada)
- [ ] Ranking scores visible only if UI exposes them (no broken layout)
- [ ] If rank empty, portada falls back to feeds (no blank page)

## Operational (local, optional)

- [ ] `./qsd.sh` prints usage
- [ ] `./qsd.sh smoke` against preview URL if server available

## Sign-off

| Field | Value |
|-------|--------|
| Preview URL | |
| Commit / branch | |
| Tester | |
| Date | |
| Result | PASS / FAIL |

**Rollback:** checkout tag `qsd-runtime-integration-pre-review` or redeploy previous Vercel preview.
