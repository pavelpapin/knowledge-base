#!/bin/bash
# Code Review Skill
# Analyzes code against Elio standards

PATH_TO_CHECK="${1:-.}"

# Find files
if [ -d "$PATH_TO_CHECK" ]; then
    FILES=$(find "$PATH_TO_CHECK" -name "*.ts" -o -name "*.js" | grep -v node_modules | grep -v dist)
else
    FILES="$PATH_TO_CHECK"
fi

ISSUES=()
SUGGESTIONS=()

# Check each file
for file in $FILES; do
    if [ ! -f "$file" ]; then continue; fi

    LINES=$(wc -l < "$file")
    FILENAME=$(basename "$file")

    # Check file size (max 200 lines)
    if [ "$LINES" -gt 200 ]; then
        ISSUES+=("{\"file\": \"$file\", \"issue\": \"file_too_large\", \"lines\": $LINES, \"max\": 200}")
    fi

    # Check for 'any' type usage
    ANY_COUNT=$(grep -c ': any' "$file" 2>/dev/null || echo 0)
    if [ "$ANY_COUNT" -gt 0 ]; then
        ISSUES+=("{\"file\": \"$file\", \"issue\": \"any_type_used\", \"count\": $ANY_COUNT}")
    fi

    # Check for console.log
    CONSOLE_COUNT=$(grep -c 'console.log' "$file" 2>/dev/null || echo 0)
    if [ "$CONSOLE_COUNT" -gt 2 ]; then
        SUGGESTIONS+=("{\"file\": \"$file\", \"suggestion\": \"replace_console_with_logger\", \"count\": $CONSOLE_COUNT}")
    fi

    # Check for var usage
    VAR_COUNT=$(grep -cE '^\s*var ' "$file" 2>/dev/null || echo 0)
    if [ "$VAR_COUNT" -gt 0 ]; then
        ISSUES+=("{\"file\": \"$file\", \"issue\": \"var_used\", \"count\": $VAR_COUNT}")
    fi
done

# Output JSON
echo "{"
echo "  \"path\": \"$PATH_TO_CHECK\","
echo "  \"files_checked\": $(echo "$FILES" | wc -w),"
echo "  \"issues\": ["
printf '%s\n' "${ISSUES[@]}" | paste -sd ',' -
echo "  ],"
echo "  \"suggestions\": ["
printf '%s\n' "${SUGGESTIONS[@]}" | paste -sd ',' -
echo "  ],"
echo "  \"instruction\": \"Review these issues and fix them according to /root/.claude/STANDARDS.md\""
echo "}"
