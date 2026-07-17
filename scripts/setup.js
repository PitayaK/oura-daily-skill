#!/usr/bin/env node
/**
 * oura-daily-skill / setup.js
 *
 * Interactive first-time setup.
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');

const HOME = process.env.HOME || '/root';
const ENV_PATH = path.join(HOME, '.openclaw', 'oura-daily-skill.env');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function ask(q, defaultValue) {
  return new Promise(resolve => {
    const prompt = defaultValue ? `${q} [${defaultValue}]: ` : `${q}: `;
    rl.question(prompt, ans => {
      resolve(ans.trim() || defaultValue);
    });
  });
}

async function main() {
  console.log('🧭 Oura Daily Skill Setup\n');
  console.log('Get your token at: https://cloud.ouraring.com/personal-access-tokens\n');

  const token = await ask('Oura personal access token');
  const timezone = await ask('Timezone', 'Asia/Shanghai');
  const morningTime = await ask('Morning report time (HHMM)', '0900');
  const eveningTime = await ask('Evening report time (HHMM)', '2330');
  const tone = await ask('Tone (concise/friendly/coach/strict)', 'friendly');
  const language = await ask('Language (zh/en)', 'zh');
  const delivery = await ask('Delivery channel (console/feishu/lark/email)', 'console');

  let receiveId = '';
  let receiveType = '';
  if (delivery === 'feishu' || delivery === 'lark') {
    receiveType = await ask('Receive ID type (open_id/chat_id)', 'open_id');
    receiveId = await ask('Receive ID');
  }

  const lines = [
    `OURA_TOKEN=${token}`,
    `OURA_TIMEZONE=${timezone}`,
    `OURA_MORNING_TIME=${morningTime}`,
    `OURA_EVENING_TIME=${eveningTime}`,
    `OURA_REPORT_TONE=${tone}`,
    `OURA_LANGUAGE=${language}`,
    `OURA_DELIVERY=${delivery}`,
  ];

  if (receiveType) lines.push(`FEISHU_RECEIVE_ID_TYPE=${receiveType}`);
  if (receiveId) lines.push(`FEISHU_RECEIVE_ID=${receiveId}`);

  fs.mkdirSync(path.dirname(ENV_PATH), { recursive: true });
  fs.writeFileSync(ENV_PATH, lines.join('\n') + '\n', 'utf-8');
  fs.chmodSync(ENV_PATH, 0o600);

  console.log(`\n✅ Config saved to ${ENV_PATH}`);
  console.log('Run `./scripts/run.sh morning` to test the morning report.');
  console.log('Run `./scripts/run.sh evening` to test the evening report.');

  rl.close();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
