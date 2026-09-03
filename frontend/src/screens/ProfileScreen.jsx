import React, { useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { C } from '../theme/colors';
import { SANS } from '../theme/typography';
import { GRAD } from '../theme/gradients';
import { bmiOf, classifyBMI, classifyBP, classifySugar, fmtDay, kg1 } from '../lib/calc';
import { activeMeds, adherence } from '../lib/meds';
import { HISTORY_TYPES, normType, typeOf } from '../lib/history';
import { useData } from '../state/DataContext';
import { useAuth } from '../state/AuthContext';
import { useAsk } from '../state/AskDialogContext';
import { useGo } from '../navigation/useGo';
import Head from '../components/atoms/Head';
import Card from '../components/atoms/Card';
import Mono from '../components/atoms/Mono';
import Btn from '../components/atoms/Btn';
import Seg from '../components/atoms/Seg';
import Press from '../components/atoms/Press';
import TypeIcon from '../components/icons/TypeIcon';
import { G } from '../components/icons/ScreenGlyphs';
import ReportSheet from '../components/dialogs/ReportSheet';
import FamilySheet from '../components/dialogs/FamilySheet';

const SEXES = [
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
  { value: 'other', label: 'Other' },
];

function Row({ label, children }) {
  return (
    <View style={styles.row}>
      <Mono>{label}</Mono>
      {children}
    </View>
  );
}

function Stat({ k, v, sub, color, onPress }) {
  return (
    <Press onPress={onPress} style={styles.statTile}>
      <Mono>{k}</Mono>
      <Text style={styles.statValue}>{v}</Text>
      {sub ? <Text style={[styles.statSub, { color: color || C.ink3 }]}>{sub}</Text> : null}
    </Press>
  );
}

export default function ProfileScreen() {
  const { data, setData, saveProfile, setCareRole, deleteAllReadings } = useData();
  const { signOut } = useAuth();
  const ask = useAsk();
  const go = useGo();
  const [report, setReport] = useState(false);
  const [family, setFamily] = useState(false);
  const [draft, setDraft] = useState(data.profile);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const saved = useRef(data.profile);

  useEffect(() => {
    if (JSON.stringify(saved.current) !== JSON.stringify(data.profile)) {
      saved.current = data.profile;
      setDraft(data.profile);
    }
  }, [data.profile]);

  const set = (k, v) => setDraft(d => ({ ...d, [k]: v }));
  const dirty = JSON.stringify(draft) !== JSON.stringify(data.profile);
  const save = async () => {
    setSaving(true);
    try {
      saved.current = draft;
      await saveProfile(draft);
      setNote('Profile saved');
      setTimeout(() => setNote(''), 1800);
    } catch (err) {
      setNote(err.message);
    } finally {
      setSaving(false);
    }
  };

  const p = data.profile;
  const h = data.health || { conditions: [], allergies: '', bloodGroup: '' };
  const bp = data.bp[0];
  const w = data.body[0];
  const sugar = data.sugar[0];
  const bmi = bmiOf(w?.weightKg, p.heightCm);
  const ad = adherence(data, 7);
  const hist = data.history || [];
  const byType = HISTORY_TYPES.map(t => ({ t, n: hist.filter(r => normType(r.type) === t.key).length })).filter(x => x.n > 0);
  const initials = (p.name || '').trim().split(/\s+/).map(x => x[0]).slice(0, 2).join('').toUpperCase();

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Head title="Profile" caption="who you are, and where you stand" icon={G.me(C.brand)} tint={C.brand} />

      <Card style={{ padding: 20 }}>
        <View style={styles.identityRow}>
          <LinearGradient colors={GRAD.colors} start={GRAD.start} end={GRAD.end} style={styles.avatar}>
            <Text style={styles.avatarLabel}>{initials || '—'}</Text>
          </LinearGradient>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.name}>{p.name || 'Add your name'}</Text>
            <Text style={styles.subline}>{[p.age && `${p.age} years`, p.sex && SEXES.find(x => x.value === p.sex)?.label, p.heightCm && `${p.heightCm} cm`, w && `${kg1(w.weightKg)} kg`].filter(Boolean).join(' · ') || 'Details below'}</Text>
          </View>
        </View>
        {(h.bloodGroup || h.allergies || h.conditions.length > 0) && (
          <View style={styles.tagsRow}>
            {h.bloodGroup && (
              <View style={[styles.tag, { backgroundColor: C.stage2 }]}>
                <Text style={styles.tagLabelWhite}>Blood {h.bloodGroup}</Text>
              </View>
            )}
            {h.allergies && (
              <View style={[styles.tag, { backgroundColor: C.elevated }]}>
                <Text style={styles.tagLabelWhite}>Allergy · {h.allergies}</Text>
              </View>
            )}
            {h.conditions.map(c => (
              <View key={c} style={[styles.tag, styles.tagOutline]}>
                <Text style={styles.tagLabelOutline}>{c}</Text>
              </View>
            ))}
          </View>
        )}
      </Card>

      <View style={styles.sectionPad}>
        <Mono>Vitals at a glance</Mono>
      </View>
      <View style={styles.row2}>
        <Stat k="Pressure" v={bp ? `${bp.sys}/${bp.dia}` : '—'} sub={bp ? classifyBP(bp.sys, bp.dia).label : 'not recorded'} color={bp ? classifyBP(bp.sys, bp.dia).color : null} onPress={() => go('log')} />
        <Stat k="BMI" v={bmi ?? '—'} sub={bmi ? classifyBMI(bmi).label : 'add weight'} color={bmi ? classifyBMI(bmi).color : null} onPress={() => go('log')} />
      </View>
      <View style={[styles.row2, { marginTop: 8 }]}>
        <Stat k="Sugar" v={sugar ? sugar.mgdl : '—'} sub={sugar ? classifySugar(sugar.mgdl, sugar.kind).label : 'not recorded'} color={sugar ? classifySugar(sugar.mgdl, sugar.kind).color : null} onPress={() => go('log')} />
        <Stat k="Medicines" v={ad.pct != null ? `${ad.pct}%` : '—'} sub={activeMeds(data).length ? `${activeMeds(data).length} active · 7 days` : 'none active'} onPress={() => go('meds')} />
      </View>
      <Text style={styles.footNote}>
        {data.bp.length} pressure · {data.body.length} weight · {data.sugar.length} sugar readings recorded.
      </Text>

      <View style={styles.sectionPad}>
        <Mono>Medical history</Mono>
      </View>
      <Card style={{ padding: 20 }} onPress={() => go('history')}>
        {hist.length === 0 ? (
          <>
            <Text style={styles.emptyTitle}>Nothing recorded yet</Text>
            <Text style={styles.emptySub}>Add your past tests, diagnoses and procedures so they are in one place when a doctor asks.</Text>
          </>
        ) : (
          <>
            <View style={styles.histCountRow}>
              <Text style={styles.histCount}>{hist.length}</Text>
              <Text style={styles.histCountLabel}>record{hist.length === 1 ? '' : 's'}</Text>
            </View>
            <View style={styles.histTypesRow}>
              {byType.map(({ t, n }) => (
                <View key={t.key} style={[styles.histTypeTag, { borderColor: t.color }]}>
                  <Text style={[styles.histTypeLabel, { color: t.color }]}>
                    {n} {t.label.split(' ')[0].toLowerCase()}
                    {n > 1 && t.key !== 'other' ? 's' : ''}
                  </Text>
                </View>
              ))}
            </View>
            <View style={styles.histRecentWrap}>
              <Mono style={{ paddingVertical: 10 }}>Most recent</Mono>
              {[...hist]
                .sort((a, b) => b.date - a.date)
                .slice(0, 4)
                .map((r, i, arr) => {
                  const d = new Date(r.date);
                  const t = typeOf(r.type);
                  return (
                    <View key={r.id} style={[styles.histRow, i < arr.length - 1 && styles.condRowBorder]}>
                      <View style={styles.histDateCol}>
                        <Text style={styles.histDay}>{d.getDate()}</Text>
                        <Text style={styles.histMonth}>
                          {d.toLocaleDateString(undefined, { month: 'short' })} {String(d.getFullYear()).slice(2)}
                        </Text>
                      </View>
                      <View style={{ minWidth: 0, flex: 1 }}>
                        <Text style={styles.histTitle} numberOfLines={1}>
                          {r.title}
                        </Text>
                        <Text style={styles.histType}>{t.label}</Text>
                      </View>
                      <View style={[styles.histIcon, { backgroundColor: `${t.color}2E`, borderColor: `${t.color}4D` }]}>
                        <TypeIcon k={r.type} color={t.color} />
                      </View>
                    </View>
                  );
                })}
              {hist.length > 4 && <Mono style={{ paddingTop: 12 }}>+{hist.length - 4} more in the timeline</Mono>}
            </View>
          </>
        )}
        <Btn kind="quiet" style={{ marginTop: 16, paddingVertical: 16 }} onClick={() => go('history')}>
          {hist.length ? 'Open full timeline' : 'Add a medical record'}
        </Btn>
      </Card>

      <View style={styles.sectionPad}>
        <Mono>Your details</Mono>
      </View>
      <Card style={{ paddingTop: 4, paddingBottom: 18 }}>
        <Row label="Name">
          <TextInput value={draft.name || ''} onChangeText={t => set('name', t)} placeholder="Add name" placeholderTextColor={C.ink3} style={styles.fieldInput} />
        </Row>
        <Row label="Age">
          <TextInput
            value={draft.age ? String(draft.age) : ''}
            onChangeText={t => set('age', t.replace(/\D/g, '').slice(0, 3))}
            keyboardType="number-pad"
            placeholder="––"
            placeholderTextColor={C.ink3}
            style={[styles.fieldInput, { width: 70 }]}
          />
        </Row>
        <View style={styles.sexBlock}>
          <Mono>Sex</Mono>
          <View style={{ marginTop: 10 }}>
            <Seg value={draft.sex || ''} onChange={v => set('sex', v)} options={SEXES} />
          </View>
        </View>
        <Row label="Height · cm">
          <TextInput
            value={draft.heightCm ? String(draft.heightCm) : ''}
            onChangeText={t => set('heightCm', t.replace(/\D/g, '').slice(0, 3))}
            keyboardType="number-pad"
            placeholder="––"
            placeholderTextColor={C.ink3}
            style={[styles.fieldInput, { width: 70 }]}
          />
        </Row>
        <Row label="Weight · kg">
          <Text style={[styles.readonlyValue, { color: w ? C.ink : C.ink3 }]}>{w ? kg1(w.weightKg) : 'record it'}</Text>
        </Row>
        <Row label="Blood group">
          <Text style={[styles.readonlyValue, { color: h.bloodGroup ? C.ink : C.ink3 }]}>{h.bloodGroup || 'set in Health'}</Text>
        </Row>
        <View style={styles.dietBlock}>
          <Mono>Diet</Mono>
          <View style={{ marginTop: 10 }}>
            <Seg
              value={draft.diet || 'veg'}
              onChange={v => set('diet', v)}
              options={[
                { value: 'veg', label: 'Veg' },
                { value: 'egg', label: 'Egg' },
                { value: 'nonveg', label: 'Non-veg' },
              ]}
            />
          </View>
        </View>
        <Btn onClick={save} disabled={!dirty || saving} style={{ paddingVertical: 17 }}>
          {saving ? 'Saving…' : dirty ? 'Save profile' : note || 'Saved'}
        </Btn>
        <Text style={styles.hintText}>Weight comes from your latest reading. Blood group and conditions live in Health Summary.</Text>
      </Card>

      <View style={styles.sectionPad}>
        <Mono>Doctor</Mono>
      </View>
      <Card style={{ paddingTop: 4, paddingBottom: 18 }}>
        <Row label="Doctor · WhatsApp">
          <TextInput
            value={draft.docPhone || ''}
            onChangeText={t => set('docPhone', t.replace(/[^\d+]/g, '').slice(0, 15))}
            keyboardType="phone-pad"
            placeholder="+91…"
            placeholderTextColor={C.ink3}
            style={[styles.fieldInput, { width: 130 }]}
          />
        </Row>
        <Row label="Doctor · email">
          <TextInput
            value={draft.docEmail || ''}
            onChangeText={t => set('docEmail', t.trim())}
            keyboardType="email-address"
            autoCapitalize="none"
            placeholder="optional"
            placeholderTextColor={C.ink3}
            style={styles.fieldInput}
          />
        </Row>
        <Text style={[styles.hintText, { paddingTop: 14 }]}>Fill these in and the report goes straight to your doctor. Include the country code.</Text>
      </Card>

      <View style={styles.sectionPad}>
        <Mono>More</Mono>
      </View>
      <Card>
        <View style={styles.row2}>
          <Btn kind="quiet" style={{ flex: 1, paddingVertical: 15 }} onClick={() => go('log')}>
            Record a reading
          </Btn>
          <Btn kind="quiet" style={{ flex: 1, paddingVertical: 15 }} onClick={() => go('learn')}>
            Learn
          </Btn>
        </View>
      </Card>

      <Card style={{ marginTop: 10 }}>
        <Mono>This phone is</Mono>
        <View style={{ marginTop: 10 }}>
          <Seg
            value={data.care?.role || 'logger'}
            onChange={v => setCareRole(v).catch(err => setNote(err.message))}
            options={[
              { value: 'logger', label: 'Logging' },
              { value: 'viewer', label: 'Receiving' },
            ]}
          />
        </View>
        <Text style={styles.hintText}>Logging is the full app, for whoever takes the readings. Receiving is the family view — no logging, just the weekly updates that arrive by WhatsApp.</Text>
        {(data.care?.role || 'logger') === 'logger' && (
          <Btn kind="quiet" style={{ marginTop: 14 }} onClick={() => setFamily(true)}>
            Family circle{data.care?.circle?.length ? ` · ${data.care.circle.length}` : ''}
          </Btn>
        )}
      </Card>

      <Card style={{ marginTop: 10 }}>
        <Mono>Your data</Mono>
        <Text style={styles.dataText}>
          {data.bp.length} pressure · {data.body.length} weight · {data.sugar.length} sugar · {data.meds.length} medicine{data.meds.length === 1 ? '' : 's'} · {hist.length} history record{hist.length === 1 ? '' : 's'}, held on this device.
        </Text>
        <Btn onClick={() => setReport(true)} style={{ paddingVertical: 17 }}>
          Open report
        </Btn>
        <Btn
          kind="quiet"
          style={{ marginTop: 8 }}
          textStyle={{ color: C.stage2 }}
          onClick={async () => {
            const ok = await ask({
              title: 'Delete every reading?',
              body: 'All pressure, weight and sugar readings will be removed. Your medicines and medical history stay.',
              confirmLabel: 'Delete readings',
              cancelLabel: 'Cancel',
              danger: true,
            });
            if (ok) {
              try {
                await deleteAllReadings();
              } catch (err) {
                setNote(err.message);
              }
            }
          }}>
          Delete all readings
        </Btn>
      </Card>

      <Card style={{ marginTop: 10 }}>
        <Mono>Important</Mono>
        <Text style={styles.importantText}>This app records what you measure and explains the standard reference ranges. It does not diagnose, prescribe, or change medicines. Take your readings to your doctor — that is what they are for.</Text>
      </Card>

      <Btn
        kind="quiet"
        style={{ marginTop: 10, paddingVertical: 17 }}
        textStyle={{ color: C.stage2 }}
        onClick={async () => {
          const ok = await ask({
            title: 'Log out?',
            body: 'You can log back in anytime with your email and password.',
            confirmLabel: 'Log out',
            cancelLabel: 'Cancel',
            danger: true,
          });
          if (ok) signOut();
        }}>
        Log out
      </Btn>

      {report && <ReportSheet data={data} onClose={() => setReport(false)} />}
      {family && <FamilySheet data={data} setData={setData} onClose={() => setFamily(false)} />}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, paddingTop: 20, paddingBottom: 120 },
  identityRow: { flexDirection: 'row', alignItems: 'center', gap: 15 },
  avatar: { width: 62, height: 62, borderRadius: 999, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  avatarLabel: { fontFamily: SANS.bold, fontSize: 21, letterSpacing: -0.4, color: '#FFFFFF' },
  name: { fontFamily: SANS.bold, fontSize: 22, letterSpacing: -0.65, lineHeight: 27, color: C.ink },
  subline: { fontFamily: SANS.regular, fontSize: 15, color: C.ink2, marginTop: 4 },
  tagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 16 },
  tag: { borderRadius: 999, paddingVertical: 7, paddingHorizontal: 13 },
  tagOutline: { borderWidth: 1, borderColor: C.hair },
  tagLabelWhite: { fontFamily: SANS.semibold, fontSize: 13, color: '#FFFFFF' },
  tagLabelOutline: { fontFamily: SANS.semibold, fontSize: 13, color: C.ink2 },
  sectionPad: { paddingTop: 22, paddingHorizontal: 4, paddingBottom: 10 },
  row2: { flexDirection: 'row', gap: 8 },
  statTile: { flex: 1, minWidth: 0, backgroundColor: C.card, borderWidth: 1, borderColor: C.hair, borderRadius: 18, padding: 15 },
  statValue: { fontFamily: SANS.bold, fontSize: 24, letterSpacing: -0.9, marginTop: 7, color: C.ink },
  statSub: { fontFamily: SANS.semibold, fontSize: 14.5, marginTop: 3 },
  footNote: { fontFamily: SANS.regular, fontSize: 14.5, color: C.ink3, lineHeight: 21, paddingTop: 10, paddingHorizontal: 4 },
  emptyTitle: { fontFamily: SANS.semibold, fontSize: 17, color: C.ink },
  emptySub: { fontFamily: SANS.regular, fontSize: 15, color: C.ink2, marginTop: 6, lineHeight: 22 },
  histCountRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  histCount: { fontFamily: SANS.bold, fontSize: 30, letterSpacing: -1.2, color: C.ink },
  histCountLabel: { fontFamily: SANS.regular, fontSize: 15, color: C.ink2 },
  histTypesRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 12 },
  histTypeTag: { borderWidth: 1, borderRadius: 999, paddingVertical: 6, paddingHorizontal: 12 },
  histTypeLabel: { fontFamily: SANS.semibold, fontSize: 14 },
  histRecentWrap: { marginTop: 16, paddingTop: 6, borderTopWidth: 1, borderTopColor: C.hair },
  histRow: { flexDirection: 'row', alignItems: 'center', gap: 13, paddingVertical: 12 },
  condRowBorder: { borderBottomWidth: 1, borderBottomColor: C.hair },
  histDateCol: { flexShrink: 0, width: 42, alignItems: 'center' },
  histDay: { fontFamily: SANS.bold, fontSize: 19, letterSpacing: -0.5, color: C.ink },
  histMonth: { fontFamily: SANS.medium, fontSize: 12, letterSpacing: 0.8, color: C.ink3, textTransform: 'uppercase' },
  histTitle: { fontFamily: SANS.semibold, fontSize: 16, letterSpacing: -0.3, color: C.ink },
  histType: { fontFamily: SANS.regular, fontSize: 15, color: C.ink3, marginTop: 2 },
  histIcon: { flexShrink: 0, width: 30, height: 30, borderRadius: 10, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: C.hair },
  fieldInput: { textAlign: 'right', fontFamily: SANS.semibold, fontSize: 16, color: C.ink, minWidth: 100 },
  readonlyValue: { fontFamily: SANS.semibold, fontSize: 16 },
  sexBlock: { paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: C.hair },
  dietBlock: { paddingTop: 16, paddingBottom: 18 },
  hintText: { fontFamily: SANS.regular, fontSize: 14.5, color: C.ink3, lineHeight: 21, marginTop: 12 },
  dataText: { fontFamily: SANS.regular, fontSize: 15, color: C.ink2, marginTop: 10, marginBottom: 16, lineHeight: 22 },
  importantText: { fontFamily: SANS.regular, fontSize: 15, lineHeight: 23, color: C.ink2, marginTop: 10 },
});
