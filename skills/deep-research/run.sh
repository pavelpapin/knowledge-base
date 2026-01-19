#!/bin/bash
# Deep Research Agent Runner
# Usage: ./run.sh <topic> [depth] [output]

cd "$(dirname "$0")"

TOPIC="$1"
DEPTH="${2:-medium}"
OUTPUT="${3:-markdown}"

if [ -z "$TOPIC" ]; then
    echo '{"error": "Topic is required"}'
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
    node dist/index.js "$TOPIC" "$DEPTH" "$OUTPUT"
else
    npx tsx src/index.ts "$TOPIC" "$DEPTH" "$OUTPUT"
fi
