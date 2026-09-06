import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { C } from '../theme/colors';
import { SANS } from '../theme/typography';
import { useData } from '../state/DataContext';
import { useTabBarClearance } from '../navigation/TabBar';
import Head from '../components/atoms/Head';
import Card from '../components/atoms/Card';
import Mono from '../components/atoms/Mono';
import Btn from '../components/atoms/Btn';
import Press from '../components/atoms/Press';
import { G } from '../components/icons/ScreenGlyphs';

const BLOOD_GROUPS = ['A+', 'A−', 'B+', 'B−', 'AB+', 'AB−', 'O+', 'O−'];

function Big({ children, style }) {
  return <Text style={[styles.big, style]}>{children}</Text>;
}

export default function HealthScreen() {
  const { data, setData, saveHealth } = useData();
  const bottomPad = useTabBarClearance();
  const [edit, setEdit] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [cond, setCond] = useState('');
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

  const addCondition = () => {
    if (!cond.trim()) return;
    setH({ conditions: [...h.conditions, cond.trim()] });
    setCond('');
  };

  return (
    <ScrollView contentContainerStyle={[styles.container, { paddingBottom: bottomPad }]}>
      <Head title="Health Summary" caption="your important health information at a glance" icon={G.health(C.mint)} tint={C.mint} />

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
            <TextInput
              value={cond}
              onChangeText={setCond}
              placeholder="Add a condition"
              placeholderTextColor={C.ink3}
              onSubmitEditing={addCondition}
              style={styles.condInput}
            />
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

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      <Btn kind={edit ? 'solid' : 'quiet'} style={{ marginTop: 10, paddingVertical: 17 }} disabled={saving} onClick={toggleEdit}>
        {saving ? 'Saving…' : edit ? 'Done editing' : 'Edit health information'}
      </Btn>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, paddingTop: 20, paddingBottom: 120 },
  errorText: { fontFamily: SANS.regular, fontSize: 13.5, color: C.stage2, marginTop: 10, paddingHorizontal: 4 },
  big: { fontFamily: SANS.semibold, fontSize: 19, letterSpacing: -0.4, lineHeight: 26, color: C.ink },
  condRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12 },
  condRowBorder: { borderBottomWidth: 1, borderBottomColor: C.hair },
  addCondRow: { flexDirection: 'row', gap: 8, marginTop: 14 },
  condInput: { flex: 1, borderWidth: 1, borderColor: C.hair, borderRadius: 14, paddingVertical: 14, paddingHorizontal: 15, fontFamily: SANS.regular, fontSize: 16, color: C.ink, backgroundColor: 'rgba(22,36,28,0.05)' },
  addBtn: { backgroundColor: C.panel, borderRadius: 14, paddingVertical: 14, paddingHorizontal: 20, alignItems: 'center', justifyContent: 'center' },
  addBtnLabel: { fontFamily: SANS.semibold, fontSize: 15, color: C.onPanel },
  row: { flexDirection: 'row', gap: 10, marginTop: 10 },
  allergyInput: { borderBottomWidth: 2, borderBottomColor: C.hair, marginTop: 10, paddingBottom: 6, fontFamily: SANS.semibold, fontSize: 18, color: C.ink },
  bgRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 },
  bgChip: { borderWidth: 1, borderColor: C.hair, borderRadius: 10, paddingVertical: 6, paddingHorizontal: 8, backgroundColor: 'rgba(22,36,28,0.05)' },
  bgChipOn: { backgroundColor: C.stage2, borderColor: C.stage2 },
  bgChipLabel: { fontFamily: SANS.semibold, fontSize: 14, color: C.ink },
  bgValue: { fontFamily: SANS.bold, fontSize: 30, letterSpacing: -1.2, marginTop: 8, color: C.ink },
});
