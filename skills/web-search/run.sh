#!/bin/bash
# Web Search Skill Runner
# Usage: ./run.sh <query> [num_results] [site]

cd "$(dirname "$0")"

QUERY="$1"
NUM="${2:-10}"
SITE="$3"

if [ -z "$QUERY" ]; then
    echo '{"error": "Query is required"}'
    exit 1
fi

# Check if built
if [ ! -d "dist" ]; then
    echo "Building TypeScript..." >&2
    npm install --silent 2>/dev/null
    npm run build --silent 2>/dev/null
fi

# Run
if [ -d "dist" ]; then
    node dist/index.js "$QUERY" "$NUM" "$SITE"
else
    npx tsx src/index.ts "$QUERY" "$NUM" "$SITE"
fi
