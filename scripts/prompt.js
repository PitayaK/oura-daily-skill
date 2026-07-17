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

function fact(label, value) {
  const v = fmt(value);
  return v !== null ? `${label}${v}` : null;
}

function describeTrend(stats, unit = '') {
  if (!stats || stats.count < 2) return null;
  const { avg, min, max, last } = stats;
  const diff = last - avg;
  const direction = diff > 0 ? '高' : diff < 0 ? '低' : '持平';
  return `最近 ${stats.count} 天平均 ${Math.round(avg * 10) / 10}${unit}，范围 ${min}${unit}–${max}${unit}，今天比平均 ${direction} ${Math.round(Math.abs(diff) * 10) / 10}${unit}`;
}

function buildPrompt(payload) {
  const { mode, config, date, targetDate, sleep, day, trends } = payload;
  const tone = TONE_INSTRUCTIONS[config.tone] || TONE_INSTRUCTIONS.friendly;
  const lang = config.language === 'zh' ? 'zh' : 'en';

  const system = `You are a health coach writing a daily brief for a busy person.
Your job is to read Oura Ring data and tell the user what their body is saying today.

Rules:
- Do NOT list numbers. Use them only to decide the conclusion.
- Answer in plain language: how did I sleep? how is my body today? what should I do?
- Classify the day into one of these states: 状态很好 / 状态正常 / 有点累 / 需要小心 / 明显透支.
- For sleep: 睡够了 / 勉强够 / 不够.
- Give ONE concrete action: 可以冲刺 / 正常安排 / 悠着点 / 多休息 / 今晚早睡.
- ${tone}
- Language: ${lang === 'zh' ? 'Chinese' : 'English'}`;

  let user;
  if (mode === 'morning') {
    const parts = [
      sleep ? `昨晚睡眠：${sleep.hours}小时，效率${sleep.efficiency}%，HRV ${sleep.hrv}ms，静息心率${sleep.restingHr}bpm。` : null,
      day ? `今早 readiness：${day.readinessScore}。` : null,
      describeTrend(trends.readiness),
      describeTrend(trends.hrv, 'ms'),
    ].filter(Boolean);

    user = [
      `今天是 ${date}，目标睡眠日是 ${targetDate}。`,
      ...parts,
      '',
      '请给出今天的身体状态判断、睡眠是否足够、以及一条建议。不要罗列数字。',
    ].join('\n');
  } else {
    const parts = [
      day ? `今日 readiness：${day.readinessScore}；步数${day.steps}，消耗${day.calories}kcal。` : null,
      sleep ? `昨晚睡眠：${sleep.hours}小时，效率${sleep.efficiency}%。` : null,
      describeTrend(trends.readiness),
      describeTrend(trends.steps),
      describeTrend(trends.hrv, 'ms'),
    ].filter(Boolean);

    user = [
      `今天是 ${date}。`,
      ...parts,
      '',
      '请判断今天身体消耗到了什么程度、现在该休息还是还能做事、以及今晚怎么安排。不要罗列数字。',
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
