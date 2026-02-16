#!/usr/bin/env bash

BASE_URL="${BASE_URL:-https://qsd-seven.vercel.app}"
BASE_URL="${BASE_URL%/}"
RESOLVE_TEST_URL="https://news.google.com/rss/articles/CBMi5wFBVV95cUxOOHdwT1ZOQk84cHVva0JSdGJqNE1mcXZINEVwWXNhQkRkUWxmZzNJTENUN3BIZ0pmM2w3Qm93Umo2amxndnI4Q1lsUGY1a1c3SHBUdVJVemRwTXpDQ01QU2tFbWpMNGJybWw4ZV9xeWViai1lbGJKaXJ5MVBJTm50U1g0STF1a2ZwRzBoR01sQzZ5V1BRSHpiUmVpSnJYNWt6WC0xdzRTUjVtajJFYklOSFRPMHExNkJEbzN0X3pPajBOOGg3ek8zMUlrMVpPZk5wbHZUSXgwc2ZEQ2VKWnF4NVlqdmdrSlXSAYICQVVfeXFMT1JMenUzTDlndm9zcGxvaUhNSjhzazN2N1ZfS2J5bWdrbXR5ZTZTLS15S0FPTWZBRnBTaktWN0ExaGxzX0FxRlZlcjU2STI4WWFNSmw5aU8zSThWZjd5SERFVndIYklKSktmUlNJYTgzZFh2bTlwRmZrN19xMHFrUGs0OTZIdFI3Z3VvNGxNUjZJVkhZemYtVEdJTU1LeDVsZzRaSGk4SnFCTndHMDluNXpYQV9GWkZuYm40bVZYM09ILTFDZzV3SFFWUW1hWDhJUFBrV3dtaVZ4WHdhWExVTTBfWmNHMS1VQWJGaVpRWV92ZkhhU1hLWEc0RUhkOXQ2MXR3?oc=5"

LAST_BODY=""
LAST_CODE=""
FEEDS_BODY=""
CRITICAL_FAILED=0

fetch_url() {
  local url="$1"
  local tmp
  tmp="$(mktemp)"
  LAST_CODE="$(curl -sS -o "$tmp" -w "%{http_code}" "$url")"
  LAST_BODY="$(cat "$tmp")"
  rm -f "$tmp"
}

ok() {
  echo "[OK] $1"
}

fail() {
  echo "[FAIL] $1 - $2"
}

skip() {
  echo "[SKIP] $1 - $2"
}

check_feeds() {
  fetch_url "${BASE_URL}/api/feeds?cat=portada"
  if [ "$LAST_CODE" != "200" ]; then
    fail "feeds" "status $LAST_CODE"
    CRITICAL_FAILED=1
    return
  fi
  if ! printf '%s' "$LAST_BODY" | grep -q '^[[:space:]]*{' ; then
    fail "feeds" "not json"
    CRITICAL_FAILED=1
    return
  fi
  if ! printf '%s' "$LAST_BODY" | grep -q '"items"' ; then
    fail "feeds" "missing items"
    CRITICAL_FAILED=1
    return
  fi
  if ! printf '%s' "$LAST_BODY" | grep -Eq '"items"[[:space:]]*:[[:space:]]*\[[[:space:]]*\{[[:space:]]*"title"' ; then
    fail "feeds" "missing items[0].title"
    CRITICAL_FAILED=1
    return
  fi
  local title_count
  title_count="$(printf '%s' "$LAST_BODY" | grep -o '"title"' | wc -l | tr -d ' ')"
  if [ -z "$title_count" ] || [ "$title_count" -lt 5 ]; then
    fail "feeds" "items < 5"
    CRITICAL_FAILED=1
    return
  fi
  FEEDS_BODY="$LAST_BODY"
  ok "feeds"
}

check_freshness() {
  if [ -z "$FEEDS_BODY" ]; then
    skip "freshness" "no feeds body"
    return
  fi
  local pub_date
  pub_date="$(printf '%s' "$FEEDS_BODY" | sed -n 's/.*"pubDate":"\([^"]*\)".*/\1/p' | head -n 1)"
  if [ -z "$pub_date" ]; then
    skip "freshness" "missing pubDate"
    return
  fi
  local pub_ts
  pub_ts="$(date -d "$pub_date" +%s 2>/dev/null || true)"
  if [ -z "$pub_ts" ]; then
    skip "freshness" "unparseable pubDate"
    return
  fi
  local now_ts diff
  now_ts="$(date +%s)"
  diff=$((now_ts - pub_ts))
  if [ "$diff" -lt 0 ]; then
    skip "freshness" "future timestamp"
    return
  fi
  if [ "$diff" -lt 43200 ]; then
    ok "freshness"
    return
  fi
  fail "freshness" "older than 12h"
}

check_og() {
  fetch_url "${BASE_URL}/api/og?title=Test&cat=deportes"
  if [ "$LAST_CODE" != "200" ]; then
    fail "og" "status $LAST_CODE"
    CRITICAL_FAILED=1
    return
  fi
  if ! printf '%s' "$LAST_BODY" | grep -q 'Test' ; then
    fail "og" "missing title"
    CRITICAL_FAILED=1
    return
  fi
  ok "og"
}

check_share() {
  fetch_url "${BASE_URL}/api/share?title=Test&url=https://example.com"
  if [ "$LAST_CODE" != "200" ]; then
    fail "share" "status $LAST_CODE"
    CRITICAL_FAILED=1
    return
  fi
  if ! printf '%s' "$LAST_BODY" | grep -q 'og:image' ; then
    fail "share" "missing og:image"
    CRITICAL_FAILED=1
    return
  fi
  if ! printf '%s' "$LAST_BODY" | grep -qi 'refresh' ; then
    fail "share" "missing refresh"
    CRITICAL_FAILED=1
    return
  fi
  ok "share"
}

check_resolver() {
  fetch_url "${BASE_URL}/api/resolve?url=${RESOLVE_TEST_URL}"
  if [ "$LAST_CODE" != "200" ]; then
    fail "resolver" "status $LAST_CODE"
    CRITICAL_FAILED=1
    return
  fi
  local resolved
  resolved="$(printf '%s' "$LAST_BODY" | sed -n 's/.*"resolved":"\([^"]*\)".*/\1/p' | head -n 1)"
  if [ -z "$resolved" ]; then
    fail "resolver" "missing resolved"
    CRITICAL_FAILED=1
    return
  fi
  if printf '%s' "$resolved" | grep -q 'news.google.com' ; then
    fail "resolver" "resolved still google news"
    CRITICAL_FAILED=1
    return
  fi
  ok "resolver"
}

check_home() {
  fetch_url "${BASE_URL}/"
  if [ "$LAST_CODE" != "200" ]; then
    fail "home" "status $LAST_CODE"
    CRITICAL_FAILED=1
    return
  fi
  if ! printf '%s' "$LAST_BODY" | grep -q 'QUÉ SE DICE' ; then
    fail "home" "missing QUÉ SE DICE"
    CRITICAL_FAILED=1
    return
  fi
  ok "home"
}

check_feeds
check_freshness
check_og
check_share
check_resolver
check_home

if [ "$CRITICAL_FAILED" -ne 0 ]; then
  exit 1
fi

exit 0
