import React, { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { C } from '../../theme/colors';
import { GRAD_MINT } from '../../theme/gradients';
import { MONO, SANS } from '../../theme/typography';
import { daysLeft, dailyUnits, prettyTime, refillColor, refillLabel, REFILL_ALERT_DAYS, slotOf, unitsLeft } from '../../lib/meds';
import Card from '../atoms/Card';
import Press from '../atoms/Press';

const clock = ts => new Date(ts).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }).toLowerCase();

/* One medicine = one card. Name, strength and how many tablets up top;
   below it one big button per time of day it's taken, each showing its
   own state — so "did I take my after-dinner Metformin?" is answered by
   looking at one card, not by scanning time-of-day lists.

   A dose button is either
   · to take   — outlined, with its reminder time and "Mark taken"
   · due now   — amber: its time has passed and it isn't marked yet
   · taken     — green with the time it was marked; tapping it again
                 undoes it (the screen confirms first).

   Stock, pause/stop and "bought more" live behind the ⋯ button so the
   card stays about the doses. */
export default function MedicineDoseCard({ med, doses, takenToday, busy, onToggle, onPause, onStop, onRestock }) {
  const [menu, setMenu] = useState(false);
  const [restocking, setRestocking] = useState(false);
  const [qty, setQty] = useState('');

  const nowMin = new Date().getHours() * 60 + new Date().getMinutes();
  const dl = daysLeft(med);
  const left = unitsLeft(med);
  const low = dl != null && dl <= REFILL_ALERT_DAYS;
  const done = doses.filter(d => takenToday[d.id]).length;
  const perDose = med.perDose || 1;

  const saveRestock = () => {
    const n = +qty;
    if (!n || n <= 0) return;
    onRestock(n);
    setQty('');
    setRestocking(false);
    setMenu(false);
  };

  return (
    <Card style={styles.card}>
      <View style={styles.topRow}>
        <View style={styles.pillIcon}>
          <Svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={C.brand2} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <Path d="M10.5 20.5a7 7 0 0 1-9.9-9.9l6-6a7 7 0 0 1 9.9 9.9z" />
            <Path d="M8.5 8.5l7 7" />
          </Svg>
        </View>
        <View style={styles.titleBlock}>
          <Text style={styles.name} numberOfLines={2}>
            {med.name}
          </Text>
          <Text style={styles.sub}>
            {[med.dose, `${perDose} tablet${perDose === 1 ? '' : 's'} each time`].filter(Boolean).join(' · ')}
          </Text>
        </View>
        <Press onPress={() => setMenu(m => !m)} style={[styles.moreBtn, menu && styles.moreBtnOn]} accessibilityLabel={`More options for ${med.name}`}>
          <Svg width="20" height="20" viewBox="0 0 24 24" fill={menu ? '#FFFFFF' : C.ink}>
            <Circle cx="5" cy="12" r="2" />
            <Circle cx="12" cy="12" r="2" />
            <Circle cx="19" cy="12" r="2" />
          </Svg>
        </Press>
      </View>

      {(dl != null || doses.length > 1) && (
        <View style={styles.metaRow}>
          {doses.length > 1 && (
            <Text style={[styles.metaText, done === doses.length && { color: C.normal }]}>
              {done === doses.length ? '✓ All taken today' : `${done} of ${doses.length} taken today`}
            </Text>
          )}
          {dl != null && (
            <View style={styles.stockPill}>
              <View style={[styles.stockDot, { backgroundColor: low ? refillColor(dl) : C.normal }]} />
              <Text style={[styles.metaText, low && { color: refillColor(dl), fontFamily: SANS.semibold }]}>{refillLabel(dl)}</Text>
            </View>
          )}
        </View>
      )}

      <View style={styles.doseRow}>
        {doses.map(d => {
          const takenAt = takenToday[d.id];
          const due = !takenAt && d.minutes <= nowMin;
          const pending = busy.includes(d.id);
          const label = slotOf(d.slot).label;

          if (takenAt) {
            return (
              <Press
                key={d.id}
                onPress={() => onToggle(d, true)}
                disabled={pending}
                style={[styles.doseBtn, styles.doseBtnTaken]}
                accessibilityRole="button"
                accessibilityLabel={`${label}: taken at ${clock(takenAt)}. Tap to undo.`}>
                <LinearGradient colors={GRAD_MINT.colors} start={GRAD_MINT.start} end={GRAD_MINT.end} style={StyleSheet.absoluteFill} />
                <Text style={[styles.slotName, styles.onGreen]} numberOfLines={1}>
                  {label}
                </Text>
                <Text style={[styles.stateText, styles.onGreen]}>✓ Taken {clock(takenAt)}</Text>
                <Text style={[styles.hint, styles.onGreenSoft]}>Tap to undo</Text>
              </Press>
            );
          }

          return (
            <Press
              key={d.id}
              onPress={() => onToggle(d, false)}
              disabled={pending}
              style={[styles.doseBtn, due ? styles.doseBtnDue : styles.doseBtnTodo]}
              accessibilityRole="button"
              accessibilityLabel={`${label} at ${prettyTime(d.time)}. Mark taken.`}>
              <Text style={styles.slotName} numberOfLines={1}>
                {label}
              </Text>
              <Text style={[styles.timeText, due && { color: '#92400E' }]}>
                {due ? 'Due ' : ''}
                {prettyTime(d.time)}
              </Text>
              <View style={[styles.markChip, due && styles.markChipDue]}>
                <Text style={[styles.markLabel, due && { color: '#FFFFFF' }]}>{pending ? 'Saving…' : 'Mark taken'}</Text>
              </View>
            </Press>
          );
        })}
      </View>

      {menu && (
        <View style={styles.menu}>
          {dl != null && (
            <Text style={styles.menuInfo}>
              About {left} tablets left · {dailyUnits(med)} a day
            </Text>
          )}
          {restocking ? (
            <View style={styles.restockRow}>
              <TextInput
                value={qty}
                onChangeText={t => setQty(t.replace(/\D/g, '').slice(0, 4))}
                keyboardType="number-pad"
                autoFocus
                placeholder="How many tablets now?"
                placeholderTextColor={C.ink3}
                onSubmitEditing={saveRestock}
                style={styles.restockInput}
              />
              <Press onPress={saveRestock} disabled={!qty} style={styles.restockSave}>
                <Text style={styles.restockSaveLabel}>Save</Text>
              </Press>
            </View>
          ) : (
            <View style={styles.menuRow}>
              <MenuButton label={dl == null ? 'Set stock' : 'Bought more'} onPress={() => setRestocking(true)} />
              <MenuButton label="Pause" icon={<Path d="M9 5v14M15 5v14" />} onPress={onPause} />
              <MenuButton label="Stop" danger icon={<Rect x="6" y="6" width="12" height="12" rx="2" />} onPress={onStop} />
            </View>
          )}
        </View>
      )}
    </Card>
  );
}

function MenuButton({ label, icon, onPress, danger }) {
  const color = danger ? C.stage2 : C.ink;
  return (
    <Press onPress={onPress} style={styles.menuBtn}>
      {icon && (
        <Svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round">
          {icon}
        </Svg>
      )}
      <Text style={[styles.menuLabel, { color }]}>{label}</Text>
    </Press>
  );
}

const styles = StyleSheet.create({
  card: { marginBottom: 12, padding: 16 },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  pillIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(34,197,94,0.14)', alignItems: 'center', justifyContent: 'center' },
  titleBlock: { flex: 1, minWidth: 0 },
  name: { fontFamily: SANS.bold, fontSize: 20, letterSpacing: -0.5, color: C.ink },
  sub: { fontFamily: SANS.regular, fontSize: 15, color: C.ink2, marginTop: 2 },
  moreBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: C.hair,
    backgroundColor: 'rgba(255,255,255,0.7)',
  },
  moreBtnOn: { backgroundColor: C.ink, borderColor: C.ink },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 12 },
  metaText: { fontFamily: SANS.medium, fontSize: 14.5, color: C.ink2 },
  stockPill: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  stockDot: { width: 8, height: 8, borderRadius: 4 },
  // up to 3 buttons share one row; 4–5 wrap onto a second
  doseRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 },
  doseBtn: {
    flexGrow: 1,
    flexBasis: '30%',
    minWidth: 100,
    minHeight: 104,
    borderRadius: 18,
    paddingVertical: 12,
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  doseBtnTodo: { backgroundColor: '#FFFFFF', borderWidth: 1.5, borderColor: 'rgba(22,36,28,0.16)' },
  doseBtnDue: { backgroundColor: '#FFFBEB', borderWidth: 2, borderColor: '#F59E0B' },
  doseBtnTaken: { borderWidth: 0 },
  slotName: { fontFamily: SANS.semibold, fontSize: 15, color: C.ink, textAlign: 'center' },
  timeText: { fontFamily: MONO.medium, fontSize: 13.5, color: C.ink3, marginTop: 3 },
  stateText: { fontFamily: SANS.bold, fontSize: 15, marginTop: 4, textAlign: 'center' },
  hint: { fontFamily: SANS.regular, fontSize: 12.5, marginTop: 3 },
  onGreen: { color: '#08221A' },
  onGreenSoft: { color: 'rgba(8,34,26,0.7)' },
  markChip: { marginTop: 8, borderRadius: 999, paddingVertical: 6, paddingHorizontal: 12, backgroundColor: 'rgba(22,163,74,0.12)' },
  markChipDue: { backgroundColor: '#D97706' },
  markLabel: { fontFamily: SANS.semibold, fontSize: 13.5, color: C.brand2 },
  menu: { marginTop: 14, paddingTop: 12, borderTopWidth: 1, borderTopColor: C.hair },
  menuInfo: { fontFamily: SANS.regular, fontSize: 14.5, color: C.ink2, marginBottom: 10 },
  menuRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  menuBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: C.hair,
    backgroundColor: '#FFFFFF',
    borderRadius: 999,
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  menuLabel: { fontFamily: SANS.semibold, fontSize: 15 },
  restockRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  restockInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: C.hair,
    borderRadius: 12,
    paddingVertical: 11,
    paddingHorizontal: 13,
    fontFamily: SANS.regular,
    fontSize: 16,
    color: C.ink,
    backgroundColor: '#FFFFFF',
  },
  restockSave: { backgroundColor: C.ink, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 18 },
  restockSaveLabel: { fontFamily: SANS.semibold, fontSize: 15, color: '#FFFFFF' },
});
