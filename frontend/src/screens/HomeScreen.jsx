import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { C, GLASS } from '../theme/colors';
import { SANS } from '../theme/typography';
import { GRAD } from '../theme/gradients';
import { bmiOf, classifyBMI, classifyBP, classifySugar, fmtDay, fmtTime, kg1 } from '../lib/calc';
import { dosesToday, isTaken, prettyTime, slotOf } from '../lib/meds';
import { displayName, greeting, greetingName } from '../lib/appName';
import { upcomingOf } from '../lib/summary';
import { useData } from '../state/DataContext';
import { useAuth } from '../state/AuthContext';
import { useSubscription } from '../state/SubscriptionContext';
import { useGo } from '../navigation/useGo';
import Screen, { IconButton, Section } from '../components/layout/Screen';
import Card from '../components/atoms/Card';
import Chip from '../components/atoms/Chip';
import Btn from '../components/atoms/Btn';
import Press from '../components/atoms/Press';
import GradientText from '../components/atoms/GradientText';
import DoseCheckbox from '../components/atoms/DoseCheckbox';
import Trend from '../components/charts/Trend';
import { GaugeGlyph, PulseGlyph, G } from '../components/icons/ScreenGlyphs';

const todayLabel = () => new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });

// one latest reading: what it is, its value, and how recent
function VitalTile({ glyph, color, name, value, unit, note, noteColor, onPress }) {
  return (
    <Card style={styles.vital} onPress={onPress}>
      <View style={styles.vitalHead}>
        <Chip color={color} size={32}>
          {glyph}
        </Chip>
        <Text style={styles.vitalName} numberOfLines={1}>
          {name}
        </Text>
      </View>
      <View style={styles.vitalValueRow}>
        <Text style={styles.vitalValue}>{value}</Text>
        {unit ? <Text style={styles.vitalUnit}>{unit}</Text> : null}
      </View>
      <Text style={[styles.vitalNote, noteColor && { color: noteColor, fontFamily: SANS.semibold }]} numberOfLines={1}>
        {note}
      </Text>
    </Card>
  );
}

// a shortcut into another part of the book
function Shortcut({ icon, tint, title, sub, onPress }) {
  return (
    <Press onPress={onPress} style={styles.shortcut} accessibilityRole="button" accessibilityLabel={title}>
      <View style={[styles.shortcutIcon, { backgroundColor: `${tint}22` }]}>{icon}</View>
      <Text style={styles.shortcutTitle}>{title}</Text>
      <Text style={styles.shortcutSub} numberOfLines={2}>
        {sub}
      </Text>
    </Press>
  );
}

const Drop = ({ c }) => (
  <Svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
    <Path d="M12 3.5s-6 6.6-6 10.9a6 6 0 0 0 12 0C18 10.1 12 3.5 12 3.5z" />
  </Svg>
);
const Scale = ({ c }) => (
  <Svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
    <Path d="M5 4.5h14l-1.5 15h-11z" />
    <Path d="M9.5 9.5a2.5 2.5 0 0 1 5 0" />
  </Svg>
);
const Bell = ({ c }) => (
  <Svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
    <Path d="M18 9a6 6 0 1 0-12 0c0 5-2 6.5-2 6.5h16S18 14 18 9z" />
    <Path d="M13.7 19.5a2 2 0 0 1-3.4 0" />
  </Svg>
);
const People = ({ c }) => (
  <Svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <Path d="M9 11.5a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM16.5 12a2.2 2.2 0 1 0 0-4.4 2.2 2.2 0 0 0 0 4.4z" />
    <Path d="M3.5 19c1-2.6 3-4 5.5-4s4.5 1.4 5.5 4M16 14.2c2 .2 3.5 1.5 4.3 3.4" />
  </Svg>
);

/* Home answers three questions, in this order: what do I need to do
   today (medicines), how am I doing (latest readings), and where is
   everything else (shortcuts). Nothing else competes for the space. */
export default function HomeScreen() {
  const { data, toggleDoseTaken } = useData();
  const { user } = useAuth();
  const { tier } = useSubscription();
  const go = useGo();
  const [busy, setBusy] = useState(null);

  const bp = data.bp[0];
  const w = data.body[0];
  const sugar = data.sugar[0];
  const bmi = bmiOf(w?.weightKg, data.profile.heightCm);
  const cat = bp ? classifyBP(bp.sys, bp.dia) : null;
  const rows = useMemo(() => [...data.bp].slice(0, 10).reverse(), [data.bp]);
  const [picked, setPicked] = useState(null);
  const shown = picked != null ? rows[picked] : rows[rows.length - 1];

  const doses = dosesToday(data);
  const taken = doses.filter(x => isTaken(data, x.id)).length;
  const due = doses.filter(x => !isTaken(data, x.id));
  const next = upcomingOf(data)[0];
  const when = ts => `${fmtDay(ts)}, ${fmtTime(ts)}`;
  const name = displayName(data.profile, user);

  const take = async dose => {
    if (busy) return;
    setBusy(dose.id);
    try {
      await toggleDoseTaken(dose.id);
    } catch {
      // the Medicines page shows errors; this is a shortcut
    } finally {
      setBusy(null);
    }
  };

  return (
    <Screen
      title={name ? `${greeting()}, ${greetingName(name)}` : greeting()}
      subtitle={todayLabel()}
      right={
        <>
          <IconButton label="Learn" onPress={() => go('learn')}>
            {G.learn(C.ink)}
          </IconButton>
          <IconButton label="Today's medicines" onPress={() => go('meds')} badge={due.length > 0}>
            <Bell c={C.ink} />
          </IconButton>
        </>
      }
    >
      {/* ── today's medicines ── */}
      <Section first title="Today's medicines" action={doses.length ? 'See all' : null} onAction={() => go('meds')}>
        {doses.length === 0 ? (
          <Card style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>{data.meds.length ? 'No doses left to schedule today' : 'Add your medicines'}</Text>
            <Text style={styles.emptyText}>{data.meds.length ? 'Your medicine list is up to date.' : 'Get a reminder at the right time for every dose, and a warning before a strip runs out.'}</Text>
            {!data.meds.length && (
              <Btn style={{ marginTop: 14 }} onClick={() => go('meds')}>
                Add a medicine
              </Btn>
            )}
          </Card>
        ) : (
          <Card style={styles.medsCard}>
            <View style={styles.progressHead}>
              <Text style={styles.progressText}>{taken === doses.length ? 'All doses taken today' : `${taken} of ${doses.length} doses taken`}</Text>
              <Text style={styles.progressPct}>{Math.round((taken / doses.length) * 100)}%</Text>
            </View>
            <View style={styles.track}>
              <View style={[styles.fill, { width: `${(taken / doses.length) * 100}%` }]} />
            </View>
            {(due.length ? due : doses).slice(0, 3).map((d, i, arr) => {
              const done = isTaken(data, d.id);
              return (
                <View key={d.id} style={[styles.doseRow, i < arr.length - 1 && styles.rowBorder]}>
                  <DoseCheckbox done={done} size={32} onPress={() => (done ? go('meds') : take(d))} />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={[styles.doseName, done && styles.doseDone]} numberOfLines={1}>
                      {d.med.name}
                      {d.med.dose ? <Text style={styles.doseDose}>{`  ${d.med.dose}`}</Text> : null}
                    </Text>
                    <Text style={styles.doseWhen}>
                      {slotOf(d.slot).label} · {prettyTime(d.time)}
                    </Text>
                  </View>
                </View>
              );
            })}
            {due.length > 3 && <Text style={styles.moreText}>+{due.length - 3} more still to take</Text>}
          </Card>
        )}
      </Section>

      {/* ── latest readings ── */}
      <Section title="Latest readings" action="Add reading" onAction={() => go('log', { add: Date.now() })}>
        <View style={styles.grid}>
          <VitalTile
            glyph={<GaugeGlyph c={cat ? cat.color : C.low} />}
            color={cat ? cat.color : C.low}
            name="Blood pressure"
            value={bp ? `${bp.sys}/${bp.dia}` : '—'}
            unit={bp ? 'mmHg' : ''}
            note={bp ? cat.label : 'Not recorded yet'}
            noteColor={bp ? cat.color : null}
            onPress={() => go('log', { tab: 'bp' })}
          />
          <VitalTile
            glyph={<PulseGlyph c={C.stage2} />}
            color={C.stage2}
            name="Heart rate"
            value={bp?.pulse || '—'}
            unit={bp?.pulse ? 'bpm' : ''}
            note={bp?.pulse ? when(bp.ts) : 'Not recorded yet'}
            onPress={() => go('log', { tab: 'bp' })}
          />
        </View>
        <View style={[styles.grid, { marginTop: 10 }]}>
          <VitalTile
            glyph={<Drop c={C.low} />}
            color={C.low}
            name="Blood sugar"
            value={sugar?.mgdl ?? '—'}
            unit={sugar ? 'mg/dL' : ''}
            note={sugar ? classifySugar(sugar.mgdl, sugar.kind).label : 'Not recorded yet'}
            noteColor={sugar ? classifySugar(sugar.mgdl, sugar.kind).color : null}
            onPress={() => go('log', { tab: 'sugar' })}
          />
          <VitalTile
            glyph={<Scale c={C.normal} />}
            color={C.normal}
            name="Weight"
            value={w ? kg1(w.weightKg) : '—'}
            unit={w ? 'kg' : ''}
            note={bmi ? `BMI ${bmi} · ${classifyBMI(bmi).label}` : w ? when(w.ts) : 'Not recorded yet'}
            noteColor={bmi ? classifyBMI(bmi).color : null}
            onPress={() => go('log', { tab: 'body' })}
          />
        </View>
        {bp && <Text style={styles.asOf}>Blood pressure last recorded {when(bp.ts).toLowerCase()}</Text>}
      </Section>

      {/* ── BP trend ── */}
      {rows.length > 1 && (
        <Section title="Blood pressure" action="See trends" onAction={() => go('trends')}>
          <Card style={{ paddingBottom: 14 }}>
            <View style={styles.legendRow}>
              <View style={styles.legendItem}>
                <View style={[styles.legendSwatch, { backgroundColor: C.stage1 }]} />
                <Text style={styles.legendText}>Systolic</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendSwatch, { backgroundColor: C.brand }]} />
                <Text style={styles.legendText}>Diastolic</Text>
              </View>
            </View>
            <Trend rows={rows} picked={picked} onPick={setPicked} />
            {shown && (
              <View style={styles.trendFooter}>
                <Text style={styles.trendWhen}>{when(shown.ts)}</Text>
                <Text style={styles.trendReading}>
                  {shown.sys}/{shown.dia} <Text style={{ color: classifyBP(shown.sys, shown.dia).color }}>{classifyBP(shown.sys, shown.dia).label}</Text>
                </Text>
              </View>
            )}
          </Card>
        </Section>
      )}

      {/* ── upcoming follow-up ── */}
      {next && (
        <Section title="Next appointment">
          <Card onPress={() => go('health')}>
            <Text style={styles.apptTitle}>{next.title}</Text>
            <Text style={styles.apptSub}>
              {new Date(next.date).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}
              {next.doctor ? ` · ${next.doctor}` : ''}
            </Text>
          </Card>
        </Section>
      )}

      {/* ── everything else ── */}
      <Section title="Your health book">
        <View style={styles.shortcuts}>
          <Shortcut icon={G.health(C.stage2)} tint={C.stage2} title="Health summary" sub="Conditions, allergies, follow-ups" onPress={() => go('health')} />
          <Shortcut icon={G.readings(C.low)} tint={C.low} title="Trends" sub="Your readings over time" onPress={() => go('trends')} />
          <Shortcut icon={G.insights(C.brand2)} tint={C.brand2} title="AI insights" sub="Your trends, explained simply" onPress={() => go('insights')} />
          <Shortcut icon={G.coach(C.elevated)} tint={C.elevated} title="AI coach" sub="Ask about food and exercise" onPress={() => go('coach')} />
          <Shortcut icon={<People c={C.normal} />} tint={C.normal} title="Family" sub="Share and care together" onPress={() => go('family')} />
          <Shortcut icon={G.learn(C.low)} tint={C.low} title="Learn" sub="Short, reliable reads" onPress={() => go('learn')} />
        </View>
      </Section>

      {tier === 'free' && (
        <Press onPress={() => go('premium')} style={styles.planStrip}>
          <View style={styles.planDot}>
            <GradientText gradient={GRAD} style={styles.planStar}>
              ✦
            </GradientText>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.planTitle}>MyHealthBook Plus</Text>
            <Text style={styles.planSub}>Longer trends, doctor-ready summary, more storage — from ₹49/month</Text>
          </View>
        </Press>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  emptyCard: { padding: 18 },
  emptyTitle: { fontFamily: SANS.semibold, fontSize: 17, color: C.ink },
  emptyText: { fontFamily: SANS.regular, fontSize: 15, lineHeight: 21, color: C.ink2, marginTop: 4 },
  medsCard: { padding: 0 },
  progressHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', paddingHorizontal: 18, paddingTop: 16 },
  progressText: { fontFamily: SANS.semibold, fontSize: 16, color: C.ink },
  progressPct: { fontFamily: SANS.bold, fontSize: 16, color: C.brand2 },
  track: { height: 8, borderRadius: 4, backgroundColor: 'rgba(22,36,28,0.08)', marginHorizontal: 18, marginTop: 10, marginBottom: 6, overflow: 'hidden' },
  fill: { height: 8, borderRadius: 4, backgroundColor: C.brand },
  doseRow: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14, paddingHorizontal: 18 },
  rowBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.hair },
  doseName: { fontFamily: SANS.semibold, fontSize: 17, color: C.ink },
  doseDose: { fontFamily: SANS.regular, fontSize: 15, color: C.ink2 },
  doseDone: { color: C.ink3, textDecorationLine: 'line-through' },
  doseWhen: { fontFamily: SANS.regular, fontSize: 15, color: C.ink2, marginTop: 2 },
  moreText: { fontFamily: SANS.medium, fontSize: 14.5, color: C.ink3, paddingHorizontal: 18, paddingBottom: 14 },
  grid: { flexDirection: 'row', gap: 10 },
  vital: { flex: 1, padding: 16 },
  vitalHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  vitalName: { flex: 1, fontFamily: SANS.medium, fontSize: 14.5, color: C.ink2 },
  vitalValueRow: { flexDirection: 'row', alignItems: 'baseline', gap: 5, marginTop: 12 },
  vitalValue: { fontFamily: SANS.bold, fontSize: 28, letterSpacing: -1, color: C.ink },
  vitalUnit: { fontFamily: SANS.medium, fontSize: 14, color: C.ink3 },
  vitalNote: { fontFamily: SANS.regular, fontSize: 14, color: C.ink3, marginTop: 4 },
  asOf: { fontFamily: SANS.regular, fontSize: 13.5, color: C.ink3, marginTop: 8, paddingHorizontal: 4 },
  legendRow: { flexDirection: 'row', justifyContent: 'flex-end', gap: 14 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendSwatch: { width: 12, height: 3, borderRadius: 9 },
  legendText: { fontFamily: SANS.medium, fontSize: 13.5, color: C.ink2 },
  trendFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.hair, paddingTop: 12 },
  trendWhen: { fontFamily: SANS.regular, fontSize: 14.5, color: C.ink2 },
  trendReading: { fontFamily: SANS.bold, fontSize: 15.5, color: C.ink },
  apptTitle: { fontFamily: SANS.semibold, fontSize: 17, color: C.ink },
  apptSub: { fontFamily: SANS.regular, fontSize: 15, color: C.ink2, marginTop: 3 },
  shortcuts: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  shortcut: { width: '47%', flexGrow: 1, ...GLASS, borderRadius: 22, padding: 16 },
  shortcutIcon: { width: 42, height: 42, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  shortcutTitle: { fontFamily: SANS.semibold, fontSize: 16.5, color: C.ink, marginTop: 12 },
  shortcutSub: { fontFamily: SANS.regular, fontSize: 14, lineHeight: 19, color: C.ink3, marginTop: 2 },
  planStrip: { flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 20, backgroundColor: C.panelSoft, borderRadius: 20, padding: 16 },
  planDot: { width: 40, height: 40, borderRadius: 12, backgroundColor: C.cardSolid, alignItems: 'center', justifyContent: 'center' },
  planStar: { fontFamily: SANS.bold, fontSize: 20 },
  planTitle: { fontFamily: SANS.semibold, fontSize: 16, color: C.ink },
  planSub: { fontFamily: SANS.regular, fontSize: 14, lineHeight: 19, color: C.ink2, marginTop: 2 },
});
