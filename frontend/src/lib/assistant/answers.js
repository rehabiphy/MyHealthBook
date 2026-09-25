import { dosesToday, isTaken, prettyTime, dayKey } from '../meds';
import { SLOTS_IN_GROUP } from './parse';

/* Answers MyHealth AI gives from data already on the phone — no LLM,
   no network. Each returns { say, lines?, tone? } for the overlay. */

const nowMin = () => new Date().getHours() * 60 + new Date().getMinutes();
const avg = xs => Math.round(xs.reduce((a, b) => a + b, 0) / xs.length);
const clock = ts => new Date(ts).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

const GROUP_LABEL = { morning: 'morning', afternoon: 'afternoon', tonight: 'tonight', bedtime: 'bedtime' };

const doseLine = (data, d) =>
  `${d.med.name}${d.med.dose ? ` ${d.med.dose}` : ''} · ${prettyTime(d.time)}${isTaken(data, d.id) ? ' · ✓ taken' : ''}`;

/* Doses for a slot group, or — with no group — the ones already due. */
export function dosesFor(data, group) {
  const all = dosesToday(data);
  if (group) return all.filter(d => SLOTS_IN_GROUP[group].includes(d.slot));
  return all.filter(d => d.minutes <= nowMin() + 60);
}

export function answerMeds(data, group) {
  const all = dosesToday(data);
  if (!all.length) return { say: "You don't have any medicines set up yet. You can add them in Medicines." };

  const list = group ? dosesFor(data, group) : all.filter(d => !isTaken(data, d.id) && d.minutes >= nowMin() - 90);
  if (!list.length) {
    return { say: group ? `No medicines are scheduled for ${GROUP_LABEL[group]}.` : 'No more medicines are due today.' };
  }
  const head = group ? `For ${GROUP_LABEL[group]}, you have ${list.length} medicine${list.length === 1 ? '' : 's'}:` : 'Still to take today:';
  return { say: head, lines: list.map(d => doseLine(data, d)) };
}

export function answerDoseStatus(data, group) {
  const list = dosesFor(data, group);
  if (!list.length) return { say: group ? `No medicines are scheduled for ${GROUP_LABEL[group]}.` : 'No medicines have been due yet today.' };

  const day = data.taken?.[dayKey()] || {};
  const taken = list.filter(d => isTaken(data, d.id));
  const lines = list.map(d => (day[d.id] ? `✓ ${d.med.name} · taken at ${clock(day[d.id])}` : `○ ${d.med.name} · not marked as taken`));
  const when = group ? `${GROUP_LABEL[group]} ` : '';

  if (taken.length === list.length) return { say: `Yes, your ${when}medicine is marked as taken.`, lines, tone: 'good' };
  return {
    say: `Your ${when}medicine is not marked as taken.`,
    lines,
    note: "If you're not sure whether you took it, don't take an extra dose. Ask your doctor or pharmacist.",
    untaken: list.filter(d => !isTaken(data, d.id)),
  };
}

/* Untaken doses a "I took my medicine" command should mark. */
export function dosesToMark(data, group, medName) {
  let list = dosesFor(data, group).filter(d => !isTaken(data, d.id));
  if (medName) {
    const q = medName.toLowerCase();
    const named = list.filter(d => d.med.name.toLowerCase().includes(q) || q.includes(d.med.name.toLowerCase()));
    if (named.length) list = named;
  }
  // with no time of day given, "I took my medicine" means the dose(s) due nearest now
  if (!group && !medName && list.length) {
    const nearest = Math.min(...list.map(d => Math.abs(d.minutes - nowMin())));
    list = list.filter(d => Math.abs(d.minutes - nowMin()) === nearest);
  }
  return list;
}

export function answerTrend(data, metric, days = 7) {
  const since = Date.now() - days * 864e5;
  const span = days === 1 ? 'today' : `in the last ${days} days`;

  if (metric === 'bp') {
    const rs = data.bp.filter(r => r.ts >= since);
    if (!rs.length) return { say: `You have no BP readings ${span}.` };
    const high = rs.filter(r => r.sys >= 140 || r.dia >= 90).length;
    const top = rs.reduce((a, b) => (b.sys > a.sys ? b : a));
    return {
      say: `${rs.length} BP reading${rs.length === 1 ? '' : 's'} ${span}. Average ${avg(rs.map(r => r.sys))}/${avg(rs.map(r => r.dia))}.`,
      lines: [
        `Latest · ${rs[0].sys}/${rs[0].dia}`,
        `Highest · ${top.sys}/${top.dia}`,
        high ? `${high} reading${high === 1 ? ' was' : 's were'} 140/90 or above` : 'None were 140/90 or above',
      ],
      tone: high ? 'warn' : 'good',
    };
  }

  if (metric === 'sugar') {
    const rs = data.sugar.filter(r => r.ts >= since);
    if (!rs.length) return { say: `You have no sugar readings ${span}.` };
    const fasting = rs.filter(r => r.kind === 'fasting');
    const post = rs.filter(r => r.kind !== 'fasting');
    const lines = [];
    if (fasting.length) lines.push(`Fasting · average ${avg(fasting.map(r => r.mgdl))} mg/dL (${fasting.length})`);
    if (post.length) lines.push(`After meals · average ${avg(post.map(r => r.mgdl))} mg/dL (${post.length})`);
    lines.push(`Latest · ${rs[0].mgdl} mg/dL ${rs[0].kind === 'fasting' ? 'fasting' : 'after meal'}`);
    return { say: `${rs.length} sugar reading${rs.length === 1 ? '' : 's'} ${span}.`, lines };
  }

  const rs = data.body.filter(r => r.ts >= since);
  if (!rs.length) return { say: `You have no weight entries ${span}.` };
  const change = +(rs[0].weightKg - rs[rs.length - 1].weightKg).toFixed(1);
  return {
    say: `Your latest weight is ${rs[0].weightKg} kg.`,
    lines: rs.length > 1 ? [`${change === 0 ? 'No change' : `${change > 0 ? 'Up' : 'Down'} ${Math.abs(change)} kg`} ${span}`] : [],
  };
}

/* Fixed clinical thresholds, checked right after a reading is saved,
   so the safety message never depends on an LLM. */
export function readingAlert(intent) {
  if (intent.intent === 'log_bp') {
    if (intent.sys > 180 || intent.dia > 120)
      return 'This reading is very high. Sit and rest for 5 minutes and measure again. If it stays this high, or you have chest pain, a bad headache, breathlessness or weakness, get medical help now.';
    if (intent.sys < 90 || intent.dia < 60) return 'This reading is low. If you feel dizzy or faint, sit or lie down and contact your doctor.';
  }
  if (intent.intent === 'log_sugar') {
    if (intent.mgdl < 70) return 'This sugar is low. Have something sweet now, like juice or glucose, and check again in 15 minutes.';
    if (intent.mgdl > 300) return 'This sugar is very high. Please contact your doctor today.';
  }
  return null;
}
