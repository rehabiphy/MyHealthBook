import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { C } from '../theme/colors';
import { SANS } from '../theme/typography';
import { GRAD } from '../theme/gradients';
import { useAuth } from '../state/AuthContext';
import * as authApi from '../lib/authApi';
import AmbientBackground from '../components/AmbientBackground';
import Card from '../components/atoms/Card';
import Btn from '../components/atoms/Btn';
import Input from '../components/atoms/Input';
import GradientText from '../components/atoms/GradientText';
import Press from '../components/atoms/Press';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/* Email verification (OTP-by-mail) is built and working (see
   authController.js's sendVerification/verifyEmail + authApi.js) but
   disabled for now — the deployed host doesn't reliably support
   outbound SMTP, so this screen registers directly instead of gating
   on a code. Re-enable by restoring the Send Code / verify step here
   once /send-verification + /verify-email are un-commented server-side. */
export default function RegisterScreen({ navigation }) {
  const auth = useAuth();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  const nameValid = name.trim().length > 1;
  const emailValid = EMAIL_RE.test(email.trim());
  const phoneValid = phone.trim().length >= 10;
  const passwordValid = password.length >= 6;
  const passwordsMatch = confirmPassword.length === 0 || confirmPassword === password;

  const canSubmit = nameValid && emailValid && phoneValid && passwordValid && confirmPassword === password && !submitting;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setFormError('');
    setSubmitting(true);
    try {
      const res = await authApi.register({ name: name.trim(), email: email.trim(), phone: phone.trim(), password });
      auth.signIn(res.token, res.user);
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.root}>
      <AmbientBackground />
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <View style={styles.headerWrap}>
          <GradientText gradient={GRAD} style={styles.heading}>
            {'Create account'}
          </GradientText>
          <Text style={styles.subheading}>Join MyHealthBook to track your health.</Text>
        </View>

        <Card style={{ padding: 20 }}>
          <Input label="Full Name" value={name} onChangeText={setName} placeholder="Jane Doe" />
          <Input label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" placeholder="you@example.com" />
          <Input label="Phone Number" value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholder="9876543210" />
          <Input label="Password" value={password} onChangeText={setPassword} secureTextEntry placeholder="••••••••" />
          <Input
            label="Confirm Password"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secureTextEntry
            placeholder="••••••••"
            error={!passwordsMatch ? "Passwords don't match" : ''}
          />

          {formError ? <Text style={styles.errorText}>{formError}</Text> : null}

          <Btn kind="solid" onPress={handleSubmit} disabled={!canSubmit} style={{ marginTop: 4 }}>
            {submitting ? 'Creating account…' : 'Create Account'}
          </Btn>
        </Card>

        <Press style={styles.bottomLinkWrap} onPress={() => navigation.navigate('Login')}>
          <Text style={styles.bottomLinkText}>
            Already have an account? <Text style={styles.bottomLinkStrong}>Log In</Text>
          </Text>
        </Press>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.paper },
  container: { flexGrow: 1, padding: 20, paddingTop: 40 },
  headerWrap: { marginBottom: 24 },
  heading: { fontFamily: SANS.bold, fontSize: 30, letterSpacing: -1, lineHeight: 35 },
  subheading: { fontFamily: SANS.regular, fontSize: 15, color: C.ink2, marginTop: 8 },
  errorText: { fontFamily: SANS.regular, fontSize: 13.5, color: C.stage2, marginBottom: 14 },
  bottomLinkWrap: { alignItems: 'center', marginTop: 24, marginBottom: 20 },
  bottomLinkText: { fontFamily: SANS.regular, fontSize: 14.5, color: C.ink2 },
  bottomLinkStrong: { fontFamily: SANS.semibold, color: C.brand },
});
