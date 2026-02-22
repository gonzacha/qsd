#!/usr/bin/env bash
# QSD QA — Notify Discord on FAIL
# Input: tmp/qa_result.json, Discord webhook URL (env or arg)
# Output: POST to Discord, no logs of webhook URL
# Philosophy: Fail-only notifications, surgical, secure

set -euo pipefail

RESULT_FILE="${1:-tmp/qa_result.json}"
WEBHOOK_URL="${DISCORD_WEBHOOK_QA:-}"

# Validate inputs
if [ ! -f "$RESULT_FILE" ]; then
  echo "Error: Result file not found: $RESULT_FILE"
  exit 1
fi

if [ -z "$WEBHOOK_URL" ]; then
  echo "Error: DISCORD_WEBHOOK_QA not set"
  exit 1
fi

# Parse result JSON
STATUS=$(jq -r '.status' "$RESULT_FILE")
GIT_SHA=$(jq -r '.git_sha' "$RESULT_FILE")
SHORT_SHA="${GIT_SHA:0:7}"
RUN_URL=$(jq -r '.run_url' "$RESULT_FILE")
L1=$(jq -r '.layers.L1' "$RESULT_FILE")
L2=$(jq -r '.layers.L2' "$RESULT_FILE")
L3=$(jq -r '.layers.L3' "$RESULT_FILE")
L4=$(jq -r '.layers.L4' "$RESULT_FILE")

# Only notify on FAIL
if [ "$STATUS" != "FAIL" ]; then
  echo "Status is $STATUS, no notification needed"
  exit 0
fi

# Build Discord message
MESSAGE="🔴 QSD QA FAIL — ${SHORT_SHA}

Layers: L1=${L1} L2=${L2} L3=${L3} L4=${L4}
Run: ${RUN_URL}
Repro: bash qa/run-all.sh"

# POST to Discord (webhook URL never logged)
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" \
  -H "Content-Type: application/json" \
  -d "{\"content\": $(echo "$MESSAGE" | jq -Rs .)}" \
  "$WEBHOOK_URL")

if [ "$HTTP_CODE" -ge 200 ] && [ "$HTTP_CODE" -lt 300 ]; then
  echo "✓ Notified Discord (HTTP $HTTP_CODE)"
else
  echo "⚠ Discord notification failed (HTTP $HTTP_CODE)"
  exit 1
fi
