import React, { useCallback, useEffect, useRef, useState } from 'react';
import { RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import Svg, { Path } from 'react-native-svg';
import { C } from '../theme/colors';
import { SANS } from '../theme/typography';
import { fmtDay, fmtTime } from '../lib/calc';
import { clearNotifications, deleteNotification, listNotifications, markNotificationsRead } from '../lib/notificationsApi';
import { inboxChanged, onInboxChanged } from '../lib/inbox';
import { useAuth } from '../state/AuthContext';
import { useAsk } from '../state/AskDialogContext';
import { useGo } from '../navigation/useGo';
import Screen, { IconButton, Section } from '../components/layout/Screen';
import Card from '../components/atoms/Card';
import Chip from '../components/atoms/Chip';
import Btn from '../components/atoms/Btn';
import Press from '../components/atoms/Press';

const icon = d => c =>
  (
    <Svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <Path d={d} />
    </Svg>
  );
const I = {
  bell: icon('M18 9a6 6 0 1 0-12 0c0 5-2 6.5-2 6.5h16S18 14 18 9zM13.7 19.5a2 2 0 0 1-3.4 0'),
  tip: icon('M9.5 17.5h5M10 20.5h4M12 3.5a5.5 5.5 0 0 0-3.2 10c.8.6 1.2 1.4 1.2 2.3v.2h4v-.2c0-.9.4-1.7 1.2-2.3A5.5 5.5 0 0 0 12 3.5z'),
  people: icon('M9 11.5a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM3.5 19c1-2.6 3-4 5.5-4s4.5 1.4 5.5 4M16.5 12a2.2 2.2 0 1 0 0-4.4M16 14.2c2 .2 3.5 1.5 4.3 3.4'),
  alert: icon('M12 4l9 16H3zM12 10v4.5M12 17.5v.01'),
  star: icon('M12 3.8l2.5 5.1 5.6.8-4 4 .9 5.6-5-2.7-5 2.7.9-5.6-4-4 5.6-.8z'),
  gear: icon(
    'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 13.5l1.6 1.2-2 3.4-1.9-.7a7 7 0 0 1-2 1.2l-.3 2h-4l-.3-2a7 7 0 0 1-2-1.2l-1.9.7-2-3.4 1.6-1.2a7 7 0 0 1 0-3l-1.6-1.2 2-3.4 1.9.7a7 7 0 0 1 2-1.2l.3-2h4l.3 2a7 7 0 0 1 2 1.2l1.9-.7 2 3.4-1.6 1.2a7 7 0 0 1 0 3z',
  ),
};

/* How each kind looks, and the page a tap opens (none → the tap
   expands the full text in place). */
const KIND = {
  health_tip: { icon: I.tip, tint: C.normal },
  family_invite: { icon: I.people, tint: C.low, to: 'family' },
  sos: { icon: I.alert, tint: C.stage2, to: 'family' },
  subscription_ending: { icon: I.star, tint: C.elevated, to: 'subscription' },
};
const kindOf = n => KIND[n.type] || { icon: I.bell, tint: C.brand2 };

const tsOf = n => new Date(n.createdAt).getTime();

// consecutive notifications from the same day share one heading
function byDay(items) {
  const groups = [];
  for (const n of items) {
    const day = fmtDay(tsOf(n));
    if (groups[groups.length - 1]?.day !== day) groups.push({ day, items: [] });
    groups[groups.length - 1].items.push(n);
  }
  return groups;
}

function Row({ n, last, open, onPress, onLongPress }) {
  const k = kindOf(n);
  return (
    <Press
      onPress={onPress}
      onLongPress={onLongPress}
      style={[styles.row, !last && styles.rowBorder]}
      accessibilityRole="button"
      accessibilityLabel={`${n.read ? '' : 'Unread. '}${n.title}. ${n.body}`}
    >
      <Chip color={k.tint} size={38}>
        {k.icon(k.tint)}
      </Chip>
      <View style={styles.rowText}>
        <View style={styles.rowHead}>
          <Text style={[styles.title, !n.read && styles.titleUnread]} numberOfLines={open ? undefined : 2}>
            {n.title || 'MyHealthBook'}
          </Text>
          <Text style={styles.time}>{fmtTime(tsOf(n))}</Text>
        </View>
        {n.body ? (
          <Text style={styles.body} numberOfLines={open ? undefined : 3}>
            {n.body}
          </Text>
        ) : null}
      </View>
      {!n.read && <View style={styles.dot} />}
    </Press>
  );
}

/* Home → bell. Every push the server has sent this user — health tips,
   family invites and SOS alerts, plan reminders — newest first. Opening
   the page marks them read on the server, but this visit still shows
   which ones were new. Long-press one to delete it. Medicine reminders
   are scheduled on the phone and live on the Medicines page instead. */
export default function NotificationsScreen() {
  const { token } = useAuth();
  const ask = useAsk();
  const go = useGo();
  const [items, setItems] = useState(null); // null until the first load
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [open, setOpen] = useState(null);
  const loading = useRef(false);

  const load = useCallback(async () => {
    if (!token || loading.current) return;
    loading.current = true;
    try {
      const res = await listNotifications(token);
      setItems(res.notifications);
      setHasMore(res.hasMore);
      setError('');
      if (res.unread) {
        await markNotificationsRead(token).catch(() => {});
        inboxChanged(); // clears the Home badge
      }
    } catch (err) {
      setError(err.message);
    } finally {
      loading.current = false;
    }
  }, [token]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  // a push arriving while the page is open
  useEffect(() => onInboxChanged(() => setTimeout(load, 300)), [load]);

  const refresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const more = async () => {
    if (!items?.length) return;
    setLoadingMore(true);
    try {
      const res = await listNotifications(token, items[items.length - 1].id);
      setItems(cur => [...cur, ...res.notifications.filter(n => !cur.some(c => c.id === n.id))]);
      setHasMore(res.hasMore);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoadingMore(false);
    }
  };

  const tap = n => {
    const to = kindOf(n).to;
    if (to) go(to);
    else setOpen(o => (o === n.id ? null : n.id));
  };

  const remove = async n => {
    const ok = await ask({ title: 'Delete this notification?', body: n.title, confirmLabel: 'Delete', danger: true });
    if (!ok) return;
    setItems(cur => cur.filter(x => x.id !== n.id));
    deleteNotification(n.id, token).catch(err => {
      setError(err.message);
      load();
    });
  };

  const clearAll = async () => {
    const ok = await ask({ title: 'Clear all notifications?', body: 'This removes every notification from this list. It can’t be undone.', confirmLabel: 'Clear all', danger: true });
    if (!ok) return;
    const before = items;
    setItems([]);
    setHasMore(false);
    try {
      await clearNotifications(token);
    } catch (err) {
      setItems(before);
      setError(err.message);
    }
  };

  const unread = items?.filter(n => !n.read).length || 0;

  return (
    <Screen
      title="Notifications"
      subtitle={unread ? `${unread} new` : 'Tips, family and plan updates'}
      back
      right={
        <IconButton label="Notification settings" onPress={() => go('notificationSettings')}>
          {I.gear(C.ink)}
        </IconButton>
      }
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} colors={[C.brand2]} tintColor={C.brand2} />}
    >
      {error ? <Text style={styles.error}>{error}</Text> : null}

      {items === null ? (
        !error && <Text style={styles.loading}>Loading your notifications…</Text>
      ) : items.length === 0 ? (
        <Card style={styles.empty}>
          <Chip color={C.brand2} size={48}>
            {I.bell(C.brand2)}
          </Chip>
          <Text style={styles.emptyTitle}>No notifications yet</Text>
          <Text style={styles.emptyText}>Your daily health tip, family invitations and alerts will appear here as they arrive.</Text>
        </Card>
      ) : (
        <>
          {byDay(items).map((g, gi) => (
            <Section key={g.day} first={gi === 0} title={g.day} action={gi === 0 ? 'Clear all' : null} onAction={clearAll}>
              <Card style={styles.list}>
                {g.items.map((n, i) => (
                  <Row key={n.id} n={n} last={i === g.items.length - 1} open={open === n.id} onPress={() => tap(n)} onLongPress={() => remove(n)} />
                ))}
              </Card>
            </Section>
          ))}
          {hasMore && (
            <Btn kind="quiet" style={{ marginTop: 16 }} disabled={loadingMore} onClick={more}>
              {loadingMore ? 'Loading…' : 'Show older'}
            </Btn>
          )}
          <Text style={styles.hint}>Press and hold a notification to delete it.</Text>
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { padding: 0 },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 14, paddingVertical: 14, paddingHorizontal: 16 },
  rowBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.hair },
  rowText: { flex: 1, minWidth: 0 },
  rowHead: { flexDirection: 'row', alignItems: 'baseline', gap: 10 },
  title: { flex: 1, fontFamily: SANS.medium, fontSize: 16, lineHeight: 21, color: C.ink },
  titleUnread: { fontFamily: SANS.bold },
  time: { fontFamily: SANS.regular, fontSize: 13.5, color: C.ink3 },
  body: { fontFamily: SANS.regular, fontSize: 15, lineHeight: 21, color: C.ink2, marginTop: 3 },
  dot: { width: 9, height: 9, borderRadius: 999, backgroundColor: C.brand, marginTop: 7 },
  empty: { alignItems: 'center', paddingVertical: 32 },
  emptyTitle: { fontFamily: SANS.semibold, fontSize: 17, color: C.ink, marginTop: 14 },
  emptyText: { fontFamily: SANS.regular, fontSize: 15, lineHeight: 21, color: C.ink2, marginTop: 4, textAlign: 'center' },
  loading: { fontFamily: SANS.regular, fontSize: 15, color: C.ink3, textAlign: 'center', marginTop: 30 },
  error: { fontFamily: SANS.medium, fontSize: 14.5, color: C.stage2, marginBottom: 12, paddingHorizontal: 4 },
  hint: { fontFamily: SANS.regular, fontSize: 13.5, color: C.ink3, textAlign: 'center', marginTop: 16 },
});
