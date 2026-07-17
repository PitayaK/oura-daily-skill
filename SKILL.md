---
name: oura-daily-skill
description: |
  Generate plain-language daily health briefs from Oura Ring data.

  When invoked (manually or by cron), the agent should:
  1. Load the environment variables from ~/.openclaw/oura-daily-skill.env.
  2. Run the appropriate skill script for the requested mode:
     - scripts/run.sh morning   -> generates a morning sleep brief
     - scripts/run.sh evening   -> generates an evening readiness/activity brief
  3. The script returns a system prompt + user prompt containing Oura data and trends.
  4. Use the local LLM to generate a concise, natural-language summary in the configured language and tone.
  5. If OURA_DELIVERY is "feishu" or "lark", send the summary to the configured Feishu/Lark user or chat.
     Otherwise, return the summary to the user.

  The report should answer, not enumerate data:
  - How did I sleep? / How is my body today?
  - Is there anything I should pay attention to?

  Avoid dumping raw Oura numbers. Use comparison to recent trends (7-day average) when available.
examples:
  - "每天早上 9 点给我发 Oura 睡眠报告"
  - "晚上 11 点半推送 Oura 身体状态总结"
  - "用严格风格生成今天的 Oura 晚报"
commands:
  - "cd ~/.agents/skills/oura-daily-skill && set -a; . ~/.openclaw/oura-daily-skill.env; set -a && ./scripts/run.sh morning"
  - "cd ~/.agents/skills/oura-daily-skill && set -a; . ~/.openclaw/oura-daily-skill.env; set -a && ./scripts/run.sh evening"
tags:
  - oura
  - health
  - sleep
  - wearable
  - daily-report
license: MIT
author: PitayaK
source: https://github.com/PitayaK/oura-daily-skill
---

# Oura Daily Skill

See [README.md](./README.md) for installation and configuration instructions.

## Runtime behavior

When the agent runs this skill, it should:

1. Load environment from `~/.openclaw/oura-daily-skill.env`.
2. Run `./scripts/run.sh morning` or `./scripts/run.sh evening`.
3. The script returns a `system` prompt and a `user` prompt with Oura data.
4. The agent uses its own LLM to generate the report in the configured tone and language.
5. The agent delivers the report via Feishu/Lark if configured, or returns it to the user.

The agent should not ask the user for clarification during a scheduled run unless the token is missing or the API fails.
