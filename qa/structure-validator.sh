#!/bin/bash
# qa/structure-validator.sh — Capa 4: Validación Estructural
# Valida que la API responde con la FORMA correcta
# Usage: BASE_URL=https://qsd-seven.vercel.app ./qa/structure-validator.sh

set -euo pipefail
cd "$(dirname "$0")"
source ./lib/qa-helpers.sh

RULES_FILE="./rules/editorial.json"
MAX_RESPONSE_MS=$(jq -r '.max_response_time_ms' "$RULES_FILE")
CATEGORIES=$(jq -r '.known_categories[]' "$RULES_FILE")

echo "═══ QSD Structure Validator ═══"
echo "Target: $BASE_URL"
echo "Time:   $(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo ""

# ── Check 1: JSON Schema ──
portada=$(fetch_json "/api/feeds?cat=portada")
if [ -n "$portada" ]; then
  # Verify required fields exist
  has_items=$(echo "$portada" | jq 'has("items")' 2>/dev/null)
  if [ "$has_items" = "true" ]; then
    # Check first item has required fields
    first_item_keys=$(echo "$portada" | jq -r '.items[0] | keys[]' 2>/dev/null | sort)
    required_fields="link title"
    missing=""
    for field in $required_fields; do
      if ! echo "$first_item_keys" | grep -q "^${field}$"; then
        missing="${missing} ${field}"
      fi
    done
    if [ -z "$missing" ]; then
      ok "json_schema" "items[] con campos requeridos: title, link"
    else
      fail "json_schema" "Faltan campos:${missing}"
    fi
  else
    fail "json_schema" "Response no tiene campo 'items'"
  fi
else
  fail "json_schema" "No response from feeds"
fi

# ── Check 2: All categories respond ──
CAT_OK=0
CAT_TOTAL=0
SLOW_CATS=""

for cat in $CATEGORIES; do
  CAT_TOTAL=$((CAT_TOTAL+1))

  result=$(fetch_timed "/api/feeds?cat=$cat")
  elapsed=$(echo "$result" | cut -d'|' -f1)
  http_code=$(echo "$result" | cut -d'|' -f2)
  body=$(echo "$result" | cut -d'|' -f3-)
  
  # Check response
  if [ -z "$body" ] || [ "$http_code" != "200" ]; then
    fail "cat_${cat}" "HTTP ${http_code:-timeout}"
    continue
  fi
  
  # Check it's valid JSON with items
  item_count=$(echo "$body" | jq '.items | length' 2>/dev/null || echo "0")
  if [ "$item_count" -gt 0 ]; then
    CAT_OK=$((CAT_OK+1))
  else
    warn "cat_${cat}" "200 but 0 items"
    continue
  fi
  
  # Track slow responses
  if [ "$elapsed" -gt "$MAX_RESPONSE_MS" ]; then
    SLOW_CATS="${SLOW_CATS} ${cat}(${elapsed}ms)"
  fi
done

if [ "$CAT_OK" -eq "$CAT_TOTAL" ]; then
  ok "category_response" "${CAT_OK}/${CAT_TOTAL} categorías responden con datos"
else
  warn "category_response" "${CAT_OK}/${CAT_TOTAL} categorías OK"
fi

# ── Check 3: Response time ──
if [ -z "$SLOW_CATS" ]; then
  ok "response_time" "Todas las categorías < ${MAX_RESPONSE_MS}ms"
else
  warn "response_time" "Lento:${SLOW_CATS} (umbral: ${MAX_RESPONSE_MS}ms)"
fi

# ── Check 4: CORS headers ──
headers=$(fetch_headers "/api/feeds?cat=portada")
if echo "$headers" | grep -qi "access-control-allow-origin"; then
  ok "cors" "CORS header presente"
else
  info "cors" "Sin CORS header (puede no ser necesario si es same-origin)"
fi

# ── Check 5: Cache headers ──
if echo "$headers" | grep -qi "cache-control"; then
  cache_value=$(echo "$headers" | grep -i "cache-control" | head -1 | cut -d: -f2- | tr -d ' \r')
  ok "cache" "Cache-Control: $cache_value"
else
  warn "cache" "Sin Cache-Control header"
fi

# ── Check 6: Content-Type ──
content_type=$(echo "$headers" | grep -i "content-type" | head -1 | cut -d: -f2- | tr -d ' \r')
if echo "$content_type" | grep -qi "application/json"; then
  ok "content_type" "$content_type"
else
  warn "content_type" "Esperado application/json, recibido: $content_type"
fi

# ── Check 7: Home page loads ──
home_result=$(fetch_timed "/")
home_elapsed=$(echo "$home_result" | cut -d'|' -f1)
home_code=$(echo "$home_result" | cut -d'|' -f2)
if [ "$home_code" = "200" ]; then
  if [ "$home_elapsed" -gt "$MAX_RESPONSE_MS" ]; then
    warn "home_load" "HTTP 200 pero lento: ${home_elapsed}ms"
  else
    ok "home_load" "HTTP 200 en ${home_elapsed}ms"
  fi
else
  fail "home_load" "HTTP ${home_code:-timeout}"
fi

print_summary
