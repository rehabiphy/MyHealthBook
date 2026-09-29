import React, { useCallback, useEffect, useState } from 'react';
import { AppState, Platform, StyleSheet, Text, View } from 'react-native';
import { C } from '../theme/colors';
import { SANS } from '../theme/typography';
import { useAuth } from '../state/AuthContext';
import { useData } from '../state/DataContext';
import { notificationsAllowed, openNotificationSettings, requestNotificationPermission } from '../lib/notifications';
import { exactAlarmsAllowed, openExactAlarmSettings, scheduledMedReminderCount, sendTestMedReminder } from '../lib/medReminders';
import { getNotificationSettings, sendHealthTipNow, updateNotificationSettings } from '../lib/notificationsApi';
import Card from './atoms/Card';
import Mono from './atoms/Mono';
import Btn from './atoms/Btn';
import Seg from './atoms/Seg';

/* Profile → Notifications: what this phone will be reminded about, the
   phone settings that stop reminders arriving (or arriving on time), and
   buttons to try each kind without waiting for it. */
export default function NotificationsCard() {
  const { token } = useAuth();
  const { data } = useData();
  const [allowed, setAllowed] = useState(true);
  const [exact, setExact] = useState(true);
  const [count, setCount] = useState(null);
  const [tips, setTips] = useState(null); // null until the server answers
  const [note, setNote] = useState('');
  const [sending, setSending] = useState(false);

  const say = m => {
    setNote(m);
    setTimeout(() => setNote(n => (n === m ? '' : n)), 6000);
  };

  const check = useCallback(async () => {
    try {
      const [a, e, n] = await Promise.all([notificationsAllowed(), exactAlarmsAllowed(), scheduledMedReminderCount()]);
      setAllowed(a);
      setExact(e);
      setCount(n);
    } catch {
      // advisory only — keep what's showing
    }
  }, []);

  // coming back from a settings screen is the usual reason these changed
  useEffect(() => {
    check();
    const sub = AppState.addEventListener('change', s => s === 'active' && setTimeout(check, 800));
    return () => sub.remove();
  }, [check]);

  // the schedule is rebuilt in the background when medicines change — look again once it has been
  useEffect(() => {
    const t = setTimeout(check, 1500);
    return () => clearTimeout(t);
  }, [data.meds, data.medSettings, check]);

  useEffect(() => {
    if (!token) return;
    getNotificationSettings(token)
      .then(res => setTips(res.settings.healthTips))
      .catch(() => {});
  }, [token]);

  if (Platform.OS !== 'android') return null;

  const allow = async () => {
    await requestNotificationPermission();
    if (!(await notificationsAllowed())) openNotificationSettings(); // denied before — only settings can turn it on now
    check();
  };

  const testReminder = async () => {
    try {
      await sendTestMedReminder(10);
      say('A test reminder is coming in about 10 seconds. You can close the app to see it arrive.');
    } catch (err) {
      say(err.message || "Couldn't schedule the test reminder.");
    }
  };

  const setTipsOn = async value => {
    const on = value === 'on';
    if (on === tips) return;
    setTips(on);
    try {
      await updateNotificationSettings({ healthTips: on }, token);
    } catch (err) {
      setTips(!on);
      say(err.message);
    }
  };

  const testTip = async () => {
    setSending(true);
    try {
      const res = await sendHealthTipNow(token);
      say(`Sent: "${res.tip.title}". It should appear in a few seconds.`);
    } catch (err) {
      say(err.message);
    } finally {
      setSending(false);
    }
  };

  const hasMeds = data.meds.some(m => (m.status || 'active') === 'active');

  return (
    <Card style={{ marginTop: 10 }}>
      <Mono>Notifications</Mono>

      {!allowed && (
        <View style={styles.warn}>
          <Text style={styles.warnText}>Notifications are turned off for MyHealthBook, so no reminders can reach you.</Text>
          <Btn style={styles.warnBtn} onClick={allow}>
            Turn on notifications
          </Btn>
        </View>
      )}

      <Text style={styles.subhead}>Medicine reminders</Text>
      <Text style={styles.hint}>
        {!hasMeds
          ? 'Add a medicine and you’ll be reminded at each dose time, even when the app is closed.'
          : count
            ? `${count} reminder${count === 1 ? '' : 's'} set on this phone, at your dose times minus the “remind me before” time on the Medicines page. They work even when the app is closed.`
            : 'Setting up your reminders…'}
      </Text>

      {!exact && (
        <View style={styles.check}>
          <Text style={styles.checkText}>Allow “Alarms & reminders” so medicine reminders arrive on the minute. Without it, Android may deliver them a few minutes late.</Text>
          <Btn kind="quiet" style={styles.checkBtn} onClick={openExactAlarmSettings}>
            Allow on-time reminders
          </Btn>
        </View>
      )}

      <Btn kind="quiet" style={{ marginTop: 12 }} onClick={testReminder}>
        Send a test reminder
      </Btn>

      <View style={styles.divider} />

      <Text style={styles.subhead}>Daily health tip</Text>
      <Text style={styles.hint}>One short tip a day at around 10 am, written by AI from your own readings and medicines. It’s general guidance, not medical advice.</Text>
      <View style={{ marginTop: 12 }}>
        <Seg
          value={tips === false ? 'off' : 'on'}
          onChange={setTipsOn}
          options={[
            { value: 'off', label: 'Off' },
            { value: 'on', label: 'On' },
          ]}
        />
      </View>
      {tips !== false && (
        <Btn kind="quiet" style={{ marginTop: 10 }} disabled={sending} onClick={testTip}>
          {sending ? 'Writing your tip…' : 'Send me today’s tip now'}
        </Btn>
      )}

      {note ? <Text style={[styles.hint, { color: C.brand2 }]}>{note}</Text> : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  subhead: { fontFamily: SANS.semibold, fontSize: 16, color: C.ink, marginTop: 14 },
  hint: { fontFamily: SANS.regular, fontSize: 14.5, color: C.ink3, lineHeight: 21, marginTop: 6 },
  warn: { marginTop: 12, padding: 14, borderRadius: 14, backgroundColor: 'rgba(217,119,6,0.12)' },
  warnText: { fontFamily: SANS.semibold, fontSize: 14.5, color: '#92400E', lineHeight: 21 },
  warnBtn: { marginTop: 10 },
  check: { marginTop: 14, paddingTop: 14, borderTopWidth: 1, borderTopColor: C.hair },
  checkText: { fontFamily: SANS.regular, fontSize: 14.5, color: C.ink2, lineHeight: 21 },
  checkBtn: { marginTop: 10, paddingVertical: 12 },
  divider: { height: 1, backgroundColor: C.hair, marginTop: 18 },
});
