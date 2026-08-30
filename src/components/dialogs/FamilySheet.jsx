import React, { useMemo, useState } from 'react';
import { Modal, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Svg, { Path } from 'react-native-svg';
import { C } from '../../theme/colors';
import { GRAD, GRAD_SHEET } from '../../theme/gradients';
import { SANS, MONO } from '../../theme/typography';
import { uid, fmtDay } from '../../lib/calc';
import { RELATIONS, buildWeekly } from '../../lib/family';
import { copyText, openLink, toWhatsAppUrl } from '../../lib/share';
import Card from '../atoms/Card';
import Mono from '../atoms/Mono';
import Btn from '../atoms/Btn';
import Press from '../atoms/Press';

export default function FamilySheet({ data, setData, onClose }) {
  const care = data.care || { role: 'logger', circle: [], day: 0 };
  const [name, setName] = useState('');
  const [rel, setRel] = useState('Son');
  const [phone, setPhone] = useState('');
  const [note, setNote] = useState('');
  const text = useMemo(() => buildWeekly(data), [data]);
  const say = m => {
    setNote(m);
    setTimeout(() => setNote(''), 2800);
  };
  const setCare = patch => setData(d => ({ ...d, care: { ...care, ...patch } }));

  const add = () => {
    if (!name.trim()) return;
    setCare({ circle: [...care.circle, { id: uid(), name: name.trim(), rel, phone: phone.replace(/[^\d+]/g, ''), weekly: true, lastSent: null }] });
    setName('');
    setPhone('');
    say('Added to the circle');
  };

  const send = async m => {
    const msg = `${text}\n\nSent from my vitals app.`;
    const ok = await openLink(toWhatsAppUrl((m.phone || '').replace(/\D/g, ''), msg));
    if (!ok) return say("Couldn't open WhatsApp");
    setCare({ circle: care.circle.map(x => (x.id === m.id ? { ...x, lastSent: Date.now() } : x)) });
  };

  const sendAll = () => {
    const first = care.circle.filter(m => m.weekly)[0];
    if (first) send(first);
  };

  const DAY_OPTIONS = [
    { value: '0', label: 'Sunday' },
    { value: '1', label: 'Monday' },
    { value: '5', label: 'Friday' },
    { value: '6', label: 'Saturday' },
  ];

  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <LinearGradient colors={GRAD_SHEET.colors} locations={GRAD_SHEET.locations} start={GRAD_SHEET.start} end={GRAD_SHEET.end} style={styles.root}>
        <View style={styles.header}>
          <View>
            <Text style={styles.h2}>Family</Text>
            <Mono style={styles.sub}>Weekly update by WhatsApp</Mono>
          </View>
          <Press onPress={onClose} style={styles.closeBtn}>
            <Svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={C.ink} strokeWidth="2" strokeLinecap="round">
              <Path d="M6 6l12 12M18 6L6 18" />
            </Svg>
          </Press>
        </View>

        <ScrollView style={styles.body} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
          {note ? (
            <View style={styles.noteBanner}>
              <Text style={styles.noteText}>{note}</Text>
            </View>
          ) : null}

          <Card style={{ padding: 20 }}>
            <Mono>Who gets the update</Mono>
            {care.circle.length === 0 && <Text style={styles.emptyText}>Nobody yet. Add a family member and their weekly summary goes out over WhatsApp — no account, no server, nothing stored anywhere but this phone.</Text>}
            {care.circle.map((m, i) => (
              <View key={m.id} style={[styles.memberRow, i < care.circle.length - 1 && styles.memberRowBorder]}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.memberName}>{m.name}</Text>
                  <Mono style={{ marginTop: 3 }}>
                    {m.rel}
                    {m.phone ? ` · ${m.phone}` : ' · no number'} · {m.lastSent ? `sent ${fmtDay(m.lastSent).toLowerCase()}` : 'never sent'}
                  </Mono>
                </View>
                <View style={styles.memberActions}>
                  <Press onPress={() => send(m)} style={styles.sendBtn}>
                    <Text style={styles.sendLabel}>Send</Text>
                  </Press>
                  <Press onPress={() => setCare({ circle: care.circle.filter(x => x.id !== m.id) })} style={styles.trashBtn}>
                    <Svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={C.ink3} strokeWidth="1.8" strokeLinecap="round">
                      <Path d="M5 7h14M10 7V5h4v2M7 7l1 12h8l1-12" />
                    </Svg>
                  </Press>
                </View>
              </View>
            ))}

            <View style={{ paddingTop: 16 }}>
              <Mono>Add someone</Mono>
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder="Name"
                placeholderTextColor={C.ink3}
                style={styles.fieldInput}
              />
              <TextInput
                value={phone}
                onChangeText={t => setPhone(t.replace(/[^\d+]/g, '').slice(0, 15))}
                keyboardType="phone-pad"
                placeholder="WhatsApp number with country code"
                placeholderTextColor={C.ink3}
                style={[styles.fieldInput, { fontSize: 15, marginTop: 14 }]}
              />
              <View style={styles.relRow}>
                {RELATIONS.map(x => (
                  <Press key={x} onPress={() => setRel(x)} style={styles.relPillWrap}>
                    {rel === x ? (
                      <LinearGradient colors={GRAD.colors} start={GRAD.start} end={GRAD.end} style={styles.relPill}>
                        <Text style={[styles.relLabel, { color: '#FFFFFF' }]}>{x}</Text>
                      </LinearGradient>
                    ) : (
                      <View style={[styles.relPill, styles.relPillOff]}>
                        <Text style={[styles.relLabel, { color: C.ink2 }]}>{x}</Text>
                      </View>
                    )}
                  </Press>
                ))}
              </View>
              <Btn style={{ marginTop: 16 }} disabled={!name.trim()} onClick={add}>
                Add to circle
              </Btn>
            </View>
          </Card>

          <Card style={{ marginTop: 10 }}>
            <Mono>Send on</Mono>
            <View style={{ flexDirection: 'row', gap: 3, backgroundColor: 'rgba(255,255,255,0.10)', padding: 4, borderRadius: 16, marginTop: 10 }}>
              {DAY_OPTIONS.map(o => {
                const on = String(care.day ?? 0) === o.value;
                return (
                  <Press key={o.value} onPress={() => setCare({ day: +o.value })} style={{ flex: 1 }}>
                    {on ? (
                      <LinearGradient colors={GRAD.colors} start={GRAD.start} end={GRAD.end} style={styles.dayPill}>
                        <Text style={[styles.dayLabel, { color: '#FFFFFF' }]}>{o.label}</Text>
                      </LinearGradient>
                    ) : (
                      <View style={styles.dayPill}>
                        <Text style={[styles.dayLabel, { color: C.ink2 }]}>{o.label}</Text>
                      </View>
                    )}
                  </Press>
                );
              })}
            </View>
            <Text style={styles.helpText}>You'll be reminded on the day. Nothing sends by itself — you see the message before it goes.</Text>
          </Card>

          <Card style={{ marginTop: 10 }}>
            <Mono>This week's message</Mono>
            <Text style={styles.preview}>{text}</Text>
          </Card>

          <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
            <Btn kind="quiet" style={{ flex: 1 }} onClick={async () => say((await copyText(text)) ? 'Copied' : 'Copy failed')}>
              Copy
            </Btn>
            <Btn style={{ flex: 1 }} disabled={!care.circle.length} onClick={sendAll}>
              Send now
            </Btn>
          </View>
        </ScrollView>
      </LinearGradient>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: C.hair,
  },
  h2: { fontFamily: SANS.bold, fontSize: 19, letterSpacing: -0.6, color: C.ink },
  sub: { marginTop: 3 },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: C.hair,
    backgroundColor: C.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: { flex: 1 },
  noteBanner: {
    backgroundColor: C.panelSoft,
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
  },
  noteText: { fontFamily: SANS.regular, fontSize: 13.5, color: C.onPanel2 },
  emptyText: { fontFamily: SANS.regular, fontSize: 14, color: C.ink2, marginTop: 10, lineHeight: 21 },
  memberRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 14 },
  memberRowBorder: { borderBottomWidth: 1, borderBottomColor: C.hair },
  memberName: { fontFamily: SANS.semibold, fontSize: 15.5, letterSpacing: -0.3, color: C.ink },
  memberActions: { flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 0 },
  sendBtn: { backgroundColor: C.panel, borderRadius: 999, paddingVertical: 9, paddingHorizontal: 15 },
  sendLabel: { fontFamily: SANS.semibold, fontSize: 13, color: C.onPanel },
  trashBtn: { padding: 4 },
  fieldInput: {
    width: '100%',
    borderBottomWidth: 2,
    borderBottomColor: C.hair,
    marginTop: 8,
    paddingBottom: 8,
    fontFamily: SANS.semibold,
    fontSize: 17,
    color: C.ink,
  },
  relRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 14 },
  relPillWrap: {},
  relPill: { borderRadius: 999, paddingVertical: 8, paddingHorizontal: 14 },
  relPillOff: { backgroundColor: 'rgba(255,255,255,0.10)', borderWidth: 1, borderColor: C.hair },
  relLabel: { fontFamily: SANS.semibold, fontSize: 13 },
  dayPill: { borderRadius: 11, paddingVertical: 10, alignItems: 'center', justifyContent: 'center' },
  dayLabel: { fontFamily: SANS.semibold, fontSize: 13.5 },
  helpText: { fontFamily: SANS.regular, fontSize: 12.5, color: C.ink2, lineHeight: 19, marginTop: 12 },
  preview: { fontFamily: MONO.regular, fontSize: 11, lineHeight: 19, color: C.ink2, marginTop: 12 },
});
