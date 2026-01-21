#!/bin/bash
# System Review Runner
# Usage: ./run.sh [scope] [fix] [notify]
#   scope: full|quick|build-only (default: full)
#   fix: true|false (default: false)
#   notify: true|false (default: false)

set -e

SCOPE="${1:-full}"
FIX="${2:-false}"
NOTIFY="${3:-false}"

ELIO_ROOT="/root/.claude"
LOG_DIR="$ELIO_ROOT/logs/system-review"
TIMESTAMP=$(date +%Y-%m-%d_%H%M%S)
REPORT_FILE="$LOG_DIR/$TIMESTAMP.json"

mkdir -p "$LOG_DIR"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Counters
TOTAL_SCORE=0
TOTAL_WEIGHT=0
ISSUES=()
ACTION_ITEMS=()

log() { echo -e "$1"; }
pass() { log "${GREEN}✓${NC} $1"; }
warn() { log "${YELLOW}⚠${NC} $1"; ISSUES+=("$1"); }
fail() { log "${RED}✗${NC} $1"; ISSUES+=("$1"); }

add_score() {
  local score=$1
  local weight=$2
  TOTAL_SCORE=$((TOTAL_SCORE + score * weight))
  TOTAL_WEIGHT=$((TOTAL_WEIGHT + weight))
}

# ============================================
# Phase 1: Build Check (weight: 30)
# ============================================
phase_build() {
  log "\n${YELLOW}═══ Phase 1: Build Check ═══${NC}\n"

  cd "$ELIO_ROOT"

  # 1.1 TypeScript compilation
  log "Compiling TypeScript..."
  BUILD_OUTPUT=$(pnpm build 2>&1) || true

  if echo "$BUILD_OUTPUT" | grep -q "error TS"; then
    fail "TypeScript compilation errors found"
    echo "$BUILD_OUTPUT" | grep "error TS" | head -10
    add_score 0 30
    return
  fi

  pass "TypeScript compilation OK"

  # 1.2 Check for warnings
  WARNINGS=$(echo "$BUILD_OUTPUT" | grep -c "warning" || echo "0")
  if [ "$WARNINGS" -gt 0 ]; then
    warn "Build has $WARNINGS warnings"
    add_score 80 30
  else
    pass "No build warnings"
    add_score 100 30
  fi
}

# ============================================
# Phase 2: Architecture Check (weight: 20)
# ============================================
phase_architecture() {
  log "\n${YELLOW}═══ Phase 2: Architecture Check ═══${NC}\n"

  cd "$ELIO_ROOT"
  ARCH_ISSUES=0

  # 2.1 File size check
  log "Checking file sizes..."
  LARGE_FILES=$(find packages apps mcp-server/src -name "*.ts" -exec wc -l {} \; 2>/dev/null | \
    awk '$1 > 200 {print $2 " (" $1 " lines)"}' | grep -v node_modules || true)

  if [ -n "$LARGE_FILES" ]; then
    LARGE_COUNT=$(echo "$LARGE_FILES" | wc -l)
    warn "Found $LARGE_COUNT files > 200 lines:"
    echo "$LARGE_FILES" | head -5
    ACTION_ITEMS+=("Split large files: $(echo "$LARGE_FILES" | head -1)")
    ARCH_ISSUES=$((ARCH_ISSUES + LARGE_COUNT))
  else
    pass "All files within size limits"
  fi

  # 2.2 Check for index.ts
  log "Checking module structure..."
  MISSING_INDEX=$(find packages/*/src apps/*/src -maxdepth 1 -type d ! -exec test -e '{}/index.ts' \; -print 2>/dev/null || true)

  if [ -n "$MISSING_INDEX" ]; then
    warn "Modules without index.ts: $(echo "$MISSING_INDEX" | wc -l)"
    ARCH_ISSUES=$((ARCH_ISSUES + 1))
  else
    pass "All modules have index.ts"
  fi

  # Calculate score
  if [ "$ARCH_ISSUES" -eq 0 ]; then
    add_score 100 20
  elif [ "$ARCH_ISSUES" -le 3 ]; then
    add_score 70 20
  else
    add_score 40 20
  fi
}

# ============================================
# Phase 3: Code Quality (weight: 20)
# ============================================
phase_code_quality() {
  log "\n${YELLOW}═══ Phase 3: Code Quality ═══${NC}\n"

  cd "$ELIO_ROOT"
  QUALITY_ISSUES=0

  # 3.1 Check for `any` types
  log "Checking for any types..."
  ANY_COUNT=$(grep -r ": any" --include="*.ts" packages apps mcp-server/src 2>/dev/null | \
    grep -v node_modules | grep -v "\.d\.ts" | wc -l || echo "0")

  if [ "$ANY_COUNT" -gt 0 ]; then
    warn "Found $ANY_COUNT 'any' types"
    QUALITY_ISSUES=$((QUALITY_ISSUES + ANY_COUNT))
  else
    pass "No any types found"
  fi

  # 3.2 Check for console.log
  log "Checking for console.log..."
  CONSOLE_COUNT=$(grep -r "console\.\(log\|error\|warn\)" --include="*.ts" packages apps mcp-server/src 2>/dev/null | \
    grep -v node_modules | grep -v "test" | grep -v "spec" | wc -l || echo "0")

  if [ "$CONSOLE_COUNT" -gt 5 ]; then
    warn "Found $CONSOLE_COUNT console.log statements (should use logger)"
    QUALITY_ISSUES=$((QUALITY_ISSUES + 1))
  else
    pass "Console usage acceptable"
  fi

  # 3.3 Check for hardcoded secrets
  log "Checking for hardcoded secrets..."
  SECRETS=$(grep -rE "(api[_-]?key|password|secret)\s*[:=]\s*['\"][a-zA-Z0-9]{10,}" --include="*.ts" packages apps mcp-server/src 2>/dev/null | \
    grep -v node_modules | grep -v "\.env" || true)

  if [ -n "$SECRETS" ]; then
    fail "Potential hardcoded secrets found!"
    echo "$SECRETS" | head -3
    QUALITY_ISSUES=$((QUALITY_ISSUES + 10))
  else
    pass "No hardcoded secrets"
  fi

  # 3.4 TODO count
  log "Checking TODOs..."
  TODO_COUNT=$(grep -rE "(TODO|FIXME)" --include="*.ts" packages apps mcp-server/src 2>/dev/null | \
    grep -v node_modules | wc -l || echo "0")

  if [ "$TODO_COUNT" -gt 10 ]; then
    warn "Found $TODO_COUNT TODOs/FIXMEs"
  else
    pass "TODO count acceptable ($TODO_COUNT)"
  fi

  # Calculate score
  if [ "$QUALITY_ISSUES" -eq 0 ]; then
    add_score 100 20
  elif [ "$QUALITY_ISSUES" -le 5 ]; then
    add_score 70 20
  else
    add_score 40 20
  fi
}

# ============================================
# Phase 4: Runtime Check (weight: 20)
# ============================================
phase_runtime() {
  log "\n${YELLOW}═══ Phase 4: Runtime Check ═══${NC}\n"

  RUNTIME_FAILS=0

  # 4.1 Redis
  log "Checking Redis..."
  if redis-cli ping > /dev/null 2>&1; then
    pass "Redis connection OK"
  else
    fail "Redis not available"
    RUNTIME_FAILS=$((RUNTIME_FAILS + 1))
  fi

  # 4.2 Worker process
  log "Checking Worker..."
  if pgrep -f "apps/worker" > /dev/null 2>&1; then
    pass "Worker is running"
  else
    warn "Worker not running"
    RUNTIME_FAILS=$((RUNTIME_FAILS + 1))
  fi

  # 4.3 Test job (if worker running)
  if [ "$RUNTIME_FAILS" -eq 0 ]; then
    log "Testing job queue..."
    QUEUE_LEN=$(redis-cli LLEN bull:agent-execution:wait 2>/dev/null || echo "-1")
    if [ "$QUEUE_LEN" != "-1" ]; then
      pass "Job queue accessible (waiting: $QUEUE_LEN)"
    else
      warn "Cannot access job queue"
      RUNTIME_FAILS=$((RUNTIME_FAILS + 1))
    fi
  fi

  # Calculate score
  if [ "$RUNTIME_FAILS" -eq 0 ]; then
    add_score 100 20
  elif [ "$RUNTIME_FAILS" -eq 1 ]; then
    add_score 60 20
  else
    add_score 20 20
  fi
}

# ============================================
# Phase 5: Integration Check (weight: 10)
# ============================================
phase_integration() {
  log "\n${YELLOW}═══ Phase 5: Integration Check ═══${NC}\n"

  cd "$ELIO_ROOT/mcp-server"

  # 5.1 Check adapters load
  log "Checking adapters..."
  ADAPTER_CHECK=$(node -e "
    import('./dist/adapters/index.js')
      .then(m => {
        const names = m.allAdapters.map(a => a.name);
        console.log('OK:' + names.length + ':' + names.join(','));
      })
      .catch(e => console.log('ERROR:' + e.message));
  " 2>&1)

  if echo "$ADAPTER_CHECK" | grep -q "^OK:"; then
    ADAPTER_COUNT=$(echo "$ADAPTER_CHECK" | cut -d: -f2)
    pass "Loaded $ADAPTER_COUNT adapters"
    add_score 100 10
  else
    fail "Failed to load adapters"
    echo "$ADAPTER_CHECK"
    add_score 0 10
  fi
}

# ============================================
# Generate Report
# ============================================
generate_report() {
  FINAL_SCORE=$((TOTAL_SCORE / TOTAL_WEIGHT))

  if [ "$FINAL_SCORE" -ge 90 ]; then
    STATUS="pass"
  elif [ "$FINAL_SCORE" -ge 70 ]; then
    STATUS="warn"
  else
    STATUS="fail"
  fi

  log "\n${YELLOW}═══════════════════════════════════${NC}"
  log "${YELLOW}       SYSTEM REVIEW COMPLETE        ${NC}"
  log "${YELLOW}═══════════════════════════════════${NC}\n"

  if [ "$STATUS" = "pass" ]; then
    log "Status: ${GREEN}✅ PASS${NC}"
  elif [ "$STATUS" = "warn" ]; then
    log "Status: ${YELLOW}⚠️ WARN${NC}"
  else
    log "Status: ${RED}❌ FAIL${NC}"
  fi

  log "Score: ${FINAL_SCORE}/100"
  log ""

  if [ ${#ISSUES[@]} -gt 0 ]; then
    log "Issues found:"
    for issue in "${ISSUES[@]}"; do
      log "  • $issue"
    done
  fi

  if [ ${#ACTION_ITEMS[@]} -gt 0 ]; then
    log "\nAction Items:"
    for item in "${ACTION_ITEMS[@]}"; do
      log "  • $item"
    done
  fi

  # Save JSON report
  cat > "$REPORT_FILE" << EOF
{
  "timestamp": "$(date -Iseconds)",
  "scope": "$SCOPE",
  "overall_status": "$STATUS",
  "overall_score": $FINAL_SCORE,
  "issues_count": ${#ISSUES[@]},
  "action_items_count": ${#ACTION_ITEMS[@]}
}
EOF

  log "\nReport saved: $REPORT_FILE"
}

# ============================================
# Main
# ============================================
main() {
  log "${GREEN}╔═══════════════════════════════════╗${NC}"
  log "${GREEN}║       ELIO SYSTEM REVIEW          ║${NC}"
  log "${GREEN}║       Scope: $SCOPE               ${NC}"
  log "${GREEN}╚═══════════════════════════════════╝${NC}"

  case "$SCOPE" in
    build-only)
      phase_build
      ;;
    quick)
      phase_build
      phase_runtime
      ;;
    full|*)
      phase_build
      phase_architecture
      phase_code_quality
      phase_runtime
      phase_integration
      ;;
  esac

  generate_report

  # Notify if requested
  if [ "$NOTIFY" = "true" ] && [ -n "$TELEGRAM_BOT_TOKEN" ] && [ -n "$TELEGRAM_CHAT_ID" ]; then
    curl -s -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" \
      -d "chat_id=${TELEGRAM_CHAT_ID}" \
      -d "text=📊 System Review: $(echo $STATUS | tr '[:lower:]' '[:upper:]') (${FINAL_SCORE}/100)" \
      -d "parse_mode=HTML" > /dev/null
  fi
}

main
