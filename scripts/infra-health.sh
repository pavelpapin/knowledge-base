#!/bin/bash
# Elio Infrastructure Health Check
# Returns JSON status for CTO nightly review

set -e

# Colors for terminal output
RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
NC='\033[0m'

# Get metrics
DISK_USAGE=$(df / | awk 'NR==2 {gsub(/%/,""); print $5}')
DISK_FREE=$(df -BG / | awk 'NR==2 {gsub(/G/,""); print $4}')

RAM_TOTAL=$(free -m | awk '/Mem:/ {print $2}')
RAM_USED=$(free -m | awk '/Mem:/ {print $3}')
RAM_PERCENT=$((RAM_USED * 100 / RAM_TOTAL))

SWAP_TOTAL=$(free -m | awk '/Swap:/ {print $2}')
SWAP_USED=$(free -m | awk '/Swap:/ {print $3}')
if [ "$SWAP_TOTAL" -gt 0 ]; then
    SWAP_PERCENT=$((SWAP_USED * 100 / SWAP_TOTAL))
else
    SWAP_PERCENT=0
fi

# Check for OOM kills in last 24h
OOM_KILLS=$(dmesg 2>/dev/null | grep -ci "oom" || echo 0)

# Check failed services
FAILED_SERVICES=$(systemctl --failed --no-pager 2>/dev/null | grep -c "failed" || echo 0)

# Determine status
get_status() {
    local value=$1
    local warn=$2
    local crit=$3

    if [ "$value" -ge "$crit" ]; then
        echo "critical"
    elif [ "$value" -ge "$warn" ]; then
        echo "warning"
    else
        echo "healthy"
    fi
}

DISK_STATUS=$(get_status $DISK_USAGE 70 85)
RAM_STATUS=$(get_status $RAM_PERCENT 80 90)
SWAP_STATUS=$(get_status $SWAP_PERCENT 50 70)

# Overall status
OVERALL="healthy"
if [ "$DISK_STATUS" = "critical" ] || [ "$RAM_STATUS" = "critical" ] || [ "$SWAP_STATUS" = "critical" ]; then
    OVERALL="critical"
elif [ "$DISK_STATUS" = "warning" ] || [ "$RAM_STATUS" = "warning" ] || [ "$SWAP_STATUS" = "warning" ]; then
    OVERALL="warning"
fi

# Top memory processes (JSON array)
TOP_PROCS=$(ps aux --sort=-%mem | head -6 | tail -5 | awk '{printf "{\"pid\":%s,\"name\":\"%s\",\"mem_percent\":%.1f},", $2, $11, $4}' | sed 's/,$//')

# Output format
if [ "$1" = "--json" ]; then
    cat << EOF
{
  "timestamp": "$(date -Iseconds)",
  "overall_status": "$OVERALL",
  "disk": {
    "usage_percent": $DISK_USAGE,
    "free_gb": $DISK_FREE,
    "status": "$DISK_STATUS"
  },
  "ram": {
    "usage_percent": $RAM_PERCENT,
    "used_mb": $RAM_USED,
    "total_mb": $RAM_TOTAL,
    "status": "$RAM_STATUS"
  },
  "swap": {
    "usage_percent": $SWAP_PERCENT,
    "used_mb": $SWAP_USED,
    "total_mb": $SWAP_TOTAL,
    "status": "$SWAP_STATUS"
  },
  "oom_kills": $OOM_KILLS,
  "failed_services": $FAILED_SERVICES,
  "top_memory_processes": [$TOP_PROCS]
}
EOF
else
    # Human-readable output
    echo "=== Elio Infrastructure Health ==="
    echo ""

    printf "Disk:   %3d%% " $DISK_USAGE
    case $DISK_STATUS in
        healthy)  printf "${GREEN}[OK]${NC}\n" ;;
        warning)  printf "${YELLOW}[WARNING]${NC}\n" ;;
        critical) printf "${RED}[CRITICAL]${NC}\n" ;;
    esac

    printf "RAM:    %3d%% " $RAM_PERCENT
    case $RAM_STATUS in
        healthy)  printf "${GREEN}[OK]${NC}\n" ;;
        warning)  printf "${YELLOW}[WARNING]${NC}\n" ;;
        critical) printf "${RED}[CRITICAL]${NC}\n" ;;
    esac

    printf "Swap:   %3d%% " $SWAP_PERCENT
    case $SWAP_STATUS in
        healthy)  printf "${GREEN}[OK]${NC}\n" ;;
        warning)  printf "${YELLOW}[WARNING]${NC}\n" ;;
        critical) printf "${RED}[CRITICAL]${NC}\n" ;;
    esac

    echo ""
    echo "OOM Kills (recent): $OOM_KILLS"
    echo "Failed Services:    $FAILED_SERVICES"
    echo ""
    echo "Top Memory Processes:"
    ps aux --sort=-%mem | head -6 | tail -5 | awk '{printf "  %s: %.1f%%\n", $11, $4}'
    echo ""
    echo "Overall: $OVERALL"
fi
