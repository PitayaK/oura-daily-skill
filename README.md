# oura-daily-skill

A universal OpenClaw skill that turns your Oura Ring data into plain-language daily briefs.

## What it does

Fetches your Oura Ring data and pushes short, personalized health briefs at two configurable times:

- **Morning brief** (default 09:00): "How did you sleep last night?"
- **Evening brief** (default 23:30): "How is your body doing today?"

The reports are intentionally not a dump of Oura app numbers. They answer:

- Is my body ready / recovered / overloaded?
- Did I sleep well enough?
- Is there anything I should pay attention to today / tonight?

## Features

- Oura API v2
- Two daily briefs (sleep + daytime readiness)
- Configurable schedule
- Configurable delivery channel (Feishu, Lark, email, or console)
- Configurable tone: concise, friendly, coach, strict
- Works for any Oura user, not just the skill author

## Install

### 1. Get an Oura personal access token

Go to https://cloud.ouraring.com/personal-access-tokens and create a token.

### 2. Install the skill

```bash
cd ~/.openclaw/workspace/skills
npx skills add https://github.com/PitayaK/oura-daily-skill.git
# or copy this repo into ~/.openclaw/workspace/skills/oura-daily-skill
```

### 3. Configure

Create `~/.openclaw/oura-daily-skill.env`:

```bash
OURA_TOKEN=your_oura_personal_access_token
OURA_TIMEZONE=Asia/Shanghai
OURA_MORNING_TIME=0900
OURA_EVENING_TIME=2330
OURA_REPORT_TONE=friendly
OURA_LANGUAGE=zh

# Delivery: feishu|lark|email|console
OURA_DELIVERY=feishu

# For Feishu/Lark delivery (optional if your OpenClaw already binds to a channel)
FEISHU_RECEIVE_ID=your_open_id_or_chat_id
FEISHU_RECEIVE_ID_TYPE=open_id
```

### 4. Add cron jobs

```bash
# Edit crontab
0 9 * * * cd ~/.openclaw/workspace/skills/oura-daily-skill && ./scripts/run.sh morning
30 23 * * * cd ~/.openclaw/workspace/skills/oura-daily-skill && ./scripts/run.sh evening
```

Or use OpenClaw cron:

```bash
openclaw cron add --name oura-morning --schedule "0 9 * * *" --command "..."
openclaw cron add --name oura-evening --schedule "30 23 * * *" --command "..."
```

## Usage

Run manually:

```bash
./scripts/run.sh morning
./scripts/run.sh evening
```

## Tone presets

- `concise` — 2-3 句话，只给结论
- `friendly` — 像朋友聊天
- `coach` — 教练式，建议明确
- `strict` — 直接指出问题

## How the report works

1. Fetches `daily_sleep`, `daily_readiness`, and `daily_activity` for the target date.
2. Compares key metrics against a 7-day rolling average (if cached locally).
3. Generates a short narrative summary via LLM prompt.
4. Sends to the configured channel.

## Privacy

- The Oura token is stored locally in `~/.openclaw/oura-daily-skill.env`.
- No data is sent to the skill author.
- Oura data is only used to generate the brief.

## License

MIT

## Author

@PitayaK
