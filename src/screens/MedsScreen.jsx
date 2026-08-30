import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import Svg, { Path, Rect } from 'react-native-svg';
import { C } from '../theme/colors';
import { SANS, MONO } from '../theme/typography';
import { GRAD } from '../theme/gradients';
import {
  SLOTS,
  activeMeds,
  adherence,
  daysLeft,
  dailyUnits,
  dosesToday,
  isTaken,
  prettyTime,
  refillColor,
  refillLabel,
  REFILL_ALERT_DAYS,
  unitsLeft,
  dayKey,
} from '../lib/meds';
import { fmtDay, uid } from '../lib/calc';
import { useData } from '../state/DataContext';
import { useAsk } from '../state/AskDialogContext';
import Head from '../components/atoms/Head';
import Card from '../components/atoms/Card';
import Mono from '../components/atoms/Mono';
import Btn from '../components/atoms/Btn';
import Seg from '../components/atoms/Seg';
import Press from '../components/atoms/Press';
import DoseCheckbox from '../components/atoms/DoseCheckbox';
import { G } from '../components/icons/ScreenGlyphs';
import LinearGradient from 'react-native-linear-gradient';

export default function MedsScreen() {
  const { data, setData } = useData();
  const ask = useAsk();
  const [name, setName] = useState('');
  const [dose, setDose] = useState('');
  const [picked, setPicked] = useState([]);
  const [stock, setStock] = useState('');
  const [perDose, setPerDose] = useState('1');
  const [adding, setAdding] = useState(false);
  const [restock, setRestock] = useState(null);
  const [restockQty, setRestockQty] = useState('');
  const [editTimes, setEditTimes] = useState(false);
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

  const setSettings = patch => setData(d => ({ ...d, medSettings: { ...settings, ...patch } }));

  const toggleSlot = k => setPicked(p => (p.includes(k) ? p.filter(x => x !== k) : [...p, k]));

  const addMed = () => {
    if (!name.trim() || !picked.length) return;
    setData(d => ({
      ...d,
      meds: [
        ...d.meds,
        {
          id: uid(),
          name: name.trim(),
          dose: dose.trim(),
          slots: picked,
          added: Date.now(),
          status: 'active',
          perDose: Math.max(1, +perDose || 1),
          stock: stock === '' ? null : +stock,
          stockedAt: stock === '' ? null : Date.now(),
        },
      ],
    }));
    setName('');
    setDose('');
    setPicked([]);
    setStock('');
    setPerDose('1');
    setAdding(false);
    say('Medicine added');
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
      setData(d => ({ ...d, meds: d.meds.map(m => (m.id === id ? { ...m, status, stoppedAt: Date.now(), stopReason: why || '' } : m)) }));
      say(`${med.name} stopped. It stays in your medicine record.`);
      return;
    }
    setData(d => ({ ...d, meds: d.meds.map(m => (m.id === id ? { ...m, status } : m)) }));
    say(status === 'paused' ? `${med.name} paused` : `${med.name} is active again`);
  };

  const saveRestock = id => {
    const qty = +restockQty;
    if (!qty || qty <= 0) return;
    setData(d => ({ ...d, meds: d.meds.map(m => (m.id === id ? { ...m, stock: qty, stockedAt: Date.now() } : m)) }));
    setRestock(null);
    setRestockQty('');
    say('Stock updated');
  };

  const toggleTaken = doseId => {
    const day = dayKey();
    setData(d => {
      const dayMap = { ...(d.taken?.[day] || {}) };
      if (dayMap[doseId]) delete dayMap[doseId];
      else dayMap[doseId] = Date.now();
      return { ...d, taken: { ...(d.taken || {}), [day]: dayMap } };
    });
  };

  const grouped = SLOTS.map(s => ({ slot: s, items: doses.filter(d => d.slot === s.key) })).filter(g => g.items.length);

  const timeToDate = t => {
    const [h, m] = String(t || '00:00').split(':').map(Number);
    const d = new Date();
    d.setHours(h, m, 0, 0);
    return d;
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
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

      {grouped.length > 0 && (
        <View style={{ marginTop: 16 }}>
          {grouped.map(({ slot, items }) => (
            <View key={slot.key} style={{ marginBottom: 12 }}>
              <View style={styles.slotHeaderRow}>
                <Mono>{slot.label}</Mono>
                <Mono>{prettyTime(times[slot.key])}</Mono>
              </View>
              {items.map(d => {
                const done = isTaken(data, d.id);
                return (
                  <View key={d.id} style={styles.doseRow}>
                    <View style={styles.doseLeft}>
                      <DoseCheckbox done={done} onPress={() => toggleTaken(d.id)} />
                      <View style={{ minWidth: 0, flex: 1 }}>
                        <Text style={[styles.doseName, done && styles.doseNameDone]} numberOfLines={1}>
                          {d.med.name}
                        </Text>
                        {d.med.dose ? <Mono style={{ marginTop: 2 }}>{d.med.dose}</Mono> : null}
                      </View>
                    </View>
                    <View style={styles.doseActions}>
                      <Press onPress={() => setStatus(d.med.id, 'paused')} style={{ padding: 8 }} accessibilityLabel="pause">
                        <Svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={C.ink3} strokeWidth="2" strokeLinecap="round">
                          <Path d="M9 5v14M15 5v14" />
                        </Svg>
                      </Press>
                      <Press onPress={() => setStatus(d.med.id, 'discontinued')} style={{ padding: 8 }} accessibilityLabel="stop this medicine">
                        <Svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={C.ink3} strokeWidth="1.8" strokeLinecap="round">
                          <Rect x="6" y="6" width="12" height="12" rx="2" />
                        </Svg>
                      </Press>
                    </View>
                  </View>
                );
              })}
            </View>
          ))}
        </View>
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
                        <Text style={styles.slotOptTime}>{prettyTime(times[s.key])}</Text>
                      </LinearGradient>
                    ) : (
                      <View style={[styles.slotOpt, styles.slotOptOff]}>
                        <Text style={[styles.slotOptLabel, { color: C.ink }]}>
                          {s.label}
                          {s.sub ? <Text style={{ fontFamily: SANS.regular, opacity: 0.6 }}> · {s.sub}</Text> : ''}
                        </Text>
                        <Text style={[styles.slotOptTime, { color: C.ink2 }]}>{prettyTime(times[s.key])}</Text>
                      </View>
                    )}
                  </Press>
                );
              })}
            </View>
          </View>
          <View style={styles.row2}>
            <Btn kind="quiet" style={{ flex: 1 }} onClick={() => { setAdding(false); setName(''); setDose(''); setPicked([]); }}>
              Cancel
            </Btn>
            <Btn style={{ flex: 1 }} disabled={!name.trim() || !picked.length} onClick={addMed}>
              Add medicine
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

      {activeMeds(data).length > 0 && (
        <Card style={{ marginTop: 10 }}>
          <Mono>Stock and refills</Mono>
          {activeMeds(data).map(m => {
            const dl = daysLeft(m);
            const left = unitsLeft(m);
            const low = dl != null && dl <= REFILL_ALERT_DAYS;
            return (
              <View key={m.id} style={styles.stockItem}>
                <View style={styles.stockRowTop}>
                  <View style={{ minWidth: 0, flex: 1 }}>
                    <Text style={styles.stockName} numberOfLines={1}>
                      {m.name}
                    </Text>
                    {dl == null ? (
                      <Mono style={{ marginTop: 3 }}>No stock tracked</Mono>
                    ) : (
                      <View style={styles.stockStatusRow}>
                        <View style={[styles.stockDot, { backgroundColor: low ? refillColor(dl) : C.normal }]} />
                        <Text style={[styles.stockLabel, { color: low ? refillColor(dl) : C.ink2 }]}>{refillLabel(dl)}</Text>
                        <Mono>
                          ≈ {left} left · {dailyUnits(m)}/day
                        </Mono>
                      </View>
                    )}
                  </View>
                  <Press
                    onPress={() => {
                      setRestock(restock === m.id ? null : m.id);
                      setRestockQty('');
                    }}
                    style={styles.stockBtn}>
                    <Text style={styles.stockBtnLabel}>{dl == null ? 'Set stock' : 'Bought more'}</Text>
                  </Press>
                </View>
                {restock === m.id && (
                  <View style={styles.restockRow}>
                    <TextInput
                      value={restockQty}
                      onChangeText={t => setRestockQty(t.replace(/\D/g, '').slice(0, 4))}
                      keyboardType="number-pad"
                      autoFocus
                      placeholder="How many tablets now?"
                      placeholderTextColor={C.ink3}
                      onSubmitEditing={() => saveRestock(m.id)}
                      style={styles.restockInput}
                    />
                    <Press onPress={() => saveRestock(m.id)} disabled={!restockQty} style={styles.restockSave}>
                      <Text style={styles.restockSaveLabel}>Save</Text>
                    </Press>
                  </View>
                )}
              </View>
            );
          })}
          <Text style={styles.hintText}>Counted down by the calendar from the day you set the stock, so it stays honest even if you forget to tick a dose.</Text>
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
        <Press onPress={() => setEditTimes(v => !v)} style={styles.doseTimesHeader}>
          <Mono>Your dose times</Mono>
          <View style={[editTimes && { transform: [{ rotate: '180deg' }] }]}>
            <Svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={C.ink3} strokeWidth="2" strokeLinecap="round">
              <Path d="M6 9l6 6 6-6" />
            </Svg>
          </View>
        </Press>
        {editTimes ? (
          <View style={{ marginTop: 8 }}>
            {SLOTS.map(s => (
              <View key={s.key} style={styles.timeRow}>
                <View>
                  <Text style={styles.timeSlotLabel}>{s.label}</Text>
                  {s.sub ? <Mono style={{ marginTop: 2 }}>{s.sub}</Mono> : null}
                </View>
                <Press onPress={() => setTimePickerFor(s.key)} style={styles.timeBtn}>
                  <Text style={styles.timeBtnLabel}>{prettyTime(times[s.key])}</Text>
                </Press>
              </View>
            ))}
            <Text style={styles.hintText}>Set these to when you actually eat. Every reminder is calculated from them.</Text>
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
        ) : (
          <View style={styles.timesPreviewRow}>
            {SLOTS.map(s => (
              <View key={s.key}>
                <Mono>{s.label.split(' ').pop()}</Mono>
                <Text style={styles.timesPreviewValue}>{prettyTime(times[s.key])}</Text>
              </View>
            ))}
          </View>
        )}
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
  slotHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 4, paddingBottom: 8 },
  doseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.hair,
    borderRadius: 16,
    paddingVertical: 13,
    paddingHorizontal: 15,
    marginBottom: 6,
  },
  doseLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, minWidth: 0, flex: 1 },
  doseName: { fontFamily: SANS.semibold, fontSize: 15.5, letterSpacing: -0.3, color: C.ink },
  doseNameDone: { color: C.ink3, textDecorationLine: 'line-through' },
  doseActions: { flexDirection: 'row', gap: 4, flexShrink: 0 },
  nameInput: { width: '100%', borderBottomWidth: 2, borderBottomColor: C.hair, marginTop: 8, paddingBottom: 8, fontFamily: SANS.semibold, fontSize: 20, color: C.ink },
  doseInput: { width: '100%', borderBottomWidth: 2, borderBottomColor: C.hair, marginTop: 8, paddingBottom: 8, fontFamily: SANS.medium, fontSize: 16, color: C.ink },
  stockRow: { flexDirection: 'row', gap: 14, marginTop: 18 },
  hintText: { fontFamily: SANS.regular, fontSize: 14.5, color: C.ink2, lineHeight: 21, marginTop: 8 },
  slotOptWrap: { marginBottom: 6 },
  slotOpt: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderRadius: 14, paddingVertical: 13, paddingHorizontal: 15 },
  slotOptOff: { backgroundColor: 'rgba(255,255,255,0.10)', borderWidth: 1, borderColor: C.hair },
  slotOptLabel: { fontFamily: SANS.semibold, fontSize: 14.5 },
  slotOptTime: { fontFamily: MONO.medium, fontSize: 13, letterSpacing: 0.6, opacity: 0.9, color: '#FFFFFF' },
  row2: { flexDirection: 'row', gap: 8, marginTop: 16 },
  inactiveRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: C.hair },
  inactiveName: { fontFamily: SANS.semibold, fontSize: 15.5, color: C.ink2, letterSpacing: -0.3 },
  restartBtn: { borderWidth: 1, borderColor: C.hair, backgroundColor: C.card, borderRadius: 999, paddingVertical: 9, paddingHorizontal: 15 },
  restartLabel: { fontFamily: SANS.semibold, fontSize: 14.5, color: C.ink },
  stockItem: { paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: C.hair },
  stockRowTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  stockName: { fontFamily: SANS.semibold, fontSize: 15, letterSpacing: -0.3, color: C.ink },
  stockStatusRow: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 4 },
  stockDot: { width: 7, height: 7, borderRadius: 99 },
  stockLabel: { fontFamily: SANS.semibold, fontSize: 14.5 },
  stockBtn: { borderWidth: 1, borderColor: C.hair, backgroundColor: C.card, borderRadius: 999, paddingVertical: 8, paddingHorizontal: 14, flexShrink: 0 },
  stockBtnLabel: { fontFamily: SANS.semibold, fontSize: 14.5, color: C.ink },
  restockRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12 },
  restockInput: { flex: 1, borderWidth: 1, borderColor: C.hair, borderRadius: 12, paddingVertical: 11, paddingHorizontal: 13, fontFamily: SANS.regular, fontSize: 15, color: C.ink, backgroundColor: C.card },
  restockSave: { backgroundColor: C.panel, borderRadius: 12, paddingVertical: 11, paddingHorizontal: 16 },
  restockSaveLabel: { fontFamily: SANS.semibold, fontSize: 14, color: C.onPanel },
  doseTimesHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  timeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: C.hair },
  timeSlotLabel: { fontFamily: SANS.semibold, fontSize: 14.5, color: C.ink },
  timeBtn: { borderWidth: 1, borderColor: C.hair, borderRadius: 10, paddingVertical: 8, paddingHorizontal: 10, backgroundColor: 'rgba(255,255,255,0.10)' },
  timeBtnLabel: { fontFamily: MONO.medium, fontSize: 14.5, color: C.ink },
  timesPreviewRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 14, marginTop: 10 },
  timesPreviewValue: { fontFamily: SANS.semibold, fontSize: 15, color: C.ink },
  importantText: { fontFamily: SANS.regular, fontSize: 15, lineHeight: 23, color: C.ink2, marginTop: 10 },
});
