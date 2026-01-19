#!/bin/bash
# Auto-Test Skill v1.0
# Runs automated tests for core functionality on every commit

set -e

SCOPE="${1:-changed}"
ROOT_DIR="/root/.claude"

# Test results
PASSED=()
FAILED=()
SKIPPED=()

# Colors for output (optional, for human readability)
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_pass() {
    PASSED+=("$1")
    echo -e "${GREEN}✓${NC} $1" >&2
}

log_fail() {
    FAILED+=("$1: $2")
    echo -e "${RED}✗${NC} $1: $2" >&2
}

log_skip() {
    SKIPPED+=("$1")
    echo -e "${YELLOW}○${NC} $1 (skipped)" >&2
}

# Determine which modules were changed
get_changed_modules() {
    local changed_files=$(git diff --name-only HEAD~1 2>/dev/null || echo "")
    local modules=()

    if echo "$changed_files" | grep -q "^mcp-server/"; then
        modules+=("mcp-server")
    fi
    if echo "$changed_files" | grep -q "^elio/"; then
        modules+=("elio")
    fi
    if echo "$changed_files" | grep -q "^scheduler/"; then
        modules+=("scheduler")
    fi
    if echo "$changed_files" | grep -q "^gtd/"; then
        modules+=("gtd")
    fi
    if echo "$changed_files" | grep -q "^headless/"; then
        modules+=("headless")
    fi
    if echo "$changed_files" | grep -q "^context-graph/"; then
        modules+=("context-graph")
    fi
    if echo "$changed_files" | grep -q "^self-improvement/"; then
        modules+=("self-improvement")
    fi

    # If no specific modules changed or scope is full, test all
    if [ ${#modules[@]} -eq 0 ] || [ "$SCOPE" = "full" ]; then
        modules=("mcp-server" "elio" "scheduler" "gtd" "headless" "context-graph" "self-improvement")
    fi

    echo "${modules[@]}"
}

# ============================================
# TEST: TypeScript Compilation
# ============================================
test_typescript_compilation() {
    local module="$1"
    local dir="$ROOT_DIR/$module"

    if [ ! -d "$dir" ]; then
        log_skip "TypeScript compilation: $module (not found)"
        return
    fi

    if [ ! -f "$dir/tsconfig.json" ]; then
        log_skip "TypeScript compilation: $module (no tsconfig)"
        return
    fi

    cd "$dir"
    if npm run build 2>/dev/null || npx tsc --noEmit 2>/dev/null; then
        log_pass "TypeScript compilation: $module"
    else
        log_fail "TypeScript compilation: $module" "Compilation errors"
    fi
    cd "$ROOT_DIR"
}

# ============================================
# TEST: Module Exports
# ============================================
test_module_exports() {
    local module="$1"
    local dir="$ROOT_DIR/$module"

    if [ ! -d "$dir/dist" ] && [ ! -d "$dir/src" ]; then
        log_skip "Module exports: $module (no dist/src)"
        return
    fi

    # Check if main entry point exists
    local entry=""
    if [ -f "$dir/package.json" ]; then
        entry=$(node -e "console.log(require('$dir/package.json').main || '')" 2>/dev/null)
    fi

    if [ -n "$entry" ] && [ -f "$dir/$entry" ]; then
        log_pass "Module exports: $module (entry: $entry)"
    elif [ -f "$dir/dist/index.js" ] || [ -f "$dir/src/index.ts" ]; then
        log_pass "Module exports: $module (index found)"
    else
        log_fail "Module exports: $module" "No valid entry point"
    fi
}

# ============================================
# TEST: MCP Server Tools
# ============================================
test_mcp_tools() {
    local tools_dir="$ROOT_DIR/mcp-server/src/tools"

    if [ ! -d "$tools_dir" ]; then
        log_skip "MCP tools: tools directory not found"
        return
    fi

    local tool_count=$(find "$tools_dir" -name "*.ts" -type f ! -name "index.ts" ! -name "types.ts" | wc -l)

    if [ "$tool_count" -gt 0 ]; then
        # Check that index.ts exports tools
        if [ -f "$tools_dir/index.ts" ]; then
            # Look for any export pattern (export *, export {}, or export const)
            local exports=$(grep -cE "^export " "$tools_dir/index.ts" 2>/dev/null) || exports=0
            if [ "$exports" -gt 0 ]; then
                log_pass "MCP tools: $tool_count tool modules, $exports exports"
            else
                log_fail "MCP tools" "Tools not exported from index"
            fi
        else
            log_fail "MCP tools" "No index.ts in tools directory"
        fi
    else
        log_fail "MCP tools" "No tool files found"
    fi
}

# ============================================
# TEST: Integration Modules
# ============================================
test_integrations() {
    local int_dir="$ROOT_DIR/mcp-server/src/integrations"

    if [ ! -d "$int_dir" ]; then
        log_skip "Integrations: directory not found"
        return
    fi

    local valid=0
    local invalid=0

    for file in "$int_dir"/*.ts; do
        [ ! -f "$file" ] && continue
        local name=$(basename "$file" .ts)

        # Check for required exports (isAuthenticated or similar)
        if grep -qE "export (async )?function|export const" "$file" 2>/dev/null; then
            valid=$((valid + 1))
        else
            invalid=$((invalid + 1))
            log_fail "Integration: $name" "No exports found"
        fi
    done

    if [ "$valid" -gt 0 ] && [ "$invalid" -eq 0 ]; then
        log_pass "Integrations: $valid modules validated"
    elif [ "$valid" -gt 0 ]; then
        log_pass "Integrations: $valid valid, $invalid invalid"
    fi
}

# ============================================
# TEST: Circular Dependencies
# ============================================
test_circular_deps() {
    local module="$1"
    local dir="$ROOT_DIR/$module/src"

    [ ! -d "$dir" ] && dir="$ROOT_DIR/$module"
    [ ! -d "$dir" ] && return

    # Simple circular dependency check using import patterns
    local circular=0

    for file in $(find "$dir" -name "*.ts" -type f 2>/dev/null); do
        local imports=$(grep "^import.*from" "$file" 2>/dev/null | grep -oE "from ['\"]\.+/[^'\"]+['\"]" | sed "s/from ['\"]//;s/['\"]//")

        for imp in $imports; do
            local target=$(dirname "$file")/"$imp"
            if [ -f "$target.ts" ]; then
                # Check if target imports back to this file
                local basename=$(basename "$file" .ts)
                if grep -q "from.*$basename" "$target.ts" 2>/dev/null; then
                    circular=$((circular + 1))
                fi
            fi
        done
    done

    if [ "$circular" -eq 0 ]; then
        log_pass "Circular deps: $module"
    else
        log_fail "Circular deps: $module" "$circular potential cycles"
    fi
}

# ============================================
# TEST: Package.json Validity
# ============================================
test_package_json() {
    local module="$1"
    local pkg="$ROOT_DIR/$module/package.json"

    if [ ! -f "$pkg" ]; then
        log_skip "Package.json: $module (not found)"
        return
    fi

    # Validate JSON
    if node -e "JSON.parse(require('fs').readFileSync('$pkg'))" 2>/dev/null; then
        # Check required fields
        local name=$(node -e "console.log(require('$pkg').name || '')" 2>/dev/null)
        local version=$(node -e "console.log(require('$pkg').version || '')" 2>/dev/null)

        if [ -n "$name" ] && [ -n "$version" ]; then
            log_pass "Package.json: $module ($name@$version)"
        else
            log_fail "Package.json: $module" "Missing name or version"
        fi
    else
        log_fail "Package.json: $module" "Invalid JSON"
    fi
}

# ============================================
# TEST: Quick Smoke Test (imports work)
# ============================================
test_smoke() {
    local module="$1"
    local dir="$ROOT_DIR/$module"

    if [ ! -d "$dir" ]; then
        log_skip "Smoke test: $module"
        return
    fi

    # Try to parse TypeScript files without errors
    local errors=0
    for file in $(find "$dir/src" -name "*.ts" -type f 2>/dev/null | head -5); do
        if ! node --check "$file" 2>/dev/null; then
            # TypeScript files won't pass --check, so check for syntax with tsc
            if ! npx tsc --noEmit --skipLibCheck "$file" 2>/dev/null; then
                errors=$((errors + 1))
            fi
        fi
    done

    if [ "$errors" -eq 0 ]; then
        log_pass "Smoke test: $module"
    else
        log_fail "Smoke test: $module" "$errors files with errors"
    fi
}

# ============================================
# MAIN
# ============================================

echo "Running Elio OS Auto-Tests (scope: $SCOPE)" >&2
echo "========================================" >&2

MODULES=$(get_changed_modules)

# Run tests based on scope
if [ "$SCOPE" = "quick" ]; then
    # Quick: just smoke tests
    for module in $MODULES; do
        test_package_json "$module"
    done
    test_mcp_tools
else
    # Full or changed: comprehensive tests
    for module in $MODULES; do
        test_package_json "$module"
        test_typescript_compilation "$module"
        test_module_exports "$module"
        test_circular_deps "$module"
    done

    # MCP-specific tests
    if echo "$MODULES" | grep -q "mcp-server"; then
        test_mcp_tools
        test_integrations
    fi
fi

echo "========================================" >&2

# Calculate results
TOTAL=$((${#PASSED[@]} + ${#FAILED[@]}))
PASS_RATE=0
[ "$TOTAL" -gt 0 ] && PASS_RATE=$((${#PASSED[@]} * 100 / TOTAL))

ALL_PASSED="false"
[ ${#FAILED[@]} -eq 0 ] && ALL_PASSED="true"

# Build JSON arrays
build_json_array() {
    local arr=("$@")
    if [ ${#arr[@]} -eq 0 ]; then
        echo "[]"
    else
        local result="["
        for i in "${!arr[@]}"; do
            result+="\"${arr[$i]}\""
            [ $i -lt $((${#arr[@]} - 1)) ] && result+=","
        done
        result+="]"
        echo "$result"
    fi
}

PASSED_JSON=$(build_json_array "${PASSED[@]}")
FAILED_JSON=$(build_json_array "${FAILED[@]}")
SKIPPED_JSON=$(build_json_array "${SKIPPED[@]}")

# Output JSON
cat << EOF
{
  "version": "1.0.0",
  "scope": "$SCOPE",
  "passed": $ALL_PASSED,
  "summary": {
    "total": $TOTAL,
    "passed": ${#PASSED[@]},
    "failed": ${#FAILED[@]},
    "skipped": ${#SKIPPED[@]},
    "pass_rate": $PASS_RATE
  },
  "passed_tests": $PASSED_JSON,
  "failures": $FAILED_JSON,
  "skipped_tests": $SKIPPED_JSON
}
EOF
