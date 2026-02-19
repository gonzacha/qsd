# QA UI Manifest QSD v1

Source of truth: `qa/QA_UI_MANIFEST_QSD_v1.json`

## Philosophy
- Editorial-first, reader-first, deterministic UI.
- No dashboard/engine feel in default reader mode.
- Local-first memory; no external tracking.

## Identity Rules
- Dark editorial theme preserved.
- Gold accent reserved for highlights, not system chrome.
- No component library feel or admin panel styling.

## Content Translation Rules
Forbidden raw strings (production, unless debug_ui=1):
- src=
- score=
- agreement_ratio
- factos_final
- editorial_score
- hours_since_publish

Required human translations:
- sources_count -> "Confirmado por X medios"
- agreement_ratio (high) -> "Alta coincidencia entre fuentes"
- contradiction_flag -> "Versiones contradictorias"

## Interaction Rules
- Hero looks like front page; title is most prominent.
- Single primary action per card: open.
- Secondary actions allowed: save, share, copy.
- Install CTA/help must not reflow layout.

## Performance Rules
- No layout shift on load.
- Offline shows last cached content; Saved always accessible.
- Rank endpoint must not block render; fallback allowed.

## QA Checks
- Does it read like a newspaper, not a dashboard?
- Are technical signals hidden from reader mode?
- Mobile/PWA navigation is clear without browser UI?

## Forbidden Patterns
- Debug labels visible in production.
- Developer copy visible to reader.
- Multiple primary CTAs per card.
- Analytics or tracking beacons (local ledger only).

## Debug Rule
- Toggle: debug_ui
- Enabled via: URL query ?debug_ui=1 only
- Default: off
- Allowed raw labels:
  - src=
  - score=
  - agreement_ratio
  - factos_final
  - editorial_score
  - hours_since_publish
