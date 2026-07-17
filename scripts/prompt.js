#!/usr/bin/env node
/**
 * oura-daily-skill / prompt.js
 *
 * Turns Oura payload into a plain-language report prompt.
 */

const TONE_INSTRUCTIONS = {
  concise: 'Keep it to 2-3 short sentences. Give only the conclusion and one actionable note.',
  friendly: 'Write like a friend checking in. Warm, casual, one emoji allowed.',
  coach: 'Be encouraging but direct. Give clear do/don’t suggestions for the rest of the day or night.',
  strict: 'Be blunt and direct. If numbers are bad, say so without softening.',
};

function fmt(v) {
  if (v === undefined || v === null || v === '') return null;
  if (typeof v === 'number') return Math.round(v * 10) / 10;
  return v;
}

function describeWindow(stats, name, unit = '') {
  if (!stats || stats.count === 0) return null;
  return `${name}（${stats.count}天）：平均${fmt(stats.avg)}${unit}，范围${fmt(stats.min)}${unit}–${fmt(stats.max)}${unit}，最新${fmt(stats.last)}${unit}`;
}

function buildPrompt(payload) {
  const { mode, config, date, targetDate, sleep, day, trends } = payload;
  const tone = TONE_INSTRUCTIONS[config.tone] || TONE_INSTRUCTIONS.friendly;
  const lang = config.language === 'zh' ? 'zh' : 'en';

  const system = `You are a health coach writing a daily brief for a busy person.
Your job is to read Oura Ring data and tell the user what their body is telling them.

Rules:
- Do NOT just list numbers. Translate the data into what it means for the day.
- Compare today against the user's own 3-day, 7-day, and 21-day baselines.
- Identify the real issue: acute fatigue, chronic under-recovery, overreaching, or a good recovery day.
- Be direct. Avoid vague phrases like "a bit tired but not too bad".
- For morning: say whether the user is recovered or still paying off a sleep/recovery debt. If sleep is consistently short, say so plainly.
- For evening: say whether the day added more strain or was manageable. Give one clear recommendation for tonight.
- ${tone}
- Language: ${lang === 'zh' ? 'Chinese' : 'English'}`;

  const readinessTrends = [
    describeWindow(trends.readiness.d3, '近3天 readiness'),
    describeWindow(trends.readiness.d7, '近7天 readiness'),
    describeWindow(trends.readiness.baseline, '21天 baseline readiness'),
  ].filter(Boolean);

  const sleepTrends = [
    describeWindow(trends.sleepHours.d3, '近3天睡眠时长', '小时'),
    describeWindow(trends.sleepHours.d7, '近7天睡眠时长', '小时'),
    describeWindow(trends.sleepHours.baseline, '21天 baseline睡眠时长', '小时'),
  ].filter(Boolean);

  const hrvTrends = [
    describeWindow(trends.hrv.d3, '近3天 HRV', 'ms'),
    describeWindow(trends.hrv.d7, '近7天 HRV', 'ms'),
    describeWindow(trends.hrv.baseline, '21天 baseline HRV', 'ms'),
  ].filter(Boolean);

  let user;
  if (mode === 'morning') {
    const parts = [
      sleep ? `昨晚睡眠：${sleep.hours}小时，效率${sleep.efficiency}%，HRV ${sleep.hrv}ms，静息心率${sleep.restingHr}bpm。` : null,
      day ? `今早 readiness：${day.readinessScore}。` : null,
      ...sleepTrends,
      ...readinessTrends,
      ...hrvTrends,
    ].filter(Boolean);

    user = [
      `今天是 ${date}，目标睡眠日是 ${targetDate}。`,
      ...parts,
      '',
      '请直接告诉我：我今天的身体是什么问题？是恢复过来了，还是还在欠睡眠债？跟自己 21 天 baseline 相比，现在是什么位置？我需要怎么做？不要含糊。',
    ].join('\n');
  } else {
    const parts = [
      day ? `今日 readiness：${day.readinessScore}；步数${day.steps}，消耗${day.calories}kcal。` : null,
      sleep ? `昨晚睡眠：${sleep.hours}小时，效率${sleep.efficiency}%。` : null,
      ...readinessTrends,
      describeWindow(trends.steps.d3, '近3天步数'),
      describeWindow(trends.steps.d7, '近7天步数'),
      describeWindow(trends.steps.baseline, '21天 baseline步数'),
      ...hrvTrends,
    ].filter(Boolean);

    user = [
      `今天是 ${date}。`,
      ...parts,
      '',
      '请直接告诉我：今天身体是在透支还是可控？跟自己 21 天 baseline 相比，现在是什么位置？今晚应该怎么做？不要含糊。',
    ].join('\n');
  }

  return { system, user };
}

module.exports = { buildPrompt };

if (require.main === module) {
  let payload = '';
  process.stdin.on('data', chunk => payload += chunk);
  process.stdin.on('end', () => {
    const prompt = buildPrompt(JSON.parse(payload));
    console.log(JSON.stringify(prompt, null, 2));
  });
}
