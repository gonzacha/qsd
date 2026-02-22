#!/usr/bin/env bash
# QSD QA — Append result to ledger
# Input: tmp/qa_result.json
# Output: Append one line to data/ledger/qa_runs.jsonl
# Philosophy: Append-only, never overwrite, idempotent

set -euo pipefail

RESULT_FILE="${1:-tmp/qa_result.json}"
LEDGER_FILE="data/ledger/qa_runs.jsonl"

# Validate result file exists
if [ ! -f "$RESULT_FILE" ]; then
  echo "Error: Result file not found: $RESULT_FILE"
  exit 1
fi

# Ensure ledger directory exists
mkdir -p data/ledger

# Validate JSON before appending (fail-safe)
if ! jq empty "$RESULT_FILE" 2>/dev/null; then
  echo "Error: Invalid JSON in $RESULT_FILE"
  exit 1
fi

# Read JSON and append to ledger (append-only)
cat "$RESULT_FILE" >> "$LEDGER_FILE"
echo "" >> "$LEDGER_FILE"  # Ensure newline after JSON line

echo "✓ Appended to $LEDGER_FILE"

# Show last 3 entries for verification
echo ""
echo "Last 3 ledger entries:"
tail -n 3 "$LEDGER_FILE" | jq -r '"\(.ts) \(.status) \(.run_id)"' 2>/dev/null || tail -n 3 "$LEDGER_FILE"
