#!/bin/bash
# Code Review Skill v2.1
# AI-powered code review with dependency audit

PATH_TO_CHECK="${1:-.}"
SCOPE="${2:-changed}"

STANDARDS_FILE="/root/.claude/STANDARDS.md"
ISSUES=()
SUGGESTIONS=()
VULNERABILITIES=()
CRITICAL_COUNT=0
HIGH_COUNT=0
MEDIUM_COUNT=0
LOW_COUNT=0
VULN_CRITICAL=0
VULN_HIGH=0

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

    # === CRITICAL: Security Issues ===

    # SQL Injection patterns
    if grep -qE "(query|execute|exec)\s*\([^)]*\+\s*[a-zA-Z]" "$file" 2>/dev/null; then
        add_issue "$file" 0 "critical" "security" "Potential SQL injection - use parameterized queries" "Use prepared statements"
    fi

    # Hardcoded secrets
    if grep -qE "(password|secret|api_key|apikey|token)\s*=\s*['\"][^'\"]+['\"]" "$file" 2>/dev/null; then
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

    # File too large (>200 lines)
    if [ "$lines" -gt 200 ]; then
        add_issue "$file" 0 "high" "architecture" "File has $lines lines (max 200)" "Split into smaller modules"
    fi

    # 'any' type usage
    local any_count
    any_count=$(grep -c ': any' "$file" 2>/dev/null) || any_count=0
    if [ "$any_count" -gt 0 ]; then
        add_issue "$file" 0 "high" "type-safety" "Found $any_count uses of any type" "Add proper type annotations"
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

    # Missing error handling in async
    if grep -qE 'await\s+[^;]+;' "$file" 2>/dev/null && ! grep -q 'try\s*{' "$file" 2>/dev/null; then
        add_suggestion "$file" "error-handling" "Consider adding try-catch for async operations"
    fi

    # Synchronous fs operations
    if grep -qE '(readFileSync|writeFileSync|existsSync)' "$file" 2>/dev/null; then
        add_suggestion "$file" "performance" "Consider using async fs operations for better performance"
    fi

    # === LOW: Style & Optimization ===

    # Console.log (>2 occurrences)
    local console_count
    console_count=$(grep -c 'console.log' "$file" 2>/dev/null) || console_count=0
    if [ "$console_count" -gt 2 ]; then
        add_issue "$file" 0 "low" "logging" "Found $console_count console.log statements" "Use structured logger"
    fi

    # TODO/FIXME comments
    if grep -qiE '(TODO|FIXME|HACK|XXX):' "$file" 2>/dev/null; then
        add_suggestion "$file" "maintenance" "Contains TODO/FIXME comments that need attention"
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

# Output JSON
cat << EOF
{
  "version": "2.1.0",
  "scope": "$SCOPE",
  "path": "$PATH_TO_CHECK",
  "files_checked": $FILES_COUNT,
  "score": $SCORE,
  "summary": {
    "critical": $CRITICAL_COUNT,
    "high": $HIGH_COUNT,
    "medium": $MEDIUM_COUNT,
    "low": $LOW_COUNT,
    "total": $TOTAL_ISSUES
  },
  "vulnerabilities": {
    "critical": $VULN_CRITICAL,
    "high": $VULN_HIGH,
    "total": $VULN_TOTAL,
    "details": [$(IFS=','; echo "${VULNERABILITIES[*]}")]
  },
  "issues": [$(IFS=','; echo "${ISSUES[*]}")],
  "suggestions": [$(IFS=','; echo "${SUGGESTIONS[*]}")],
  "standards": "$STANDARDS_FILE",
  "recommendation": "$RECOMMENDATION"
}
EOF
