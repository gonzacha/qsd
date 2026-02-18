#!/bin/bash
# qa/qa.sh — Capa 1: Health Checks
# QSD Editorial Quality Factory
# Usage: BASE_URL=https://qsd-seven.vercel.app ./qa/qa.sh

set -euo pipefail
cd "$(dirname "$0")"
source ./lib/qa-helpers.sh

echo "═══ QSD Health Checks ═══"
echo "Target: $BASE_URL"
echo "Time:   $(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo ""

# ── 1. Feeds endpoint ──
feeds_response=$(fetch_json "/api/feeds?cat=portada")
if [ -z "$feeds_response" ]; then
  fail "feeds" "No response from /api/feeds?cat=portada"
else
  has_title=$(echo "$feeds_response" | jq -r '.items[0].title // empty' 2>/dev/null)
  if [ -n "$has_title" ]; then
    item_count=$(echo "$feeds_response" | jq '.items | length' 2>/dev/null)
    ok "feeds" "${item_count} items, first: $(echo "$has_title" | head -c 50)..."
  else
    fail "feeds" "Response OK but no items[0].title"
  fi
fi

# ── 2. OG Image endpoint ──
og_response=$(fetch_json "/api/og?title=QA_Test&cat=deportes")
if [ -z "$og_response" ]; then
  # OG might return SVG/image, not JSON — check HTTP status
  og_status=$(curl -sf -o /dev/null -w "%{http_code}" --max-time 10 "${BASE_URL}/api/og?title=QA_Test&cat=deportes" 2>/dev/null)
  if [ "$og_status" = "200" ]; then
    ok "og_image" "HTTP 200"
  else
    fail "og_image" "HTTP $og_status"
  fi
else
  if echo "$og_response" | grep -q "QA_Test"; then
    ok "og_image" "Contains test title"
  else
    warn "og_image" "200 but test title not found in response"
  fi
fi

# ── 3. Share redirect ──
share_response=$(curl -sf --max-time 10 "${BASE_URL}/api/share?title=QA_Test&url=https://example.com" 2>/dev/null)
if [ -z "$share_response" ]; then
  fail "share" "No response from /api/share"
else
  has_og=$(echo "$share_response" | grep -c "og:image" || true)
  has_refresh=$(echo "$share_response" | grep -c "refresh" || true)
  if [ "$has_og" -gt 0 ] && [ "$has_refresh" -gt 0 ]; then
    ok "share" "Has og:image and refresh"
  else
    warn "share" "Missing og:image($has_og) or refresh($has_refresh)"
  fi
fi

# ── 4. URL Resolver ──
# Use a known Google News URL pattern for testing
resolve_response=$(fetch_json "/api/resolve?url=https://news.google.com/rss/articles/test")
if [ -z "$resolve_response" ]; then
  # Resolver might not work with fake URL, check if endpoint is alive
  resolve_status=$(curl -sf -o /dev/null -w "%{http_code}" --max-time 10 "${BASE_URL}/api/resolve?url=https://example.com" 2>/dev/null)
  if [ "$resolve_status" = "200" ] || [ "$resolve_status" = "400" ]; then
    ok "resolver" "Endpoint alive (HTTP $resolve_status)"
  else
    warn "resolver" "HTTP $resolve_status — may need real URL to test"
  fi
else
  resolved_url=$(echo "$resolve_response" | jq -r '.resolved // .url // empty' 2>/dev/null)
  if [ -n "$resolved_url" ]; then
    ok "resolver" "Resolved to: $(echo "$resolved_url" | head -c 60)"
  else
    warn "resolver" "Response OK but no resolved URL in body"
  fi
fi

# ── 5. Home page ──
home_response=$(curl -sf --max-time 10 "${BASE_URL}/" 2>/dev/null)
if [ -z "$home_response" ]; then
  fail "home" "No response from /"
else
  # Check for portal name (case-insensitive)
  if grep -iq "qu.*se.*dice" <<< "$home_response"; then
    ok "home" "Portal title found"
  else
    fail "home" "Portal title 'Qué Se Dice' not found in HTML"
  fi
fi

print_summary
