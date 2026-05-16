#!/usr/bin/env bash
#
# QSD / Ubuntu Freeze Audit
# Deterministic local diagnostics
# NO destructive actions
#
# Usage:
#   chmod +x system-freeze-audit.sh
#   ./system-freeze-audit.sh
#
# Output:
#   qa/system_audit_YYYYMMDD_HHMMSS/
#

set -euo pipefail

TS="$(date +%Y%m%d_%H%M%S)"
OUTDIR="qa/system_audit_${TS}"

mkdir -p "$OUTDIR"

echo "======================================"
echo " QSD SYSTEM FREEZE AUDIT"
echo "======================================"
echo "timestamp: $(date)"
echo "output: $OUTDIR"
echo

section () {
  echo
  echo "======================================"
  echo "$1"
  echo "======================================"
}

save_cmd () {
  local name="$1"
  shift

  {
    echo "### COMMAND"
    echo "$*"
    echo
    echo "### OUTPUT"
    "$@" 2>&1 || true
  } > "${OUTDIR}/${name}.txt"
}

#
# BASIC SYSTEM
#

section "SYSTEM INFO"

save_cmd system_uname uname -a
save_cmd os_release cat /etc/os-release
save_cmd uptime uptime
save_cmd hostname hostnamectl

#
# CPU / MEMORY
#

section "CPU / MEMORY"

save_cmd cpu lscpu
save_cmd memory free -h
save_cmd vmstat vmstat 1 5

#
# DISK
#

section "DISK"

save_cmd disk_usage df -h
save_cmd inode_usage df -i
save_cmd lsblk lsblk

#
# TEMPERATURES
#

section "THERMALS"

save_cmd sensors sensors

#
# GPU
#

section "GPU"

save_cmd gpu_lspci lspci -nnk
save_cmd gpu_glx glxinfo -B

#
# TOP PROCESSES
#

section "TOP PROCESSES"

save_cmd top_cpu bash -c "ps aux --sort=-%cpu | head -25"
save_cmd top_mem bash -c "ps aux --sort=-%mem | head -25"

#
# BROWSER / NODE / CURSOR
#

section "DEV STACK"

save_cmd node_processes bash -c "ps aux | grep -Ei 'node|npm|vercel|cursor|chrome|firefox' | grep -v grep"

#
# SYSTEMD FAILURES
#

section "SYSTEMD FAILURES"

save_cmd failed_services systemctl --failed

#
# KERNEL ERRORS
#

section "KERNEL ERRORS"

save_cmd dmesg_errors bash -c "dmesg -T | grep -Ei 'error|fail|warn|gpu|i915|amdgpu|nouveau|oom|thermal|segfault|lockup|hung|drm' | tail -300"

#
# JOURNAL ERRORS
#

section "JOURNAL ERRORS"

save_cmd journal_errors bash -c "journalctl -p 3 -xb | tail -300"

#
# OOM / FREEZE
#

section "OOM / LOCKUPS"

save_cmd oom_events bash -c "journalctl -k | grep -Ei 'out of memory|oom|killed process|lockup|hung task' | tail -200"

#
# GPU DRIVER STATE
#

section "GPU DRIVER"

save_cmd gpu_modules bash -c "lsmod | grep -Ei 'i915|amdgpu|nouveau|nvidia'"

#
# OPEN FILES
#

section "LIMITS"

save_cmd ulimit bash -c "ulimit -a"

#
# NETWORK
#

section "NETWORK"

save_cmd listening_ports ss -tulpn

#
# QSD PROJECT
#

section "QSD PROJECT"

if [ -d "/home/gonza/dev/editorial/quesedice" ]; then
  save_cmd qsd_git_status bash -c "cd /home/gonza/dev/editorial/quesedice && git status"
  save_cmd qsd_disk bash -c "du -sh /home/gonza/dev/editorial/quesedice"
fi

#
# LIVE SNAPSHOT
#

section "LIVE SNAPSHOT"

{
  echo "date=$(date)"
  echo
  echo "loadavg:"
  cat /proc/loadavg
  echo
  echo "meminfo:"
  grep -E 'MemTotal|MemFree|MemAvailable|SwapTotal|SwapFree' /proc/meminfo
} > "${OUTDIR}/live_snapshot.txt"

#
# SUMMARY
#

section "SUMMARY"

SUMMARY_FILE="${OUTDIR}/SUMMARY.md"

{
  echo "# System Freeze Audit"
  echo
  echo "Generated: $(date)"
  echo
  echo "## Files"
  echo

  find "$OUTDIR" -maxdepth 1 -type f | sort | while read -r f; do
    echo "- $(basename "$f")"
  done

  echo
  echo "## Quick Notes"
  echo
  echo "- Check dmesg_errors.txt for GPU hangs or OOM"
  echo "- Check top_mem.txt for browser/Cursor pressure"
  echo "- Check sensors.txt for overheating"
  echo "- Check journal_errors.txt for hard lock evidence"

} > "$SUMMARY_FILE"

echo
echo "======================================"
echo " AUDIT COMPLETE"
echo "======================================"
echo
echo "Results saved in:"
echo "$OUTDIR"
echo
echo "Open:"
echo "  $SUMMARY_FILE"
echo
