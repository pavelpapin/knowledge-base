#!/bin/bash
# Person Research Skill
# Usage: ./run.sh <name> [context]
# Note: This is a stub - requires web search API integration

set -e

NAME="$1"
CONTEXT="${2:-}"

if [ -z "$NAME" ]; then
    echo '{"error": "Name is required"}' >&2
    exit 1
fi

# Build search query
QUERY="$NAME"
if [ -n "$CONTEXT" ]; then
    QUERY="$NAME $CONTEXT"
fi

# Output structure (to be filled by Claude with web search)
cat << EOF
{
  "query": "$QUERY",
  "status": "requires_claude",
  "instruction": "Use web search to find information about: $QUERY. Look for LinkedIn, Twitter, GitHub profiles. Summarize findings.",
  "profile": {
    "name": "$NAME",
    "context": "$CONTEXT"
  }
}
EOF
