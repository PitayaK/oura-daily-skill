#!/bin/bash
# oura-daily-skill / scripts/run.sh
#
# Usage: ./run.sh [morning|evening]
# Generates an Oura daily brief and prints it to stdout.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
MODE="${1:-morning}"

# Load env from ~/.openclaw/oura-daily-skill.env if it exists
ENV_FILE="${HOME}/.openclaw/oura-daily-skill.env"
if [ -f "$ENV_FILE" ]; then
  set -a
  # shellcheck source=/dev/null
  . "$ENV_FILE"
  set +a
fi

# Fetch raw data
PAYLOAD=$("${SCRIPT_DIR}/fetch.js" "$MODE")

# Build prompt
PROMPT=$(echo "$PAYLOAD" | node "${SCRIPT_DIR}/prompt.js")

# Generate report via LLM (fallback to OpenClaw if available, otherwise print prompt)
if command -v openclaw >/dev/null 2>&1; then
  REPORT=$(echo "$PROMPT" | openclaw run-prompt --stdin 2>/dev/null || echo "")
fi

if [ -z "${REPORT:-}" ]; then
  # Fallback: print prompt for manual feeding
  echo "$PROMPT"
  exit 0
fi

echo "$REPORT"

# Deliver if configured
DELIVERY="${OURA_DELIVERY:-console}"
if [ "$DELIVERY" = "console" ]; then
  exit 0
fi

# Feishu delivery example
if [ "$DELIVERY" = "feishu" ] && [ -n "${FEISHU_RECEIVE_ID:-}" ] && [ -n "${FEISHU_RECEIVE_ID_TYPE:-}" ]; then
  openclaw message send \
    --target "${FEISHU_RECEIVE_ID_TYPE}:${FEISHU_RECEIVE_ID}" \
    --message "$REPORT" \
    >/dev/null 2>&1 || echo "Failed to send Feishu message"
fi
