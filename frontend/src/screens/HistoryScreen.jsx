import React, { useEffect, useState } from 'react';
import { BackHandler, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { pick as pickDocument, types as documentTypes } from '@react-native-documents/picker';
import Svg, { Path } from 'react-native-svg';
import { C } from '../theme/colors';
import { SANS, MONO } from '../theme/typography';
import { GRAD } from '../theme/gradients';
import { FILTERS, HISTORY_TYPES, monthLabel, normType, typeOf } from '../lib/history';
import { useData } from '../state/DataContext';
import { useAsk } from '../state/AskDialogContext';
import Head from '../components/atoms/Head';
import Card from '../components/atoms/Card';
import Mono from '../components/atoms/Mono';
import Btn from '../components/atoms/Btn';
import Press from '../components/atoms/Press';
import TypeIcon from '../components/icons/TypeIcon';
import { G } from '../components/icons/ScreenGlyphs';
import LinearGradient from 'react-native-linear-gradient';

const TITLE_FOR = { test: 'Test or scan name', diagnosis: 'Diagnosis', treatment: 'Treatment or medicine', procedure: 'Procedure, surgery or hospital', other: 'What is it about?' };
const DETAIL_FOR = { test: 'What did the report show?', diagnosis: 'What did the doctor say?', treatment: 'Why was it given?', procedure: 'What was done, and what was found?', other: 'Details' };

function CloseBtn({ onPress }) {
  return (
    <Press onPress={onPress} style={styles.closeBtn}>
      <Text style={styles.closeLabel}>✕</Text>
    </Press>
  );
}

export default function HistoryScreen() {
  const { data, addOrUpdateHistory, deleteHistory, promoteHistoryToMedicine } = useData();
  const ask = useAsk();
  const [view, setView] = useState('list'); // list | pick | form | detail
  const [type, setType] = useState('test');
  const [openId, setOpenId] = useState(null);
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState('all');
  const [draft, setDraft] = useState(null);
  const [toast, setToast] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [saving, setSaving] = useState(false);

  const items = data.history || [];
  const say = m => {
    setToast(m);
    setTimeout(() => setToast(''), 2800);
  };

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (view !== 'list') {
        setView('list');
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [view]);

  const shown = items
    .filter(r => filter === 'all' || normType(r.type) === filter)
    .filter(r => {
      if (!q.trim()) return true;
      const hay = `${r.title} ${r.details} ${r.doctor} ${r.hospital} ${r.medName} ${r.notes}`.toLowerCase();
      return hay.includes(q.trim().toLowerCase());
    })
    .sort((a, b) => b.date - a.date);

  const groups = [];
  shown.forEach(r => {
    const key = monthLabel(r.date);
    const last = groups[groups.length - 1];
    if (last && last.key === key) last.items.push(r);
    else groups.push({ key, items: [r] });
  });

  const blank = t => ({
    type: t,
    date: Date.now(),
    title: '',
    details: '',
    doctor: '',
    hospital: '',
    medName: '',
    medDose: '',
    notes: '',
    file: '',
  });

  const save = async () => {
    if (!draft.title.trim() || saving) return;
    setSaving(true);
    try {
      const record = await addOrUpdateHistory(draft);
      if (draft.medName.trim()) {
        setOpenId(record.id);
        setView('detail');
        say('Saved. Medicine recorded as historical information.');
      } else {
        setView('list');
        say('Saved to medical history');
      }
    } catch (err) {
      say(err.message);
    } finally {
      setSaving(false);
    }
  };

  const remove = async id => {
    const rec = items.find(r => r.id === id);
    const ok = await ask({
      title: 'Delete this record?',
      body: `${rec?.title || 'This record'} will be removed from your medical history. This cannot be undone.`,
      confirmLabel: 'Delete',
      danger: true,
      cancelLabel: 'Keep it',
    });
    if (!ok) return;
    try {
      await deleteHistory(id);
      setView('list');
      say('Record deleted');
    } catch (err) {
      say(err.message);
    }
  };

  const promote = async rec => {
    const ok = await ask({
      title: `Are you currently taking ${rec.medName}?`,
      body: 'Only say yes if this is a medicine you take today. Otherwise it stays in your medical history as a past prescription.',
      confirmLabel: 'Yes, add it',
      cancelLabel: 'No, keep as history',
    });
    if (!ok) return;
    try {
      await promoteHistoryToMedicine(rec);
      say('Added to current medications. Set its timing on the Meds screen.');
    } catch (err) {
      say(err.message);
    }
  };

  const pickFile = async () => {
    try {
      const [res] = await pickDocument({ type: [documentTypes.images, documentTypes.pdf] });
      if (res) setDraft({ ...draft, file: `${res.name} · ${((res.size || 0) / 1024 / 1024).toFixed(1)} MB` });
    } catch {
      // user cancelled — no-op, matching the original's silent cancel behaviour
    }
  };

  const Field = ({ label, keyName, multi, placeholder }) => (
    <View style={{ marginTop: 18 }}>
      <Mono>{label}</Mono>
      <TextInput
        value={draft[keyName]}
        onChangeText={t => setDraft({ ...draft, [keyName]: t })}
        placeholder={placeholder}
        placeholderTextColor={C.ink3}
        multiline={multi}
        numberOfLines={multi ? 3 : 1}
        style={[styles.fieldInput, multi && styles.fieldInputMulti]}
      />
    </View>
  );

  /* ── pick a record type ── */
  if (view === 'pick') {
    return (
      <ScrollView contentContainerStyle={styles.container}>
        <Head title="Add a record" caption="what would you like to add?" right={<CloseBtn onPress={() => setView('list')} />} />
        {HISTORY_TYPES.map(t => (
          <Press
            key={t.key}
            onPress={() => {
              setType(t.key);
              setDraft(blank(t.key));
              setView('form');
            }}
            style={styles.pickCard}>
            <View style={[styles.pickIcon, { backgroundColor: `${t.color}30`, borderColor: `${t.color}55` }]}>
              <TypeIcon k={t.key} color={t.color} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.pickLabel}>{t.label}</Text>
              <Text style={styles.pickBlurb}>{t.blurb}</Text>
            </View>
          </Press>
        ))}
      </ScrollView>
    );
  }

  /* ── the form ── */
  if (view === 'form' && draft) {
    const t = typeOf(draft.type);
    const k = normType(draft.type);
    return (
      <ScrollView contentContainerStyle={styles.container}>
        <Head title={t.label} caption="fill in what you know · you can edit later" right={<CloseBtn onPress={() => setView('list')} />} />
        <Card style={{ padding: 20 }}>
          <Mono>Date</Mono>
          <Press onPress={() => setShowDatePicker(true)} style={styles.dateBtn}>
            <Text style={styles.dateBtnLabel}>{new Date(draft.date).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' })}</Text>
          </Press>
          {showDatePicker && (
            <DateTimePicker
              value={new Date(draft.date)}
              mode="date"
              display="default"
              maximumDate={new Date()}
              onChange={(event, selected) => {
                setShowDatePicker(false);
                if (event.type === 'dismissed' || !selected) return;
                setDraft({ ...draft, date: selected.getTime() });
              }}
            />
          )}
          <Field label={TITLE_FOR[k]} keyName="title" placeholder="Required" />
          <Field label={DETAIL_FOR[k]} keyName="details" multi />
          <Field label="Doctor" keyName="doctor" />
          <Field label={draft.type === 'test' ? 'Hospital or laboratory' : 'Hospital or clinic'} keyName="hospital" />
          {['treatment', 'diagnosis', 'procedure', 'other'].includes(k) && (
            <>
              <View style={styles.medSectionHeader}>
                <Mono>Medicine prescribed then — optional</Mono>
                <Text style={styles.medSectionHint}>This is recorded as history. It does not become a medicine you are taking now.</Text>
              </View>
              <Field label="Medicine name" keyName="medName" />
              <Field label="Dose" keyName="medDose" placeholder="1 tablet" />
            </>
          )}
          <Field label="Notes" keyName="notes" multi />
          <View style={{ marginTop: 18 }}>
            <Mono>Report</Mono>
            <Press onPress={pickFile} style={styles.filePicker}>
              <Text style={styles.filePickerLabel}>{draft.file || 'Attach a photo or a file'}</Text>
            </Press>
            {draft.file ? <Text style={styles.fileHint}>The file name is saved on this phone. The file itself stays where it was picked from.</Text> : null}
          </View>
          <Btn style={{ marginTop: 22, paddingVertical: 18 }} disabled={!draft.title.trim() || saving} onClick={save}>
            {saving ? 'Saving…' : 'Save to medical history'}
          </Btn>
        </Card>
      </ScrollView>
    );
  }

  /* ── one record ── */
  if (view === 'detail') {
    const r = items.find(x => x.id === openId);
    if (!r) {
      setView('list');
      return null;
    }
    const t = typeOf(r.type);
    const Line = ({ k, v }) =>
      v ? (
        <View style={styles.detailLine}>
          <Mono>{k}</Mono>
          <Text style={styles.detailValue}>{v}</Text>
        </View>
      ) : null;
    return (
      <ScrollView contentContainerStyle={styles.container}>
        <Head
          title="Record"
          caption={new Date(r.date).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' })}
          right={<CloseBtn onPress={() => setView('list')} />}
        />
        <Card style={{ padding: 20 }}>
          <View style={styles.detailTypeRow}>
            <View style={[styles.pickIcon, { width: 40, height: 40, backgroundColor: `${t.color}30`, borderColor: `${t.color}55` }]}>
              <TypeIcon k={r.type} color={t.color} />
            </View>
            <Mono>{t.label}</Mono>
          </View>
          <Text style={styles.detailTitle}>{r.title}</Text>
          <View style={{ marginTop: 14 }}>
            <Line k="What it showed" v={r.details} />
            <Line k="Doctor" v={r.doctor} />
            <Line k="Hospital" v={r.hospital} />
            <Line k="Report" v={r.file} />
            <Line k="Notes" v={r.notes} />
          </View>
        </Card>

        {r.medName && (
          <Card style={{ marginTop: 10, padding: 20 }}>
            <View style={styles.detailTypeRow}>
              <View style={[styles.dot, { backgroundColor: C.elevated }]} />
              <Mono style={{ color: C.elevated }}>Historical medicine</Mono>
            </View>
            <Text style={styles.medDetailName}>{r.medName}</Text>
            {r.medDose ? <Text style={styles.medDetailDose}>{r.medDose}</Text> : null}
            <Text style={styles.medDetailHint}>This was prescribed as part of this past event. It is not one of your current medicines.</Text>
            {r.promoted ? (
              <Text style={styles.promotedLabel}>✓ Already in current medications</Text>
            ) : (
              <Btn style={{ marginTop: 16, paddingVertical: 17 }} onClick={() => promote(r)}>
                Add to current medications
              </Btn>
            )}
          </Card>
        )}

        <View style={styles.row3}>
          <Btn kind="quiet" style={{ flex: 1, paddingVertical: 16 }} onClick={() => { setDraft(r); setView('form'); }}>
            Edit
          </Btn>
          <Btn kind="quiet" style={{ flex: 1, paddingVertical: 16 }} textStyle={{ color: C.stage2 }} onClick={() => remove(r.id)}>
            Delete
          </Btn>
        </View>
      </ScrollView>
    );
  }

  /* ── the timeline ── */
  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Head title="Medical History" caption="your medical journey, organised by date" icon={G.records(C.elevated)} tint={C.elevated} />
      {toast ? (
        <View style={styles.toastBanner}>
          <Text style={styles.toastText}>{toast}</Text>
        </View>
      ) : null}

      <Btn style={{ paddingVertical: 18 }} onClick={() => setView('pick')}>
        + Add medical record
      </Btn>

      <TextInput value={q} onChangeText={setQ} placeholder="Search your history" placeholderTextColor={C.ink3} style={styles.searchInput} />

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
        {FILTERS.map(f => {
          const on = filter === f.key;
          return (
            <Press key={f.key} onPress={() => setFilter(f.key)} style={styles.filterPillWrap}>
              {on ? (
                <LinearGradient colors={GRAD.colors} start={GRAD.start} end={GRAD.end} style={styles.filterPill}>
                  <Text style={[styles.filterLabel, { color: '#FFFFFF' }]}>{f.label}</Text>
                </LinearGradient>
              ) : (
                <View style={[styles.filterPill, styles.filterPillOff]}>
                  <Text style={[styles.filterLabel, { color: C.ink2 }]}>{f.label}</Text>
                </View>
              )}
            </Press>
          );
        })}
      </ScrollView>

      {shown.length === 0 && (
        <Card style={{ marginTop: 14, padding: 20 }}>
          <Text style={styles.emptyTitle}>{items.length ? 'Nothing matches' : 'Your history is empty'}</Text>
          <Text style={styles.emptySub}>{items.length ? 'Try another word or clear the filter.' : 'Add your past tests, diagnoses, procedures and hospital stays. They stay on this phone.'}</Text>
        </Card>
      )}

      {groups.map(g => (
        <View key={g.key} style={{ marginTop: 22 }}>
          <Mono style={{ paddingHorizontal: 4, paddingBottom: 10 }}>{g.key}</Mono>
          {g.items.map(r => {
            const t = typeOf(r.type);
            const d = new Date(r.date);
            return (
              <Press
                key={r.id}
                onPress={() => {
                  setOpenId(r.id);
                  setView('detail');
                }}
                style={styles.timelineRow}>
                <View style={[styles.timelineDate, { backgroundColor: `${t.color}66`, borderColor: `${t.color}55` }]}>
                  <Text style={styles.timelineDay}>{d.getDate()}</Text>
                  <Text style={styles.timelineMonth}>{d.toLocaleDateString(undefined, { month: 'short' })}</Text>
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <View style={styles.timelineTitleRow}>
                    <Text style={styles.timelineTitle} numberOfLines={1}>
                      {r.title}
                    </Text>
                    <View style={[styles.timelineIcon, { backgroundColor: `${t.color}2E`, borderColor: `${t.color}4D` }]}>
                      <TypeIcon k={r.type} color={t.color} />
                    </View>
                  </View>
                  {r.details ? (
                    <Text style={styles.timelineDetails} numberOfLines={2}>
                      {r.details}
                    </Text>
                  ) : null}
                  {r.medName ? <Text style={[styles.timelineMedTag, { color: r.promoted ? C.brand : C.elevated }]}>{r.promoted ? '· also a current medicine' : '· historical medicine'}</Text> : null}
                </View>
              </Press>
            );
          })}
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, paddingTop: 20, paddingBottom: 120 },
  closeBtn: { width: 40, height: 40, borderRadius: 999, borderWidth: 1, borderColor: C.hair, backgroundColor: C.card, alignItems: 'center', justifyContent: 'center' },
  closeLabel: { color: C.ink, fontSize: 15 },
  pickCard: { flexDirection: 'row', alignItems: 'center', gap: 15, backgroundColor: C.card, borderWidth: 1, borderColor: C.hair, borderRadius: 18, padding: 18, marginBottom: 10 },
  pickIcon: { width: 52, height: 52, borderRadius: 16, borderWidth: 1, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  pickLabel: { fontFamily: SANS.semibold, fontSize: 18, letterSpacing: -0.4, color: C.ink },
  pickBlurb: { fontFamily: SANS.regular, fontSize: 14.5, color: C.ink2, marginTop: 3 },
  dateBtn: { marginTop: 8, borderWidth: 1, borderColor: C.hair, borderRadius: 14, padding: 14, backgroundColor: 'rgba(22,36,28,0.05)' },
  dateBtnLabel: { fontFamily: SANS.regular, fontSize: 16, color: C.ink },
  fieldInput: { width: '100%', marginTop: 8, borderWidth: 1, borderColor: C.hair, borderRadius: 14, paddingVertical: 15, paddingHorizontal: 14, fontFamily: SANS.regular, fontSize: 16, color: C.ink, backgroundColor: 'rgba(22,36,28,0.05)' },
  fieldInputMulti: { minHeight: 84, textAlignVertical: 'top' },
  medSectionHeader: { marginTop: 22, paddingTop: 18, borderTopWidth: 1, borderTopColor: C.hair },
  medSectionHint: { fontFamily: SANS.regular, fontSize: 14, color: C.ink2, marginTop: 6, lineHeight: 21 },
  filePicker: { marginTop: 8, borderWidth: 1, borderColor: C.hair, borderStyle: 'dashed', borderRadius: 14, padding: 18, alignItems: 'center', backgroundColor: C.card },
  filePickerLabel: { fontFamily: SANS.semibold, fontSize: 16, color: C.ink },
  fileHint: { fontFamily: SANS.regular, fontSize: 14.5, color: C.ink3, marginTop: 8, lineHeight: 21 },
  detailLine: { paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: C.hair },
  detailValue: { fontFamily: SANS.regular, fontSize: 16.5, color: C.ink, marginTop: 5, lineHeight: 24 },
  detailTypeRow: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  detailTitle: { fontFamily: SANS.bold, fontSize: 24, letterSpacing: -0.7, marginTop: 10, lineHeight: 30, color: C.ink },
  dot: { width: 9, height: 9, borderRadius: 99 },
  medDetailName: { fontFamily: SANS.bold, fontSize: 20, letterSpacing: -0.6, marginTop: 10, color: C.ink },
  medDetailDose: { fontFamily: SANS.regular, fontSize: 16, color: C.ink2, marginTop: 4 },
  medDetailHint: { fontFamily: SANS.regular, fontSize: 14.5, color: C.ink2, marginTop: 12, lineHeight: 21 },
  promotedLabel: { fontFamily: SANS.semibold, fontSize: 15, color: C.brand, marginTop: 14 },
  row3: { flexDirection: 'row', gap: 8, marginTop: 10 },
  toastBanner: { backgroundColor: C.panelSoft, borderRadius: 14, paddingVertical: 14, paddingHorizontal: 16, marginBottom: 12 },
  toastText: { fontFamily: SANS.regular, fontSize: 14.5, color: C.onPanel2, lineHeight: 21 },
  searchInput: { width: '100%', marginTop: 12, borderWidth: 1, borderColor: C.hair, borderRadius: 15, paddingVertical: 15, paddingHorizontal: 16, fontFamily: SANS.regular, fontSize: 16, color: C.ink, backgroundColor: 'rgba(22,36,28,0.05)' },
  filterRow: { gap: 7, marginTop: 12, paddingBottom: 4 },
  filterPillWrap: {},
  filterPill: { borderRadius: 999, paddingVertical: 10, paddingHorizontal: 16 },
  filterPillOff: { backgroundColor: 'rgba(22,36,28,0.05)', borderWidth: 1, borderColor: C.hair },
  filterLabel: { fontFamily: SANS.semibold, fontSize: 14 },
  emptyTitle: { fontFamily: SANS.semibold, fontSize: 17, color: C.ink },
  emptySub: { fontFamily: SANS.regular, fontSize: 15, color: C.ink2, marginTop: 6, lineHeight: 22 },
  timelineRow: { flexDirection: 'row', gap: 14, backgroundColor: C.card, borderWidth: 1, borderColor: C.hair, borderRadius: 18, padding: 16, marginBottom: 8 },
  timelineDate: { flexShrink: 0, width: 52, height: 52, borderRadius: 15, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  timelineDay: { fontFamily: SANS.bold, fontSize: 19, letterSpacing: -0.5, color: '#FFFFFF', lineHeight: 21 },
  timelineMonth: { fontFamily: MONO.medium, fontSize: 12, letterSpacing: 0.6, textTransform: 'uppercase', color: 'rgba(255,255,255,0.9)' },
  timelineTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  timelineTitle: { flex: 1, fontFamily: SANS.semibold, fontSize: 17, letterSpacing: -0.4, color: C.ink },
  timelineIcon: { flexShrink: 0, width: 30, height: 30, borderRadius: 10, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  timelineDetails: { fontFamily: SANS.regular, fontSize: 14.5, color: C.ink2, marginTop: 5, lineHeight: 20 },
  timelineMedTag: { fontFamily: MONO.medium, fontSize: 12, letterSpacing: 0.4, textTransform: 'uppercase', marginTop: 8 },
});
