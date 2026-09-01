import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { C } from '../theme/colors';
import { SANS } from '../theme/typography';
import { GRAD } from '../theme/gradients';
import { BANDS, bmiOf, classifyBMI, classifyBP, classifySugar, fmtDay, fmtTime } from '../lib/calc';
import { dosesToday, isTaken, prettyTime, slotOf } from '../lib/meds';
import { weeklyDue } from '../lib/family';
import { greeting } from '../lib/appName';
import { useData } from '../state/DataContext';
import { useGo } from '../navigation/useGo';
import Card from '../components/atoms/Card';
import Chip from '../components/atoms/Chip';
import Mono from '../components/atoms/Mono';
import GradientText from '../components/atoms/GradientText';
import DoseCheckbox from '../components/atoms/DoseCheckbox';
import Dial from '../components/charts/Dial';
import Trend from '../components/charts/Trend';
import { GaugeGlyph, PulseGlyph } from '../components/icons/ScreenGlyphs';
import Svg, { Path, Rect } from 'react-native-svg';

function Label({ children }) {
  return <Mono style={styles.sectionLabel}>{children}</Mono>;
}

function Tile({ glyph, color, name, value, unit, when, onPress }) {
  return (
    <Card style={{ flex: 1, padding: 16 }} onPress={onPress}>
      <View style={styles.tileHeader}>
        <Chip color={color}>{glyph}</Chip>
        <Mono style={styles.tileHeaderLabel}>{name}</Mono>
      </View>
      <View style={styles.tileValueRow}>
        <Text style={styles.tileValue}>{value}</Text>
        <Text style={styles.tileUnit}>{unit}</Text>
      </View>
      <Text style={styles.tileWhen}>{when}</Text>
    </Card>
  );
}

export default function HomeScreen() {
  const { data } = useData();
  const go = useGo();
  const bp = data.bp[0];
  const w = data.body[0];
  const sugar = data.sugar[0];
  const bmi = bmiOf(w?.weightKg, data.profile.heightCm);
  const cat = bp ? classifyBP(bp.sys, bp.dia) : null;
  const rows = useMemo(() => [...data.bp].slice(0, 10).reverse(), [data.bp]);
  const [picked, setPicked] = useState(null);
  const shown = picked != null ? rows[picked] : rows[rows.length - 1];
  const doses = dosesToday(data);
  const left = doses.filter(x => !isTaken(data, x.id));
  const hist = data.history || [];

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.greetingWrap}>
        <GradientText gradient={GRAD} style={styles.greeting}>
          {`${greeting()},\n${data.profile.name || 'there'}`}
        </GradientText>
      </View>

      <Card style={{ padding: 18 }} onPress={() => go('health')}>
        <View style={styles.bookRow}>
          <Chip color={C.brand} size={52}>
            <Svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={C.brand} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
              <Rect x="5" y="3.5" width="14" height="17" rx="2.5" />
              <Path d="M9 3.5h6v2.5H9z" />
              <Path d="M8.5 13h2l1.3-2.2 1.7 3.7 1.1-1.5h2.1" />
            </Svg>
          </Chip>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.bookTitle}>MyHealthBook</Text>
            <Text style={styles.bookSub}>Your health information, organised in one place.</Text>
          </View>
        </View>
      </Card>

      <View style={styles.sectionPad}>
        <Label>Today</Label>
      </View>
      <View style={styles.row}>
        <Tile
          glyph={<GaugeGlyph c={cat ? cat.color : C.low} />}
          color={cat ? cat.color : C.low}
          name="Blood pressure"
          value={bp ? `${bp.sys}/${bp.dia}` : '––'}
          unit="mmHg"
          when={bp ? `${fmtDay(bp.ts).toLowerCase()}, ${fmtTime(bp.ts)}` : 'not recorded'}
          onPress={() => go('log')}
        />
        <Tile
          glyph={<PulseGlyph c={C.stage2} />}
          color={C.stage2}
          name="Heart rate"
          value={bp?.pulse || '––'}
          unit="bpm"
          when={bp?.pulse ? `${fmtDay(bp.ts).toLowerCase()}, ${fmtTime(bp.ts)}` : 'not recorded'}
          onPress={() => go('log')}
        />
      </View>

      {bp && (
        <Card style={{ marginTop: 10, padding: 18 }} onPress={() => go('log')}>
          <View style={styles.bpRow}>
            <View style={styles.bpLeft}>
              <View style={[styles.dot, { backgroundColor: cat.color }]} />
              <View style={{ minWidth: 0 }}>
                <Text style={styles.bpLabel}>{cat.label}</Text>
                <Mono style={{ marginTop: 3 }}>{cat.note}</Mono>
              </View>
            </View>
            <View style={styles.dialWrap}>
              <Dial value={bp.sys} bands={BANDS} size={112} />
            </View>
          </View>
        </Card>
      )}

      {doses.length > 0 && (
        <>
          <View style={styles.sectionPad}>
            <View style={styles.medsHeaderRow}>
              <Mono>Medicines today</Mono>
              <Mono>
                {doses.length - left.length}/{doses.length} taken
              </Mono>
            </View>
          </View>
          <Card style={{ padding: 0, overflow: 'hidden' }}>
            {doses.slice(0, 4).map((d, i, arr) => {
              const done = isTaken(data, d.id);
              return (
                <View key={d.id} style={[styles.medRow, i < arr.length - 1 && styles.medRowBorder]}>
                  <DoseCheckbox done={done} onPress={() => go('meds')} />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={[styles.medName, done && styles.medNameDone]} numberOfLines={1}>
                      {d.med.name}
                    </Text>
                    <Text style={styles.medWhen}>
                      {slotOf(d.slot).label} · {prettyTime(d.time)}
                    </Text>
                  </View>
                </View>
              );
            })}
            {doses.length > 4 && (
              <View style={[styles.moreRow]}>
                <Mono>+{doses.length - 4} more today</Mono>
              </View>
            )}
          </Card>
        </>
      )}

      <View style={styles.sectionPad}>
        <Label>Body and sugar</Label>
      </View>
      <View style={styles.row}>
        <Card style={{ flex: 1, padding: 16 }} onPress={() => go('log')}>
          <Mono>Body mass</Mono>
          <View style={styles.statValueRow}>
            <Text style={styles.statValue}>{bmi ?? '––'}</Text>
            <Text style={styles.statUnit}>bmi</Text>
          </View>
          <Text style={[styles.statTag, { color: bmi ? classifyBMI(bmi).color : C.ink3 }]}>{bmi ? classifyBMI(bmi).label : 'add height & weight'}</Text>
        </Card>
        <Card style={{ flex: 1, padding: 16 }} onPress={() => go('log')}>
          <Mono>Blood sugar</Mono>
          <View style={styles.statValueRow}>
            <Text style={styles.statValue}>{sugar?.mgdl ?? '––'}</Text>
            <Text style={styles.statUnit}>mg/dl</Text>
          </View>
          <Text style={[styles.statTag, { color: sugar ? classifySugar(sugar.mgdl, sugar.kind).color : C.ink3 }]}>
            {sugar ? classifySugar(sugar.mgdl, sugar.kind).label : 'not recorded'}
          </Text>
        </Card>
      </View>

      {rows.length > 1 && (
        <>
          <View style={styles.sectionPad}>
            <Label>Last {rows.length} readings</Label>
          </View>
          <Card style={{ paddingBottom: 14 }}>
            <View style={styles.legendRow}>
              <View style={styles.legendItem}>
                <View style={[styles.legendSwatch, { backgroundColor: C.stage1 }]} />
                <Mono>sys</Mono>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendSwatch, { backgroundColor: C.brand }]} />
                <Mono>dia</Mono>
              </View>
            </View>
            <Trend rows={rows} picked={picked} onPick={setPicked} />
            {shown && (
              <View style={styles.trendFooter}>
                <Mono>
                  {fmtDay(shown.ts)} · {fmtTime(shown.ts)}
                </Mono>
                <View style={styles.trendFooterRight}>
                  <Text style={styles.trendReading}>
                    {shown.sys}/{shown.dia}
                  </Text>
                  <Text style={[styles.trendCat, { color: classifyBP(shown.sys, shown.dia).color }]}>{classifyBP(shown.sys, shown.dia).label}</Text>
                </View>
              </View>
            )}
          </Card>
        </>
      )}

      <View style={styles.sectionPad}>
        <Label>Your health</Label>
      </View>
      {weeklyDue(data) && (
        <Card style={{ marginBottom: 10 }} onPress={() => go('me')}>
          <Mono style={{ color: C.brand }}>Weekly update ready</Mono>
          <Text style={styles.weeklyTitle}>Send this week to {data.care.circle.filter(m => m.weekly).map(m => m.name).join(', ')}</Text>
        </Card>
      )}
      <View style={styles.row}>
        <Card style={{ flex: 1, padding: 18 }} onPress={() => go('health')}>
          <Mono>Health summary</Mono>
          <Text style={styles.linkTitle}>
            {(data.health?.conditions?.length || 0) > 0 ? `${data.health.conditions.length} condition${data.health.conditions.length === 1 ? '' : 's'}` : 'Set up'}
          </Text>
          <Mono style={{ marginTop: 5 }}>{data.health?.bloodGroup ? `blood ${data.health.bloodGroup}` : 'what matters today'}</Mono>
        </Card>
        <Card style={{ flex: 1, padding: 18 }} onPress={() => go('history')}>
          <Mono>Medical records</Mono>
          <Text style={styles.linkTitle}>{hist.length > 0 ? `${hist.length} record${hist.length === 1 ? '' : 's'}` : 'Add the past'}</Text>
          <Mono style={{ marginTop: 5 }}>{hist.length ? `last ${fmtDay([...hist].sort((a, b) => b.date - a.date)[0].date).toLowerCase()}` : 'tests, scans, surgery'}</Mono>
        </Card>
      </View>

      <Card style={{ marginTop: 10 }} onPress={() => go('coach')}>
        <Mono style={{ color: C.brand }}>AI coach</Mono>
        <Text style={styles.weeklyTitle}>What to eat, how to move</Text>
        <Text style={styles.coachSub}>Meals and workouts built from your own numbers.</Text>
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, paddingBottom: 120 },
  greetingWrap: { paddingTop: 26, paddingBottom: 20, paddingHorizontal: 4 },
  greeting: { fontFamily: SANS.bold, fontSize: 31, letterSpacing: -1.2, lineHeight: 36 },
  bookRow: { flexDirection: 'row', alignItems: 'center', gap: 15 },
  bookTitle: { fontFamily: SANS.bold, fontSize: 19, letterSpacing: -0.55, color: C.ink },
  bookSub: { fontFamily: SANS.regular, fontSize: 15, color: C.ink2, marginTop: 3, lineHeight: 21 },
  sectionPad: { paddingTop: 26, paddingBottom: 10 },
  sectionLabel: { paddingHorizontal: 4 },
  row: { flexDirection: 'row', gap: 10 },
  tileHeader: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  tileHeaderLabel: { flex: 1, flexShrink: 1 },
  tileValueRow: { flexDirection: 'row', alignItems: 'baseline', gap: 5, marginTop: 14 },
  tileValue: { fontFamily: SANS.bold, fontSize: 30, letterSpacing: -1.3, color: C.ink },
  tileUnit: { fontFamily: SANS.medium, fontSize: 14, color: C.ink3 },
  tileWhen: { fontFamily: SANS.regular, fontSize: 14.5, color: C.ink3, marginTop: 6 },
  bpRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  bpLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 },
  dot: { width: 9, height: 9, borderRadius: 99, flexShrink: 0 },
  bpLabel: { fontFamily: SANS.semibold, fontSize: 15.5, letterSpacing: -0.3, color: C.ink },
  dialWrap: { flexShrink: 0, marginRight: -6, marginBottom: -18, marginTop: -18, opacity: 0.95 },
  medsHeaderRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', paddingHorizontal: 4, paddingBottom: 10 },
  medRow: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 15, paddingHorizontal: 17 },
  medRowBorder: { borderBottomWidth: 1, borderBottomColor: C.hair },
  medName: { fontFamily: SANS.semibold, fontSize: 16.5, letterSpacing: -0.3, color: C.ink },
  medNameDone: { color: C.ink3, textDecorationLine: 'line-through' },
  medWhen: { fontFamily: SANS.regular, fontSize: 15, color: C.ink3, marginTop: 3 },
  moreRow: { paddingVertical: 13, paddingHorizontal: 17, borderTopWidth: 1, borderTopColor: C.hair },
  statValueRow: { flexDirection: 'row', alignItems: 'baseline', gap: 5, marginTop: 12 },
  statValue: { fontFamily: SANS.bold, fontSize: 28, letterSpacing: -1.25, color: C.ink },
  statUnit: { fontFamily: SANS.regular, fontSize: 14, color: C.ink3 },
  statTag: { fontFamily: SANS.semibold, fontSize: 14.5, marginTop: 6 },
  legendRow: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendSwatch: { width: 10, height: 2, borderRadius: 9 },
  trendFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: C.hair, paddingTop: 12 },
  trendFooterRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  trendReading: { fontFamily: SANS.bold, fontSize: 15, letterSpacing: -0.3, color: C.ink },
  trendCat: { fontFamily: SANS.semibold, fontSize: 14 },
  // no colour override here on purpose — these read as the same neutral glass as every
  // other card, with green carried only by the "Weekly update"/"AI coach" label text
  weeklyTitle: { fontFamily: SANS.semibold, fontSize: 16, letterSpacing: -0.4, marginTop: 7, color: C.ink },
  linkTitle: { fontFamily: SANS.semibold, fontSize: 17, letterSpacing: -0.4, marginTop: 9, lineHeight: 21, color: C.ink },
  coachSub: { fontFamily: SANS.regular, fontSize: 15, color: C.ink2, marginTop: 5, lineHeight: 21 },
});
