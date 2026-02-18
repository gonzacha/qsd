#!/bin/bash
# qa/run-all.sh — Orquestador Editorial Quality Factory
# Ejecuta las 4 capas en orden. Si Capa 1 falla, no corre el resto.
# Usage: BASE_URL=https://qsd-seven.vercel.app ./qa/run-all.sh

set -uo pipefail
cd "$(dirname "$0")"

export BASE_URL="${BASE_URL:-https://qsd-seven.vercel.app}"

RED='\033[0;31m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
NC='\033[0m'

FINAL_EXIT=0
REPORT=""

run_layer() {
  local name="$1"
  local script="$2"
  local blocking="$3"  # "yes" or "no"
  
  echo ""
  echo -e "${CYAN}━━━ $name ━━━${NC}"
  
  if bash "$script"; then
    REPORT="${REPORT}✅ ${name}\n"
  else
    if [ "$blocking" = "yes" ]; then
      REPORT="${REPORT}❌ ${name} (BLOCKING)\n"
      FINAL_EXIT=1
      echo ""
      echo -e "${RED}⛔ ${name} FAILED — skipping remaining layers${NC}"
      return 1
    else
      REPORT="${REPORT}⚠️ ${name}\n"
      # Non-blocking layers set exit=1 only on FAIL (not WARN)
      FINAL_EXIT=1
    fi
  fi
  return 0
}

echo "╔══════════════════════════════════════╗"
echo "║  QSD Editorial Quality Factory v1.0  ║"
echo "╠══════════════════════════════════════╣"
echo "║  Target: $BASE_URL"
echo "║  Time:   $(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo "╚══════════════════════════════════════╝"

# Layer 1: Health (BLOCKING)
run_layer "Capa 1: Health Checks" "./qa.sh" "yes" || {
  echo ""
  echo "══════════════════════════════════════"
  echo -e "FINAL: ${RED}SITE DOWN — aborting${NC}"
  echo "══════════════════════════════════════"
  exit 1
}

# Layer 2: Structure (BLOCKING)
run_layer "Capa 2: Estructura" "./structure-validator.sh" "yes" || {
  echo ""
  echo "══════════════════════════════════════"
  echo -e "FINAL: ${RED}STRUCTURE BROKEN — aborting${NC}"
  echo "══════════════════════════════════════"
  exit 1
}

# Layer 3: Content Integrity (non-blocking)
run_layer "Capa 3: Integridad" "./content-integrity.sh" "no"

# Layer 4: Editorial Audit (non-blocking, never blocks)
run_layer "Capa 4: Auditoría Editorial" "./editorial-audit.sh" "no"

# ── Final Report ──
echo ""
echo "╔══════════════════════════════════════╗"
echo "║         RESUMEN FINAL                ║"
echo "╠══════════════════════════════════════╣"
echo -e "$REPORT"
echo "╚══════════════════════════════════════╝"

exit $FINAL_EXIT
