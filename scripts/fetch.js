#!/usr/bin/env node
/**
 * oura-daily-skill / fetch.js
 *
 * Fetches Oura API v2 data and generates a JSON payload for the report.
 */

const fs = require('fs');
const path = require('path');

const BASE_URL = 'https://api.ouraring.com/v2/usercollection';

function loadEnv() {
  const envPaths = [
    path.join(process.env.HOME || '/root', '.openclaw', 'oura-daily-skill.env'),
    path.join(__dirname, '..', '.env'),
  ];
  for (const p of envPaths) {
    if (fs.existsSync(p)) {
      const lines = fs.readFileSync(p, 'utf-8').split('\n');
      for (const line of lines) {
        const m = line.match(/^([A-Za-z0-9_]+)\s*=\s*(.*)$/);
        if (m && process.env[m[1]] === undefined) {
          process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
        }
      }
      break;
    }
  }
}

function loadConfig() {
  return {
    token: process.env.OURA_TOKEN,
    timezone: process.env.OURA_TIMEZONE || 'Asia/Shanghai',
    tone: process.env.OURA_REPORT_TONE || 'friendly',
    language: process.env.OURA_LANGUAGE || 'zh',
  };
}

function fmtDate(d) {
  return d.toISOString().slice(0, 10);
}

function fmtDateCN(d) {
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
}

async function fetchOura(endpoint, token, startDate, endDate) {
  const url = new URL(`${BASE_URL}/${endpoint}`);
  url.searchParams.set('start_date', startDate);
  url.searchParams.set('end_date', endDate);
  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    throw new Error(`Oura ${endpoint} failed: ${res.status} ${await res.text()}`);
  }
  return await res.json();
}

function latest(list) {
  if (!Array.isArray(list) || list.length === 0) return null;
  return list[list.length - 1];
}

function average(values) {
  const nums = values.filter(v => typeof v === 'number');
  if (nums.length === 0) return null;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

function buildSleepSummary(data) {
  const s = data.sleep;
  if (!s) return null;
  const total = s.total_sleep_duration || s.duration || 0;
  const hours = Math.round((total / 3600) * 10) / 10;
  const efficiency = s.efficiency || 0;
  const score = s.score || s.sleep_score || 0;
  return {
    date: s.day,
    score,
    hours,
    efficiency,
    hrv: s.average_hrv,
    restingHr: s.resting_heart_rate,
    deep: s.deep_sleep_duration,
    rem: s.rem_sleep_duration,
    awake: s.awake_duration,
  };
}

function buildDaySummary(data) {
  const r = data.readiness;
  const a = data.activity;
  if (!r && !a) return null;
  return {
    date: (r || a).day,
    readinessScore: r?.score || r?.readiness_score,
    hrv: r?.average_hrv,
    restingHr: r?.resting_heart_rate,
    activityScore: a?.score,
    steps: a?.steps,
    calories: a?.total_calories,
    activeCalories: a?.active_calories,
    activity: a?.equivalent_walking_distance,
  };
}

async function main() {
  loadEnv();
  const config = loadConfig();
  if (!config.token) {
    throw new Error('OURA_TOKEN is not set. Create ~/.openclaw/oura-daily-skill.env');
  }

  const mode = process.argv[2] || 'morning'; // morning | evening

  const now = new Date();
  const today = fmtDate(now);
  const yesterday = fmtDate(new Date(now.getTime() - 86400000));
  const weekAgo = fmtDate(new Date(now.getTime() - 86400000 * 7));

  // For morning brief: report on yesterday's sleep and today's readiness.
  // For evening brief: report on today's readiness and activity.
  const sleepDate = mode === 'morning' ? yesterday : today;
  const readinessDate = today;
  const activityDate = today;

  const [sleep, readiness, activity] = await Promise.all([
    fetchOura('sleep', config.token, sleepDate, today).catch(() => ({ data: [] })),
    fetchOura('daily_readiness', config.token, weekAgo, today).catch(() => ({ data: [] })),
    fetchOura('daily_activity', config.token, weekAgo, today).catch(() => ({ data: [] })),
  ]);

  const sleepDoc = latest(sleep.data);
  const readinessDoc = latest(readiness.data);
  const activityDoc = latest(activity.data);

  const sleepData = sleepDoc ? buildSleepSummary({ sleep: sleepDoc }) : null;
  const dayData = buildDaySummary({
    readiness: readinessDoc,
    activity: activityDoc,
  });

  const hrvTrend = readiness.data
    .filter(d => d.average_hrv)
    .map(d => d.average_hrv);
  const readinessTrend = readiness.data
    .filter(d => d.score || d.readiness_score)
    .map(d => d.score || d.readiness_score);
  const sleepScoreTrend = sleep.data
    .filter(d => d.score || d.sleep_score)
    .map(d => d.score || d.sleep_score);

  const payload = {
    mode,
    config,
    date: today,
    targetDate: mode === 'morning' ? yesterday : today,
    sleep: sleepData,
    day: dayData,
    trends: {
      avgHrv: average(hrvTrend),
      avgReadiness: average(readinessTrend),
      avgSleepScore: average(sleepScoreTrend),
    },
  };

  console.log(JSON.stringify(payload, null, 2));
}

main().catch(err => {
  console.error(err.message);
  process.exit(1);
});
