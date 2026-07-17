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

function byDay(list, day) {
  if (!Array.isArray(list)) return null;
  return list.find(d => d.day === day) || null;
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

function trendStats(values) {
  const nums = values.filter(v => typeof v === 'number');
  if (nums.length === 0) return null;
  const avg = nums.reduce((a, b) => a + b, 0) / nums.length;
  const min = Math.min(...nums);
  const max = Math.max(...nums);
  const last = nums[nums.length - 1];
  const first = nums[0];
  return { avg, min, max, last, first, count: nums.length };
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

  const sleepDate = mode === 'morning' ? yesterday : today;
  const readinessDate = today;
  const activityDate = today;

  const [sleep, readiness, activity] = await Promise.all([
    fetchOura('sleep', config.token, weekAgo, today).catch(() => ({ data: [] })),
    fetchOura('daily_readiness', config.token, weekAgo, today).catch(() => ({ data: [] })),
    fetchOura('daily_activity', config.token, weekAgo, today).catch(() => ({ data: [] })),
  ]);

  const sleepDoc = byDay(sleep.data, sleepDate) || latest(sleep.data);
  const readinessDoc = byDay(readiness.data, readinessDate) || latest(readiness.data);
  const activityDoc = byDay(activity.data, activityDate) || latest(activity.data);

  const sleepData = sleepDoc ? {
    date: sleepDoc.day,
    score: sleepDoc.score || sleepDoc.sleep_score || 0,
    hours: Math.round(((sleepDoc.total_sleep_duration || sleepDoc.duration || 0) / 3600) * 10) / 10,
    efficiency: sleepDoc.efficiency || 0,
    hrv: sleepDoc.average_hrv,
    restingHr: sleepDoc.lowest_heart_rate || sleepDoc.resting_heart_rate,
    deep: sleepDoc.deep_sleep_duration,
    rem: sleepDoc.rem_sleep_duration,
    awake: sleepDoc.awake_time || sleepDoc.awake_duration,
  } : null;

  const dayData = (readinessDoc || activityDoc) ? {
    date: readinessDate,
    readinessScore: readinessDoc?.score || readinessDoc?.readiness_score,
    hrv: mode === 'morning' ? sleepData?.hrv : undefined,
    restingHr: mode === 'morning' ? sleepData?.restingHr : undefined,
    activityScore: activityDoc?.score,
    steps: activityDoc?.steps,
    calories: activityDoc?.total_calories,
    activeCalories: activityDoc?.active_calories,
    activity: activityDoc?.equivalent_walking_distance,
  } : null;

  const readinessScores = readiness.data
    .filter(d => d.score || d.readiness_score)
    .map(d => d.score || d.readiness_score);
  const sleepScores = sleep.data
    .filter(d => d.score || d.sleep_score)
    .map(d => d.score || d.sleep_score);
  const hrvValues = sleep.data
    .filter(d => d.average_hrv)
    .map(d => d.average_hrv);
  const stepsValues = activity.data
    .filter(d => d.steps)
    .map(d => d.steps);

  const payload = {
    mode,
    config,
    date: today,
    targetDate: sleepDate,
    sleep: sleepData,
    day: dayData,
    trends: {
      readiness: trendStats(readinessScores),
      sleepScore: trendStats(sleepScores),
      hrv: trendStats(hrvValues),
      steps: trendStats(stepsValues),
    },
  };

  console.log(JSON.stringify(payload, null, 2));
}

main().catch(err => {
  console.error(err.message);
  process.exit(1);
});
