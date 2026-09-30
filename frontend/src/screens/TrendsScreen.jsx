import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { C } from '../theme/colors';
import { SANS } from '../theme/typography';
import { useData } from '../state/DataContext';
import { useSubscription, FEATURES } from '../state/SubscriptionContext';
import { useGo } from '../navigation/useGo';
import { METRICS, RANGES, clip, fmt, previousWindow, seriesFor, spanDays, stats, toCsv, windowFor } from '../lib/trends';
import { exportCsv } from '../lib/share';
import Screen from '../components/layout/Screen';
import Card from '../components/atoms/Card';
import Mono from '../components/atoms/Mono';
import Btn from '../components/atoms/Btn';
import Press from '../components/atoms/Press';
import LineChart from '../components/charts/LineChart';

/* Readings over time. Free covers the last `trendDays` (30); longer and
   custom periods, comparison with the previous period and export come
   with Plus. Wording stays descriptive — this screen reports what was
   recorded and never says what it means medically. */

function Chip({ label, on, locked, onPress }) {
  return (
    <Press onPress={onPress} style={[styles.chip, on && styles.chipOn]}>
      <Text style={[styles.chipLabel, on && styles.chipLabelOn, locked && { color: C.ink3 }]}>
        {label}
        {locked ? ' · Plus' : ''}
      </Text>
    </Press>
  );
}

function StatRow({ label, value }) {
  return (
    <View style={styles.statRow}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}

const signed = v => (v > 0 ? `+${v}` : `${v}`);

export default function TrendsScreen() {
  const { data } = useData();
  const { can, limit } = useSubscription();
  const go = useGo();
  const [metric, setMetric] = useState('bp');
  const [range, setRange] = useState('30');
  const [custom, setCustom] = useState({ from: Date.now() - 180 * 864e5, to: Date.now() });
  const [picking, setPicking] = useState(null); // 'from' | 'to'
  const [note, setNote] = useState('');

  const advanced = can(FEATURES.ADVANCED_TRENDS);
  const freeDays = limit('trendDays');
  const locked = r => !advanced && (r.days == null || (freeDays != null && r.days > freeDays));

  const m = METRICS.find(x => x.key === metric);
  const full = useMemo(() => seriesFor(data, metric), [data, metric]);
  const window = windowFor(range, custom, full);
  const shown = clip(full, window);
  const prev = advanced ? clip(full, previousWindow(window)) : null;

  const pickRange = r => {
    if (locked(r)) {
      setNote(
        `Trends over ${r.key === 'custom' ? 'custom periods' : r.days ? r.label : 'your full history'} are part of MyHealthBook Plus. Your readings themselves are always available in your log.`,
      );
      return;
    }
    setNote('');
    setRange(r.key);
  };

  const doExport = async () => {
    const ok = await exportCsv(toCsv(metric, shown, window), `${m.label.toLowerCase().replace(/\s+/g, '-')}-${new Date().toISOString().slice(0, 10)}`);
    setNote(ok ? '' : 'Could not export right now. Please try again.');
  };

  return (
    <Screen title="Trends" subtitle="Your readings over time" back>
      <View style={styles.chips}>
        {METRICS.map(x => (
          <Chip key={x.key} label={x.label} on={metric === x.key} onPress={() => setMetric(x.key)} />
        ))}
      </View>
      <View style={[styles.chips, { marginTop: 8 }]}>
        {RANGES.map(r => (
          <Chip key={r.key} label={r.label} on={range === r.key} locked={locked(r)} onPress={() => pickRange(r)} />
        ))}
      </View>

      {range === 'custom' && (
        <View style={styles.customRow}>
          <Btn kind="quiet" style={{ flex: 1 }} onClick={() => setPicking('from')}>
            {`From ${fmt(custom.from)}`}
          </Btn>
          <Btn kind="quiet" style={{ flex: 1 }} onClick={() => setPicking('to')}>
            {`To ${fmt(custom.to)}`}
          </Btn>
        </View>
      )}
      {picking && (
        <DateTimePicker
          value={new Date(custom[picking])}
          mode="date"
          display="default"
          maximumDate={new Date()}
          onChange={(event, selected) => {
            const which = picking;
            setPicking(null);
            if (event.type === 'dismissed' || !selected) return;
            setCustom(c => {
              const next = { ...c, [which]: selected.getTime() };
              if (next.from > next.to) next[which === 'from' ? 'to' : 'from'] = next[which];
              return next;
            });
          }}
        />
      )}

      {note ? (
        <Card style={styles.noteCard}>
          <Text style={styles.noteText}>{note}</Text>
          {!advanced && (
            <Btn kind="quiet" style={{ marginTop: 10 }} onClick={() => go('premium')}>
              See plans
            </Btn>
          )}
        </Card>
      ) : null}

      <Card style={{ marginTop: 12, padding: 16 }}>
        <Text style={styles.title}>{m.title}</Text>
        <Mono style={{ marginTop: 4 }}>
          {fmt(window.from)} – {fmt(window.to)} · {spanDays(window)} days
        </Mono>
        <View style={{ marginTop: 10 }}>
          <LineChart series={shown} window={window} unit={m.unit} />
        </View>
      </Card>

      {shown.map(s => {
        const st = stats(s.points);
        if (!st) return null;
        const before = prev ? stats(prev.find(p => p.key === s.key)?.points || []) : null;
        return (
          <Card key={s.key} style={{ marginTop: 10, padding: 16 }}>
            <Mono style={{ color: s.color }}>{s.label}</Mono>
            <StatRow label="Entries" value={st.count} />
            <StatRow label="Average" value={`${st.mean} ${m.unit}`} />
            <StatRow label="Lowest – highest" value={`${st.min} – ${st.max} ${m.unit}`} />
            <StatRow label="First → latest in period" value={`${st.first} → ${st.last} (${signed(st.change)})`} />
            {advanced && (
              <StatRow label={`Average, previous ${spanDays(window)} days`} value={before ? `${before.mean} ${m.unit} (${signed(Math.round((st.mean - before.mean) * 10) / 10)})` : 'No entries'} />
            )}
          </Card>
        );
      })}

      {advanced ? (
        <Btn kind="quiet" style={{ marginTop: 12 }} disabled={!shown.some(s => s.points.length)} onClick={doExport}>
          Export this period (CSV)
        </Btn>
      ) : (
        <Text style={styles.fineprint}>MyHealthBook Plus adds longer and custom periods, comparison with the previous period, and export.</Text>
      )}

      <Text style={styles.fineprint}>These figures summarise what you recorded. They are not a diagnosis — discuss your readings with your doctor.</Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, paddingTop: 20 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderWidth: 1, borderColor: C.hair, borderRadius: 999, paddingVertical: 8, paddingHorizontal: 13, backgroundColor: C.panel },
  chipOn: { backgroundColor: C.ink, borderColor: C.ink },
  chipLabel: { fontFamily: SANS.semibold, fontSize: 13.5, color: C.ink },
  chipLabelOn: { color: '#FFFFFF' },
  customRow: { flexDirection: 'row', gap: 8, marginTop: 10 },
  noteCard: { marginTop: 10, padding: 16 },
  noteText: { fontFamily: SANS.regular, fontSize: 14.5, color: C.ink2, lineHeight: 20 },
  title: { fontFamily: SANS.semibold, fontSize: 16, color: C.ink, lineHeight: 22 },
  statRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 7, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.hair },
  statLabel: { fontFamily: SANS.regular, fontSize: 14, color: C.ink3, flexShrink: 1, paddingRight: 8 },
  statValue: { fontFamily: SANS.semibold, fontSize: 14, color: C.ink },
  fineprint: { fontFamily: SANS.regular, fontSize: 13, color: C.ink3, lineHeight: 19, marginTop: 14, paddingHorizontal: 4 },
});
