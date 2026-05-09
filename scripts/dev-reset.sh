#!/usr/bin/env bash
set -u

echo "QSD dev reset diagnostics"
echo

echo "1) Running Vercel processes"
ps -ef | rg "vercel dev|npm exec vercel" || echo "No vercel dev processes detected."
echo

echo "2) Listening ports (common dev ports)"
if command -v ss >/dev/null 2>&1; then
  ss -ltn | rg ":3000|:3001|:3002|:3003|:5173|:8080" || echo "No common local dev ports are listening."
else
  echo "Command 'ss' not available."
fi
echo

echo "3) Recommendations"
echo "- Stop all previous vercel dev terminals before starting a new one."
# Keep one deterministic listener to avoid mixed routing state.
echo "- Use one fixed port per session, e.g. 'npx vercel dev --listen 3000'."
echo "- Validate runtime after boot with: './scripts/dev-smoke.sh'."
echo "- If browser output differs from curl, clear service worker/cache (see qa/SW_QA_GUIDE.md)."
