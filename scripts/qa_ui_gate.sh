#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
HTML_LOCAL="${ROOT_DIR}/index.html"

fail() { echo "[FAIL] $1"; exit 1; }
pass() { echo "[PASS] $1"; }
skip() { echo "[SKIP] $1"; }

forbidden_strings=(
  "src="
  "score="
  "agreement_ratio"
  "factos_final"
  "editorial_score"
  "hours_since_publish"
)

# ── Helpers ────────────────────────────────────────────────────────────────

strip_scripts() {
  python3 -c "
import re, sys
html = sys.stdin.read()
print(re.sub(r'<script\b[^>]*>.*?</script>', '', html, flags=re.IGNORECASE | re.DOTALL), end='')
"
}

strip_tags() {
  python3 -c "
import re, sys
print(re.sub(r'<[^>]+>', ' ', sys.stdin.read()), end='')
"
}

check_html_file() {
  local label="$1"
  local file="$2"

  local tmp_ns tmp_text
  tmp_ns="$(mktemp)"
  tmp_text="$(mktemp)"
  # shellcheck disable=SC2064
  trap "rm -f '$tmp_ns' '$tmp_text'" RETURN

  strip_scripts < "$file" > "$tmp_ns"
  strip_tags    < "$tmp_ns" > "$tmp_text"

  grep -aq  "Guardados"     "$tmp_ns" || fail "[$label] Missing Guardados entry point"
  grep -aq  "Backup"        "$tmp_ns" || fail "[$label] Missing Backup entry point"
  grep -aq  "Instalar QSD"  "$tmp_ns" || fail "[$label] Missing Instalar QSD CTA"
  grep -aq  "Cómo instalar" "$tmp_ns" || fail "[$label] Missing install help entry point"
  grep -aq  "serviceWorker" "$file"   || fail "[$label] Missing service worker snippet"
  grep -aFq "/r?u="         "$file"   || fail "[$label] Missing /r redirect usage"
  pass "$label: key UX elements and /r usage present"

  for token in "${forbidden_strings[@]}"; do
    if grep -aq "$token" "$tmp_text"; then
      fail "[$label] Forbidden token '$token' visible in HTML text"
    fi
  done
  pass "$label: forbidden tokens not visible in rendered text"
}

# ── 1. Static scan (local, always) ─────────────────────────────────────────

[[ -f "$HTML_LOCAL" ]] || fail "Missing index.html at ${HTML_LOCAL}"

INDEX_HTML="$HTML_LOCAL" TOKENS="$(printf "%s " "${forbidden_strings[@]}")" python3 - <<'PY'
import os, re, sys

index_html = os.environ.get("INDEX_HTML")
tokens     = os.environ.get("TOKENS", "").split()
if not index_html:
    print("[FAIL] Missing INDEX_HTML env"); sys.exit(1)

text   = open(index_html, "r", encoding="utf-8").read()
lines  = text.splitlines()
pattern = re.compile(r"('([^'\\\\]|\\\\.)*'|\"([^\"\\\\]|\\\\.)*\"|`([^`\\\\]|\\\\.)*`)")

in_script = False
for i, line in enumerate(lines, 1):
    if "<script" in line:   in_script = True
    if "</script>" in line: in_script = False
    if not in_script:       continue
    for match in pattern.finditer(line):
        literal = match.group(0)
        if "data-" in line: continue
        for token in tokens:
            if token in literal and "debugUi" not in line:
                print(f"[FAIL] Forbidden token '{token}' not guarded by debugUi — line {i}: {line.strip()[:120]}")
                sys.exit(1)

print("[PASS] Static scan: forbidden tokens only appear under debugUi guard in string literals")
PY

# ── 2. Local HTML checks (always) ──────────────────────────────────────────

check_html_file "Local" "$HTML_LOCAL"

# ── 3. Remote checks (only if QSD_PROD_URL is set) ─────────────────────────

if [[ -n "${QSD_PROD_URL:-}" ]]; then
  TMP="$(mktemp)"
  trap 'rm -f "$TMP"' EXIT
  curl -fsS "${QSD_PROD_URL}/" -o "$TMP" || fail "Failed to fetch ${QSD_PROD_URL}/"
  check_html_file "Remote" "$TMP"
else
  skip "Remote checks (set QSD_PROD_URL to enable)"
fi

echo "[PASS] QA UI gate checks completed"
