# QSD / Nordia — Institutional memory (operational doctrine)

This directory holds **append-only institutional cognition**: durable decisions, freezes, and architectural facts that outlive any single chat or session. It extends the same philosophy already used for QA (`scripts/qa_append_ledger.sh`, `data/ledger/qa_runs.jsonl`) and for the in-browser ledger export in `index.html` (IndexedDB `qsd_ledger` → JSONL). Those remain **separate concerns**; this ledger is **team and repository–scoped**, not per-device telemetry.

---

## 1. Two layers (what lives where)

| Artifact | Role |
|----------|------|
| **`QSD_LLM_SHARE_CONTEXT.json`** (repo root) | **Canonical snapshot**: what is **implemented now**, how the stack is wired, constraints, and pointers. Optimized for onboarding LLMs and humans without re-deriving the repo from scratch. |
| **`memory/qsd_memory_ledger.jsonl`** | **Append-only ledger**: **how** and **why** the system evolved—freezes, pivots, accepted trade-offs, and institutional realizations. It is **historical truth**, not a substitute for reading current code. |

The browser IndexedDB ledger and `data/ledger/qa_runs.jsonl` stay where they are: behavioral/QA traces. They may be **referenced** from institutional events (`repo_paths`, summaries) but are not merged into this file.

---

## 2. Source-of-truth precedence

1. **Current implemented behavior** and **declared architecture for “now”** → **`QSD_LLM_SHARE_CONTEXT.json`** (and the codebase). If the snapshot disagrees with the code, **the code wins** until the snapshot is regenerated and merged.
2. **Institutional narrative, decisions, and supersession chains** → **`qsd_memory_ledger.jsonl`**. The ledger does **not** redefine production behavior; it records **decisions and context** so future work does not relitigate the same questions blindly.

When a past ledger line appears to conflict with the snapshot, treat the snapshot as **current policy** and the ledger as **audit trail**—then append a new event that clarifies or supersedes the old reading (see below), and refresh the snapshot when appropriate.

---

## 3. Append-only rule

- **Do not** delete or rewrite existing lines in `qsd_memory_ledger.jsonl`.
- **Do not** “fix” history in place. If something was wrong or incomplete, **append** a new event.
- **Corrections** use a new line; optionally link backward with `supersedes_event_id` when the schema includes it.
- **Superseded** claims remain in the file forever; supersession is expressed by **newer** events and snapshot updates, not by erasure.

This keeps git history, code review, and `git blame` meaningful for institutional memory.

---

## 4. Recommended operational workflow

**When to append**

- Phase freezes, pivots, or explicit acceptance of technical debt.
- Architecture decisions that would otherwise exist only in chat.
- Incidents or QA outcomes that **change doctrine** (not every failing CI run—those belong in `qa_runs.jsonl` unless they alter how we build or ship).

**Who appends**

- Default **`actor`**: accountable human (`human:…`). Agents may propose text; the **merge** is human-owned unless you adopt a stricter convention later.

**Validation**

- Each line must be **one valid JSON object** (JSONL). Validate with `jq empty` on the line or file tail before push.
- Prefer small payloads: a clear `summary`, `repo_paths` pointing at evidence, optional `detail` if the schema grows.

**Snapshot regeneration**

- Regenerate or hand-edit **`QSD_LLM_SHARE_CONTEXT.json`** when the **implemented** picture changes materially (major API, pipeline, deployment, or product boundary).
- The ledger records **that** a freeze or pivot happened; the snapshot carries **what** the system **is** after merges. No requirement to mirror every ledger line into the snapshot.

---

## 5. Anti-overengineering

- **Local-first, git-first**: files in the repo; no extra services required to read or write.
- **Tooling**: shell, `jq`, editors, normal PR review. No daemons, no databases, no embeddings, no dashboards for this layer.
- **No frameworks**: this is documentation plus a line-delimited log. If reporting ever needs more, export or aggregate **out of band**; do not turn the ledger into a product.

---

## 6. Quick reference (append discipline)

1. Add one JSON object as **one line** at the end of `qsd_memory_ledger.jsonl`.
2. Use monotonic UTC timestamps; unique `event_id` per line.
3. Open a PR; reviewer checks JSON validity and that the event matches repo reality.
4. Update **`QSD_LLM_SHARE_CONTEXT.json`** separately when the canonical “now” changes—not on every ledger append.

That is the full operational model for this foundation.
