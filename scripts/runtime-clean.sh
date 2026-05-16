#!/usr/bin/env bash
# QSD runtime environment diagnostics — does NOT kill processes or change state.
set -uo pipefail

echo "QSD runtime-clean (diagnostics only — no auto-fix)"
echo "generated_at_utc: $(date -u +"%Y-%m-%dT%H:%M:%SZ")"
echo

echo "=== 1) Processes: vercel / npx vercel ==="
if command -v ps >/dev/null 2>&1; then
  if command -v rg >/dev/null 2>&1; then
    ps -eo pid,user,args 2>/dev/null | rg '[v]ercel dev|[n]px vercel dev|[n]pm exec vercel dev' || echo "(no matching lines)"
  else
    ps -eo pid,user,args 2>/dev/null | grep -E 'vercel dev|npx vercel dev|npm exec vercel dev' || echo "(no matching lines)"
  fi
else
  echo "(ps not available)"
fi
echo

echo "=== 2) Listen TCP (3000, 3001, 3010, 3020, 5173) ==="
if command -v ss >/dev/null 2>&1; then
  if command -v rg >/dev/null 2>&1; then
    ss -ltnp 2>/dev/null | rg ':3000|:3001|:3010|:3020|:5173' || echo "(no matches — try: sudo ss -ltnp for PIDs)"
  else
    ss -ltnp 2>/dev/null | grep -E ':3000|:3001|:3010|:3020|:5173' || echo "(no matches — try: sudo ss -ltnp for PIDs)"
  fi
else
  echo "(ss not available)"
fi
echo

echo "=== 3) Duplicate vercel dev hint ==="
if command -v rg >/dev/null 2>&1; then
  cnt="$(ps -eo args 2>/dev/null | rg -c '[v]ercel dev' || true)"
else
  cnt="$(ps -eo args 2>/dev/null | grep -cF 'vercel dev' || true)"
fi
cnt="${cnt:-0}"
echo "lines matching 'vercel dev': $cnt"
if [[ "$cnt" -gt 1 ]]; then
  echo "RISK: Multiple dev servers often cause mixed routing; stop extras before QA."
fi
echo

echo "=== 4) Manual cleanup (run yourself if needed) ==="
echo "  pkill -f 'vercel dev'    # stop all local Vercel dev (review PIDs first: ps aux | rg vercel)"
echo "  # Then start exactly one:  npx vercel dev --listen 3000"
echo
echo "=== 5) Next step ==="
echo "  ./scripts/runtime-audit.sh http://127.0.0.1:3000"
