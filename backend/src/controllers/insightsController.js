import User from '../models/User.js';
import BpReading from '../models/BpReading.js';
import BodyReading from '../models/BodyReading.js';
import SugarReading from '../models/SugarReading.js';
import Medicine from '../models/Medicine.js';
import { isPremium } from '../utils/subscription.js';

const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';
const FREE_LIMIT = 3;
const LOOKBACK_MS = 90 * 24 * 60 * 60 * 1000;
const MAX_POINTS = 60;

function monthKey() {
  return new Date().toISOString().slice(0, 7);
}

function fmtDate(ts) {
  return new Date(ts).toISOString().slice(0, 10);
}

/* Windowed sibling of coachController.buildAccountContext — that one
   summarizes the latest reading only, this one describes a 90-day
   trend so the model can talk about direction/stability instead of a
   single point-in-time snapshot. Built entirely from what's on record
   for this user — never from anything the client sends. */
async function buildTrendContext(userId) {
  const since = Date.now() - LOOKBACK_MS;
  const [bp, sugar, body, activeMeds] = await Promise.all([
    BpReading.find({ userId, ts: { $gte: since } }).sort({ ts: 1 }),
    SugarReading.find({ userId, ts: { $gte: since } }).sort({ ts: 1 }),
    BodyReading.find({ userId, ts: { $gte: since } }).sort({ ts: 1 }),
    Medicine.find({ userId, status: 'active' }),
  ]);

  const parts = [];

  if (bp.length) {
    const points = bp.slice(-MAX_POINTS).map(r => `${fmtDate(r.ts)} ${r.sys}/${r.dia}${r.pulse ? ` (pulse ${r.pulse})` : ''}`);
    parts.push(`Blood pressure readings over the last 90 days (${bp.length} total):\n${points.join('\n')}`);
  } else {
    parts.push('No blood pressure readings in the last 90 days.');
  }

  if (sugar.length) {
    const points = sugar.slice(-MAX_POINTS).map(r => `${fmtDate(r.ts)} ${r.mgdl} mg/dL (${r.kind === 'fasting' ? 'fasting' : 'post-meal'})`);
    parts.push(`Blood glucose readings over the last 90 days (${sugar.length} total):\n${points.join('\n')}`);
  } else {
    parts.push('No blood glucose readings in the last 90 days.');
  }

  if (body.length) {
    const points = body.slice(-MAX_POINTS).map(r => `${fmtDate(r.ts)} ${r.weightKg} kg`);
    parts.push(`Weight readings over the last 90 days (${body.length} total):\n${points.join('\n')}`);
  } else {
    parts.push('No weight readings in the last 90 days.');
  }

  parts.push(
    activeMeds.length
      ? `${activeMeds.length} active medicine${activeMeds.length === 1 ? '' : 's'}: ${activeMeds.map(m => m.name).join(', ')}.`
      : 'No active medicines on record.',
  );

  return parts.join('\n\n');
}

const SYSTEM_PROMPT = context =>
  `You are the AI health insights engine embedded in the MyHealthBook app. You analyze the trend in a user's own recorded blood pressure, blood glucose and weight readings over the last 90 days and explain what's changed in plain language. You are NOT a doctor: never diagnose, never prescribe or suggest changing a medicine — encourage seeing a real doctor for anything concerning. For each metric that has data, say whether it's improving, worsening or stable, then give 2-4 short, practical takeaways. Keep it concise.\n\nWhat's on record for this user over the last 90 days:\n\n${context}`;

export async function generateInsights(req, res) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ success: false, message: "AI Insights isn't configured yet — ask the app owner to add an OpenAI API key." });
  }

  let user = await User.findById(req.user.id);
  if (!user) return res.status(404).json({ success: false, message: 'User not found' });

  const premium = isPremium(user);
  const key = monthKey();

  if (!premium) {
    if (user.insightsMonthKey !== key) {
      user = await User.findByIdAndUpdate(user._id, { insightsMonthKey: key, insightsUsedThisMonth: 0 }, { new: true });
    }
    if (user.insightsUsedThisMonth >= FREE_LIMIT) {
      return res.status(403).json({ success: false, quotaExceeded: true, message: `You've used your ${FREE_LIMIT} free insights this month. Upgrade to Premium for unlimited access.` });
    }
    // Atomic increment, re-checked in the filter — closes the race between
    // the read above and this write (e.g. two concurrent taps).
    user = await User.findOneAndUpdate(
      { _id: user._id, insightsMonthKey: key, insightsUsedThisMonth: { $lt: FREE_LIMIT } },
      { $inc: { insightsUsedThisMonth: 1 } },
      { new: true },
    );
    if (!user) {
      return res.status(403).json({ success: false, quotaExceeded: true, message: 'Free limit reached for this month.' });
    }
  }

  const context = await buildTrendContext(req.user.id);

  const response = await fetch(OPENAI_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || 'gpt-4.1-nano',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT(context) },
        { role: 'user', content: 'Analyze my recent health trends.' },
      ],
      temperature: 0.6,
    }),
  });

  if (!response.ok) {
    const errBody = await response.text().catch(() => '');
    console.error('OpenAI request failed:', response.status, errBody);
    return res.status(502).json({ success: false, message: "AI Insights couldn't respond right now. Please try again." });
  }

  const json = await response.json();
  const reply = json.choices?.[0]?.message?.content?.trim();
  if (!reply) {
    return res.status(502).json({ success: false, message: "AI Insights couldn't respond right now. Please try again." });
  }

  return res.json({
    success: true,
    insights: reply,
    usage: premium ? { unlimited: true } : { used: user.insightsUsedThisMonth, limit: FREE_LIMIT },
  });
}
