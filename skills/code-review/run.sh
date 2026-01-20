#!/bin/bash
# Code Review Skill v2.2
# AI-powered code review with architecture analysis & auto-refactoring suggestions

PATH_TO_CHECK="${1:-.}"
SCOPE="${2:-changed}"

STANDARDS_FILE="/root/.claude/STANDARDS.md"
ISSUES=()
SUGGESTIONS=()
VULNERABILITIES=()
REFACTORING=()
CRITICAL_COUNT=0
HIGH_COUNT=0
MEDIUM_COUNT=0
LOW_COUNT=0
VULN_CRITICAL=0
VULN_HIGH=0

# Architecture metrics
TOTAL_LINES=0
LARGE_FILES=0
COMPLEX_FUNCTIONS=0

# Get files to review based on scope
get_files() {
    case "$SCOPE" in
        changed)
            git diff --name-only HEAD~1 2>/dev/null | grep -E '\.(ts|js|tsx|jsx)$' | grep -v node_modules || true
            ;;
        staged)
            git diff --cached --name-only 2>/dev/null | grep -E '\.(ts|js|tsx|jsx)$' | grep -v node_modules || true
            ;;
        full)
            find "$PATH_TO_CHECK" -type f \( -name "*.ts" -o -name "*.js" -o -name "*.tsx" -o -name "*.jsx" \) 2>/dev/null | grep -v node_modules | grep -v dist || true
            ;;
        *)
            if [ -d "$PATH_TO_CHECK" ]; then
                find "$PATH_TO_CHECK" -type f \( -name "*.ts" -o -name "*.js" \) 2>/dev/null | grep -v node_modules | grep -v dist || true
            else
                echo "$PATH_TO_CHECK"
            fi
            ;;
    esac
}

add_issue() {
    local file="$1"
    local line="$2"
    local severity="$3"
    local category="$4"
    local message="$5"
    local fix="$6"

    case "$severity" in
        critical) CRITICAL_COUNT=$((CRITICAL_COUNT + 1)) ;;
        high) HIGH_COUNT=$((HIGH_COUNT + 1)) ;;
        medium) MEDIUM_COUNT=$((MEDIUM_COUNT + 1)) ;;
        low) LOW_COUNT=$((LOW_COUNT + 1)) ;;
    esac

    ISSUES+=("{\"file\":\"$file\",\"line\":$line,\"severity\":\"$severity\",\"category\":\"$category\",\"message\":\"$message\",\"fix\":\"$fix\"}")
}

add_suggestion() {
    local file="$1"
    local category="$2"
    local message="$3"

    SUGGESTIONS+=("{\"file\":\"$file\",\"category\":\"$category\",\"message\":\"$message\"}")
}

add_vulnerability() {
    local pkg="$1"
    local severity="$2"
    local desc="$3"
    local fix="$4"

    case "$severity" in
        critical) VULN_CRITICAL=$((VULN_CRITICAL + 1)) ;;
        high) VULN_HIGH=$((VULN_HIGH + 1)) ;;
    esac

    VULNERABILITIES+=("{\"package\":\"$pkg\",\"severity\":\"$severity\",\"description\":\"$desc\",\"fix\":\"$fix\"}")
}

add_refactoring() {
    local file="$1"
    local type="$2"
    local reason="$3"
    local suggestion="$4"

    REFACTORING+=("{\"file\":\"$file\",\"type\":\"$type\",\"reason\":\"$reason\",\"suggestion\":\"$suggestion\"}")
}

# Get appropriate line limit based on file type
get_line_limit() {
    local file="$1"
    # Integration files can be larger (300 lines)
    if [[ "$file" == *"/integrations/"* ]]; then
        echo 300
    # Test files can be larger
    elif [[ "$file" == *".test."* ]] || [[ "$file" == *".spec."* ]]; then
        echo 400
    # CLI files can be larger (250 lines)
    elif [[ "$file" == *"cli.ts"* ]] || [[ "$file" == *"cli.js"* ]]; then
        echo 250
    # Standard limit
    else
        echo 200
    fi
}

# Check dependencies for vulnerabilities and outdated versions
check_dependencies() {
    local pkg_dir="$1"
    [ ! -f "$pkg_dir/package.json" ] && return

    # Check for npm audit (security vulnerabilities)
    if command -v npm &> /dev/null && [ -d "$pkg_dir/node_modules" ]; then
        local audit_result
        audit_result=$(cd "$pkg_dir" && npm audit --json 2>/dev/null || true)

        if [ -n "$audit_result" ]; then
            local vuln_critical vuln_high
            vuln_critical=$(echo "$audit_result" | grep -o '"critical":[0-9]*' | head -1 | grep -o '[0-9]*') || vuln_critical=0
            vuln_high=$(echo "$audit_result" | grep -o '"high":[0-9]*' | head -1 | grep -o '[0-9]*') || vuln_high=0

            if [ "${vuln_critical:-0}" -gt 0 ]; then
                add_vulnerability "$pkg_dir" "critical" "Found $vuln_critical critical vulnerabilities" "Run npm audit fix"
            fi
            if [ "${vuln_high:-0}" -gt 0 ]; then
                add_vulnerability "$pkg_dir" "high" "Found $vuln_high high-severity vulnerabilities" "Run npm audit fix"
            fi
        fi
    fi

    # Check for outdated packages
    if command -v npm &> /dev/null; then
        local outdated
        outdated=$(cd "$pkg_dir" && npm outdated --json 2>/dev/null || true)

        if [ -n "$outdated" ] && [ "$outdated" != "{}" ]; then
            # Check for major version updates (potentially breaking)
            local major_updates
            major_updates=$(echo "$outdated" | grep -c '"wanted":' 2>/dev/null) || major_updates=0

            if [ "$major_updates" -gt 0 ]; then
                add_suggestion "$pkg_dir/package.json" "dependencies" "Found $major_updates outdated packages - run npm update"
            fi

            # Check specifically for security-critical packages
            for critical_pkg in "typescript" "express" "axios" "node-fetch"; do
                if echo "$outdated" | grep -q "\"$critical_pkg\""; then
                    local current=$(echo "$outdated" | grep -A2 "\"$critical_pkg\"" | grep '"current"' | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' | head -1)
                    local latest=$(echo "$outdated" | grep -A4 "\"$critical_pkg\"" | grep '"latest"' | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' | head -1)
                    if [ -n "$current" ] && [ -n "$latest" ]; then
                        add_issue "$pkg_dir/package.json" 0 "medium" "dependencies" "Package $critical_pkg is outdated: $current -> $latest" "npm update $critical_pkg"
                    fi
                fi
            done
        fi
    fi
}

check_file() {
    local file="$1"
    [ ! -f "$file" ] && return

    local lines
    lines=$(wc -l < "$file" 2>/dev/null | tr -d ' ')
    TOTAL_LINES=$((TOTAL_LINES + lines))

    local line_limit
    line_limit=$(get_line_limit "$file")

    # === CRITICAL: Security Issues ===

    # SQL Injection patterns
    if grep -qE "(query|execute|exec)\s*\([^)]*\+\s*[a-zA-Z]" "$file" 2>/dev/null; then
        add_issue "$file" 0 "critical" "security" "Potential SQL injection - use parameterized queries" "Use prepared statements"
    fi

    # Hardcoded secrets (more specific pattern to avoid false positives)
    if grep -qE "(password|secret|api_key|apikey|private_key)\s*[:=]\s*['\"][A-Za-z0-9_-]{8,}['\"]" "$file" 2>/dev/null; then
        add_issue "$file" 0 "critical" "security" "Hardcoded credentials detected" "Use environment variables"
    fi

    # eval() usage
    if grep -q 'eval(' "$file" 2>/dev/null; then
        add_issue "$file" 0 "critical" "security" "eval() usage is dangerous" "Refactor to avoid eval"
    fi

    # Unsafe regex (ReDoS)
    if grep -qE 'new RegExp\([^)]*\+' "$file" 2>/dev/null; then
        add_issue "$file" 0 "high" "security" "Dynamic regex may be vulnerable to ReDoS" "Validate regex input"
    fi

    # === HIGH: Code Quality & Architecture ===

    # File too large (dynamic limit based on file type)
    if [ "$lines" -gt "$line_limit" ]; then
        LARGE_FILES=$((LARGE_FILES + 1))
        add_issue "$file" 0 "high" "architecture" "File has $lines lines (max $line_limit)" "Split into smaller modules"

        # Add specific refactoring suggestion
        local basename=$(basename "$file")
        if [[ "$file" == *"/integrations/"* ]]; then
            add_refactoring "$file" "split" "Integration file too large" "Split into: ${basename%.ts}-types.ts, ${basename%.ts}-utils.ts, ${basename}"
        elif [[ "$file" == *"cli"* ]]; then
            add_refactoring "$file" "split" "CLI file too large" "Extract commands into separate files under commands/"
        else
            add_refactoring "$file" "split" "File exceeds size limit" "Extract related functions into separate modules"
        fi
    fi

    # 'any' type usage
    local any_count
    any_count=$(grep -c ': any' "$file" 2>/dev/null) || any_count=0
    if [ "$any_count" -gt 3 ]; then
        add_issue "$file" 0 "high" "type-safety" "Found $any_count uses of any type" "Add proper type annotations"
        add_refactoring "$file" "types" "Excessive any usage" "Define interfaces for unknown data structures"
    elif [ "$any_count" -gt 0 ]; then
        add_issue "$file" 0 "medium" "type-safety" "Found $any_count uses of any type" "Add proper type annotations"
    fi

    # Function complexity - count functions with >30 lines
    local long_functions
    long_functions=$(awk '/^(export )?(async )?function|^(export )?const \w+ = (async )?\(/ { start=NR } /^}$/ && start { if(NR-start>30) count++ } END { print count+0 }' "$file" 2>/dev/null)
    if [ "${long_functions:-0}" -gt 0 ]; then
        COMPLEX_FUNCTIONS=$((COMPLEX_FUNCTIONS + long_functions))
        add_suggestion "$file" "complexity" "Found $long_functions functions with >30 lines - consider breaking down"
    fi

    # Deprecated API usage
    if grep -qE '(require\(|module\.exports|__dirname|__filename)' "$file" 2>/dev/null; then
        if head -5 "$file" | grep -q '"type":\s*"module"' 2>/dev/null || grep -qE '^import\s' "$file" 2>/dev/null; then
            add_suggestion "$file" "modernization" "Mixing CommonJS and ESM - consider full ESM migration"
        fi
    fi

    # === MEDIUM: Best Practices ===

    # var usage
    if grep -qE '^\s*var\s' "$file" 2>/dev/null; then
        add_issue "$file" 0 "medium" "modernization" "Using var instead of const/let" "Replace var with const/let"
    fi

    # Missing error handling in async (only for files without any try-catch)
    local await_count try_count
    await_count=$(grep -c 'await\s' "$file" 2>/dev/null) || await_count=0
    try_count=$(grep -c 'try\s*{' "$file" 2>/dev/null) || try_count=0
    if [ "$await_count" -gt 3 ] && [ "$try_count" -eq 0 ]; then
        add_suggestion "$file" "error-handling" "Consider adding try-catch for async operations"
    fi

    # Synchronous fs operations in non-config files
    if grep -qE '(readFileSync|writeFileSync)' "$file" 2>/dev/null; then
        if [[ "$file" != *"config"* ]] && [[ "$file" != *".json"* ]]; then
            add_suggestion "$file" "performance" "Consider using async fs operations for better performance"
        fi
    fi

    # Duplicate code patterns (simple check for similar lines)
    local dup_patterns
    dup_patterns=$(sort "$file" 2>/dev/null | uniq -d | wc -l | tr -d ' ')
    if [ "${dup_patterns:-0}" -gt 10 ]; then
        add_suggestion "$file" "duplication" "Potential code duplication detected - consider extraction"
    fi

    # === LOW: Style & Optimization ===

    # Console.log (>5 occurrences for non-CLI files)
    local console_count console_limit=5
    [[ "$file" == *"cli"* ]] && console_limit=20
    console_count=$(grep -c 'console.log' "$file" 2>/dev/null) || console_count=0
    if [ "$console_count" -gt "$console_limit" ]; then
        add_issue "$file" 0 "low" "logging" "Found $console_count console.log statements" "Use structured logger"
    fi

    # TODO/FIXME comments
    local todo_count
    todo_count=$(grep -ciE '(TODO|FIXME|HACK|XXX):' "$file" 2>/dev/null) || todo_count=0
    if [ "$todo_count" -gt 0 ]; then
        add_suggestion "$file" "maintenance" "Contains $todo_count TODO/FIXME comments"
    fi

    # Export default (anti-pattern)
    if grep -q 'export default' "$file" 2>/dev/null; then
        add_issue "$file" 0 "medium" "standards" "Using export default - use named exports" "Convert to named export"
    fi
}

# Main
FILES=$(get_files)
FILES_COUNT=0
while IFS= read -r f; do
    [ -n "$f" ] && FILES_COUNT=$((FILES_COUNT + 1))
done <<< "$FILES"

while IFS= read -r file; do
    [ -n "$file" ] && check_file "$file"
done <<< "$FILES"

# Check dependencies in relevant directories
for pkg_dir in "." "./mcp-server" "./elio" "./scheduler" "./gtd" "./headless" "./context-graph" "./self-improvement"; do
    [ -d "$pkg_dir" ] && check_dependencies "$pkg_dir"
done

# Calculate score
TOTAL_ISSUES=$((CRITICAL_COUNT + HIGH_COUNT + MEDIUM_COUNT + LOW_COUNT))
VULN_TOTAL=$((VULN_CRITICAL + VULN_HIGH))
PENALTY=$((CRITICAL_COUNT * 20 + HIGH_COUNT * 10 + MEDIUM_COUNT * 5 + LOW_COUNT * 2 + VULN_CRITICAL * 25 + VULN_HIGH * 15))
SCORE=$((100 - PENALTY))
[ "$SCORE" -lt 0 ] && SCORE=0

# Build recommendation
if [ "$VULN_CRITICAL" -gt 0 ] || [ "$CRITICAL_COUNT" -gt 0 ]; then
    RECOMMENDATION="BLOCK: Fix critical issues/vulnerabilities before merge"
elif [ "$VULN_HIGH" -gt 0 ] || [ "$HIGH_COUNT" -gt 0 ]; then
    RECOMMENDATION="REVIEW: Address high-priority issues and update vulnerable packages"
elif [ "$MEDIUM_COUNT" -gt 0 ]; then
    RECOMMENDATION="APPROVE with notes: Consider addressing medium issues"
else
    RECOMMENDATION="APPROVE: Code meets quality standards"
fi

# Calculate architecture score (0-100)
AVG_LINES_PER_FILE=0
[ "$FILES_COUNT" -gt 0 ] && AVG_LINES_PER_FILE=$((TOTAL_LINES / FILES_COUNT))

ARCH_SCORE=100
[ "$LARGE_FILES" -gt 0 ] && ARCH_SCORE=$((ARCH_SCORE - LARGE_FILES * 5))
[ "$COMPLEX_FUNCTIONS" -gt 0 ] && ARCH_SCORE=$((ARCH_SCORE - COMPLEX_FUNCTIONS * 2))
[ "$AVG_LINES_PER_FILE" -gt 150 ] && ARCH_SCORE=$((ARCH_SCORE - 10))
[ "$ARCH_SCORE" -lt 0 ] && ARCH_SCORE=0

# === Architecture Deep Analysis ===
TECH_DEBT=""
ARCH_CHANGE=""
DATA_FLOW=""

# 1. Biggest Tech Debt Analysis
HARDCODED_PATHS=$(grep -r "'/root/.claude" /root/.claude --include="*.ts" 2>/dev/null | grep -v node_modules | grep -v dist | grep -v ".jsonl" | wc -l)
DIRECT_FS=$(grep -r "import.*from 'fs'" /root/.claude --include="*.ts" 2>/dev/null | grep -v node_modules | grep -v dist | grep -v "core/store.ts" | wc -l)
EXPORT_DEFAULT=$(grep -r "export default" /root/.claude --include="*.ts" 2>/dev/null | grep -v node_modules | grep -v dist | wc -l)
NO_ERROR_HANDLING=$(grep -rn "JSON.parse" /root/.claude --include="*.ts" 2>/dev/null | grep -v node_modules | grep -v dist | grep -v "try" | wc -l)

if [ "$HARDCODED_PATHS" -gt 10 ]; then
    TECH_DEBT="Hardcoded paths ($HARDCODED_PATHS files) - use @elio/shared paths config"
elif [ "$DIRECT_FS" -gt 10 ]; then
    TECH_DEBT="Direct fs imports ($DIRECT_FS files) - use @elio/shared store utilities"
elif [ "$EXPORT_DEFAULT" -gt 0 ]; then
    TECH_DEBT="Export default usage ($EXPORT_DEFAULT files) - convert to named exports"
elif [ "$NO_ERROR_HANDLING" -gt 5 ]; then
    TECH_DEBT="JSON.parse without try-catch ($NO_ERROR_HANDLING places)"
else
    TECH_DEBT="No major tech debt detected"
fi

# 2. Most Important Architecture Change
EVENT_SYSTEM=$(grep -r "EventEmitter\|emit\|\.on\(" /root/.claude --include="*.ts" 2>/dev/null | grep -v node_modules | grep -v dist | wc -l)
STORE_WRITES=$(grep -rn "saveStore\|store.save\|writeFile" /root/.claude --include="*.ts" 2>/dev/null | grep -v node_modules | grep -v dist | wc -l)
SHARED_USAGE=$(grep -r "from '@elio/shared'" /root/.claude --include="*.ts" 2>/dev/null | grep -v node_modules | grep -v dist | wc -l)

if [ "$EVENT_SYSTEM" -lt 3 ] && [ "$STORE_WRITES" -gt 20 ]; then
    ARCH_CHANGE="Add event bus - $STORE_WRITES direct store writes without notifications"
elif [ "$SHARED_USAGE" -lt 5 ]; then
    ARCH_CHANGE="Use @elio/shared more - only $SHARED_USAGE imports found"
else
    ARCH_CHANGE="Consider plugin system for extensibility"
fi

# 3. Data Flow Scalability
COUPLED_MODULES=0
for pkg in headless context-graph self-improvement gtd; do
    if ! grep -q "from '@elio/shared'" "/root/.claude/$pkg"/*.ts 2>/dev/null && \
       ! grep -q "from '@elio/shared'" "/root/.claude/$pkg"/**/*.ts 2>/dev/null; then
        COUPLED_MODULES=$((COUPLED_MODULES + 1))
    fi
done

if [ "$COUPLED_MODULES" -gt 2 ]; then
    DATA_FLOW="Decouple modules - $COUPLED_MODULES packages not using shared utilities"
elif [ "$EVENT_SYSTEM" -lt 3 ]; then
    DATA_FLOW="Implement pub/sub pattern for cross-module communication"
else
    DATA_FLOW="Consider async message queue for heavy operations"
fi

# Output JSON
cat << EOF
{
  "version": "2.3.0",
  "scope": "$SCOPE",
  "path": "$PATH_TO_CHECK",
  "files_checked": $FILES_COUNT,
  "score": $SCORE,
  "architecture_score": $ARCH_SCORE,
  "summary": {
    "critical": $CRITICAL_COUNT,
    "high": $HIGH_COUNT,
    "medium": $MEDIUM_COUNT,
    "low": $LOW_COUNT,
    "total": $TOTAL_ISSUES
  },
  "metrics": {
    "total_lines": $TOTAL_LINES,
    "avg_lines_per_file": $AVG_LINES_PER_FILE,
    "large_files": $LARGE_FILES,
    "complex_functions": $COMPLEX_FUNCTIONS
  },
  "architecture_analysis": {
    "tech_debt": "$TECH_DEBT",
    "recommended_change": "$ARCH_CHANGE",
    "data_flow_improvement": "$DATA_FLOW"
  },
  "vulnerabilities": {
    "critical": $VULN_CRITICAL,
    "high": $VULN_HIGH,
    "total": $VULN_TOTAL,
    "details": [$(IFS=','; echo "${VULNERABILITIES[*]}")]
  },
  "issues": [$(IFS=','; echo "${ISSUES[*]}")],
  "suggestions": [$(IFS=','; echo "${SUGGESTIONS[*]}")],
  "refactoring": [$(IFS=','; echo "${REFACTORING[*]}")],
  "standards": "$STANDARDS_FILE",
  "recommendation": "$RECOMMENDATION"
}
EOF
