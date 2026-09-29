import { useEffect, useRef } from 'react';
import { AppState, Platform } from 'react-native';
import notifee, { AndroidImportance, AndroidNotificationSetting, RepeatFrequency, TriggerType } from '@notifee/react-native';
import { REFILL_ALERT_DAYS, activeMeds, dailyUnits, dayKey, hhmmToMin, prettyTime, slotOf } from './meds';
import { ACCENT, LARGE_ICON } from './notificationStyle';

/* Medicine reminders as notifications scheduled on the phone itself, so
   they fire with the app closed and no internet: one repeating daily
   alarm per dose time (dose time minus the "remind me before" lead), plus
   one-off "running low" alerts on the days a strip gets down to its last
   few days. Rebuilt from scratch whenever the medicines, the times, the
   lead or today's ticks change (useMedReminderSync).

   Exact alarms: with Android's AlarmManager a reminder lands on the
   minute, but on Android 12+ that needs "Alarms & reminders" permission —
   and without it Notifee silently drops the reminder altogether. So
   without the permission they go through WorkManager instead: they still
   arrive, but Android may hold them back a few minutes. */

export const MED_CHANNEL_ID = 'med_reminders';
const ANDROID = {
  channelId: MED_CHANNEL_ID,
  smallIcon: 'ic_stat_pill', // res/drawable — flat, so the status bar can tint it
  largeIcon: LARGE_ICON, // the app logo, the big icon at the side
  color: ACCENT,
  pressAction: { id: 'default', launchActivity: 'default' },
};
const ID_PREFIX = 'med:'; // every trigger this file owns — anything else (none today) is left alone
const REFILL_HOUR = 10; // running-low alerts go out at 10 am
const REFILL_HORIZON_DAYS = 60;
const DAY_MS = 24 * 60 * 60 * 1000;

export async function ensureMedChannel() {
  return notifee.createChannel({
    id: MED_CHANNEL_ID,
    name: 'Medicine reminders',
    description: 'At the times you set for each dose, and when a medicine is running low',
    importance: AndroidImportance.HIGH,
    sound: 'default',
    vibration: true,
  });
}

/** On time (true), or possibly a few minutes late (false) — see the note at the top. */
export async function exactAlarmsAllowed() {
  if (Platform.OS !== 'android') return true;
  const s = await notifee.getNotificationSettings();
  return s.android?.alarm !== AndroidNotificationSetting.DISABLED;
}

export const openExactAlarmSettings = () => notifee.openAlarmPermissionSettings();

const firstName = name => String(name || '').trim().split(/\s+/)[0] || '';

// next time the clock reads `minutes` (0–1439) — later today, or tomorrow if that's passed
function nextAt(minutes, from = new Date()) {
  const d = new Date(from);
  d.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);
  if (d.getTime() <= from.getTime()) d.setDate(d.getDate() + 1);
  return d.getTime();
}

const medLabel = m => (m.dose ? `${m.name} ${m.dose}` : m.name);

/* What should be scheduled, as plain objects — kept apart from the
   Notifee calls so it's easy to reason about (and to test). */
export function reminderPlan(data, name, now = new Date()) {
  const plan = [];
  const times = data.medSettings?.times || {};
  const lead = Math.max(0, Number(data.medSettings?.lead ?? 10) || 0);
  const meds = activeMeds(data);
  const who = firstName(name);
  const takenToday = data.taken?.[dayKey(now)] || {};

  // ---- one repeating reminder per dose time, listing every medicine due then ----
  const bySlot = {};
  for (const med of meds) for (const sk of med.slots || []) (bySlot[sk] ||= []).push(med);

  for (const [sk, list] of Object.entries(bySlot)) {
    const slot = slotOf(sk);
    const doseTime = times[sk] || slot.time;
    const at = (((hhmmToMin(doseTime) - lead) % 1440) + 1440) % 1440;
    let timestamp = nextAt(at, now);
    // everything in this slot already ticked off today — start from tomorrow instead of nagging
    const allTaken = list.every(m => takenToday[`${m.id}|${sk}`]);
    if (allTaken && new Date(timestamp).toDateString() === now.toDateString()) timestamp += DAY_MS;

    const names = list.map(medLabel).join(', ');
    const ask = `${lead ? `at ${prettyTime(doseTime)} take` : 'please take'} ${names}.`;
    plan.push({
      id: `${ID_PREFIX}dose:${sk}`,
      timestamp,
      repeat: true,
      title: lead ? `💊 ${slot.label} medicine in ${lead} min` : `💊 Time for your ${slot.label.toLowerCase()} medicine`,
      body: who ? `${who}, ${ask}` : ask[0].toUpperCase() + ask.slice(1),
    });
  }

  // ---- "running low": once a day at 10 am while a strip is down to its last few days ----
  for (const med of meds) {
    const per = dailyUnits(med);
    if (med.stock == null || !med.stockedAt || per <= 0) continue;
    for (let i = 0; i <= REFILL_HORIZON_DAYS; i++) {
      const d = new Date(now);
      d.setDate(d.getDate() + i);
      d.setHours(REFILL_HOUR, 0, 0, 0);
      if (d.getTime() <= now.getTime()) continue;
      // same calendar burn-down as lib/meds.js daysLeft(), projected to that morning
      const used = per * Math.max(0, Math.floor((d.getTime() - med.stockedAt) / DAY_MS));
      const left = Math.max(0, med.stock - used);
      const days = Math.floor(left / per);
      if (days > REFILL_ALERT_DAYS) continue;
      plan.push({
        id: `${ID_PREFIX}refill:${med.id}:${dayKey(d)}`,
        timestamp: d.getTime(),
        repeat: false,
        title: days <= 0 ? `⚠️ ${med.name} has run out` : `🔔 ${med.name} is running low`,
        body:
          days <= 0
            ? `${who ? `${who}, by` : 'By'} our count you're out of ${med.name}. Refill it so you don't miss a dose.`
            : `About ${days} day${days === 1 ? '' : 's'} of ${med.name} left. Time to reorder.`,
      });
      if (days <= 0) break; // one "run out" alert is enough
    }
  }

  return plan;
}

async function ownTriggerIds() {
  return (await notifee.getTriggerNotificationIds()).filter(id => id.startsWith(ID_PREFIX));
}

/** Replaces every scheduled medicine reminder with the current plan. Returns how many were scheduled. */
export async function syncMedReminders(data, name) {
  if (Platform.OS !== 'android') return 0;
  await ensureMedChannel();
  const exact = await exactAlarmsAllowed();
  const plan = reminderPlan(data, name);

  const old = await ownTriggerIds();
  if (old.length) await notifee.cancelTriggerNotifications(old);

  let scheduled = 0;
  for (const p of plan) {
    try {
      await notifee.createTriggerNotification(
        {
          id: p.id,
          title: p.title,
          body: p.body,
          data: { type: 'med_reminder' },
          android: ANDROID,
        },
        {
          type: TriggerType.TIMESTAMP,
          timestamp: p.timestamp,
          ...(p.repeat && { repeatFrequency: RepeatFrequency.DAILY }),
          // exact + allowed in Doze when we may; otherwise WorkManager (see top)
          ...(exact && { alarmManager: { allowWhileIdle: true } }),
        },
      );
      scheduled += 1;
    } catch (err) {
      console.warn('Medicine reminder not scheduled:', p.id, err?.message);
    }
  }
  return scheduled;
}

export async function clearMedReminders() {
  if (Platform.OS !== 'android') return;
  const old = await ownTriggerIds();
  if (old.length) await notifee.cancelTriggerNotifications(old);
}

/** How many daily dose reminders are currently scheduled on this phone (refill alerts and tests not counted). */
export async function scheduledMedReminderCount() {
  if (Platform.OS !== 'android') return 0;
  return (await ownTriggerIds()).filter(id => id.startsWith(`${ID_PREFIX}dose:`)).length;
}

/** A one-off reminder in [seconds] — proves the whole path works, app closed or not. */
export async function sendTestMedReminder(seconds = 10) {
  await ensureMedChannel();
  const exact = await exactAlarmsAllowed();
  await notifee.createTriggerNotification(
    {
      id: `${ID_PREFIX}test`,
      title: '💊 Test medicine reminder',
      body: 'This is how your medicine reminders will look.',
      data: { type: 'med_reminder' },
      android: ANDROID,
    },
    { type: TriggerType.TIMESTAMP, timestamp: Date.now() + seconds * 1000, ...(exact && { alarmManager: { allowWhileIdle: true } }) },
  );
}

/* Keeps the phone's schedule in step with the signed-in user's own
   medicines. Re-runs when anything that changes the plan changes, and
   when the app comes back to the front (the exact-alarm permission may
   have just been granted, and the refill window moves on each day). */
export function useMedReminderSync({ data, name, own, signedIn, loaded }) {
  const times = data.medSettings?.times;
  const lead = data.medSettings?.lead;
  const today = data.taken?.[dayKey()];
  const sig = loaded
    ? JSON.stringify([
        activeMeds(data).map(m => [m.id, m.name, m.dose, m.slots, m.stock, m.stockedAt, m.perDose]),
        times,
        lead,
        today && Object.keys(today).sort(),
        firstName(name),
        dayKey(),
      ])
    : null;
  const latest = useRef({ data, name });
  latest.current = { data, name };

  useEffect(() => {
    // a family member's record open in the app is theirs to be reminded about, not this phone's
    if (!own || signedIn == null) return undefined;
    if (!signedIn) {
      clearMedReminders().catch(() => {});
      return undefined;
    }
    if (!sig) return undefined; // wait for the real data, or the empty placeholder would wipe the schedule first
    const run = () => syncMedReminders(latest.current.data, latest.current.name).catch(err => console.warn('Medicine reminders sync failed:', err?.message));
    run();
    const sub = AppState.addEventListener('change', s => s === 'active' && run());
    return () => sub.remove();
  }, [sig, signedIn, own]);
}
