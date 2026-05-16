#!/usr/bin/env bash
# Thin wrapper: same checks as runtime-audit.sh, quieter console, exit 0/1 for CI.
set -uo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec "$SCRIPT_DIR/runtime-audit.sh" --smoke "$@"
