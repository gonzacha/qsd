#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LEDGER="$ROOT_DIR/data/ledger/ops.jsonl"

mkdir -p "$(dirname "$LEDGER")"

_log() {
  local level="$1"
  local msg="$2"
  local tmp
  tmp=$(mktemp)

  printf '{"ts":"%s","level":"%s","msg":"%s"}\n' \
    "$(date -Is)" "$level" "$msg" > "$tmp"

  cat "$tmp" >> "$LEDGER"
  rm -f "$tmp"
}

trap '_log "ERROR" "command failed: $BASH_COMMAND (exit=$?)"' ERR

case "${1:-}" in
  ingest)
    shift
    _log "INFO" "starting ingest"
    python3 -m angelus.angelus "$@"
    _log "INFO" "ingest finished"
    ;;

  qa)
    _log "INFO" "starting qa"
    bash qa/run-all.sh
    _log "INFO" "qa finished"
    ;;

  audit)
    shift
    _log "INFO" "starting runtime audit"
    bash scripts/runtime-audit.sh "$@"
    _log "INFO" "runtime audit finished"
    ;;

  smoke)
    _log "INFO" "starting smoke"
    bash scripts/dev-smoke.sh
    _log "INFO" "smoke finished"
    ;;

  *)
    echo "uso: ./qsd.sh [ingest|qa|audit|smoke]"
    exit 1
    ;;
esac
