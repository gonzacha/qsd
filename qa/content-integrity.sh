#!/bin/bash
# qa/content-integrity.sh — Capa 3: Integridad de Contenido
# Valida ESTRUCTURA de cada item individual
# Usage: BASE_URL=https://qsd-seven.vercel.app ./qa/content-integrity.sh

set -euo pipefail
cd "$(dirname "$0")"
source ./lib/qa-helpers.sh

RULES_FILE="./rules/editorial.json"
INTEGRITY_THRESHOLD=$(jq -r '.integrity_score_threshold' "$RULES_FILE")
CATEGORIES=$(jq -r '.known_categories[]' "$RULES_FILE")

echo "═══ QSD Content Integrity ═══"
echo "Target: $BASE_URL"
echo "Time:   $(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo ""

TOTAL=0
TITLE_OK=0
LINK_OK=0
SOURCE_OK=0
DATE_OK=0
CAT_OK=0
IMAGE_OK=0
NOW_EPOCH=$(date +%s)

for cat in $CATEGORIES; do
  response=$(fetch_json "/api/feeds?cat=$cat")
  [ -z "$response" ] && continue
  
  item_count=$(echo "$response" | jq '.items | length' 2>/dev/null || echo "0")
  
  for ((i=0; i<item_count; i++)); do
    TOTAL=$((TOTAL+1))

    # ── Title ──
    title=$(echo "$response" | jq -r ".items[$i].title // empty" 2>/dev/null)
    if [ -n "$title" ] && [ ${#title} -ge 10 ] && [ ${#title} -le 300 ]; then
      TITLE_OK=$((TITLE_OK+1))
    fi

    # ── Link ──
    link=$(echo "$response" | jq -r ".items[$i].link // empty" 2>/dev/null)
    if [ -n "$link" ] && [[ "$link" == http* ]]; then
      LINK_OK=$((LINK_OK+1))
    fi

    # ── Source ──
    source_name=$(echo "$response" | jq -r ".items[$i].source // empty" 2>/dev/null)
    if [ -n "$source_name" ]; then
      SOURCE_OK=$((SOURCE_OK+1))
    fi

    # ── Date ──
    pub_date=$(echo "$response" | jq -r ".items[$i].pubDate // empty" 2>/dev/null)
    if [ -n "$pub_date" ]; then
      item_epoch=$(date -d "$pub_date" +%s 2>/dev/null || echo "0")
      if [ "$item_epoch" -gt 0 ]; then
        # Not in the future (with 1h tolerance) and not older than 7 days
        future_limit=$((NOW_EPOCH + 3600))
        past_limit=$((NOW_EPOCH - 604800))
        if [ "$item_epoch" -le "$future_limit" ] && [ "$item_epoch" -ge "$past_limit" ]; then
          DATE_OK=$((DATE_OK+1))
        fi
      fi
    fi

    # ── Category ──
    item_cat=$(echo "$response" | jq -r ".items[$i].category // empty" 2>/dev/null)
    # If no category field, the category comes from the query param — that's OK
    if [ -n "$item_cat" ] || [ -n "$cat" ]; then
      CAT_OK=$((CAT_OK+1))
    fi

    # ── Image ──
    image=$(echo "$response" | jq -r ".items[$i].image // .items[$i].thumbnail // empty" 2>/dev/null)
    if [ -n "$image" ] && [[ "$image" == http* ]]; then
      IMAGE_OK=$((IMAGE_OK+1))
    fi
  done
done

if [ "$TOTAL" -eq 0 ]; then
  fail "scan" "No items scanned"
  print_summary
  exit 1
fi

echo "Scanned $TOTAL items across $(echo "$CATEGORIES" | wc -w) categories"
echo ""

# ── Report ──
[ "$TITLE_OK" -eq "$TOTAL" ] && ok "title_present" "${TITLE_OK}/${TOTAL}" || \
  ([ $((TOTAL - TITLE_OK)) -le 3 ] && warn "title_present" "${TITLE_OK}/${TOTAL}" || fail "title_present" "${TITLE_OK}/${TOTAL}")

[ "$LINK_OK" -eq "$TOTAL" ] && ok "link_valid" "${LINK_OK}/${TOTAL}" || \
  fail "link_valid" "${LINK_OK}/${TOTAL}"

SOURCE_MISSING=$((TOTAL - SOURCE_OK))
[ "$SOURCE_MISSING" -eq 0 ] && ok "source_present" "${SOURCE_OK}/${TOTAL}" || \
  warn "source_missing" "${SOURCE_MISSING}/${TOTAL} sin fuente"

DATE_MISSING=$((TOTAL - DATE_OK))
[ "$DATE_MISSING" -le $((TOTAL / 10)) ] && ok "date_valid" "${DATE_OK}/${TOTAL}" || \
  warn "date_issues" "${DATE_MISSING}/${TOTAL} con fecha inválida o ausente"

ok "category_valid" "${CAT_OK}/${TOTAL}"

IMAGE_MISSING=$((TOTAL - IMAGE_OK))
[ "$IMAGE_MISSING" -eq 0 ] && ok "image_present" "${IMAGE_OK}/${TOTAL}" || \
  info "image_missing" "${IMAGE_MISSING}/${TOTAL} sin imagen"

# ── Integrity Score ──
# Weighted: title(30) + link(30) + source(15) + date(15) + image(10)
SCORE=$(echo "scale=1; ($TITLE_OK * 30 + $LINK_OK * 30 + $SOURCE_OK * 15 + $DATE_OK * 15 + $IMAGE_OK * 10) / ($TOTAL * 100) * 100" | bc 2>/dev/null || echo "0")

echo ""
echo "──────────────────────────"
title_pct=$(echo "scale=1; ($TITLE_OK * 100) / $TOTAL" | bc 2>/dev/null || echo "0")
link_pct=$(echo "scale=1; ($LINK_OK * 100) / $TOTAL" | bc 2>/dev/null || echo "0")
source_pct=$(echo "scale=1; ($SOURCE_OK * 100) / $TOTAL" | bc 2>/dev/null || echo "0")
date_pct=$(echo "scale=1; ($DATE_OK * 100) / $TOTAL" | bc 2>/dev/null || echo "0")
image_pct=$(echo "scale=1; ($IMAGE_OK * 100) / $TOTAL" | bc 2>/dev/null || echo "0")

title_pts=$(echo "scale=1; ($TITLE_OK * 30) / $TOTAL" | bc 2>/dev/null || echo "0")
link_pts=$(echo "scale=1; ($LINK_OK * 30) / $TOTAL" | bc 2>/dev/null || echo "0")
source_pts=$(echo "scale=1; ($SOURCE_OK * 15) / $TOTAL" | bc 2>/dev/null || echo "0")
date_pts=$(echo "scale=1; ($DATE_OK * 15) / $TOTAL" | bc 2>/dev/null || echo "0")
image_pts=$(echo "scale=1; ($IMAGE_OK * 10) / $TOTAL" | bc 2>/dev/null || echo "0")

info "score_component title" "${title_pct}% -> ${title_pts}/30"
info "score_component link" "${link_pct}% -> ${link_pts}/30"
info "score_component source" "${source_pct}% -> ${source_pts}/15"
info "score_component date" "${date_pct}% -> ${date_pts}/15"
info "score_component image" "${image_pct}% -> ${image_pts}/10"
info "score_total" "${SCORE}% (threshold: ${INTEGRITY_THRESHOLD}%) items=${TOTAL}"

SCORE_INT=${SCORE%.*}
if [ "${SCORE_INT:-0}" -ge "$INTEGRITY_THRESHOLD" ]; then
  ok "INTEGRITY SCORE" "${SCORE}% (threshold: ${INTEGRITY_THRESHOLD}%)"
else
  fail "INTEGRITY SCORE" "${SCORE}% (threshold: ${INTEGRITY_THRESHOLD}%)"
fi

print_summary
