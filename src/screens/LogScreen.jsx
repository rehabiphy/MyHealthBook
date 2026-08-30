import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { C } from '../theme/colors';
import { SANS } from '../theme/typography';
import { BANDS, BMI_BANDS, bmiOf, classifyBMI, classifyBP, classifySugar, fmtDay, fmtTime, kg1, uid } from '../lib/calc';
import { useData } from '../state/DataContext';
import Head from '../components/atoms/Head';
import Card from '../components/atoms/Card';
import Seg from '../components/atoms/Seg';
import Stepper from '../components/atoms/Stepper';
import Scale from '../components/charts/Scale';
import Btn from '../components/atoms/Btn';
import Mono from '../components/atoms/Mono';
import Press from '../components/atoms/Press';
import Toast from '../components/atoms/Toast';
import { G } from '../components/icons/ScreenGlyphs';

const TABS = [
  { value: 'bp', label: 'Pressure' },
  { value: 'body', label: 'Body' },
  { value: 'sugar', label: 'Sugar' },
];

export default function LogScreen() {
  const { data, setData } = useData();
  const [tab, setTab] = useState('bp');
  const [sys, setSys] = useState(120);
  const [dia, setDia] = useState(80);
  const [pulse, setPulse] = useState(72);
  const [kg, setKg] = useState(data.body[0]?.weightKg || 65);
  const [cm, setCm] = useState(+data.profile.heightCm || 170);
  const [mgdl, setMgdl] = useState(95);
  const [kind, setKind] = useState('fasting');
  const [toast, setToast] = useState('');

  const flash = m => {
    setToast(m);
    setTimeout(() => setToast(''), 1800);
  };
  const cat = classifyBP(sys, dia);
  const bmi = bmiOf(kg, cm);

  const list =
    tab === 'bp'
      ? data.bp.map(r => ({ ...r, main: `${r.sys}/${r.dia}`, unit: 'mmHg', sub: r.pulse ? `${r.pulse} bpm` : '', cat: classifyBP(r.sys, r.dia) }))
      : tab === 'body'
      ? data.body.map(r => {
          const b = bmiOf(r.weightKg, data.profile.heightCm);
          return { ...r, main: kg1(r.weightKg), unit: 'kg', sub: b ? `bmi ${b}` : '', cat: classifyBMI(b) || { color: C.ink3, label: '' } };
        })
      : data.sugar.map(r => ({ ...r, main: `${r.mgdl}`, unit: 'mg/dl', sub: r.kind === 'fasting' ? 'fasting' : 'after meal', cat: classifySugar(r.mgdl, r.kind) }));

  const remove = id => setData(d => ({ ...d, bp: d.bp.filter(r => r.id !== id), body: d.body.filter(r => r.id !== id), sugar: d.sugar.filter(r => r.id !== id) }));

  return (
    <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={styles.container}>
        <Head title="Readings" caption="pressure · body · sugar" icon={G.readings(C.low)} tint={C.low} />
        <Seg value={tab} onChange={setTab} options={TABS} />

        <Card style={{ marginTop: 12, paddingTop: 4 }}>
          {tab === 'bp' && (
            <>
              <Stepper label="Systolic — upper" unit="mmHg" value={sys} set={setSys} min={70} max={220} />
              <Stepper label="Diastolic — lower" unit="mmHg" value={dia} set={setDia} min={40} max={140} />
              <Stepper label="Pulse" unit="bpm" value={pulse} set={setPulse} min={35} max={200} />
              <View style={{ paddingTop: 16 }}>
                <View style={styles.catRow}>
                  <View style={[styles.catDot, { backgroundColor: cat.color }]} />
                  <Text style={styles.catLabel}>{cat.label}</Text>
                </View>
                <Scale bands={BANDS} value={sys} min={80} max={180} label="systolic" />
                <Btn
                  style={{ marginTop: 16 }}
                  onClick={() => {
                    setData(d => ({ ...d, bp: [{ id: uid(), ts: Date.now(), sys, dia, pulse }, ...d.bp] }));
                    flash('Reading saved');
                  }}>
                  Save reading
                </Btn>
              </View>
            </>
          )}

          {tab === 'body' && (
            <>
              <Stepper label="Height" unit="cm" value={cm} set={setCm} min={120} max={215} />
              <Stepper label="Weight" unit="kg" value={kg} set={setKg} min={25} max={200} step={0.1} decimals={1} />
              <View style={{ paddingTop: 16 }}>
                <View style={styles.bmiRow}>
                  <Text style={styles.bmiValue}>{bmi}</Text>
                  <Text style={[styles.bmiTag, { color: classifyBMI(bmi).color }]}>{classifyBMI(bmi).label}</Text>
                </View>
                <Scale bands={BMI_BANDS} value={bmi} min={14} max={40} label="bmi" />
                <Text style={styles.hint}>Set to Asia-Pacific cut-offs: the healthy band ends at 23, not 25.</Text>
                <Btn
                  style={{ marginTop: 16 }}
                  onClick={() => {
                    setData(d => ({ ...d, profile: { ...d.profile, heightCm: cm }, body: [{ id: uid(), ts: Date.now(), weightKg: kg }, ...d.body] }));
                    flash('Weight saved');
                  }}>
                  Save weight
                </Btn>
              </View>
            </>
          )}

          {tab === 'sugar' && (
            <>
              <View style={{ paddingTop: 18 }}>
                <Seg
                  value={kind}
                  onChange={setKind}
                  options={[
                    { value: 'fasting', label: 'Fasting' },
                    { value: 'post', label: 'After meal' },
                  ]}
                />
              </View>
              <Stepper label="Glucose" unit="mg/dL" value={mgdl} set={setMgdl} min={40} max={500} />
              <View style={{ paddingTop: 16 }}>
                <View style={styles.catRow}>
                  <View style={[styles.catDot, { backgroundColor: classifySugar(mgdl, kind).color }]} />
                  <Text style={styles.catLabel}>{classifySugar(mgdl, kind).label}</Text>
                </View>
                <Btn
                  style={{ marginTop: 16 }}
                  onClick={() => {
                    setData(d => ({ ...d, sugar: [{ id: uid(), ts: Date.now(), mgdl, kind }, ...d.sugar] }));
                    flash('Reading saved');
                  }}>
                  Save reading
                </Btn>
              </View>
            </>
          )}
        </Card>

        <View style={styles.historyHeader}>
          <Mono>History</Mono>
        </View>
        {list.length === 0 ? (
          <Card>
            <Text style={styles.emptyText}>Nothing saved here yet.</Text>
          </Card>
        ) : (
          list.map(r => (
            <View key={r.id} style={styles.historyRow}>
              <View style={styles.historyLeft}>
                <View style={[styles.historyBar, { backgroundColor: r.cat.color }]} />
                <View>
                  <View style={styles.historyMainRow}>
                    <Text style={styles.historyMain}>{r.main}</Text>
                    <Mono>{r.unit}</Mono>
                    {r.sub ? <Mono>· {r.sub}</Mono> : null}
                  </View>
                  <Mono style={{ marginTop: 3 }}>
                    {fmtDay(r.ts)} · {fmtTime(r.ts)} · {r.cat.label}
                  </Mono>
                </View>
              </View>
              <Press onPress={() => remove(r.id)} style={{ padding: 6 }}>
                <Svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke={C.ink3} strokeWidth="1.8" strokeLinecap="round">
                  <Path d="M5 7h14M10 7V5h4v2M7 7l1 12h8l1-12" />
                </Svg>
              </Press>
            </View>
          ))
        )}
      </ScrollView>
      <Toast bottom={96}>{toast}</Toast>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, paddingTop: 20, paddingBottom: 120 },
  catRow: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  catDot: { width: 8, height: 8, borderRadius: 99 },
  catLabel: { fontFamily: SANS.semibold, fontSize: 15, letterSpacing: -0.3, color: C.ink },
  bmiRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  bmiValue: { fontFamily: SANS.bold, fontSize: 34, letterSpacing: -1.7, color: C.ink },
  bmiTag: { fontFamily: SANS.semibold, fontSize: 14 },
  hint: { fontFamily: SANS.regular, fontSize: 14.5, color: C.ink2, lineHeight: 21, marginTop: 4 },
  historyHeader: { paddingTop: 26, paddingHorizontal: 4, paddingBottom: 10 },
  emptyText: { fontFamily: SANS.regular, fontSize: 14, color: C.ink2 },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.hair,
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  historyLeft: { flexDirection: 'row', alignItems: 'center', gap: 13, flex: 1, minWidth: 0 },
  historyBar: { width: 3, height: 32, borderRadius: 99 },
  historyMainRow: { flexDirection: 'row', alignItems: 'baseline', gap: 5 },
  historyMain: { fontFamily: SANS.bold, fontSize: 17, letterSpacing: -0.5, color: C.ink },
});
