#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
INDEX_HTML="${ROOT_DIR}/index.html"
BASE_URL="${BASE_URL:-https://quesedice.vercel.app}"

fail() {
  echo "[FAIL] $1"
  exit 1
}

pass() {
  echo "[PASS] $1"
}

forbidden_strings=(
  "src="
  "score="
  "agreement_ratio"
  "factos_final"
  "editorial_score"
  "hours_since_publish"
)

if [[ ! -f "$INDEX_HTML" ]]; then
  fail "Missing index.html at ${INDEX_HTML}"
fi

INDEX_HTML="$INDEX_HTML" TOKENS="$(printf "%s " "${forbidden_strings[@]}")" python3 - <<'PY'
import os
import re
import sys

index_html = os.environ.get("INDEX_HTML")
tokens = os.environ.get("TOKENS", "").split()
if not index_html:
    print("[FAIL] Missing INDEX_HTML env")
    sys.exit(1)

text = open(index_html, "r", encoding="utf-8").read()
lines = text.splitlines()

pattern = re.compile(r"('([^'\\\\]|\\\\.)*'|\"([^\"\\\\]|\\\\.)*\"|`([^`\\\\]|\\\\.)*`)")

in_script = False
for i, line in enumerate(lines, 1):
    if "<script" in line:
        in_script = True
    if "</script>" in line:
        in_script = False
    if not in_script:
        continue
    for match in pattern.finditer(line):
        literal = match.group(0)
        if "data-" in line:
            continue
        for token in tokens:
            if token in literal and "debugUi" not in line:
                print(f"[FAIL] Forbidden token '{token}' not guarded by debugUi in index.html: {i}:{line}")
                sys.exit(1)

print("[PASS] Static scan: forbidden tokens only appear under debugUi guard in string literals")
PY

html="$(curl -fsS "${BASE_URL}/")" || fail "Failed to fetch ${BASE_URL}/"
html_no_script="$(printf '%s' "$html" | python3 -c "import re,sys; html=sys.stdin.read(); clean=re.sub(r'<script\\b[^>]*>.*?</script>', '', html, flags=re.IGNORECASE | re.DOTALL); sys.stdout.write(clean)")"

printf '%s' "$html_no_script" | grep -a -q "Guardados" || fail "Missing Guardados entry point in homepage HTML"
printf '%s' "$html_no_script" | grep -a -q "Backup" || fail "Missing Backup entry point in homepage HTML"
printf '%s' "$html_no_script" | grep -a -q "Instalar QSD" || fail "Missing Instalar QSD CTA in homepage HTML"
printf '%s' "$html_no_script" | grep -a -q "Cómo instalar" || fail "Missing install help entry point in homepage HTML"
printf '%s' "$html" | grep -a -q "serviceWorker" || fail "Missing service worker registration snippet"
printf '%s' "$html" | grep -a -q "/r?u=" || fail "Missing /r redirect usage in template strings"
pass "Runtime HTML checks: key UX elements and /r usage present"

for token in "${forbidden_strings[@]}"; do
  if printf '%s' "$html_no_script" | grep -a -q "$token"; then
    fail "Forbidden token '$token' appears in production HTML"
  fi
done
pass "Runtime HTML checks: forbidden tokens not visible in production"

echo "[PASS] QA UI gate checks completed"
