#!/usr/bin/env bash
# QSD runtime audit — deterministic HTTP checks (curl). Does not fix anything.
# Service Worker: not exercised; see qa/runtime_findings.md / SW section.
set -uo pipefail

SMOKE=0
BASE_URL="http://localhost:3000"

for dep in curl python3; do
  command -v "$dep" >/dev/null 2>&1 || { echo "missing dependency: $dep" >&2; exit 2; }
done
command -v rg >/dev/null 2>&1 || { echo "missing dependency: rg (ripgrep) — install for HTML/NOT_FOUND heuristics" >&2; exit 2; }

while [[ $# -gt 0 ]]; do
  case "$1" in
    --smoke) SMOKE=1; shift ;;
    -h|--help)
      echo "Usage: $0 [--smoke] [BASE_URL]"
      exit 0
      ;;
    *)
      BASE_URL="${1%/}"
      shift
      ;;
  esac
done

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
REPORT_TXT="$REPO_ROOT/qa/runtime_report.txt"
FINDINGS_MD="$REPO_ROOT/qa/runtime_findings.md"
mkdir -p "$REPO_ROOT/qa"

TS_UTC="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

# --- thresholds (bytes) ----------------------------------------------------
MIN_HTML_BYTES=2048
MIN_JSON_BYTES=64
MIN_SITEMAP_BYTES=128
MIN_STORY_404_BYTES=1
MAX_STORY_404_BYTES=256

CURL=(curl -sS -m 30 --http1.1
  -H "Accept: */*"
  -H "Cache-Control: no-cache"
  -H "Pragma: no-cache"
  -H "X-QSD-Runtime-Audit: 1"
)

log() { if [[ "$SMOKE" -eq 0 ]]; then printf '%s\n' "$*"; fi }

die_json_check() {
  python3 - "$1" <<'PY' || return 1
import json, sys
path = sys.argv[1]
with open(path, "r", encoding="utf-8", errors="replace") as f:
    json.load(f)
PY
}

json_items_array() {
  python3 - "$1" "$2" <<'PY' || return 1
import json, sys
path, key = sys.argv[1], sys.argv[2]
with open(path, "r", encoding="utf-8", errors="replace") as f:
    data = json.load(f)
items = data.get(key)
sys.exit(0 if isinstance(items, list) else 1)
PY
}

body_looks_like_html_doc() {
  local f="$1"
  [[ -f "$f" ]] || return 1
  if rg -q '<!DOCTYPE\s+html|<html[\s>]' "$f" 2>/dev/null; then return 0; fi
  if rg -qi 'The page could not be found|</html>|<head[\s>]' "$f" 2>/dev/null; then return 0; fi
  return 1
}

body_looks_like_vercel_not_found() {
  local f="$1"
  [[ -f "$f" ]] || return 1
  rg -q 'The page could not be found|^NOT_FOUND\s*$' "$f" 2>/dev/null
}

ctype_primary() {
  local raw="$1"
  raw="${raw%%;*}"
  echo "${raw,,}" | tr -d '\r'
}

# --- fetch one URL ---------------------------------------------------------
# Sets: _code _ctype _size _curl_exit _hdr _body
fetch_ep() {
  local url="$1"
  local base="$2"
  _hdr="$TMP_DIR/h.$base"
  _body="$TMP_DIR/b.$base"
  _meta="$TMP_DIR/m.$base"
  _err="$TMP_DIR/e.$base"
  "${CURL[@]}" -D "$_hdr" -o "$_body" -w "http_code=%{http_code}\nsize_download=%{size_download}\n" \
    "$url" > "$_meta" 2>"$_err"
  _curl_exit=$?
  _code="$(sed -n 's/^http_code=//p' "$_meta" | tail -n1)"
  _size="$(sed -n 's/^size_download=//p' "$_meta" | tail -n1)"
  _ctype="$(rg -i '^content-type:' "$_hdr" | sed 's/^[Cc]ontent-[Tt]ype:[[:space:]]*//' | tr -d '\r' | tail -n1)"
}

FAILURES=0
WARNINGS=0
declare -a FINDING_LINES=()

record_fail() { FINDING_LINES+=("FAIL: $*"); FAILURES=$((FAILURES + 1)); }
record_warn() { FINDING_LINES+=("WARN: $*"); WARNINGS=$((WARNINGS + 1)); }

check_api_json() {
  local name="$1" path="$2" min_b="$3" item_key="$4"
  local url="${BASE_URL}${path}"
  fetch_ep "$url" "api_${name}"

  if [[ "$_curl_exit" -ne 0 ]]; then
    record_fail "$path curl error (exit $_curl_exit) $(tr '\n' ' ' < "$_err")"
    return
  fi
  if [[ "$_code" != "200" ]]; then
    record_fail "$path expected HTTP 200 got $_code"
    return
  fi

  local ct
  ct="$(ctype_primary "$_ctype")"
  if [[ "$ct" != *"application/json"* ]]; then
    record_fail "$path content-type must be application/json*; got '${_ctype:-empty}' (possible HTML fallback / rewrite capture)"
  fi

  if [[ "${_size:-0}" -lt "$min_b" ]]; then
    record_fail "$path body too small (${_size:-0} < $min_b) — empty or truncated"
  fi

  if body_looks_like_html_doc "$_body"; then
    record_fail "$path body looks like HTML document while path is /api/* — likely SPA or error page"
  fi
  if body_looks_like_vercel_not_found "$_body"; then
    record_fail "$path body matches Vercel NOT_FOUND text — not real API output"
  fi

  if ! die_json_check "$_body"; then
    record_fail "$path JSON not parseable"
    return
  fi

  if [[ -n "$item_key" ]] && ! json_items_array "$_body" "$item_key"; then
    record_fail "$path JSON missing array '$item_key' — wrong contract or error payload shape"
  fi
}

check_html_page() {
  local path="$1" tag="$2"
  local url="${BASE_URL}${path}"
  fetch_ep "$url" "$tag"

  if [[ "$_curl_exit" -ne 0 ]]; then
    record_fail "$path curl error (exit $_curl_exit)"
    return
  fi
  if [[ "$_code" != "200" ]]; then
    record_fail "$path expected HTTP 200 got $_code"
    return
  fi

  local ct
  ct="$(ctype_primary "$_ctype")"
  if [[ "$ct" != "text/html"* && "$ct" != "application/xhtml+xml"* ]]; then
    record_fail "$path expected text/html*; got '${_ctype:-empty}'"
  fi

  if [[ "${_size:-0}" -lt "$MIN_HTML_BYTES" ]]; then
    record_fail "$path HTML too small (${_size:-0} < $MIN_HTML_BYTES) — likely 404 shell or empty"
  fi

  if body_looks_like_vercel_not_found "$_body"; then
    record_fail "$path Vercel NOT_FOUND body — index.html not in static scope or wrong dev root"
  fi
  if ! body_looks_like_html_doc "$_body"; then
    record_warn "$path body does not look like a full HTML document (ambiguous — may still be valid)"
  fi
}

check_sitemap() {
  local path="/sitemap.xml"
  local url="${BASE_URL}${path}"
  fetch_ep "$url" "sitemap"

  if [[ "$_curl_exit" -ne 0 ]]; then
    record_fail "$path curl error (exit $_curl_exit)"
    return
  fi
  if [[ "$_code" != "200" ]]; then
    record_fail "$path expected HTTP 200 got $_code"
    return
  fi

  local ct
  ct="$(ctype_primary "$_ctype")"
  if [[ "$ct" != "application/xml"* && "$ct" != "text/xml"* ]]; then
    record_fail "$path expected application/xml or text/xml; got '${_ctype:-empty}' (possible HTML fallback)"
  fi

  if [[ "${_size:-0}" -lt "$MIN_SITEMAP_BYTES" ]]; then
    record_fail "$path XML too small"
  fi

  if body_looks_like_html_doc "$_body"; then
    record_fail "$path body looks like HTML — rewrite may be serving SPA instead of /api/sitemap"
  fi
  if ! rg -q '<urlset|<?xml' "$_body" 2>/dev/null; then
    record_fail "$path body missing urlset/<?xml — not a sitemap"
  fi
}

check_story_test() {
  local path="/api/story?id=test"
  local url="${BASE_URL}${path}"
  fetch_ep "$url" "story_test"

  if [[ "$_curl_exit" -ne 0 ]]; then
    record_fail "$path curl error (exit $_curl_exit)"
    return
  fi

  if [[ "$_code" != "200" && "$_code" != "404" ]]; then
    record_fail "$path expected 200 or 404 got $_code"
    return
  fi

  if [[ "$_code" == "404" ]]; then
    local ct
    ct="$(ctype_primary "$_ctype")"
    if [[ -z "$ct" ]]; then
      record_warn "$path 404 with empty Content-Type (ambiguous; body inspected below)"
    fi
    if [[ "$ct" == "text/html"* ]]; then
      record_fail "$path 404 with text/html — likely index fallback, not api/story"
    fi
    if [[ "${_size:-0}" -lt "$MIN_STORY_404_BYTES" || "${_size:-0}" -gt "$MAX_STORY_404_BYTES" ]]; then
      record_warn "$path 404 body size ${_size:-0} bytes (expected small plain 'Not Found'; ambiguous if proxy altered)"
    fi
    if body_looks_like_html_doc "$_body"; then
      record_fail "$path 404 body looks like HTML document"
    fi
    return
  fi

  # 200: must be story HTML from function
  local ct
  ct="$(ctype_primary "$_ctype")"
  if [[ "$ct" != "text/html"* ]]; then
    record_fail "$path 200 expected text/html from handler; got '${_ctype:-empty}'"
  fi
  if [[ "${_size:-0}" -lt "$MIN_HTML_BYTES" ]]; then
    record_fail "$path 200 HTML too small"
  fi
}

# --- environment snapshot --------------------------------------------------
env_block() {
  {
    echo "=== environment (local) ==="
    echo "ts_utc: $TS_UTC"
    echo "base_url: $BASE_URL"
    echo
    echo "-- processes matching vercel dev --"
    if command -v ps >/dev/null 2>&1; then
      ps -eo pid,user,args 2>/dev/null | rg '[v]ercel dev|[n]px vercel dev|[n]pm exec vercel' || echo "(none matched)"
    else
      echo "(ps not available)"
    fi
    echo
    echo "-- listening TCP (common dev ports) --"
    if command -v ss >/dev/null 2>&1; then
      ss -ltnp 2>/dev/null | rg ':3000|:3001|:3010|:3020|:5173' || echo "(no matches or ss -p needs privileges)"
    else
      echo "(ss not available)"
    fi
    echo
    vercel_count="$(ps -eo args 2>/dev/null | rg -c '[v]ercel dev' || true)"
    vercel_count="${vercel_count:-0}"
    echo "vercel_dev_process_lines: $vercel_count"
    if [[ "${vercel_count:-0}" -gt 1 ]]; then
      echo "WARNING: multiple vercel dev invocations possible — use scripts/runtime-clean.sh and one listener."
    fi
    echo
  }
}

# --- run -------------------------------------------------------------------
{
  echo "QSD_RUNTIME_AUDIT_REPORT"
  echo "generated_at_utc: $TS_UTC"
  echo "base_url: $BASE_URL"
  echo "smoke_mode: $SMOKE"
  echo
  env_block
} > "$REPORT_TXT"

log "QSD runtime audit"
log "base_url=$BASE_URL"
log

check_html_page "/" "root"
{
  echo "=== / ==="
  echo "http_code=$_code content_type=${_ctype:-} size=$_size"
  echo "-- head --"
  sed -n '1,12p' "$_body" 2>/dev/null || true
  echo
} >> "$REPORT_TXT"

check_html_page "/index.html" "index_html"
{
  echo "=== /index.html ==="
  echo "http_code=$_code content_type=${_ctype:-} size=$_size"
  echo "-- head --"
  sed -n '1,12p' "$_body" 2>/dev/null || true
  echo
} >> "$REPORT_TXT"

check_api_json "feeds" "/api/feeds" "$MIN_JSON_BYTES" "items"
{
  echo "=== /api/feeds ==="
  echo "http_code=$_code content_type=${_ctype:-} size=$_size"
  echo "-- head --"
  sed -n '1,5p' "$_body" 2>/dev/null || true
  echo
} >> "$REPORT_TXT"

check_api_json "rank" "/api/rank?limit=5" "$MIN_JSON_BYTES" "items"
{
  echo "=== /api/rank?limit=5 ==="
  echo "http_code=$_code content_type=${_ctype:-} size=$_size"
  echo
} >> "$REPORT_TXT"

check_story_test
{
  echo "=== /api/story?id=test ==="
  echo "http_code=$_code content_type=${_ctype:-} size=$_size"
  echo "-- body --"
  cat "$_body" 2>/dev/null | head -c 400; echo
  echo
} >> "$REPORT_TXT"

check_sitemap
{
  echo "=== /sitemap.xml ==="
  echo "http_code=$_code content_type=${_ctype:-} size=$_size"
  echo "-- head --"
  sed -n '1,8p' "$_body" 2>/dev/null || true
  echo
} >> "$REPORT_TXT"

{
  echo "=== summary ==="
  echo "failures: $FAILURES"
  echo "warnings: $WARNINGS"
  for line in "${FINDING_LINES[@]:-}"; do
    echo "$line"
  done
} >> "$REPORT_TXT"

# --- findings markdown -----------------------------------------------------
{
  cat <<EOF
# QSD runtime findings (auto-generated)

**Generated (UTC):** $TS_UTC  
**Base URL:** \`$BASE_URL\`  
**Tooling:** \`scripts/runtime-audit.sh\` (curl + python3 JSON).  

## Measurement limits (no false confidence)

| Topic | Status |
|-------|--------|
| Service Worker cache | **NOT measured** here. curl does not register SW; browser may differ. See \`qa/SW_QA_GUIDE.md\`. |
| HTTP intermediary cache | Partially bypassed via \`Cache-Control: no-cache\` on requests. |
| Production vs local | This audit targets the URL you pass (e.g. \`vercel dev\`). Production is a separate run. |

## Reproduce

\`\`\`bash
cd "$REPO_ROOT"
./scripts/runtime-clean.sh
# start a single dev server, then:
./scripts/runtime-audit.sh http://127.0.0.1:3000
\`\`\`

## Environment snapshot

See \`qa/runtime_report.txt\` section \`environment (local)\`.

## Deterministic results

EOF

  if [[ "$FAILURES" -eq 0 && "$WARNINGS" -eq 0 ]]; then
    echo "- **Overall:** \`PASS\` (no FAIL/WARN lines)."
  elif [[ "$FAILURES" -eq 0 ]]; then
    echo "- **Overall:** \`PASS_WITH_WARNINGS\` — review WARN lines; not automatically broken."
  else
    echo "- **Overall:** \`FAIL\` — at least one FAIL below; do not treat as green build."
  fi
  echo

  echo "### Issues (ordered)"
  echo
  if [[ ${#FINDING_LINES[@]} -eq 0 ]]; then
    echo "_No FAIL/WARN records._"
  else
    for line in "${FINDING_LINES[@]}"; do
      esc="${line//\`/\\\`}"
      echo "- \`$esc\`"
    done
  fi
  echo

  cat <<'EOF'
## Risk priority (how to read)

1. **FAIL: `/api/*` … content-type … application/json** — Often SPA rewrite or dev static root wrong; same symptom as “APIs simuladas por rewrite”.
2. **FAIL: … HTML document while path is /api/** — Strong signal of fallback HTML.
3. **FAIL: Vercel NOT_FOUND** — Route exists in browser expectation but dev server has no file/handler.
4. **WARN: multiple vercel dev** — Port contamination; see `runtime-clean.sh`.

EOF
} > "$FINDINGS_MD"

log
if [[ ${#FINDING_LINES[@]} -gt 0 ]]; then
  for line in "${FINDING_LINES[@]}"; do log "$line"; done
fi

log
log "Wrote: $REPORT_TXT"
log "Wrote: $FINDINGS_MD"

if [[ "$FAILURES" -eq 0 ]]; then
  [[ "$SMOKE" -eq 1 ]] && echo "RUNTIME_SMOKE=PASS"
  exit 0
fi
[[ "$SMOKE" -eq 1 ]] && echo "RUNTIME_SMOKE=FAIL failures=$FAILURES"
exit 1
