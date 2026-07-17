#!/bin/bash
# oura-daily-skill / scripts/run.sh
#
# Usage: ./run.sh [morning|evening]
#
# Fetches Oura data and generates a plain-text prompt that can be sent to any
# LLM or agent. In console mode it prints the prompt; in delivery mode it is
# typically invoked by an OpenClaw cron job that turns the prompt into a
# natural-language report and sends it to the user.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
MODE="${1:-morning}"

ENV_FILE="${HOME}/.openclaw/oura-daily-skill.env"
if [ -f "$ENV_FILE" ]; then
  set -a
  # shellcheck source=/dev/null
  . "$ENV_FILE"
  set +a
fi

PAYLOAD="$(${SCRIPT_DIR}/fetch.js "$MODE")"
PROMPT="$(echo "$PAYLOAD" | node "${SCRIPT_DIR}/prompt.js")"

USER_TEXT="$(echo "$PROMPT" | python3 -c 'import json,sys; print(json.load(sys.stdin)["user"])')"
SYSTEM_TEXT="$(echo "$PROMPT" | python3 -c 'import json,sys; print(json.load(sys.stdin)["system"])')"

cat <<EOF
${SYSTEM_TEXT}

${USER_TEXT}
EOF
