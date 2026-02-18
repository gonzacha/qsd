#!/bin/bash
# qa/editorial-audit.sh — Capa 2: Auditoría Editorial
# Analiza CALIDAD del contenido, no disponibilidad
# Usage: BASE_URL=https://qsd-seven.vercel.app ./qa/editorial-audit.sh

set -euo pipefail
cd "$(dirname "$0")"
source ./lib/qa-helpers.sh

# ── Load rules ──
RULES_FILE="./rules/editorial.json"
MAX_SOURCE_DOM=$(jq -r '.max_source_dominance_pct' "$RULES_FILE")
MIN_ITEMS_CAT=$(jq -r '.min_items_per_category' "$RULES_FILE")
MAX_TITLE_TRUNC=$(jq -r '.max_title_truncated_pct' "$RULES_FILE")
FRESHNESS_HOURS=$(jq -r '.freshness_max_hours' "$RULES_FILE")
MAX_CAT_DOM=$(jq -r '.max_category_dominance_pct' "$RULES_FILE")
DUP_THRESHOLD=$(jq -r '.duplicate_similarity_threshold' "$RULES_FILE")
CATEGORIES=$(jq -r '.known_categories[]' "$RULES_FILE")

echo "═══ QSD Editorial Audit ═══"
echo "Target: $BASE_URL"
echo "Time:   $(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo ""

# ── Fetch all categories ──
declare -A CAT_DATA
declare -A CAT_COUNTS
TOTAL_ITEMS=0
ALL_TITLES=""
ALL_SOURCES=""

for cat in $CATEGORIES; do
  response=$(fetch_json "/api/feeds?cat=$cat")
  if [ -z "$response" ]; then
    fail "fetch_${cat}" "No data for category: $cat"
    continue
  fi
  
  count=$(echo "$response" | jq '.items | length' 2>/dev/null || echo "0")
  CAT_COUNTS[$cat]=$count
  CAT_DATA[$cat]="$response"
  TOTAL_ITEMS=$((TOTAL_ITEMS + count))
  
  # Collect titles and sources
  titles=$(echo "$response" | jq -r '.items[].title // empty' 2>/dev/null)
  sources=$(echo "$response" | jq -r '.items[].source // empty' 2>/dev/null)
  ALL_TITLES="${ALL_TITLES}${titles}\n"
  ALL_SOURCES="${ALL_SOURCES}${sources}\n"
done

if [ "$TOTAL_ITEMS" -eq 0 ]; then
  fail "total_items" "No items fetched from any category"
  print_summary
  exit 1
fi

info "total_items" "$TOTAL_ITEMS items across ${#CAT_COUNTS[@]} categories"

# ── Check 1: Source diversity ──
if [ -n "$ALL_SOURCES" ]; then
  top_source=$(echo -e "$ALL_SOURCES" | grep -v '^$' | sort | uniq -c | sort -rn | head -1)
  top_count=$(echo "$top_source" | awk '{print $1}')
  top_name=$(echo "$top_source" | awk '{$1=""; print $0}' | sed 's/^ //')
  
  if [ "$TOTAL_ITEMS" -gt 0 ]; then
    dominance=$((top_count * 100 / TOTAL_ITEMS))
    if [ "$dominance" -gt "$MAX_SOURCE_DOM" ]; then
      warn "source_diversity" "${top_count} fuentes, max ${dominance}% (${top_name}) — umbral: ${MAX_SOURCE_DOM}%"
    else
      source_count=$(echo -e "$ALL_SOURCES" | grep -v '^$' | sort -u | wc -l)
      ok "source_diversity" "${source_count} fuentes, max ${dominance}% (${top_name})"
    fi
  fi
else
  warn "source_diversity" "No source data available"
fi

# ── Check 2: Duplicate titles (Jaccard) ──
DUPES=0
# Compare titles within same category to avoid cross-category false positives
for cat in $CATEGORIES; do
  if [ -z "${CAT_DATA[$cat]+x}" ]; then continue; fi
  
  mapfile -t titles < <(echo "${CAT_DATA[$cat]}" | jq -r '.items[].title // empty' 2>/dev/null)
  title_count=${#titles[@]}
  
  for ((i=0; i<title_count; i++)); do
    for ((j=i+1; j<title_count; j++)); do
      sim=$(jaccard_words "${titles[$i]}" "${titles[$j]}")
      # bc comparison: 1 if sim > threshold
      is_dup=$(echo "$sim >= $DUP_THRESHOLD" | bc 2>/dev/null || echo "0")
      if [ "$is_dup" = "1" ]; then
        DUPES=$((DUPES+1))
      fi
    done
  done
done

if [ "$DUPES" -gt 2 ]; then
  warn "duplicates" "${DUPES} pares similares detectados (umbral Jaccard: ${DUP_THRESHOLD})"
elif [ "$DUPES" -gt 0 ]; then
  info "duplicates" "${DUPES} par(es) similar(es) — dentro de tolerancia"
else
  ok "duplicates" "Sin duplicados detectados"
fi

# ── Check 3: Category coverage ──
EMPTY_CATS=0
for cat in $CATEGORIES; do
  count=${CAT_COUNTS[$cat]:-0}
  if [ "$count" -lt "$MIN_ITEMS_CAT" ]; then
    warn "category_${cat}" "Solo ${count} items (mínimo: ${MIN_ITEMS_CAT})"
    EMPTY_CATS=$((EMPTY_CATS+1))
  fi
done

if [ "$EMPTY_CATS" -eq 0 ]; then
  ok "category_coverage" "${#CAT_COUNTS[@]}/${#CAT_COUNTS[@]} categorías con ≥${MIN_ITEMS_CAT} items"
else
  warn "category_coverage" "${EMPTY_CATS} categorías bajo mínimo"
fi

# ── Check 4: Title quality (truncated) ──
TRUNCATED=0
TOTAL_TITLES=0
for cat in $CATEGORIES; do
  if [ -z "${CAT_DATA[$cat]+x}" ]; then continue; fi
  
  while IFS= read -r title; do
    [ -z "$title" ] && continue
    TOTAL_TITLES=$((TOTAL_TITLES+1))
    len=${#title}

    # Check truncation: ends with "..." or too short
    if [[ "$title" == *"..." ]] || [ "$len" -lt 20 ]; then
      TRUNCATED=$((TRUNCATED+1))
    fi
  done < <(echo "${CAT_DATA[$cat]}" | jq -r '.items[].title // empty' 2>/dev/null)
done

if [ "$TOTAL_TITLES" -gt 0 ]; then
  trunc_pct=$((TRUNCATED * 100 / TOTAL_TITLES))
  if [ "$trunc_pct" -gt "$MAX_TITLE_TRUNC" ]; then
    warn "title_quality" "${trunc_pct}% truncados (${TRUNCATED}/${TOTAL_TITLES}) — umbral: ${MAX_TITLE_TRUNC}%"
  else
    ok "title_quality" "${trunc_pct}% truncados (${TRUNCATED}/${TOTAL_TITLES})"
  fi
fi

# ── Check 5: Freshness per category ──
NOW_EPOCH=$(date +%s)
STALE_CATS=0
FRESHNESS_SECS=$((FRESHNESS_HOURS * 3600))

for cat in $CATEGORIES; do
  if [ -z "${CAT_DATA[$cat]+x}" ]; then continue; fi
  
  # Get most recent pubDate
  newest_date=$(echo "${CAT_DATA[$cat]}" | jq -r '.items[0].pubDate // empty' 2>/dev/null)
  
  if [ -z "$newest_date" ]; then
    warn "freshness_${cat}" "Sin fecha en items"
    STALE_CATS=$((STALE_CATS+1))
    continue
  fi
  
  # Try to parse date
  item_epoch=$(date -d "$newest_date" +%s 2>/dev/null || echo "0")
  if [ "$item_epoch" -eq 0 ]; then
    info "freshness_${cat}" "Fecha no parseable: $newest_date"
    continue
  fi
  
  age_secs=$((NOW_EPOCH - item_epoch))
  age_hours=$((age_secs / 3600))
  
  if [ "$age_secs" -gt "$FRESHNESS_SECS" ]; then
    warn "freshness_${cat}" "Item más reciente: hace ${age_hours}h (umbral: ${FRESHNESS_HOURS}h)"
    STALE_CATS=$((STALE_CATS+1))
  fi
done

if [ "$STALE_CATS" -eq 0 ]; then
  ok "freshness" "Todas las categorías tienen contenido fresco (<${FRESHNESS_HOURS}h)"
else
  warn "freshness" "${STALE_CATS} categoría(s) sin contenido fresco"
fi

# ── Check 6: Editorial balance ──
if [ "$TOTAL_ITEMS" -gt 0 ]; then
  MAX_CAT_COUNT=0
  MAX_CAT_NAME=""
  for cat in $CATEGORIES; do
    count=${CAT_COUNTS[$cat]:-0}
    if [ "$count" -gt "$MAX_CAT_COUNT" ]; then
      MAX_CAT_COUNT=$count
      MAX_CAT_NAME=$cat
    fi
  done
  
  cat_pct=$((MAX_CAT_COUNT * 100 / TOTAL_ITEMS))
  if [ "$cat_pct" -gt "$MAX_CAT_DOM" ]; then
    warn "editorial_balance" "max ${cat_pct}% (${MAX_CAT_NAME}) — umbral: ${MAX_CAT_DOM}%"
  else
    ok "editorial_balance" "max ${cat_pct}% (${MAX_CAT_NAME})"
  fi
fi

print_summary
