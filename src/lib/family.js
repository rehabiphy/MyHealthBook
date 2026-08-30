import { kg1 } from './calc';
import { adherence, dayKey, hhmmToMin, refillLabel, refillsDue, slotOf } from './meds';

export const RELATIONS = ['Son', 'Daughter', 'Spouse', 'Sibling', 'Caregiver'];

export function weekWindow() {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - 6);
  const f = d => d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
  return { start, end, label: `${f(start)}–${f(end)}` };
}

const avg = a => (a.length ? Math.round(a.reduce((x, y) => x + y, 0) / a.length) : null);

export function missedDoses(data, days = 7) {
  const out = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = dayKey(d);
    const endOfDay = new Date(d).setHours(23, 59, 59, 999);
    const nowMin = new Date().getHours() * 60 + new Date().getMinutes();
    data.meds
      .filter(m => (m.status || 'active') === 'active')
      .forEach(med => {
        if (med.added > endOfDay) return;
        med.slots.forEach(sk => {
          const t = (data.medSettings?.times || {})[sk] || slotOf(sk).time;
          if (i === 0 && hhmmToMin(t) > nowMin) return;
          if (!data.taken?.[key]?.[`${med.id}|${sk}`])
            out.push(`${med.name}, ${slotOf(sk).label.toLowerCase()} on ${d.toLocaleDateString(undefined, { weekday: 'short' })}`);
        });
      });
  }
  return out;
}

export function buildWeekly(data) {
  const { label } = weekWindow();
  const since = Date.now() - 7 * 864e5;
  const bp = data.bp.filter(r => r.ts >= since);
  const sugar = data.sugar.filter(r => r.ts >= since);
  const body = data.body.filter(r => r.ts >= since);
  const ad = adherence(data, 7);
  const missed = missedDoses(data);
  const L = [];
  const who = data.profile.name || 'Weekly update';

  L.push(`${who} — weekly update`);
  L.push(label);
  L.push('');

  if (bp.length) {
    const high = bp.filter(r => r.sys >= 140 || r.dia >= 90);
    const worst = [...bp].sort((a, b) => b.sys - a.sys)[0];
    L.push(`Blood pressure: ${bp.length} reading${bp.length === 1 ? '' : 's'}, average ${avg(bp.map(r => r.sys))}/${avg(bp.map(r => r.dia))}.`);
    L.push(`Highest ${worst.sys}/${worst.dia} on ${new Date(worst.ts).toLocaleDateString(undefined, { weekday: 'long' })}.`);
    if (high.length) L.push(`${high.length} of ${bp.length} above 140/90.`);
  } else {
    L.push('Blood pressure: nothing recorded this week.');
  }
  L.push('');

  if (data.meds.length) {
    L.push(`Medicines: ${ad.done} of ${ad.due} doses taken${ad.pct != null ? ` (${ad.pct}%)` : ''}.`);
    if (missed.length) L.push(`Missed: ${missed.slice(0, 3).join('; ')}${missed.length > 3 ? `; +${missed.length - 3} more` : ''}.`);
    const low = refillsDue(data);
    if (low.length) L.push(`Running out: ${low.map(r => `${r.med.name} (${refillLabel(r.days).toLowerCase()})`).join(', ')}.`);
    L.push('');
  }

  if (body.length) {
    const latest = body[0],
      oldest = body[body.length - 1];
    const diff = +(latest.weightKg - oldest.weightKg).toFixed(1);
    L.push(`Weight: ${kg1(latest.weightKg)} kg${body.length > 1 ? ` (${diff > 0 ? '+' : ''}${diff} this week)` : ''}.`);
  }
  if (sugar.length) {
    const f = sugar.filter(r => r.kind === 'fasting');
    if (f.length) L.push(`Fasting sugar: average ${avg(f.map(r => r.mgdl))} mg/dL over ${f.length}.`);
  }
  if (body.length || sugar.length) L.push('');

  const flags = [];
  if (bp.filter(r => r.sys >= 140 || r.dia >= 90).length >= 3) flags.push('several readings above target');
  if (ad.pct != null && ad.pct < 80) flags.push('doses being missed');
  if (!bp.length) flags.push('no readings taken');
  if (refillsDue(data).length) flags.push('a medicine about to run out');
  if (flags.length) L.push(`Worth a call about: ${flags.join(', ')}.`);

  L.push('Measured at home. Not a diagnosis.');
  return L.join('\n');
}

/* Sunday by default. Due once the chosen day arrives and nothing has
   been sent since the start of that day. */
export function weeklyDue(data) {
  const care = data.care || {};
  if (!care.circle?.length) return false;
  const day = care.day ?? 0;
  const now = new Date();
  const lastDue = new Date();
  lastDue.setDate(now.getDate() - ((now.getDay() - day + 7) % 7));
  lastDue.setHours(0, 0, 0, 0);
  return care.circle.some(m => m.weekly && (!m.lastSent || m.lastSent < lastDue.getTime()));
}
