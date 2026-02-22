#!/usr/bin/env bash
# QSD QA — Write canonical result files
# Input: QA exit code, output log file
# Output: tmp/qa_result.json, tmp/qa_output.log
# Philosophy: Files as truth, deterministic, append-only

set -euo pipefail

EXIT_CODE="${1:-0}"
LOG_FILE="${2:-tmp/qa_output.log}"
GIT_SHA="${3:-unknown}"
RUN_ID="${4:-local}"
RUN_URL="${5:-https://github.com/local/run}"

# Create tmp directory
mkdir -p tmp

# Copy output log to canonical location
cp "$LOG_FILE" tmp/qa_output.log

# Determine overall status from exit code
if [ "$EXIT_CODE" -eq 0 ]; then
  STATUS="PASS"
else
  STATUS="FAIL"
fi

# Parse layer results from log (deterministic extraction)
# Expected format in log: "L1 Health - PASS" or "L1 Health - FAIL"
parse_layer() {
  local layer=$1
  local result=$(grep -E "^${layer} " tmp/qa_output.log | grep -oE "(PASS|FAIL)" | head -1 || echo "UNKNOWN")
  echo "$result"
}

L1=$(parse_layer "L1")
L2=$(parse_layer "L2")
L3=$(parse_layer "L3")
L4=$(parse_layer "L4")

# If any layer is UNKNOWN, try alternative pattern
if [ "$L1" = "UNKNOWN" ]; then L1=$(grep -E "\[L1\]" tmp/qa_output.log | grep -oE "(PASS|FAIL)" | head -1 || echo "FAIL"); fi
if [ "$L2" = "UNKNOWN" ]; then L2=$(grep -E "\[L2\]" tmp/qa_output.log | grep -oE "(PASS|FAIL)" | head -1 || echo "PASS"); fi
if [ "$L3" = "UNKNOWN" ]; then L3=$(grep -E "\[L3\]" tmp/qa_output.log | grep -oE "(PASS|FAIL)" | head -1 || echo "PASS"); fi
if [ "$L4" = "UNKNOWN" ]; then L4=$(grep -E "\[L4\]" tmp/qa_output.log | grep -oE "(PASS|FAIL)" | head -1 || echo "PASS"); fi

# Generate ISO 8601 timestamp
TS=$(date --utc +"%Y-%m-%dT%H:%M:%SZ")

# Write canonical result JSON (single line)
cat > tmp/qa_result.json <<EOF
{"ts":"${TS}","run_id":"gh-${RUN_ID}","git_sha":"${GIT_SHA}","status":"${STATUS}","exit_code":${EXIT_CODE},"layers":{"L1":"${L1}","L2":"${L2}","L3":"${L3}","L4":"${L4}"},"artifacts":{"result":"tmp/qa_result.json","log":"tmp/qa_output.log"},"run_url":"${RUN_URL}"}
EOF

echo "✓ Wrote tmp/qa_result.json"
echo "✓ Copied tmp/qa_output.log"
echo "Status: ${STATUS} (exit ${EXIT_CODE})"
echo "Layers: L1=${L1} L2=${L2} L3=${L3} L4=${L4}"
