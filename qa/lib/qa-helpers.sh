#!/bin/bash
# qa/lib/qa-helpers.sh — Funciones compartidas QSD Editorial QA
# Source: source ./lib/qa-helpers.sh

# ── Colors ──
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

# ── Counters ──
PASS=0
WARN=0
FAIL=0
INFO=0

# ── Base URL ──
BASE_URL="${BASE_URL:-https://qsd-seven.vercel.app}"

# ── Output functions ──
ok()   { echo -e "${GREEN}[OK]${NC}   $1 — $2"; PASS=$((PASS+1)); }
warn() { echo -e "${YELLOW}[WARN]${NC} $1 — $2"; WARN=$((WARN+1)); }
fail() { echo -e "${RED}[FAIL]${NC} $1 — $2"; FAIL=$((FAIL+1)); }
info() { echo -e "${CYAN}[INFO]${NC} $1 — $2"; INFO=$((INFO+1)); }

# ── Fetch JSON from endpoint ──
fetch_json() {
  local endpoint="$1"
  local timeout="${2:-10}"
  curl -sf --retry 2 --retry-delay 1 --retry-all-errors --max-time "$timeout" "${BASE_URL}${endpoint}" 2>/dev/null
}

# ── Fetch with timing ──
fetch_timed() {
  local endpoint="$1"
  local timeout="${2:-10}"
  local start end elapsed
  start=$(date +%s%N)
  local body
  body=$(curl -sf --retry 2 --retry-delay 1 --retry-all-errors --max-time "$timeout" -w "\n%{http_code}" "${BASE_URL}${endpoint}" 2>/dev/null)
  end=$(date +%s%N)
  elapsed=$(( (end - start) / 1000000 ))
  local http_code
  http_code=$(echo "$body" | tail -1)
  local content
  content=$(echo "$body" | sed '$d')
  echo "${elapsed}|${http_code}|${content}"
}

# ── Fetch headers ──
fetch_headers() {
  local endpoint="$1"
  curl -sI --retry 2 --retry-delay 1 --retry-all-errors --max-time 10 "${BASE_URL}${endpoint}" 2>/dev/null
}

# ── Jaccard similarity (word-level) ──
jaccard_words() {
  local a="$1"
  local b="$2"
  # Normalize: lowercase, remove punctuation, split to words
  local words_a words_b
  words_a=$(echo "$a" | tr '[:upper:]' '[:lower:]' | tr -cs '[:alnum:]' '\n' | sort -u)
  words_b=$(echo "$b" | tr '[:upper:]' '[:lower:]' | tr -cs '[:alnum:]' '\n' | sort -u)
  
  local intersection union
  intersection=$(comm -12 <(echo "$words_a") <(echo "$words_b") | wc -l)
  union=$(sort -u <(echo "$words_a") <(echo "$words_b") | wc -l)
  
  if [ "$union" -eq 0 ]; then
    echo "0"
  else
    echo "scale=2; $intersection / $union" | bc
  fi
}

# ── Summary ──
print_summary() {
  echo ""
  echo "══════════════════════════════════════"
  echo -e " ${GREEN}PASS: $PASS${NC}  ${YELLOW}WARN: $WARN${NC}  ${RED}FAIL: $FAIL${NC}  ${CYAN}INFO: $INFO${NC}"
  echo "══════════════════════════════════════"
  
  if [ "$FAIL" -gt 0 ]; then
    echo -e "${RED}STATUS: FAILED${NC}"
    return 1
  elif [ "$WARN" -gt 0 ]; then
    echo -e "${YELLOW}STATUS: DEGRADED${NC}"
    return 0
  else
    echo -e "${GREEN}STATUS: HEALTHY${NC}"
    return 0
  fi
}

# ── JSON report (for GitHub Issues) ──
generate_report_json() {
  local layer="$1"
  cat <<EOF
{
  "layer": "$layer",
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "target": "$BASE_URL",
  "results": { "pass": $PASS, "warn": $WARN, "fail": $FAIL, "info": $INFO },
  "status": "$([ $FAIL -gt 0 ] && echo 'FAILED' || ([ $WARN -gt 0 ] && echo 'DEGRADED' || echo 'HEALTHY'))"
}
EOF
}
