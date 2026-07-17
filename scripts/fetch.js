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

function daysAgo(n, from = new Date()) {
  return fmtDate(new Date(from.getTime() - 86400000 * n));
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

function trendStats(values, label = '') {
  const nums = values.filter(v => typeof v === 'number');
  if (nums.length === 0) return null;
  const avg = nums.reduce((a, b) => a + b, 0) / nums.length;
  const min = Math.min(...nums);
  const max = Math.max(...nums);
  const last = nums[nums.length - 1];
  return { avg, min, max, last, count: nums.length, label };
}

function windowStats(list, key, days, minValue = 0) {
  if (!Array.isArray(list)) return null;
  const values = list.slice(-days).map(d => d[key]).filter(v => typeof v === 'number' && v > minValue);
  return trendStats(values, `last${days}d`);
}

function baselineStats(list, key, minValue = 0) {
  if (!Array.isArray(list)) return null;
  const values = list.map(d => d[key]).filter(v => typeof v === 'number' && v > minValue);
  return trendStats(values, 'baseline21d');
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
  const yesterday = daysAgo(1, now);
  const threeWeeksAgo = daysAgo(21, now);

  const sleepDate = mode === 'morning' ? yesterday : today;
  const readinessDate = today;
  const activityDate = today;

  const [sleep, readiness, activity] = await Promise.all([
    fetchOura('sleep', config.token, threeWeeksAgo, today).catch(() => ({ data: [] })),
    fetchOura('daily_readiness', config.token, threeWeeksAgo, today).catch(() => ({ data: [] })),
    fetchOura('daily_activity', config.token, threeWeeksAgo, today).catch(() => ({ data: [] })),
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

  const payload = {
    mode,
    config,
    date: today,
    targetDate: sleepDate,
    sleep: sleepData,
    day: dayData,
    trends: {
      readiness: {
        d3: windowStats(readiness.data, 'score', 3) || windowStats(readiness.data, 'readiness_score', 3),
        d7: windowStats(readiness.data, 'score', 7) || windowStats(readiness.data, 'readiness_score', 7),
        baseline: baselineStats(readiness.data, 'score') || baselineStats(readiness.data, 'readiness_score'),
      },
      sleepScore: {
        d3: windowStats(sleep.data, 'score', 3) || windowStats(sleep.data, 'sleep_score', 3),
        d7: windowStats(sleep.data, 'score', 7) || windowStats(sleep.data, 'sleep_score', 7),
        baseline: baselineStats(sleep.data, 'score') || baselineStats(sleep.data, 'sleep_score'),
      },
      sleepHours: {
        d3: windowStats(sleep.data, 'total_sleep_duration', 3, 3600),
        d7: windowStats(sleep.data, 'total_sleep_duration', 7, 3600),
        baseline: baselineStats(sleep.data, 'total_sleep_duration', 3600),
      },
      hrv: {
        d3: windowStats(sleep.data, 'average_hrv', 3),
        d7: windowStats(sleep.data, 'average_hrv', 7),
        baseline: baselineStats(sleep.data, 'average_hrv'),
      },
      steps: {
        d3: windowStats(activity.data, 'steps', 3),
        d7: windowStats(activity.data, 'steps', 7),
        baseline: baselineStats(activity.data, 'steps'),
      },
    },
  };

  // Convert sleepHours from seconds to hours
  ['d3', 'd7', 'baseline'].forEach(k => {
    const s = payload.trends.sleepHours[k];
    if (s) {
      s.avg = Math.round((s.avg / 3600) * 10) / 10;
      s.min = Math.round((s.min / 3600) * 10) / 10;
      s.max = Math.round((s.max / 3600) * 10) / 10;
      s.last = Math.round((s.last / 3600) * 10) / 10;
    }
  });

  console.log(JSON.stringify(payload, null, 2));
}

main().catch(err => {
  console.error(err.message);
  process.exit(1);
});
