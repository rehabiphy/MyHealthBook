import React, { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import Svg, { Path } from 'react-native-svg';
import { C } from '../theme/colors';
import { SANS } from '../theme/typography';
import { useData } from '../state/DataContext';
import { useSubscription, FEATURES } from '../state/SubscriptionContext';
import { useGo } from '../navigation/useGo';
import { uid } from '../lib/calc';
import { activeMeds } from '../lib/meds';
import { buildSummaryHTML, buildSummaryText, recentInvestigations, upcomingOf } from '../lib/summary';
import { nativeShareText, shareReportPdf, copyText } from '../lib/share';
import Screen from '../components/layout/Screen';
import Card from '../components/atoms/Card';
import Mono from '../components/atoms/Mono';
import Btn from '../components/atoms/Btn';
import Press from '../components/atoms/Press';

const BLOOD_GROUPS = ['A+', 'A−', 'B+', 'B−', 'AB+', 'AB−', 'O+', 'O−'];

function Big({ children, style }) {
  return <Text style={[styles.big, style]}>{children}</Text>;
}

export default function HealthScreen() {
  const { data, setData, saveHealth } = useData();
  const [edit, setEdit] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [cond, setCond] = useState('');
  const [fu, setFu] = useState({ title: '', doctor: '', date: Date.now() + 7 * 864e5 });
  const [pickDate, setPickDate] = useState(false);
  const [note, setNote] = useState('');
  const { can } = useSubscription();
  const go = useGo();
  const advanced = can(FEATURES.ADVANCED_HEALTH_SUMMARY);
  const say = m => {
    setNote(m);
    setTimeout(() => setNote(''), 3000);
  };
  const h = data.health || { conditions: [], allergies: '', bloodGroup: '', upcoming: [] };
  const setH = patch => setData(d => ({ ...d, health: { ...h, ...patch } }));

  const toggleEdit = async () => {
    if (!edit) {
      setEdit(true);
      return;
    }
    setSaving(true);
    setError('');
    try {
      await saveHealth(h);
      setEdit(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const addFollowUp = () => {
    if (!fu.title.trim()) return;
    setH({ upcoming: [...(h.upcoming || []), { id: uid(), title: fu.title.trim(), doctor: fu.doctor.trim(), date: fu.date }] });
    setFu({ title: '', doctor: '', date: Date.now() + 7 * 864e5 });
  };

  const savePdf = async () => {
    const ok = await shareReportPdf(buildSummaryHTML(data), `health-summary-${new Date().toISOString().slice(0, 10)}`);
    say(ok ? 'PDF ready to share or save' : 'Could not generate the PDF');
  };

  const shareText = async () => {
    const text = buildSummaryText(data);
    if (await nativeShareText('Health Summary', text)) return;
    say((await copyText(text)) ? 'Summary copied' : 'Sharing unavailable here');
  };

  const meds = activeMeds(data);
  const tests = recentInvestigations(data, 3);
  // while editing, every follow-up (so past ones can be removed); otherwise only upcoming ones
  const upcoming = edit ? [...(h.upcoming || [])].sort((a, b) => a.date - b.date) : upcomingOf(data);
  const dateLabel = ts => new Date(ts).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });

  const addCondition = () => {
    if (!cond.trim()) return;
    setH({ conditions: [...h.conditions, cond.trim()] });
    setCond('');
  };

  return (
    <Screen title="Health summary" subtitle="Your important health information at a glance" back>
      <Card style={{ padding: 20 }}>
        <Mono>Important conditions</Mono>
        {h.conditions.length === 0 && !edit && <Big style={{ color: C.ink3, marginTop: 10 }}>None recorded</Big>}
        <View style={{ marginTop: 10 }}>
          {h.conditions.map((c, i) => (
            <View key={i} style={[styles.condRow, i < h.conditions.length - 1 && styles.condRowBorder]}>
              <Big>{c}</Big>
              {edit && (
                <Press onPress={() => setH({ conditions: h.conditions.filter((_, j) => j !== i) })} style={{ padding: 8 }}>
                  <Svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={C.ink3} strokeWidth="1.8" strokeLinecap="round">
                    <Path d="M6 6l12 12M18 6L6 18" />
                  </Svg>
                </Press>
              )}
            </View>
          ))}
        </View>
        {edit && (
          <View style={styles.addCondRow}>
            <TextInput value={cond} onChangeText={setCond} placeholder="Add a condition" placeholderTextColor={C.ink3} onSubmitEditing={addCondition} style={styles.condInput} />
            <Press onPress={addCondition} style={styles.addBtn}>
              <Text style={styles.addBtnLabel}>Add</Text>
            </Press>
          </View>
        )}
      </Card>

      <View style={styles.row}>
        <Card style={{ flex: 1, padding: 20 }}>
          <Mono>Allergies</Mono>
          {edit ? (
            <TextInput value={h.allergies} onChangeText={t => setH({ allergies: t })} placeholder="None known" placeholderTextColor={C.ink3} style={styles.allergyInput} />
          ) : (
            <Big style={{ marginTop: 10, color: h.allergies ? C.stage1 : C.ink }}>{h.allergies || 'No known allergies'}</Big>
          )}
        </Card>
        <Card style={{ width: 132, padding: 20 }}>
          <Mono>Blood group</Mono>
          {edit ? (
            <View style={styles.bgRow}>
              {BLOOD_GROUPS.map(b => (
                <Press key={b} onPress={() => setH({ bloodGroup: h.bloodGroup === b ? '' : b })} style={[styles.bgChip, h.bloodGroup === b && styles.bgChipOn]}>
                  <Text style={[styles.bgChipLabel, h.bloodGroup === b && { color: '#FFFFFF' }]}>{b}</Text>
                </Press>
              ))}
            </View>
          ) : (
            <Text style={styles.bgValue}>{h.bloodGroup || '—'}</Text>
          )}
        </Card>
      </View>

      <Card style={styles.section}>
        <Mono>Current medications</Mono>
        {meds.length ? (
          meds.map(m => (
            <Text key={m.id} style={styles.item}>
              {m.name}
              {m.dose ? <Text style={styles.itemSub}>{'  ' + m.dose}</Text> : null}
            </Text>
          ))
        ) : (
          <Text style={styles.emptyLine}>None recorded. Add them in Medicines.</Text>
        )}
      </Card>

      <Card style={styles.section}>
        <Mono>Recent investigations</Mono>
        {tests.length ? (
          tests.map(r => (
            <View key={r.id} style={styles.lineRow}>
              <Text style={[styles.item, { flex: 1 }]}>{r.title}</Text>
              <Mono>{dateLabel(r.date)}</Mono>
            </View>
          ))
        ) : (
          <Text style={styles.emptyLine}>No tests or scans in your medical history yet</Text>
        )}
      </Card>

      <Card style={styles.section}>
        <Mono>Upcoming follow-ups</Mono>
        {upcoming.length === 0 && <Text style={styles.emptyLine}>{edit ? 'Add an appointment or follow-up below' : 'None recorded'}</Text>}
        {upcoming.map(u => (
          <View key={u.id} style={styles.lineRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.item}>{u.title}</Text>
              {u.doctor ? <Text style={styles.itemSub}>{u.doctor}</Text> : null}
            </View>
            <Mono>{dateLabel(u.date)}</Mono>
            {edit && (
              <Press onPress={() => setH({ upcoming: (h.upcoming || []).filter(x => x.id !== u.id) })} style={{ padding: 8 }}>
                <Svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={C.ink3} strokeWidth="1.8" strokeLinecap="round">
                  <Path d="M6 6l12 12M18 6L6 18" />
                </Svg>
              </Press>
            )}
          </View>
        ))}
        {edit && (
          <View style={{ marginTop: 12, gap: 8 }}>
            <TextInput value={fu.title} onChangeText={t => setFu(f => ({ ...f, title: t }))} placeholder="e.g. Cardiology review" placeholderTextColor={C.ink3} style={styles.condInput} />
            <TextInput value={fu.doctor} onChangeText={t => setFu(f => ({ ...f, doctor: t }))} placeholder="Doctor or clinic (optional)" placeholderTextColor={C.ink3} style={styles.condInput} />
            <View style={styles.addCondRow}>
              <Press onPress={() => setPickDate(true)} style={[styles.addBtn, { flex: 1 }]}>
                <Text style={styles.addBtnLabel}>{dateLabel(fu.date)}</Text>
              </Press>
              <Press onPress={addFollowUp} style={styles.addBtn}>
                <Text style={styles.addBtnLabel}>Add</Text>
              </Press>
            </View>
            {pickDate && (
              <DateTimePicker
                value={new Date(fu.date)}
                mode="date"
                display="default"
                onChange={(event, selected) => {
                  setPickDate(false);
                  if (event.type !== 'dismissed' && selected) setFu(f => ({ ...f, date: selected.getTime() }));
                }}
              />
            )}
          </View>
        )}
      </Card>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      <Btn kind={edit ? 'solid' : 'quiet'} style={{ marginTop: 10, paddingVertical: 17 }} disabled={saving} onClick={toggleEdit}>
        {saving ? 'Saving…' : edit ? 'Done editing' : 'Edit health information'}
      </Btn>

      <Card style={[styles.section, { padding: 20 }]}>
        <Mono>Doctor-ready summary</Mono>
        <Text style={styles.body}>
          One document with your overview, important history, current medicines, recent investigations, recent readings and upcoming follow-ups, made only from what you have recorded.
        </Text>
        {advanced ? (
          <View style={{ gap: 8, marginTop: 14 }}>
            <Btn onClick={savePdf}>Save or share as PDF</Btn>
            <Btn kind="quiet" onClick={shareText}>
              Share as text
            </Btn>
          </View>
        ) : (
          <>
            <Text style={[styles.body, { color: C.ink3 }]}>Part of MyHealthBook Plus. Everything above stays available on the Free plan.</Text>
            <Btn kind="quiet" style={{ marginTop: 12 }} onClick={() => go('premium')}>
              See plans
            </Btn>
          </>
        )}
        {note ? <Text style={[styles.body, { textAlign: 'center' }]}>{note}</Text> : null}
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, paddingTop: 20, paddingBottom: 120 },
  errorText: { fontFamily: SANS.regular, fontSize: 13.5, color: C.stage2, marginTop: 10, paddingHorizontal: 4 },
  big: { fontFamily: SANS.semibold, fontSize: 19, letterSpacing: -0.4, lineHeight: 26, color: C.ink },
  condRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12 },
  condRowBorder: { borderBottomWidth: 1, borderBottomColor: C.hair },
  addCondRow: { flexDirection: 'row', gap: 8, marginTop: 14 },
  condInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: C.hair,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 15,
    fontFamily: SANS.regular,
    fontSize: 16,
    color: C.ink,
    backgroundColor: 'rgba(22,36,28,0.05)',
  },
  addBtn: { backgroundColor: C.panel, borderRadius: 14, paddingVertical: 14, paddingHorizontal: 20, alignItems: 'center', justifyContent: 'center' },
  addBtnLabel: { fontFamily: SANS.semibold, fontSize: 15, color: C.onPanel },
  row: { flexDirection: 'row', gap: 10, marginTop: 10 },
  section: { marginTop: 10, padding: 18 },
  item: { fontFamily: SANS.semibold, fontSize: 16, color: C.ink, marginTop: 8 },
  itemSub: { fontFamily: SANS.regular, fontSize: 14, color: C.ink2 },
  lineRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  emptyLine: { fontFamily: SANS.regular, fontSize: 15, color: C.ink3, marginTop: 8 },
  body: { fontFamily: SANS.regular, fontSize: 14.5, color: C.ink2, lineHeight: 21, marginTop: 8 },
  allergyInput: { borderBottomWidth: 2, borderBottomColor: C.hair, marginTop: 10, paddingBottom: 6, fontFamily: SANS.semibold, fontSize: 18, color: C.ink },
  bgRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 },
  bgChip: { borderWidth: 1, borderColor: C.hair, borderRadius: 10, paddingVertical: 6, paddingHorizontal: 8, backgroundColor: 'rgba(22,36,28,0.05)' },
  bgChipOn: { backgroundColor: C.stage2, borderColor: C.stage2 },
  bgChipLabel: { fontFamily: SANS.semibold, fontSize: 14, color: C.ink },
  bgValue: { fontFamily: SANS.bold, fontSize: 30, letterSpacing: -1.2, marginTop: 8, color: C.ink },
});
