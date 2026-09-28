import React, { useCallback, useEffect, useState } from 'react';
import { AppState, DeviceEventEmitter, Modal, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { C } from '../../theme/colors';
import { SANS, MONO } from '../../theme/typography';
import { useAuth } from '../../state/AuthContext';
import { getActiveSos } from '../../lib/sosApi';
import { cancelMySos, dismissAlarm, onSosEvent, silenceAlarm } from '../../lib/sosNative';
import { SOS_PUSH_EVENT } from '../../lib/sos';
import Press from '../atoms/Press';

const POLL_MS = 2000; // while an SOS is on screen: pick up family responses and the end of the window

const STATE_LABEL = { sent: 'Alerted', silenced: 'Silenced', dismissed: 'Seen' };

/* Full-screen SOS in the open app, above everything else. Two faces:
     sender   — this phone raised it: countdown + "I'm OK — cancel"
     incoming — a family member's: countdown + Silence / Dismiss
   The alarm and the notification are native (android/.../sos); this
   mirrors them and drives the same actions. Server state is the truth,
   refreshed on pushes, native button presses, app focus, and a short
   poll while visible. */
export default function SosLayer() {
  const { token } = useAuth();
  const insets = useSafeAreaInsets();
  const [alerts, setAlerts] = useState([]);
  const [local, setLocal] = useState({}); // id → 'silenced' | 'dismissed' | 'cancelling', ahead of the server
  const [now, setNow] = useState(Date.now());

  const refresh = useCallback(async () => {
    if (!token) return;
    try {
      const res = await getActiveSos(token);
      setAlerts(res.alerts);
      setNow(Date.now());
    } catch {
      // offline — keep what's on screen; the native alarm still runs its course
    }
  }, [token]);

  useEffect(() => {
    refresh();
    const push = DeviceEventEmitter.addListener(SOS_PUSH_EVENT, refresh);
    const native = onSosEvent(refresh);
    const app = AppState.addEventListener('change', s => s === 'active' && refresh());
    return () => {
      push.remove();
      native();
      app.remove();
    };
  }, [refresh]);

  const visible = alerts.filter(a => new Date(a.expiresAt).getTime() > now && local[a.id] !== 'dismissed' && (a.mine || a.myState !== 'dismissed'));
  // your own SOS comes first — cancelling it is the one thing that can't wait
  const alert = visible.find(a => a.mine) || visible[0];
  const alertId = alert?.id;

  useEffect(() => {
    if (!alertId) return undefined;
    const tick = setInterval(() => setNow(Date.now()), 500);
    const poll = setInterval(refresh, POLL_MS);
    return () => {
      clearInterval(tick);
      clearInterval(poll);
    };
  }, [alertId, refresh]);

  if (!alert) return null;

  const secondsLeft = Math.max(0, Math.ceil((new Date(alert.expiresAt).getTime() - now) / 1000));
  const who = alert.from?.name || 'Family member';
  const what = alert.mine
    ? alert.trigger === 'manual'
      ? 'You sent an SOS'
      : 'Your phone detected a fall'
    : alert.trigger === 'manual'
      ? `${who} pressed SOS`
      : `${who}'s phone detected a fall`;
  const myState = local[alert.id] || alert.myState;

  const act = (fn, state) => {
    setLocal(l => ({ ...l, [alert.id]: state }));
    fn(alert.id);
    setTimeout(refresh, 800);
  };

  return (
    <Modal visible transparent={false} animationType="fade" statusBarTranslucent onRequestClose={() => {}}>
      <View style={[styles.root, { paddingTop: insets.top + 28, paddingBottom: insets.bottom + 24 }]}>
        <Text style={styles.kicker}>{alert.mine ? 'SOS SENT' : 'SOS'}</Text>
        <Text style={styles.title}>{what}</Text>
        <Text style={styles.body}>
          {alert.mine
            ? "Your family is being alerted. If you're OK, cancel it now."
            : `Check on ${who} now. Silence or dismiss only stops the alarm on your phone.`}
        </Text>

        <View style={styles.countWrap}>
          <Text style={styles.count}>{secondsLeft}</Text>
          <Text style={styles.countUnit}>seconds left</Text>
        </View>

        {alert.mine && alert.recipients?.length > 0 && (
          <View style={styles.list}>
            {alert.recipients.map(r => (
              <View key={r.id} style={styles.listRow}>
                <Text style={styles.listName} numberOfLines={1}>
                  {r.name || 'Family member'}
                </Text>
                <Text style={styles.listState}>{STATE_LABEL[r.state] || r.state}</Text>
              </View>
            ))}
          </View>
        )}

        <View style={{ flex: 1 }} />

        {alert.mine ? (
          <Press onPress={() => act(cancelMySos, 'cancelling')} disabled={myState === 'cancelling'} style={styles.primary}>
            <Text style={styles.primaryLabel}>{myState === 'cancelling' ? 'Cancelling…' : "I'm OK — cancel SOS"}</Text>
          </Press>
        ) : (
          <>
            {myState !== 'silenced' && (
              <Press onPress={() => act(silenceAlarm, 'silenced')} style={styles.primary}>
                <Text style={styles.primaryLabel}>Silence alarm</Text>
              </Press>
            )}
            <Press onPress={() => act(dismissAlarm, 'dismissed')} style={styles.secondary}>
              <Text style={styles.secondaryLabel}>Dismiss</Text>
            </Press>
          </>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  // emergency red — the one screen where colour states "crisis" (theme/colors.js)
  root: { flex: 1, backgroundColor: C.crisis, paddingHorizontal: 24 },
  kicker: { fontFamily: MONO.medium, fontSize: 14, letterSpacing: 3, color: 'rgba(255,255,255,0.8)' },
  title: { fontFamily: SANS.bold, fontSize: 30, letterSpacing: -0.8, lineHeight: 36, color: '#FFFFFF', marginTop: 10 },
  body: { fontFamily: SANS.regular, fontSize: 16.5, lineHeight: 24, color: 'rgba(255,255,255,0.88)', marginTop: 12 },
  countWrap: { alignItems: 'center', marginTop: 36 },
  count: { fontFamily: SANS.bold, fontSize: 96, letterSpacing: -3, color: '#FFFFFF', lineHeight: 104 },
  countUnit: { fontFamily: MONO.regular, fontSize: 13, letterSpacing: 1.5, color: 'rgba(255,255,255,0.75)', textTransform: 'uppercase' },
  list: { marginTop: 28, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.12)', paddingHorizontal: 16 },
  listRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, gap: 12 },
  listName: { flex: 1, fontFamily: SANS.semibold, fontSize: 15.5, color: '#FFFFFF' },
  listState: { fontFamily: MONO.medium, fontSize: 12.5, letterSpacing: 1, color: 'rgba(255,255,255,0.8)', textTransform: 'uppercase' },
  primary: { backgroundColor: '#FFFFFF', borderRadius: 16, paddingVertical: 18, alignItems: 'center' },
  primaryLabel: { fontFamily: SANS.bold, fontSize: 17, color: C.crisis },
  secondary: { borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.7)', borderRadius: 16, paddingVertical: 16, alignItems: 'center', marginTop: 10 },
  secondaryLabel: { fontFamily: SANS.semibold, fontSize: 16, color: '#FFFFFF' },
});
