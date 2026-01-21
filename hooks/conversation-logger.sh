#!/bin/bash
# Conversation Logger Hook
# Logs user messages to daily JSONL file for CPO analysis
#
# This hook is triggered via Claude Code hooks system
# Set in ~/.claude/settings.json: "hooks": { "PreToolUse": [...] }

set -euo pipefail

# Get today's date
DATE=$(date +%Y-%m-%d)
TIMESTAMP=$(date -u +%Y-%m-%dT%H:%M:%SZ)

# Ensure log directory exists
LOG_DIR="/root/.claude/logs/daily/${DATE}"
mkdir -p "${LOG_DIR}"

LOG_FILE="${LOG_DIR}/conversations.jsonl"

# Read input from stdin (hook receives JSON)
INPUT=$(cat)

# Extract message if present
# Hook receives: { "tool": "...", "input": {...} }
# We want to log user messages, corrections, etc.

# For now, log everything for analysis
echo "{\"timestamp\":\"${TIMESTAMP}\",\"data\":${INPUT}}" >> "${LOG_FILE}"
