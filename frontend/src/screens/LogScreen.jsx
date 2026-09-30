import React, { useContext, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Svg, { Path } from 'react-native-svg';
import { C, GLASS } from '../theme/colors';
import { SANS } from '../theme/typography';
import { BANDS, BMI_BANDS, bmiOf, classifyBMI, classifyBP, classifySugar, fmtDay, fmtTime, kg1 } from '../lib/calc';
import { useData } from '../state/DataContext';
import { useSubscription, FEATURES } from '../state/SubscriptionContext';
import { useAsk } from '../state/AskDialogContext';
import { useGo } from '../navigation/useGo';
import { useTabBarTop } from '../navigation/TabBar';
import Screen, { EmbeddedContext, Section } from '../components/layout/Screen';
import Sheet from '../components/layout/Sheet';
import Card from '../components/atoms/Card';
import Seg from '../components/atoms/Seg';
import Stepper from '../components/atoms/Stepper';
import Scale from '../components/charts/Scale';
import Btn from '../components/atoms/Btn';
import Press from '../components/atoms/Press';
import Toast from '../components/atoms/Toast';
import BpUpgradeBanner from '../components/BpUpgradeBanner';

const UPGRADE_BANNER_KEY = 'upgradeBannerLastShownAt';
const UPGRADE_BANNER_THROTTLE_MS = 3 * 24 * 60 * 60 * 1000;

const TABS = [
  { value: 'bp', label: 'Blood pressure' },
  { value: 'sugar', label: 'Sugar' },
  { value: 'body', label: 'Weight' },
];

const TAB_NAME = { bp: 'blood pressure', sugar: 'blood sugar', body: 'weight' };

/* Readings: pick a kind, see the latest and the full history, and add
   a new one in a sheet (so the form never pushes the history off the
   page). Opened with { tab, add } from Home's shortcuts. */
export default function LogScreen({ route }) {
  const { data, addBpReading, addBodyReading, addSugarReading, deleteReading } = useData();
  const embedded = useContext(EmbeddedContext);
  const ask = useAsk();
  const go = useGo();
  const tabTop = useTabBarTop();
  const [tab, setTab] = useState('bp');
  const [adding, setAdding] = useState(false);
  const [sys, setSys] = useState(120);
  const [dia, setDia] = useState(80);
  const [pulse, setPulse] = useState(72);
  const [kg, setKg] = useState(data.body[0]?.weightKg || 65);
  const [cm, setCm] = useState(+data.profile.heightCm || 170);
  const [mgdl, setMgdl] = useState(95);
  const [kind, setKind] = useState('fasting');
  const [toast, setToast] = useState('');
  const [saving, setSaving] = useState(false);
  const [showUpgradeBanner, setShowUpgradeBanner] = useState(false);

  const { can } = useSubscription();
  const hasTrends = can(FEATURES.ADVANCED_TRENDS);

  // shortcuts from Home: open on a kind, and/or straight into "add"
  const { tab: tabParam, add: addParam } = route?.params || {};
  useEffect(() => {
    if (tabParam) setTab(tabParam);
  }, [tabParam]);
  useEffect(() => {
    if (addParam) setAdding(true);
  }, [addParam]);

  // start the form from the latest reading, so small changes are a tap or two
  const openAdd = () => {
    if (data.bp[0]) {
      setSys(data.bp[0].sys);
      setDia(data.bp[0].dia);
      if (data.bp[0].pulse) setPulse(data.bp[0].pulse);
    }
    if (data.body[0]) setKg(data.body[0].weightKg);
    setAdding(true);
  };

  const maybeShowUpgradeBanner = async () => {
    if (embedded || hasTrends || data.bp.length < 3) return;
    try {
      const lastShown = Number(await AsyncStorage.getItem(UPGRADE_BANNER_KEY)) || 0;
      if (Date.now() - lastShown < UPGRADE_BANNER_THROTTLE_MS) return;
      await AsyncStorage.setItem(UPGRADE_BANNER_KEY, String(Date.now()));
      setShowUpgradeBanner(true);
    } catch {
      // AsyncStorage hiccup — skip the banner this time
    }
  };

  const flash = m => {
    setToast(m);
    setTimeout(() => setToast(''), 1800);
  };

  const save = async () => {
    setSaving(true);
    try {
      if (tab === 'bp') await addBpReading({ sys, dia, pulse });
      else if (tab === 'body') await addBodyReading({ weightKg: kg, heightCm: cm });
      else await addSugarReading({ mgdl, kind });
      setAdding(false);
      flash('Reading saved');
      if (tab === 'bp') maybeShowUpgradeBanner();
    } catch (err) {
      flash(err.message);
    } finally {
      setSaving(false);
    }
  };

  const cat = classifyBP(sys, dia);
  const bmi = bmiOf(kg, cm);

  const list =
    tab === 'bp'
      ? data.bp.map(r => ({ ...r, main: `${r.sys}/${r.dia}`, unit: 'mmHg', sub: r.pulse ? `Pulse ${r.pulse}` : '', cat: classifyBP(r.sys, r.dia) }))
      : tab === 'body'
      ? data.body.map(r => {
          const b = bmiOf(r.weightKg, data.profile.heightCm);
          return { ...r, main: kg1(r.weightKg), unit: 'kg', sub: b ? `BMI ${b}` : '', cat: classifyBMI(b) || { color: C.ink3, label: '' } };
        })
      : data.sugar.map(r => ({ ...r, main: `${r.mgdl}`, unit: 'mg/dL', sub: r.kind === 'fasting' ? 'Fasting' : 'After meal', cat: classifySugar(r.mgdl, r.kind) }));
  const latest = list[0];

  const remove = async r => {
    const ok = await ask({
      title: 'Delete this reading?',
      body: `${r.main} ${r.unit} from ${fmtDay(r.ts).toLowerCase()} will be removed.`,
      confirmLabel: 'Delete',
      cancelLabel: 'Keep',
      danger: true,
    });
    if (!ok) return;
    try {
      await deleteReading(tab, r.id);
    } catch (err) {
      flash(err.message);
    }
  };

  return (
    <View style={{ flex: 1 }}>
      <Screen title="Readings" subtitle="Blood pressure, sugar and weight">
        <Seg value={tab} onChange={setTab} options={TABS} />

        <Card style={styles.latestCard}>
          {latest ? (
            <>
              <Text style={styles.latestLabel}>Latest {TAB_NAME[tab]}</Text>
              <View style={styles.latestRow}>
                <Text style={styles.latestValue}>{latest.main}</Text>
                <Text style={styles.latestUnit}>{latest.unit}</Text>
              </View>
              <View style={styles.catRow}>
                {latest.cat.label ? <View style={[styles.catDot, { backgroundColor: latest.cat.color }]} /> : null}
                <Text style={styles.latestMeta}>{[latest.cat.label, latest.sub, `${fmtDay(latest.ts)}, ${fmtTime(latest.ts)}`].filter(Boolean).join(' · ')}</Text>
              </View>
            </>
          ) : (
            <>
              <Text style={styles.latestLabel}>No {TAB_NAME[tab]} recorded yet</Text>
              <Text style={styles.latestMeta}>Add your first reading — it takes a few seconds.</Text>
            </>
          )}
          <Btn style={{ marginTop: 16 }} onClick={openAdd}>
            + Add {TAB_NAME[tab]} reading
          </Btn>
          {showUpgradeBanner && tab === 'bp' && <BpUpgradeBanner onPress={() => go('trends')} onDismiss={() => setShowUpgradeBanner(false)} />}
        </Card>

        <Section title="History" action={!embedded && list.length > 1 ? 'See trends' : null} onAction={() => go('trends')}>
          {list.length === 0 ? (
            <Text style={styles.emptyText}>Readings you save will be listed here.</Text>
          ) : (
            <View style={styles.listCard}>
              {list.map((r, i) => (
                <View key={r.id} style={[styles.historyRow, i < list.length - 1 && styles.rowBorder]}>
                  <View style={[styles.historyBar, { backgroundColor: r.cat.color }]} />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.historyMain}>
                      {r.main} <Text style={styles.historyUnit}>{r.unit}</Text>
                      {r.sub ? <Text style={styles.historyUnit}>{`  ·  ${r.sub}`}</Text> : null}
                    </Text>
                    <Text style={styles.historyMeta}>
                      {fmtDay(r.ts)}, {fmtTime(r.ts)}
                      {r.cat.label ? ` · ${r.cat.label}` : ''}
                    </Text>
                  </View>
                  <Press onPress={() => remove(r)} style={styles.deleteBtn} accessibilityLabel="Delete reading" hitSlop={6}>
                    <Svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={C.ink3} strokeWidth="1.8" strokeLinecap="round">
                      <Path d="M5 7h14M10 7V5h4v2M7 7l1 12h8l1-12" />
                    </Svg>
                  </Press>
                </View>
              ))}
            </View>
          )}
        </Section>
      </Screen>

      <Sheet
        visible={adding}
        title={`Add ${TAB_NAME[tab]}`}
        subtitle="Hold + or − to change quickly, or tap a number to type it"
        onClose={() => setAdding(false)}
        footer={
          <Btn disabled={saving} onClick={save}>
            {saving ? 'Saving…' : 'Save reading'}
          </Btn>
        }
      >
        {tab === 'bp' && (
          <>
            <Stepper label="Systolic (upper)" unit="mmHg" value={sys} set={setSys} min={70} max={220} />
            <Stepper label="Diastolic (lower)" unit="mmHg" value={dia} set={setDia} min={40} max={140} />
            <Stepper label="Pulse" unit="bpm" value={pulse} set={setPulse} min={35} max={200} />
            <View style={styles.sheetResult}>
              <View style={styles.catRow}>
                <View style={[styles.catDot, { backgroundColor: cat.color }]} />
                <Text style={styles.resultLabel}>{cat.label}</Text>
              </View>
              <Scale bands={BANDS} value={sys} min={80} max={180} label="systolic" />
            </View>
          </>
        )}
        {tab === 'body' && (
          <>
            <Stepper label="Weight" unit="kg" value={kg} set={setKg} min={25} max={200} step={0.1} decimals={1} />
            <Stepper label="Height" unit="cm" value={cm} set={setCm} min={120} max={215} />
            <View style={styles.sheetResult}>
              <Text style={styles.resultLabel}>
                BMI {bmi} <Text style={{ color: classifyBMI(bmi).color }}>· {classifyBMI(bmi).label}</Text>
              </Text>
              <Scale bands={BMI_BANDS} value={bmi} min={14} max={40} label="bmi" />
              <Text style={styles.hint}>Asia-Pacific cut-offs: the healthy band ends at 23, not 25.</Text>
            </View>
          </>
        )}
        {tab === 'sugar' && (
          <>
            <View style={{ paddingTop: 8 }}>
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
            <View style={styles.sheetResult}>
              <View style={styles.catRow}>
                <View style={[styles.catDot, { backgroundColor: classifySugar(mgdl, kind).color }]} />
                <Text style={styles.resultLabel}>{classifySugar(mgdl, kind).label}</Text>
              </View>
            </View>
          </>
        )}
      </Sheet>

      <Toast bottom={tabTop + 16}>{toast}</Toast>
    </View>
  );
}

const styles = StyleSheet.create({
  latestCard: { marginTop: 14 },
  latestLabel: { fontFamily: SANS.medium, fontSize: 15, color: C.ink2 },
  latestRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6, marginTop: 6 },
  latestValue: { fontFamily: SANS.bold, fontSize: 40, letterSpacing: -1.6, color: C.ink },
  latestUnit: { fontFamily: SANS.medium, fontSize: 16, color: C.ink3 },
  latestMeta: { fontFamily: SANS.regular, fontSize: 15, color: C.ink2, marginTop: 2, flexShrink: 1 },
  catRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  catDot: { width: 10, height: 10, borderRadius: 99 },
  listCard: { ...GLASS, borderRadius: 24, overflow: 'hidden' },
  historyRow: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14, paddingLeft: 16, paddingRight: 8 },
  rowBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.hair },
  historyBar: { width: 4, height: 36, borderRadius: 99 },
  historyMain: { fontFamily: SANS.bold, fontSize: 18, letterSpacing: -0.4, color: C.ink },
  historyUnit: { fontFamily: SANS.regular, fontSize: 14.5, letterSpacing: 0, color: C.ink3 },
  historyMeta: { fontFamily: SANS.regular, fontSize: 14.5, color: C.ink2, marginTop: 2 },
  deleteBtn: { padding: 10 },
  emptyText: { fontFamily: SANS.regular, fontSize: 15, color: C.ink3, paddingHorizontal: 4 },
  sheetResult: { paddingTop: 18, paddingBottom: 6 },
  resultLabel: { fontFamily: SANS.semibold, fontSize: 17, color: C.ink },
  hint: { fontFamily: SANS.regular, fontSize: 14, color: C.ink2, lineHeight: 20, marginTop: 6 },
});
