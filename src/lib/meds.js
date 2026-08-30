import { useEffect, useRef, useState } from 'react';
import { C } from '../theme/colors';

export const SLOTS = [
  { key: 'empty', label: 'Empty stomach', sub: 'before food', time: '07:00' },
  { key: 'breakfast', label: 'After breakfast', sub: 'with water', time: '09:00' },
  { key: 'lunch', label: 'After lunch', sub: '', time: '14:00' },
  { key: 'dinner', label: 'After dinner', sub: '', time: '21:00' },
  { key: 'bed', label: 'Bedtime', sub: '', time: '22:30' },
];

export const slotOf = k => SLOTS.find(s => s.key === k) || SLOTS[0];

export const dayKey = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export const hhmmToMin = t => {
  const [h, m] = String(t || '00:00').split(':').map(Number);
  return h * 60 + m;
};

export const prettyTime = t => {
  const [h, m] = String(t || '00:00').split(':').map(Number);
  const ap = h < 12 ? 'am' : 'pm';
  const hr = h % 12 === 0 ? 12 : h % 12;
  return `${hr}:${String(m).padStart(2, '0')} ${ap}`;
};

/* Every dose due today, in clock order. */
export function dosesToday(data) {
  const times = data.medSettings?.times || {};
  const out = [];
  data.meds
    .filter(m => (m.status || 'active') === 'active')
    .forEach(med =>
      med.slots.forEach(sk => {
        const t = times[sk] || slotOf(sk).time;
        out.push({ id: `${med.id}|${sk}`, med, slot: sk, time: t, minutes: hhmmToMin(t) });
      }),
    );
  return out.sort((a, b) => a.minutes - b.minutes);
}

export const isTaken = (data, doseId, day = dayKey()) => Boolean(data.taken?.[day]?.[doseId]);

/* Adherence over the last n days, counting only days after a medicine was added. */
export function adherence(data, days = 7) {
  const times = data.medSettings?.times || {};
  let due = 0,
    done = 0;
  for (let i = 0; i < days; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = dayKey(d);
    const endOfDay = new Date(d).setHours(23, 59, 59, 999);
    data.meds
      .filter(m => (m.status || 'active') === 'active')
      .forEach(med => {
        if (med.added > endOfDay) return;
        med.slots.forEach(sk => {
          // today's later doses aren't late yet, so they don't count against you
          if (i === 0 && hhmmToMin(times[sk] || slotOf(sk).time) > new Date().getHours() * 60 + new Date().getMinutes()) return;
          due += 1;
          if (data.taken?.[key]?.[`${med.id}|${sk}`]) done += 1;
        });
      });
  }
  return { due, done, pct: due ? Math.round((done / due) * 100) : null };
}

/* Refill forecast. Stock burns down by the calendar, not by whether the
   user remembered to tick a dose — otherwise a missed tick would quietly
   report more medicine on hand than the box actually holds. */
export const REFILL_ALERT_DAYS = 3;

export const dailyUnits = med => (med.slots?.length || 0) * (med.perDose || 1);

export function unitsLeft(med) {
  if (med.stock == null || !med.stockedAt) return null;
  const days = Math.max(0, Math.floor((Date.now() - med.stockedAt) / 864e5));
  return Math.max(0, +(med.stock - dailyUnits(med) * days).toFixed(2));
}

export function daysLeft(med) {
  const left = unitsLeft(med);
  const per = dailyUnits(med);
  if (left == null || per <= 0) return null;
  return Math.floor(left / per);
}

export const refillLabel = d => (d <= 0 ? 'Out of stock' : d === 1 ? '1 day left' : `${d} days left`);

export const refillColor = d => (d <= 1 ? C.stage2 : d <= 2 ? C.stage1 : C.elevated);

/* Meds at or under the alert threshold, soonest first. */
export function refillsDue(data) {
  return data.meds
    .filter(m => (m.status || 'active') === 'active')
    .map(m => ({ med: m, days: daysLeft(m) }))
    .filter(x => x.days != null && x.days <= REFILL_ALERT_DAYS)
    .sort((a, b) => a.days - b.days);
}

export const activeMeds = data => data.meds.filter(m => (m.status || 'active') === 'active');

/* Polls while mounted and surfaces doses due now + refills running low.
   In-app only — no OS-level scheduled notification, matching the app's
   current behaviour (a real background alarm is future work). */
export function useReminders(data) {
  const [state, setState] = useState({ doses: [], refills: [] });
  const dataRef = useRef(data);
  dataRef.current = data;

  useEffect(() => {
    const tick = () => {
      const d = dataRef.current;
      const now = new Date();
      const nowMin = now.getHours() * 60 + now.getMinutes();
      const lead = d.medSettings?.lead ?? 10;
      const doses = dosesToday(d).filter(dose => {
        if (isTaken(d, dose.id)) return false;
        return nowMin >= dose.minutes - lead && nowMin <= dose.minutes + 90;
      });
      const refills = refillsDue(d);
      setState({ doses, refills });
    };
    tick();
    const id = setInterval(tick, 20000);
    return () => clearInterval(id);
  }, [data]);

  return state;
}
