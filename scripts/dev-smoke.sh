#!/usr/bin/env bash
set -u

BASE_URL="${1:-http://localhost:3000}"

ENDPOINTS=(
  # Root and index must render frontend HTML, while APIs must stay JSON/XML.
  "/|html"
  "/api/feeds|json"
  "/api/rank?limit=5|json"
  "/api/story?id=test|story"
  "/sitemap.xml|xml"
)

tmp_dir="$(mktemp -d)"
trap 'rm -rf "$tmp_dir"' EXIT

echo "QSD dev smoke"
echo "base_url: $BASE_URL"
echo

failures=0

check_kind() {
  local kind="$1"
  local content_type="$2"
  case "$kind" in
    html) [[ "$content_type" == *"text/html"* ]] && return 0 ;;
    json) [[ "$content_type" == *"application/json"* ]] && return 0 ;;
    xml)  [[ "$content_type" == *"application/xml"* || "$content_type" == *"text/xml"* ]] && return 0 ;;
    story)
      [[ "$content_type" == *"text/html"* || "$content_type" == *"text/plain"* || "$content_type" == *"application/json"* ]] && return 0
      ;;
  esac
  return 1
}

for item in "${ENDPOINTS[@]}"; do
  path="${item%%|*}"
  expected="${item##*|}"
  safe_name="$(echo "$path" | sed 's#[^a-zA-Z0-9._-]#_#g')"
  headers_file="$tmp_dir/${safe_name}.headers"
  body_file="$tmp_dir/${safe_name}.body"
  meta_file="$tmp_dir/${safe_name}.meta"
  err_file="$tmp_dir/${safe_name}.err"

  curl -sS -D "$headers_file" -o "$body_file" -m 20 \
    -w "http_code=%{http_code}\ntime_total=%{time_total}\nsize=%{size_download}\n" \
    "${BASE_URL}${path}" > "$meta_file" 2>"$err_file"
  curl_exit=$?

  status="$(rg '^http_code=' "$meta_file" -N | sed 's/http_code=//')"
  elapsed="$(rg '^time_total=' "$meta_file" -N | sed 's/time_total=//')"
  size="$(rg '^size=' "$meta_file" -N | sed 's/size=//')"
  ctype="$(rg '^content-type:' "$headers_file" -i -N | sed 's/[Cc]ontent-[Tt]ype:[[:space:]]*//' | tr -d '\r' | tail -n1)"

  html_fallback="no"
  if rg -q "NOT_FOUND|The page could not be found|<!DOCTYPE html>" "$body_file"; then
    html_fallback="yes"
  fi

  kind_ok="yes"
  if ! check_kind "$expected" "${ctype:-}"; then
    kind_ok="no"
  fi

  status_ok="yes"
  if [[ "$expected" == "story" ]]; then
    if [[ "$status" != "200" && "$status" != "404" ]]; then
      status_ok="no"
    fi
  elif [[ "$status" -lt 200 || "$status" -ge 400 ]]; then
    status_ok="no"
  fi

  echo "[$path]"
  echo "  status=$status status_ok=$status_ok"
  echo "  content_type=${ctype:-N/A} expected=$expected kind_ok=$kind_ok"
  echo "  time_s=${elapsed:-N/A} size=${size:-N/A} html_fallback=$html_fallback"

  if [[ "$curl_exit" -ne 0 ]]; then
    echo "  curl_error=$(tr '\n' ' ' < "$err_file")"
    failures=$((failures + 1))
    continue
  fi

  if [[ "$status_ok" != "yes" || "$kind_ok" != "yes" ]]; then
    failures=$((failures + 1))
  fi
done

echo
if [[ "$failures" -eq 0 ]]; then
  echo "SMOKE_RESULT=PASS"
  exit 0
fi

echo "SMOKE_RESULT=FAIL failures=$failures"
exit 1
