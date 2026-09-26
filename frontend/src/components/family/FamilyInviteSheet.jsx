import React, { useEffect, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Modal, Platform, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Svg, { Path } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { C } from '../../theme/colors';
import { GRAD, GRAD_SHEET } from '../../theme/gradients';
import { SANS } from '../../theme/typography';
import { FAMILY_SCOPES, lookupUser } from '../../lib/familyApi';
import { isValidUsername, normalizeUsername } from '../../hooks/useUsernameCheck';
import { useAuth } from '../../state/AuthContext';
import Card from '../atoms/Card';
import Mono from '../atoms/Mono';
import Btn from '../atoms/Btn';
import Press from '../atoms/Press';

/* Invite someone into your family by username, choosing which sections
   of YOUR record they can see and edit — or, with `editing` set to an
   existing link, change those sections. onSubmit({ username, scopes })
   does the API call and throws to show an error here. */
export default function FamilyInviteSheet({ editing = null, onSubmit, onClose }) {
  const { token } = useAuth();
  const insets = useSafeAreaInsets();
  const [input, setInput] = useState('');
  const [found, setFound] = useState(editing ? editing.member : null);
  const [lookupError, setLookupError] = useState('');
  const [looking, setLooking] = useState(false);
  const [scopes, setScopes] = useState(editing ? editing.scopes : []);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // confirm who a username belongs to as it's typed, so a typo can't share a record with a stranger
  const username = normalizeUsername(input);
  useEffect(() => {
    if (editing) return undefined;
    setFound(null);
    setLookupError('');
    if (!username) return undefined;
    if (!isValidUsername(username)) {
      setLookupError('Enter a valid username');
      return undefined;
    }
    let cancelled = false;
    setLooking(true);
    const t = setTimeout(async () => {
      try {
        const res = await lookupUser(username, token);
        if (!cancelled) setFound(res.user);
      } catch (err) {
        if (!cancelled) setLookupError(err.message);
      } finally {
        if (!cancelled) setLooking(false);
      }
    }, 450);
    return () => {
      cancelled = true;
      clearTimeout(t);
      setLooking(false);
    };
  }, [username, editing, token]);

  const toggle = key => setScopes(s => (s.includes(key) ? s.filter(x => x !== key) : [...s, key]));

  const submit = async () => {
    if (!found || !scopes.length || saving) return;
    setError('');
    setSaving(true);
    try {
      await onSubmit({ username: found.username, scopes });
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  };

  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <LinearGradient colors={GRAD_SHEET.colors} locations={GRAD_SHEET.locations} start={GRAD_SHEET.start} end={GRAD_SHEET.end} style={styles.root}>
        <View style={[styles.header, { paddingTop: insets.top + 16, paddingLeft: insets.left + 18, paddingRight: insets.right + 18 }]}>
          <View style={{ flex: 1 }}>
            <Text style={styles.h2}>{editing ? `What ${editing.member.name} can see` : 'Invite to your family'}</Text>
            <Mono style={{ marginTop: 3 }}>{editing ? `@${editing.member.username}` : 'Share your record by username'}</Mono>
          </View>
          <Press onPress={onClose} style={styles.closeBtn}>
            <Svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={C.ink} strokeWidth="2" strokeLinecap="round">
              <Path d="M6 6l12 12M18 6L6 18" />
            </Svg>
          </Press>
        </View>

        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={{ padding: 16 }} keyboardShouldPersistTaps="handled">
            {!editing && (
              <Card blur={false}>
                <Mono>Their username</Mono>
                <View style={styles.userRow}>
                  <Text style={styles.at}>@</Text>
                  <TextInput
                    value={input}
                    onChangeText={t => setInput(t.replace(/\s/g, '').toLowerCase())}
                    placeholder="username"
                    placeholderTextColor={C.ink3}
                    autoCapitalize="none"
                    autoCorrect={false}
                    autoFocus
                    style={styles.userInput}
                  />
                  {looking && <ActivityIndicator color={C.brand2} />}
                </View>
                {found ? (
                  <View style={styles.foundRow}>
                    <LinearGradient colors={GRAD.colors} start={GRAD.start} end={GRAD.end} style={styles.avatar}>
                      <Text style={styles.avatarLabel}>{initials(found.name)}</Text>
                    </LinearGradient>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.foundName}>{found.name}</Text>
                      <Mono style={{ marginTop: 2 }}>@{found.username}</Mono>
                    </View>
                    <Text style={styles.check}>✓</Text>
                  </View>
                ) : lookupError && !looking ? (
                  <Text style={styles.errorText}>{lookupError}</Text>
                ) : (
                  <Text style={styles.hintText}>They'll get an invitation and need to accept it before they can see anything.</Text>
                )}
              </Card>
            )}

            <Card blur={false} style={{ marginTop: editing ? 0 : 10 }}>
              <Mono>What they can see and edit</Mono>
              <Text style={styles.hintText}>Only the sections you tick are shared. You can change or remove this anytime.</Text>
              <View style={{ marginTop: 12 }}>
                {FAMILY_SCOPES.map(s => {
                  const on = scopes.includes(s.key);
                  return (
                    <Press key={s.key} onPress={() => toggle(s.key)} style={[styles.scopeRow, on && styles.scopeRowOn]}>
                      <View style={[styles.box, on && styles.boxOn]}>{on && <Text style={styles.boxTick}>✓</Text>}</View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.scopeLabel}>{s.label}</Text>
                        <Text style={styles.scopeHint}>{s.hint}</Text>
                      </View>
                    </Press>
                  );
                })}
              </View>
            </Card>

            {error ? <Text style={[styles.errorText, { marginTop: 12 }]}>{error}</Text> : null}
          </ScrollView>
        </KeyboardAvoidingView>

        <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>
          <Btn kind="quiet" style={{ flex: 1 }} onClick={onClose}>
            Cancel
          </Btn>
          <Btn style={{ flex: 1 }} disabled={!found || !scopes.length || saving} onClick={submit}>
            {saving ? 'Saving…' : editing ? 'Save' : 'Send invite'}
          </Btn>
        </View>
      </LinearGradient>
    </Modal>
  );
}

export const initials = name =>
  (name || '')
    .trim()
    .split(/\s+/)
    .map(x => x[0])
    .slice(0, 2)
    .join('')
    .toUpperCase() || '—';

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: C.hair },
  h2: { fontFamily: SANS.bold, fontSize: 19, letterSpacing: -0.6, color: C.ink },
  closeBtn: { width: 36, height: 36, borderRadius: 999, borderWidth: 1, borderColor: C.hair, backgroundColor: C.card, alignItems: 'center', justifyContent: 'center' },
  userRow: { flexDirection: 'row', alignItems: 'center', gap: 4, borderBottomWidth: 2, borderBottomColor: C.hair, marginTop: 8 },
  at: { fontFamily: SANS.semibold, fontSize: 20, color: C.ink3 },
  userInput: { flex: 1, paddingVertical: 8, fontFamily: SANS.semibold, fontSize: 20, color: C.ink },
  foundRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 14, padding: 12, borderRadius: 14, backgroundColor: C.panelSoft },
  avatar: { width: 40, height: 40, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  avatarLabel: { fontFamily: SANS.bold, fontSize: 15, color: '#FFFFFF' },
  foundName: { fontFamily: SANS.semibold, fontSize: 16, color: C.ink },
  check: { fontFamily: SANS.bold, fontSize: 18, color: C.brand2 },
  hintText: { fontFamily: SANS.regular, fontSize: 14.5, color: C.ink2, lineHeight: 21, marginTop: 8 },
  errorText: { fontFamily: SANS.regular, fontSize: 14, color: C.stage2, marginTop: 10 },
  scopeRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 13, borderRadius: 14, borderWidth: 1, borderColor: C.hair, marginBottom: 6, backgroundColor: 'rgba(22,36,28,0.03)' },
  scopeRowOn: { borderColor: C.brand, backgroundColor: C.panelSoft },
  box: { width: 22, height: 22, borderRadius: 7, borderWidth: 2, borderColor: C.ink3, alignItems: 'center', justifyContent: 'center' },
  boxOn: { borderColor: C.brand2, backgroundColor: C.brand2 },
  boxTick: { fontFamily: SANS.bold, fontSize: 13, color: '#FFFFFF', lineHeight: 15 },
  scopeLabel: { fontFamily: SANS.semibold, fontSize: 15.5, color: C.ink },
  scopeHint: { fontFamily: SANS.regular, fontSize: 13.5, color: C.ink2, marginTop: 2 },
  footer: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingTop: 12, borderTopWidth: 1, borderTopColor: C.hair },
});
