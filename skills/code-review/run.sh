#!/bin/bash
# Code Review Skill v2.0
# AI-powered code review designed like an Anthropic CTO

PATH_TO_CHECK="${1:-.}"
SCOPE="${2:-changed}"

STANDARDS_FILE="/root/.claude/STANDARDS.md"
ISSUES=()
SUGGESTIONS=()
CRITICAL_COUNT=0
HIGH_COUNT=0
MEDIUM_COUNT=0
LOW_COUNT=0

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

    # === HIGH: Code Quality ===

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

    # === MEDIUM: Best Practices ===

    # var usage
    if grep -qE '^\s*var\s' "$file" 2>/dev/null; then
        add_issue "$file" 0 "medium" "modernization" "Using var instead of const/let" "Replace var with const/let"
    fi

    # Missing error handling in async
    if grep -qE 'await\s+[^;]+;' "$file" 2>/dev/null && ! grep -q 'try\s*{' "$file" 2>/dev/null; then
        add_suggestion "$file" "error-handling" "Consider adding try-catch for async operations"
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

# Calculate score
TOTAL_ISSUES=$((CRITICAL_COUNT + HIGH_COUNT + MEDIUM_COUNT + LOW_COUNT))
PENALTY=$((CRITICAL_COUNT * 20 + HIGH_COUNT * 10 + MEDIUM_COUNT * 5 + LOW_COUNT * 2))
SCORE=$((100 - PENALTY))
[ "$SCORE" -lt 0 ] && SCORE=0

# Build recommendation
if [ "$CRITICAL_COUNT" -gt 0 ]; then
    RECOMMENDATION="BLOCK: Fix critical issues before merge"
elif [ "$HIGH_COUNT" -gt 0 ]; then
    RECOMMENDATION="REVIEW: Address high-priority issues"
else
    RECOMMENDATION="APPROVE: Code meets quality standards"
fi

# Output JSON
cat << EOF
{
  "version": "2.0.0",
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
  "issues": [$(IFS=','; echo "${ISSUES[*]}")],
  "suggestions": [$(IFS=','; echo "${SUGGESTIONS[*]}")],
  "standards": "$STANDARDS_FILE",
  "recommendation": "$RECOMMENDATION"
}
EOF
