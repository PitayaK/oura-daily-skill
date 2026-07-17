name: oura-daily-skill
description: |
  Generate plain-language daily health briefs from Oura Ring data.

  Use this skill when the user wants to:
  - Receive a morning sleep summary from Oura
  - Receive an evening readiness/activity summary from Oura
  - Configure or customize Oura daily report timing, tone, or delivery channel
  - Set up a cron job for automated Oura briefs

  The skill fetches Oura API v2 data, compares it to recent trends, and returns
  a short, human-readable summary. It does not dump raw Oura numbers.

examples:
  - "每天晚上 11 点给我推一条 Oura 身体总结"
  - "早上 9 点告诉我昨晚睡得怎么样"
  - "把 Oura 报告 tone 改成严格风格"
  - "帮我设置 Oura daily skill"

commands:
  - "oura report morning"      # generate morning sleep brief now
  - "oura report evening"      # generate evening readiness brief now
  - "oura config"              # show current configuration
  - "oura cron setup"          # install cron jobs

tags:
  - oura
  - health
  - sleep
  - wearable
  - daily-report

license: MIT
author: PitayaK
source: https://github.com/PitayaK/oura-daily-skill
