import User from '../models/User.js';
import Profile from '../models/Profile.js';
import BpReading from '../models/BpReading.js';
import SugarReading from '../models/SugarReading.js';
import BodyReading from '../models/BodyReading.js';
import Medicine from '../models/Medicine.js';
import DoseLog from '../models/DoseLog.js';
import { complete } from '../utils/llm.js';
import { notifyUser } from '../utils/push.js';

/* Once a day, each user with notifications gets one short health tip
   written for them: built from their own readings, how many doses they
   ticked off this week and what's running low, phrased by the LLM. If
   the LLM isn't configured or fails, a plain rule-based tip goes out
   instead — a tip should never silently not arrive.

   Timing is by the user's own clock (tzOffsetMin, reported by the phone
   with its FCM token; India assumed until it has). The "claim" on
   healthTipDay is atomic, so a restart or a second server instance
   can't send the same day twice. */

export const HEALTH_TIP_CHANNEL = 'daily_health_tip'; // created by the app — src/lib/notifications.js
const SEND_FROM_HOUR = 10; // local time: late enough not to wake anyone…
const SEND_UNTIL_HOUR = 20; // …and if the server was down all day, skip rather than tip at midnight
const TICK_MS = 10 * 60 * 1000;
const DEFAULT_TZ_MIN = 330; // IST
const DAY_MS = 24 * 60 * 60 * 1000;

// the user's local wall-clock time, as a Date whose UTC fields read as local
const localNow = user => new Date(Date.now() + (user.tzOffsetMin ?? DEFAULT_TZ_MIN) * 60 * 1000);
const dayKeyOf = d => d.toISOString().slice(0, 10); // matches the app's dayKey() for a "local as UTC" date
const daysAgo = ts => Math.max(0, Math.floor((Date.now() - ts) / DAY_MS));
const agoText = ts => {
  const n = daysAgo(ts);
  return n === 0 ? 'today' : n === 1 ? 'yesterday' : `${n} days ago`;
};
const firstName = s => String(s || '').trim().split(/\s+/)[0] || '';

/* The facts about this user the tip may use — each one plain and
   checkable, so the model has nothing to invent from. */
async function tipFacts(user) {
  const userId = user._id;
  const [profile, bp, sugar, body, meds] = await Promise.all([
    Profile.findOne({ userId }).lean(),
    BpReading.find({ userId }).sort({ ts: -1 }).limit(7).lean(),
    SugarReading.find({ userId }).sort({ ts: -1 }).limit(7).lean(),
    BodyReading.find({ userId }).sort({ ts: -1 }).limit(4).lean(),
    Medicine.find({ userId, status: 'active' }).lean(),
  ]);

  // dose adherence over the 7 local days before today (today isn't over yet)
  const today = localNow(user);
  const days = Array.from({ length: 7 }, (_, i) => dayKeyOf(new Date(today.getTime() - (i + 1) * DAY_MS)));
  const logs = meds.length ? await DoseLog.find({ userId, day: { $in: days } }, 'day').lean() : [];
  let due = 0;
  for (const day of days) {
    const endOfDay = Date.parse(`${day}T23:59:59Z`) - (user.tzOffsetMin ?? DEFAULT_TZ_MIN) * 60 * 1000;
    for (const m of meds) if (m.added <= endOfDay) due += m.slots?.length || 0;
  }
  const taken = Math.min(logs.length, due);

  // same calendar burn-down the app uses (src/lib/meds.js daysLeft)
  const low = meds
    .map(m => {
      const per = (m.slots?.length || 0) * (m.perDose || 1);
      if (m.stock == null || !m.stockedAt || per <= 0) return null;
      const left = Math.max(0, m.stock - per * daysAgo(m.stockedAt));
      return { name: m.name, days: Math.floor(left / per) };
    })
    .filter(x => x && x.days <= 3);

  const name = firstName(profile?.name || user.name);
  const facts = [];
  if (profile?.age) facts.push(`Age ${profile.age}${profile.sex ? `, ${profile.sex}` : ''}.`);
  if (profile?.health?.conditions?.length) facts.push(`Conditions they recorded: ${profile.health.conditions.join(', ')}.`);
  if (bp.length) facts.push(`Blood pressure, newest first: ${bp.map(r => `${r.sys}/${r.dia} (${agoText(r.ts)})`).join('; ')}.`);
  else facts.push('No blood pressure readings recorded yet.');
  if (sugar.length) facts.push(`Blood sugar, newest first: ${sugar.map(r => `${r.mgdl} mg/dL ${r.kind === 'fasting' ? 'fasting' : 'after a meal'} (${agoText(r.ts)})`).join('; ')}.`);
  if (body.length) facts.push(`Weight, newest first: ${body.map(r => `${r.weightKg} kg (${agoText(r.ts)})`).join('; ')}.`);
  if (meds.length) {
    facts.push(`Active medicines: ${meds.map(m => m.name).join(', ')}.`);
    if (due) facts.push(`Marked ${taken} of ${due} scheduled doses as taken over the last 7 days.`);
  }
  if (low.length) facts.push(`Running low: ${low.map(l => (l.days <= 0 ? `${l.name} (out)` : `${l.name} (${l.days} day${l.days === 1 ? '' : 's'} left)`)).join(', ')}.`);

  return { name, facts, bp, sugar, meds, due, taken, low };
}

const TIP_SCHEMA = {
  name: 'health_tip',
  schema: {
    type: 'object',
    properties: {
      title: { type: 'string', description: 'Notification title, at most 45 characters' },
      body: { type: 'string', description: 'Notification body, at most 150 characters' },
    },
    required: ['title', 'body'],
    additionalProperties: false,
  },
};

const SYSTEM_PROMPT = `You write the one daily push notification for MyHealthBook, a personal health record app used by Indian families, often older adults.

Write ONE short, warm, specific tip for this person, based only on the facts given. Pick the single most useful thing:
- a medicine running low → remind them to refill
- doses being missed → gentle encouragement about routine (never guilt)
- no reading for a few days → invite a quick check
- a trend in their own numbers → notice it plainly and encouragingly
- otherwise → one practical everyday habit (walking, water, salt, sleep, food suited to India)

Rules:
- You are not a doctor. Never diagnose, never name a disease they haven't recorded, never suggest starting, stopping or changing a medicine or its dose.
- If a reading is very high or very low, calmly suggest checking with their doctor — no alarming words.
- Use their first name at most once. Simple English, no jargon, no hashtags, at most one emoji.
- Title at most 45 characters, body at most 150 characters.
- Don't repeat the previous tip.`;

/* The tip without the LLM: the same priorities, fixed wording. */
function ruleTip({ name, bp, meds, due, taken, low }) {
  const hi = name ? `${name}, ` : '';
  if (low.length) {
    const l = low[0];
    return l.days <= 0
      ? { title: `Refill ${l.name}`, body: `${hi}by our count you're out of ${l.name}. Refill it today so you don't miss a dose.` }
      : { title: `${l.name} is running low`, body: `${hi}about ${l.days} day${l.days === 1 ? '' : 's'} of ${l.name} left. A good time to reorder.` };
  }
  if (due >= 4 && taken / due < 0.8) {
    return { title: 'Keeping up with your medicines', body: `${hi}you marked ${taken} of ${due} doses this week. Taking them at the same time each day makes it easier.` };
  }
  if (!bp.length) return { title: 'Start your health record', body: `${hi}log your first blood pressure reading today — it takes under a minute.` };
  if (daysAgo(bp[0].ts) >= 3) return { title: 'Time for a BP check', body: `${hi}your last blood pressure reading was ${agoText(bp[0].ts)}. Sit for 5 minutes, then measure.` };
  const habits = [
    { title: 'A short walk helps', body: `${hi}a 20-minute walk after a meal helps both blood sugar and blood pressure.` },
    { title: 'Easy on the salt', body: `${hi}less salt, pickle and papad is one of the simplest ways to help your blood pressure.` },
    { title: 'Drink enough water', body: `${hi}keep a bottle nearby and sip through the day, unless your doctor has limited your fluids.` },
    { title: 'Sleep matters too', body: `${hi}7–8 hours of sleep helps keep blood pressure and sugar steady.` },
  ];
  return habits[new Date().getDate() % habits.length];
}

const clip = (s, n) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s);

/** Writes today's tip for one user, without sending it. Returns { title, body, ai }. */
export async function writeHealthTip(user) {
  const f = await tipFacts(user);
  let tip;
  let ai = false;
  try {
    const out = await complete({
      temperature: 0.8,
      jsonSchema: TIP_SCHEMA,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        {
          role: 'user',
          content: `First name: ${f.name || '(unknown)'}\nToday: ${localNow(user).toUTCString().slice(0, 16)}\n\nFacts:\n${f.facts.join('\n')}\n\nPrevious tip: ${user.healthTipLast || '(none)'}`,
        },
      ],
    });
    if (out?.title?.trim() && out?.body?.trim()) {
      tip = { title: out.title.trim(), body: out.body.trim() };
      ai = true;
    }
  } catch (err) {
    console.warn('Health tip: AI unavailable, using a rule-based tip —', err.message);
  }
  if (!tip) tip = ruleTip(f);
  return { title: clip(tip.title, 60), body: clip(tip.body, 180), ai };
}

/** Writes and sends today's tip to one user. Returns { title, body, ai, sent }. */
export async function sendHealthTip(user) {
  const tip = await writeHealthTip(user);
  const sent = await notifyUser(user, { title: tip.title, body: tip.body, channelId: HEALTH_TIP_CHANNEL, data: { type: 'health_tip', ai: tip.ai ? '1' : '0' } });
  await User.updateOne({ _id: user._id }, { $set: { healthTipLast: `${tip.title} — ${tip.body}` } });
  return { ...tip, sent };
}

async function tick() {
  const users = await User.find(
    { healthTips: { $ne: false }, 'fcmTokens.0': { $exists: true } },
    'name fcmTokens tzOffsetMin healthTipDay healthTipLast',
  ).lean();

  for (const u of users) {
    const local = localNow(u);
    const hour = local.getUTCHours();
    const day = dayKeyOf(local);
    if (hour < SEND_FROM_HOUR || hour >= SEND_UNTIL_HOUR || u.healthTipDay === day) continue;
    // claim today first, so a crash mid-send can't turn into a second tip later
    const claimed = await User.updateOne({ _id: u._id, healthTipDay: { $ne: day } }, { $set: { healthTipDay: day } });
    if (!claimed.modifiedCount) continue;
    try {
      await sendHealthTip(u);
    } catch (err) {
      console.warn('Health tip failed for', u._id.toString(), '—', err.message);
    }
  }
}

let timer = null;

/* Starts the daily health-tip loop (called once from index.js). Opt-in
   with HEALTH_TIPS_ENABLED=true: a dev server pointed at the real
   database would otherwise tip every real user too. The "send me a tip
   now" button works either way — it only reaches the person pressing it. */
export function startHealthTips() {
  if (timer) return;
  if (process.env.HEALTH_TIPS_ENABLED !== 'true') {
    console.log('Daily health tips are off on this server (set HEALTH_TIPS_ENABLED=true to send them).');
    return;
  }
  const run = () => tick().catch(err => console.warn('Health tips tick failed:', err.message));
  setTimeout(run, 30 * 1000); // shortly after boot, not in the middle of it
  timer = setInterval(run, TICK_MS);
}
