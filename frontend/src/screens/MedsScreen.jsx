import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { C } from '../theme/colors';
import { SANS, MONO } from '../theme/typography';
import { GRAD } from '../theme/gradients';
import { SLOTS, activeMeds, adherence, dayKey, dosesToday, prettyTime, slotOf } from '../lib/meds';
import { fmtDay } from '../lib/calc';
import { useData } from '../state/DataContext';
import { useAsk } from '../state/AskDialogContext';
import { useTabBarClearance } from '../navigation/TabBar';
import Head from '../components/atoms/Head';
import Card from '../components/atoms/Card';
import Mono from '../components/atoms/Mono';
import Btn from '../components/atoms/Btn';
import Seg from '../components/atoms/Seg';
import Press from '../components/atoms/Press';
import MedicineDoseCard from '../components/meds/MedicineDoseCard';
import { G } from '../components/icons/ScreenGlyphs';
import LinearGradient from 'react-native-linear-gradient';

export default function MedsScreen() {
  const { data, addMedicine, setMedStatus, restockMedicine, toggleDoseTaken, updateMedSettings } = useData();
  const ask = useAsk();
  const bottomPad = useTabBarClearance();
  const [name, setName] = useState('');
  const [dose, setDose] = useState('');
  const [picked, setPicked] = useState([]);
  const [stock, setStock] = useState('');
  const [perDose, setPerDose] = useState('1');
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState([]); // dose ids with a save in flight — blocks double taps
  const [timePickerFor, setTimePickerFor] = useState(null);
  const [note, setNote] = useState('');

  const settings = data.medSettings || { times: {}, lead: 10 };
  const times = { ...Object.fromEntries(SLOTS.map(s => [s.key, s.time])), ...(settings.times || {}) };
  const doses = dosesToday(data);
  const adh = adherence(data, 7);
  const say = m => {
    setNote(m);
    setTimeout(() => setNote(''), 2600);
  };

  const setSettings = async patch => {
    try {
      await updateMedSettings(patch);
    } catch (err) {
      say(err.message);
    }
  };

  const toggleSlot = k => setPicked(p => (p.includes(k) ? p.filter(x => x !== k) : [...p, k]));

  const addMed = async () => {
    if (!name.trim() || !picked.length || saving) return;
    setSaving(true);
    try {
      await addMedicine({
        name: name.trim(),
        dose: dose.trim(),
        slots: picked,
        perDose: Math.max(1, +perDose || 1),
        stock: stock === '' ? null : +stock,
      });
      setName('');
      setDose('');
      setPicked([]);
      setStock('');
      setPerDose('1');
      setAdding(false);
      say('Medicine added');
    } catch (err) {
      say(err.message);
    } finally {
      setSaving(false);
    }
  };

  const setStatus = async (id, status) => {
    const med = data.meds.find(m => m.id === id);
    if (status === 'discontinued') {
      const why = await ask({
        title: `Stop ${med.name}?`,
        body: "It moves out of today's doses and your health summary, but stays in your medicine record.",
        input: true,
        placeholder: 'Reason — optional',
        confirmLabel: 'Stop this medicine',
        cancelLabel: 'Keep taking',
        danger: true,
      });
      if (why === null) return;
      try {
        await setMedStatus(id, status, why || '');
        say(`${med.name} stopped. It stays in your medicine record.`);
      } catch (err) {
        say(err.message);
      }
      return;
    }
    try {
      await setMedStatus(id, status);
      say(status === 'paused' ? `${med.name} paused` : `${med.name} is active again`);
    } catch (err) {
      say(err.message);
    }
  };

  const saveRestock = async (id, qty) => {
    try {
      await restockMedicine(id, qty);
      say('Stock updated');
    } catch (err) {
      say(err.message);
    }
  };

  /* Marking is one tap. Undoing asks first — a dose record shouldn't
     disappear because a thumb brushed the screen. */
  const toggleTaken = async (dose, wasTaken) => {
    if (busy.includes(dose.id)) return;
    if (wasTaken) {
      const ok = await ask({
        title: `Undo ${dose.med.name}?`,
        body: `Mark the ${slotOf(dose.slot).label.toLowerCase()} dose as not taken today.`,
        confirmLabel: 'Yes, undo',
        cancelLabel: 'Keep as taken',
      });
      if (!ok) return;
    }
    setBusy(b => [...b, dose.id]);
    try {
      // no success banner: it would push the cards down mid-tap; the button itself turns green / back
      await toggleDoseTaken(dose.id);
    } catch (err) {
      say(err.message);
    } finally {
      setBusy(b => b.filter(x => x !== dose.id));
    }
  };

  // one card per active medicine, ordered by its earliest dose of the day
  const takenToday = data.taken?.[dayKey()] || {};
  const medCards = activeMeds(data)
    .map(med => ({ med, doses: doses.filter(d => d.med.id === med.id) }))
    .filter(x => x.doses.length)
    .sort((a, b) => a.doses[0].minutes - b.doses[0].minutes);
  const takenCount = doses.filter(d => takenToday[d.id]).length;

  const timeToDate = t => {
    const [h, m] = String(t || '00:00').split(':').map(Number);
    const d = new Date();
    d.setHours(h, m, 0, 0);
    return d;
  };

  return (
    <ScrollView contentContainerStyle={[styles.container, { paddingBottom: bottomPad }]}>
      <Head
        title="Medicines"
        icon={G.meds(C.mint)}
        tint={C.mint}
        caption={data.meds.length ? `${doses.length} doses today` : 'Nothing added yet'}
        right={
          adh.pct != null && (
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={styles.adhPct}>{adh.pct}%</Text>
              <Mono>
                7-day · {adh.done}/{adh.due}
              </Mono>
            </View>
          )
        }
      />

      {note ? (
        <View style={styles.noteBanner}>
          <Text style={styles.noteText}>{note}</Text>
        </View>
      ) : null}

      {medCards.length > 0 && (
        <>
          <View style={styles.todayRow}>
            <Text style={styles.todayTitle}>Today</Text>
            <Text style={[styles.todayCount, takenCount === doses.length && { color: C.normal }]}>
              {takenCount === doses.length ? '✓ All doses taken' : `${takenCount} of ${doses.length} doses taken`}
            </Text>
          </View>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${doses.length ? Math.round((takenCount / doses.length) * 100) : 0}%` }]} />
          </View>

          <View style={{ marginTop: 14 }}>
            {medCards.map(({ med, doses: medDoses }) => (
              <MedicineDoseCard
                key={med.id}
                med={med}
                doses={medDoses}
                takenToday={takenToday}
                busy={busy}
                onToggle={toggleTaken}
                onPause={() => setStatus(med.id, 'paused')}
                onStop={() => setStatus(med.id, 'discontinued')}
                onRestock={qty => saveRestock(med.id, qty)}
              />
            ))}
          </View>
        </>
      )}

      {adding ? (
        <Card style={{ marginTop: 4 }}>
          <Mono>Medicine name</Mono>
          <TextInput value={name} onChangeText={setName} placeholder="Telmisartan" placeholderTextColor={C.ink3} style={styles.nameInput} />
          <View style={{ marginTop: 18 }}>
            <Mono>Dose — optional</Mono>
            <TextInput value={dose} onChangeText={setDose} placeholder="40 mg · 1 tablet" placeholderTextColor={C.ink3} style={styles.doseInput} />
          </View>
          <View style={styles.stockRow}>
            <View style={{ flex: 1 }}>
              <Mono>Tablets in hand</Mono>
              <TextInput
                value={stock}
                onChangeText={t => setStock(t.replace(/\D/g, '').slice(0, 4))}
                keyboardType="number-pad"
                placeholder="optional"
                placeholderTextColor={C.ink3}
                style={styles.doseInput}
              />
            </View>
            <View style={{ width: 92 }}>
              <Mono>Per dose</Mono>
              <TextInput
                value={perDose}
                onChangeText={t => setPerDose(t.replace(/\D/g, '').slice(0, 2))}
                keyboardType="number-pad"
                placeholder="1"
                placeholderTextColor={C.ink3}
                style={styles.doseInput}
              />
            </View>
          </View>
          <Text style={styles.hintText}>Fill these in and you'll be warned 3, 2 and 1 days before the strip runs out.</Text>

          <View style={{ marginTop: 20 }}>
            <Mono>When do you take it</Mono>
            <Text style={styles.hintText}>Tap the time to change it.</Text>
            <View style={{ marginTop: 10 }}>
              {SLOTS.map(s => {
                const on = picked.includes(s.key);
                return (
                  <Press key={s.key} onPress={() => toggleSlot(s.key)} style={styles.slotOptWrap}>
                    {on ? (
                      <LinearGradient colors={GRAD.colors} start={GRAD.start} end={GRAD.end} style={styles.slotOpt}>
                        <Text style={[styles.slotOptLabel, { color: '#FFFFFF' }]}>
                          {s.label}
                          {s.sub ? <Text style={{ fontFamily: SANS.regular, opacity: 0.7 }}> · {s.sub}</Text> : ''}
                        </Text>
                        <Press onPress={() => setTimePickerFor(s.key)} style={styles.slotTimeBtn}>
                          <Text style={styles.slotOptTime}>{prettyTime(times[s.key])}</Text>
                        </Press>
                      </LinearGradient>
                    ) : (
                      <View style={[styles.slotOpt, styles.slotOptOff]}>
                        <Text style={[styles.slotOptLabel, { color: C.ink }]}>
                          {s.label}
                          {s.sub ? <Text style={{ fontFamily: SANS.regular, opacity: 0.6 }}> · {s.sub}</Text> : ''}
                        </Text>
                        <Press onPress={() => setTimePickerFor(s.key)} style={styles.slotTimeBtn}>
                          <Text style={[styles.slotOptTime, { color: C.ink2 }]}>{prettyTime(times[s.key])}</Text>
                        </Press>
                      </View>
                    )}
                  </Press>
                );
              })}
            </View>
            {timePickerFor && (
              <DateTimePicker
                value={timeToDate(times[timePickerFor])}
                mode="time"
                is24Hour={false}
                display="default"
                onChange={(event, selected) => {
                  const key = timePickerFor;
                  setTimePickerFor(null);
                  if (event.type === 'dismissed' || !selected) return;
                  const hh = String(selected.getHours()).padStart(2, '0');
                  const mm = String(selected.getMinutes()).padStart(2, '0');
                  setSettings({ times: { ...times, [key]: `${hh}:${mm}` } });
                }}
              />
            )}
          </View>
          <View style={styles.row2}>
            <Btn kind="quiet" style={{ flex: 1 }} onClick={() => { setAdding(false); setName(''); setDose(''); setPicked([]); }}>
              Cancel
            </Btn>
            <Btn style={{ flex: 1 }} disabled={!name.trim() || !picked.length || saving} onClick={addMed}>
              {saving ? 'Adding…' : 'Add medicine'}
            </Btn>
          </View>
        </Card>
      ) : (
        <Btn style={{ marginTop: 4 }} onClick={() => setAdding(true)}>
          Add a medicine
        </Btn>
      )}

      {data.meds.some(m => (m.status || 'active') !== 'active') && (
        <Card style={{ marginTop: 10 }}>
          <Mono>Not taking now</Mono>
          <Text style={styles.hintText}>Kept in your record. These never appear in today's doses or your health summary.</Text>
          {data.meds
            .filter(m => (m.status || 'active') !== 'active')
            .map(m => (
              <View key={m.id} style={styles.inactiveRow}>
                <View style={{ minWidth: 0, flex: 1 }}>
                  <Text style={styles.inactiveName}>{m.name}</Text>
                  <Mono style={{ marginTop: 3 }}>
                    {m.status}
                    {m.stoppedAt ? ` · ${fmtDay(m.stoppedAt).toLowerCase()}` : ''}
                    {m.stopReason ? ` · ${m.stopReason}` : ''}
                  </Mono>
                </View>
                <Press onPress={() => setStatus(m.id, 'active')} style={styles.restartBtn}>
                  <Text style={styles.restartLabel}>Start again</Text>
                </Press>
              </View>
            ))}
        </Card>
      )}

      <Card style={{ marginTop: 10 }}>
        <Mono>Reminders</Mono>
        <View style={{ marginTop: 14 }}>
          <Mono>Remind me before the dose</Mono>
          <View style={{ marginTop: 10 }}>
            <Seg
              value={String(settings.lead ?? 10)}
              onChange={v => setSettings({ lead: +v })}
              options={[
                { value: '0', label: 'On time' },
                { value: '5', label: '5 min' },
                { value: '10', label: '10 min' },
                { value: '30', label: '30 min' },
              ]}
            />
          </View>
        </View>
        <Text style={styles.hintText}>
          Doses due and refills running low show as a banner while the app is open. Alerts that wake the phone with the app closed aren't part of this build yet.
        </Text>
      </Card>

      <Card style={{ marginTop: 10 }}>
        <Mono>Important</Mono>
        <Text style={styles.importantText}>
          This is a reminder list you control. It does not check doses, interactions or timing — only your doctor or pharmacist can do that. Never start, stop or change a medicine because of anything in this app.
        </Text>
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, paddingTop: 20, paddingBottom: 120 },
  adhPct: { fontFamily: SANS.bold, fontSize: 26, letterSpacing: -1, color: C.ink },
  noteBanner: { marginTop: 14, backgroundColor: C.panelSoft, borderRadius: 14, paddingVertical: 12, paddingHorizontal: 16 },
  noteText: { fontFamily: SANS.regular, fontSize: 14.5, color: C.onPanel2 },
  todayRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginTop: 20, paddingHorizontal: 4 },
  todayTitle: { fontFamily: SANS.bold, fontSize: 20, letterSpacing: -0.5, color: C.ink },
  todayCount: { fontFamily: SANS.semibold, fontSize: 15.5, color: C.ink2 },
  progressTrack: { height: 8, borderRadius: 4, backgroundColor: 'rgba(22,36,28,0.08)', marginTop: 10, marginHorizontal: 4, overflow: 'hidden' },
  progressFill: { height: 8, borderRadius: 4, backgroundColor: C.brand },
  nameInput: { width: '100%', borderBottomWidth: 2, borderBottomColor: C.hair, marginTop: 8, paddingBottom: 8, fontFamily: SANS.semibold, fontSize: 20, color: C.ink },
  doseInput: { width: '100%', borderBottomWidth: 2, borderBottomColor: C.hair, marginTop: 8, paddingBottom: 8, fontFamily: SANS.medium, fontSize: 16, color: C.ink },
  stockRow: { flexDirection: 'row', gap: 14, marginTop: 18 },
  hintText: { fontFamily: SANS.regular, fontSize: 14.5, color: C.ink2, lineHeight: 21, marginTop: 8 },
  slotOptWrap: { marginBottom: 6 },
  slotOpt: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderRadius: 14, paddingVertical: 13, paddingHorizontal: 15 },
  slotOptOff: { backgroundColor: 'rgba(22,36,28,0.05)', borderWidth: 1, borderColor: C.hair },
  slotOptLabel: { fontFamily: SANS.semibold, fontSize: 14.5 },
  slotTimeBtn: { paddingVertical: 6, paddingHorizontal: 10, marginVertical: -6, marginHorizontal: -10, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.14)' },
  slotOptTime: { fontFamily: MONO.medium, fontSize: 13, letterSpacing: 0.6, opacity: 0.9, color: '#FFFFFF' },
  row2: { flexDirection: 'row', gap: 8, marginTop: 16 },
  inactiveRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: C.hair },
  inactiveName: { fontFamily: SANS.semibold, fontSize: 15.5, color: C.ink2, letterSpacing: -0.3 },
  restartBtn: { borderWidth: 1, borderColor: C.hair, backgroundColor: C.card, borderRadius: 999, paddingVertical: 9, paddingHorizontal: 15 },
  restartLabel: { fontFamily: SANS.semibold, fontSize: 14.5, color: C.ink },
  importantText: { fontFamily: SANS.regular, fontSize: 15, lineHeight: 23, color: C.ink2, marginTop: 10 },
});
