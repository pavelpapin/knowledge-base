#!/bin/bash
# Elio Disk Cleanup Script
# Run manually or via cron when disk usage is high

set -e

WARN_THRESHOLD=70
CRIT_THRESHOLD=85
FREED_TOTAL=0

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1"
}

get_disk_usage() {
    df / | awk 'NR==2 {gsub(/%/,""); print $5}'
}

get_size_mb() {
    du -sm "$1" 2>/dev/null | awk '{print $1}' || echo 0
}

cleanup_dir() {
    local dir=$1
    local name=$2

    if [ -d "$dir" ]; then
        local size_before=$(get_size_mb "$dir")
        rm -rf "$dir"/* 2>/dev/null || true
        local size_after=$(get_size_mb "$dir")
        local freed=$((size_before - size_after))
        FREED_TOTAL=$((FREED_TOTAL + freed))
        log "Cleared $name: ${freed}MB freed"
    fi
}

# Get current usage
USAGE=$(get_disk_usage)
log "Current disk usage: ${USAGE}%"

if [ "$USAGE" -lt "$WARN_THRESHOLD" ]; then
    log "Disk usage OK (${USAGE}% < ${WARN_THRESHOLD}%)"
    exit 0
fi

log "Starting cleanup (threshold: ${WARN_THRESHOLD}%)"

# Level 1: Safe cleanups (always safe to run)
log "Level 1: Safe cleanups"
cleanup_dir "/tmp" "temp files"
journalctl --vacuum-size=100M 2>/dev/null && log "Journal vacuumed"

USAGE=$(get_disk_usage)
if [ "$USAGE" -lt "$WARN_THRESHOLD" ]; then
    log "Disk usage now: ${USAGE}%. Total freed: ${FREED_TOTAL}MB"
    exit 0
fi

# Level 2: Cache cleanups (pip, npm, etc.)
log "Level 2: Cache cleanups"
cleanup_dir "$HOME/.cache/pip" "pip cache"
cleanup_dir "$HOME/.npm/_cacache" "npm cache"

# Run npm cache clean if available
if command -v npm &> /dev/null; then
    npm cache clean --force 2>/dev/null && log "npm cache cleaned"
fi

USAGE=$(get_disk_usage)
if [ "$USAGE" -lt "$WARN_THRESHOLD" ]; then
    log "Disk usage now: ${USAGE}%. Total freed: ${FREED_TOTAL}MB"
    exit 0
fi

# Level 3: Aggressive cleanups (only if still critical)
if [ "$USAGE" -gt "$CRIT_THRESHOLD" ]; then
    log "Level 3: Aggressive cleanups (critical: ${USAGE}%)"
    cleanup_dir "$HOME/.cache/ms-playwright" "playwright browsers"
    cleanup_dir "$HOME/.cache/whisper" "whisper models"

    # Clean old logs
    find /root/.claude/logs -name "*.log" -mtime +7 -delete 2>/dev/null && log "Old logs cleaned"
fi

USAGE=$(get_disk_usage)
log "Final disk usage: ${USAGE}%. Total freed: ${FREED_TOTAL}MB"

if [ "$USAGE" -gt "$CRIT_THRESHOLD" ]; then
    log "WARNING: Disk still critical (${USAGE}% > ${CRIT_THRESHOLD}%)"
    log "Manual intervention required!"
    exit 1
fi

exit 0
