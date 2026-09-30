import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { C, GLASS } from '../theme/colors';
import { SANS } from '../theme/typography';
import { kg1 } from '../lib/calc';
import { useData } from '../state/DataContext';
import { useGo } from '../navigation/useGo';
import Screen, { Section } from '../components/layout/Screen';
import Btn from '../components/atoms/Btn';
import Seg from '../components/atoms/Seg';
import Press from '../components/atoms/Press';

const SEXES = [
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
  { value: 'other', label: 'Other' },
];
const DIETS = [
  { value: 'veg', label: 'Veg' },
  { value: 'egg', label: 'Egg' },
  { value: 'nonveg', label: 'Non-veg' },
];

function Field({ label, children, hint, last }) {
  return (
    <View style={[styles.field, !last && styles.fieldBorder]}>
      <Text style={styles.label}>{label}</Text>
      {children}
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

// Profile → Personal details: the editable part of the old Profile page
export default function ProfileDetailsScreen() {
  const { data, saveProfile } = useData();
  const go = useGo();
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
      setNote('Saved');
      setTimeout(() => setNote(''), 1800);
    } catch (err) {
      setNote(err.message);
    } finally {
      setSaving(false);
    }
  };

  const w = data.body[0];
  const h = data.health || {};

  return (
    <Screen title="Personal details" back keyboard>
      <View style={styles.card}>
        <Field label="Full name">
          <TextInput value={draft.name || ''} onChangeText={t => set('name', t)} placeholder="Your name" placeholderTextColor={C.ink3} style={styles.input} />
        </Field>
        <View style={styles.pair}>
          <View style={{ flex: 1 }}>
            <Field label="Age" last>
              <TextInput
                value={draft.age ? String(draft.age) : ''}
                onChangeText={t => set('age', t.replace(/\D/g, '').slice(0, 3))}
                keyboardType="number-pad"
                placeholder="Years"
                placeholderTextColor={C.ink3}
                style={styles.input}
              />
            </Field>
          </View>
          <View style={{ flex: 1 }}>
            <Field label="Height (cm)" last>
              <TextInput
                value={draft.heightCm ? String(draft.heightCm) : ''}
                onChangeText={t => set('heightCm', t.replace(/\D/g, '').slice(0, 3))}
                keyboardType="number-pad"
                placeholder="cm"
                placeholderTextColor={C.ink3}
                style={styles.input}
              />
            </Field>
          </View>
        </View>
        <Field label="Sex">
          <View style={{ marginTop: 8 }}>
            <Seg value={draft.sex || ''} onChange={v => set('sex', v)} options={SEXES} />
          </View>
        </Field>
        <Field label="Diet" last hint="Used by the AI coach for food suggestions.">
          <View style={{ marginTop: 8 }}>
            <Seg value={draft.diet || 'veg'} onChange={v => set('diet', v)} options={DIETS} />
          </View>
        </Field>
      </View>

      <View style={styles.readonly}>
        <Press onPress={() => go('log', { tab: 'body' })} style={styles.readonlyItem}>
          <Text style={styles.readonlyLabel}>Weight</Text>
          <Text style={styles.readonlyValue}>{w ? `${kg1(w.weightKg)} kg` : 'Add a reading'}</Text>
        </Press>
        <Press onPress={() => go('health')} style={styles.readonlyItem}>
          <Text style={styles.readonlyLabel}>Blood group</Text>
          <Text style={styles.readonlyValue}>{h.bloodGroup || 'Set in Health summary'}</Text>
        </Press>
      </View>

      <Section title="Your doctor">
        <View style={styles.card}>
          <Field label="Doctor's WhatsApp number" hint="Include the country code, e.g. +91 98765 43210.">
            <TextInput
              value={draft.docPhone || ''}
              onChangeText={t => set('docPhone', t.replace(/[^\d+]/g, '').slice(0, 15))}
              keyboardType="phone-pad"
              placeholder="+91…"
              placeholderTextColor={C.ink3}
              style={styles.input}
            />
          </Field>
          <Field label="Doctor's email (optional)" last hint="Reports go straight to your doctor from Reports & your data.">
            <TextInput
              value={draft.docEmail || ''}
              onChangeText={t => set('docEmail', t.trim())}
              keyboardType="email-address"
              autoCapitalize="none"
              placeholder="doctor@clinic.com"
              placeholderTextColor={C.ink3}
              style={styles.input}
            />
          </Field>
        </View>
      </Section>

      <Btn onClick={save} disabled={!dirty || saving} style={{ marginTop: 20 }}>
        {saving ? 'Saving…' : dirty ? 'Save changes' : note || 'All changes saved'}
      </Btn>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { ...GLASS, borderRadius: 24, paddingHorizontal: 16 },
  field: { paddingVertical: 14 },
  fieldBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.hair },
  label: { fontFamily: SANS.medium, fontSize: 14.5, color: C.ink2 },
  input: { fontFamily: SANS.semibold, fontSize: 18, color: C.ink, paddingVertical: 6, marginTop: 2 },
  hint: { fontFamily: SANS.regular, fontSize: 13.5, color: C.ink3, marginTop: 6, lineHeight: 19 },
  pair: { flexDirection: 'row', gap: 16, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.hair },
  readonly: { flexDirection: 'row', gap: 10, marginTop: 10 },
  readonlyItem: { flex: 1, ...GLASS, borderRadius: 20, padding: 14 },
  readonlyLabel: { fontFamily: SANS.medium, fontSize: 14, color: C.ink3 },
  readonlyValue: { fontFamily: SANS.semibold, fontSize: 16, color: C.ink, marginTop: 3 },
});
