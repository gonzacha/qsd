#!/usr/bin/env bash
set -u

BASE_URL="${1:-http://localhost:3000}"
OUT_FILE="qa/local_audit_report.txt"
TMP_DIR="$(mktemp -d)"
TS="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"

mkdir -p "qa"

ENDPOINTS=(
  "/"
  "/api/feeds"
  "/api/rank?limit=5"
  "/api/story?id=test"
  "/sitemap.xml"
  "/api/r"
  "/api/resolve"
  "/api/share"
  "/api/story-image"
  "/api/thumb"
  "/api/notas"
  "/api/og"
)

EXPECTED_KIND() {
  case "$1" in
    "/api/feeds"|"/api/rank?limit=5"|"/api/story?id=test"|"/api/resolve"|"/api/story-image"|"/api/notas")
      echo "json"
      ;;
    "/sitemap.xml")
      echo "xml"
      ;;
    "/api/r")
      echo "redirect"
      ;;
    *)
      echo "html"
      ;;
  esac
}

IS_MISMATCH() {
  local expected="$1"
  local ctype="$2"
  case "$expected" in
    json)
      [[ "$ctype" != *"application/json"* ]]
      ;;
    xml)
      [[ "$ctype" != *"application/xml"* && "$ctype" != *"text/xml"* ]]
      ;;
    redirect)
      [[ "$ctype" == *"text/html"* || "$ctype" == *"application/json"* ]]
      ;;
    html)
      [[ "$ctype" != *"text/html"* && "$ctype" != *"text/plain"* ]]
      ;;
    *)
      return 1
      ;;
  esac
}

{
  echo "QSD Local Audit Report"
  echo "generated_at_utc: $TS"
  echo "base_url: $BASE_URL"
  echo
} > "$OUT_FILE"

for ep in "${ENDPOINTS[@]}"; do
  safe_name="$(echo "$ep" | sed 's#[^a-zA-Z0-9._-]#_#g')"
  hdr="$TMP_DIR/${safe_name}.headers"
  body="$TMP_DIR/${safe_name}.body"

  curl -sS -D "$hdr" -o "$body" -m 20 -w "http_code=%{http_code}\ntime_total=%{time_total}\nsize_download=%{size_download}\n" \
    "${BASE_URL}${ep}" > "$TMP_DIR/${safe_name}.meta" 2>"$TMP_DIR/${safe_name}.err"
  curl_exit=$?

  http_code="$(rg '^http_code=' "$TMP_DIR/${safe_name}.meta" -N | sed 's/http_code=//')"
  time_total="$(rg '^time_total=' "$TMP_DIR/${safe_name}.meta" -N | sed 's/time_total=//')"
  size_download="$(rg '^size_download=' "$TMP_DIR/${safe_name}.meta" -N | sed 's/size_download=//')"
  content_type="$(rg '^content-type:' "$hdr" -i -N | sed 's/[Cc]ontent-[Tt]ype:[[:space:]]*//' | tr -d '\r' | tail -n1)"
  location="$(rg '^location:' "$hdr" -i -N | sed 's/[Ll]ocation:[[:space:]]*//' | tr -d '\r' | tail -n1)"
  expected="$(EXPECTED_KIND "$ep")"

  mismatch="no"
  if [[ -n "$content_type" ]]; then
    if IS_MISMATCH "$expected" "$content_type"; then
      mismatch="yes"
    fi
  fi

  html_fallback="no"
  if [[ -f "$body" ]] && rg -q "NOT_FOUND|The page could not be found|<!DOCTYPE html" "$body"; then
    html_fallback="yes"
  fi

  {
    echo "=== ENDPOINT ${ep} ==="
    echo "curl_exit: ${curl_exit}"
    echo "status: ${http_code:-N/A}"
    echo "content_type: ${content_type:-N/A}"
    echo "time_total_s: ${time_total:-N/A}"
    echo "size_download_bytes: ${size_download:-N/A}"
    echo "expected_kind: ${expected}"
    echo "content_type_mismatch: ${mismatch}"
    echo "html_or_notfound_signature: ${html_fallback}"
    if [[ -n "$location" ]]; then
      echo "location: $location"
    fi
    if [[ $curl_exit -ne 0 ]]; then
      echo "curl_error:"
      sed 's/^/  /' "$TMP_DIR/${safe_name}.err"
    fi
    echo "-- response_head --"
    sed -n '1,8p' "$body"
    echo
  } >> "$OUT_FILE"
done

echo "done: $OUT_FILE"
