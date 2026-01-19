#!/bin/bash
# YouTube Transcript Skill
# Usage: ./run.sh <youtube_url> [languages]
# Languages: comma-separated, e.g., "ru,en"

cd "$(dirname "$0")"

URL="$1"
LANG="${2:-ru,en}"

if [ -z "$URL" ]; then
    echo '{"error": "URL is required"}'
    exit 1
fi

# Use Python script for reliable transcript extraction
python3 transcript.py "$URL" "$LANG"
