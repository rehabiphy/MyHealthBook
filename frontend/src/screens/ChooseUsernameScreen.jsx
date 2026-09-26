import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { C } from '../theme/colors';
import { SANS } from '../theme/typography';
import { GRAD } from '../theme/gradients';
import { useAuth } from '../state/AuthContext';
import * as authApi from '../lib/authApi';
import { useUsernameCheck } from '../hooks/useUsernameCheck';
import AmbientBackground from '../components/AmbientBackground';
import Card from '../components/atoms/Card';
import Btn from '../components/atoms/Btn';
import Input from '../components/atoms/Input';
import UsernameStatus from '../components/atoms/UsernameStatus';
import GradientText from '../components/atoms/GradientText';
import Press from '../components/atoms/Press';

/* Shown once, before the app, to anyone signed in without a username —
   accounts from before usernames existed and new Google sign-ups (which
   skip the registration form). Family invites are sent by username, so
   everyone needs one. */
export default function ChooseUsernameScreen() {
  const { user, token, updateUser, signOut } = useAuth();
  const insets = useSafeAreaInsets();
  const [input, setInput] = useState('');
  const uname = useUsernameCheck(input);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const save = async () => {
    if (!uname.ok || saving) return;
    setError('');
    setSaving(true);
    try {
      const res = await authApi.setUsername(uname.username, token);
      updateUser(res.user);
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  };

  return (
    <View style={styles.root}>
      <AmbientBackground />
      <ScrollView contentContainerStyle={[styles.container, { paddingTop: insets.top + 40, paddingBottom: insets.bottom + 20 }]} keyboardShouldPersistTaps="handled">
        <View style={styles.headerWrap}>
          <GradientText gradient={GRAD} style={styles.heading}>
            {'Choose a username'}
          </GradientText>
          <Text style={styles.subheading}>
            {user?.name ? `Hi ${user.name.split(' ')[0]}. ` : ''}Family members use your username to invite you and share their health record with you.
          </Text>
        </View>

        <Card style={{ padding: 20 }}>
          <Input
            label="Username"
            value={input}
            onChangeText={t => setInput(t.replace(/\s/g, '').toLowerCase())}
            autoCapitalize="none"
            autoCorrect={false}
            placeholder="jane.doe"
            error={uname.error || error}
            hint={uname.hint}
            right={<UsernameStatus uname={uname} />}
          />
          <Btn onPress={save} disabled={!uname.ok || saving} style={{ marginTop: 4 }}>
            {saving ? 'Saving…' : 'Continue'}
          </Btn>
        </Card>

        <Press style={styles.bottomLinkWrap} onPress={signOut}>
          <Text style={styles.bottomLinkText}>
            Not you? <Text style={styles.bottomLinkStrong}>Log out</Text>
          </Text>
        </Press>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.paper },
  container: { flexGrow: 1, padding: 20 },
  headerWrap: { marginBottom: 24 },
  heading: { fontFamily: SANS.bold, fontSize: 30, letterSpacing: -1, lineHeight: 35 },
  subheading: { fontFamily: SANS.regular, fontSize: 15, color: C.ink2, marginTop: 8, lineHeight: 22 },
  bottomLinkWrap: { alignItems: 'center', marginTop: 24 },
  bottomLinkText: { fontFamily: SANS.regular, fontSize: 14.5, color: C.ink2 },
  bottomLinkStrong: { fontFamily: SANS.semibold, color: C.brand },
});
