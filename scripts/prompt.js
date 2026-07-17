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

function buildPrompt(payload) {
  const { mode, config, date, targetDate, sleep, day, trends } = payload;
  const tone = TONE_INSTRUCTIONS[config.tone] || TONE_INSTRUCTIONS.friendly;
  const lang = config.language === 'zh' ? 'zh' : 'en';

  const system = `You are a health assistant. Your job is to summarize Oura Ring data in plain language.
Rules:
- Do NOT list raw numbers unless they help the story.
- Answer: How did I sleep? / How is my body today? / What should I notice?
- ${tone}
- Language: ${lang === 'zh' ? 'Chinese' : 'English'}`;

  let user;
  if (mode === 'morning') {
    const sleepParts = sleep ? [
      fact('睡眠评分：', sleep.score),
      fact('总睡眠：', sleep.hours + '小时'),
      fact('效率：', sleep.efficiency + '%'),
      fact('HRV：', sleep.hrv + 'ms'),
      fact('静息心率：', sleep.restingHr + 'bpm'),
    ].filter(Boolean) : [];

    const dayParts = day ? [
      fact('今日 readiness 评分：', day.readinessScore),
      fact('HRV：', day.hrv + 'ms'),
      fact('静息心率：', day.restingHr + 'bpm'),
    ].filter(Boolean) : [];

    const lines = [
      `今天是 ${date}，目标睡眠日是 ${targetDate}。`,
      sleepParts.length ? sleepParts.join('，') + '。' : '暂无昨晚睡眠数据。',
      dayParts.length ? dayParts.join('，') + '。' : '暂无今日 readiness 数据。',
      trends.avgSleepScore ? `近7天平均睡眠评分：${Math.round(trends.avgSleepScore)}。` : '',
      trends.avgReadiness ? `近7天平均 readiness：${Math.round(trends.avgReadiness)}。` : '',
    ].filter(Boolean);
    user = lines.join('\n') + '\n\n请生成一段简短的早晨睡眠报告。';
  } else {
    const dayParts = day ? [
      fact('今日 readiness 评分：', day.readinessScore),
      fact('步数：', day.steps),
      fact('消耗卡路里：', day.calories),
      fact('主动消耗：', day.activeCalories),
    ].filter(Boolean) : [];

    const lines = [
      `今天是 ${date}。`,
      dayParts.length ? dayParts.join('，') + '。' : '暂无今日 readiness 或活动数据。',
      sleep ? fact('昨晚睡眠评分：', sleep.score) + '。' : '',
      sleep ? fact('总睡眠：', sleep.hours + '小时') + '。' : '',
      trends.avgReadiness ? `近7天平均 readiness：${Math.round(trends.avgReadiness)}。` : '',
    ].filter(Boolean);
    user = lines.join('\n') + '\n\n请生成一段简短的晚间身体状态报告。';
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
