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

export default function RegisterScreen({ navigation }) {
  const auth = useAuth();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [otp, setOtp] = useState('');

  // 'idle' | 'sent' | 'verified'
  const [verificationState, setVerificationState] = useState('idle');
  const [sendingCode, setSendingCode] = useState(false);
  const [verifyingCode, setVerifyingCode] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  const nameValid = name.trim().length > 1;
  const emailValid = EMAIL_RE.test(email.trim());
  const phoneValid = phone.trim().length >= 10;
  const passwordValid = password.length >= 6;
  const passwordsMatch = confirmPassword.length === 0 || confirmPassword === password;

  const canSendCode = nameValid && emailValid && verificationState === 'idle' && !sendingCode;
  const canVerifyCode = otp.trim().length === 6 && !verifyingCode;

  const canSubmit =
    nameValid && emailValid && phoneValid && passwordValid && confirmPassword === password && verificationState === 'verified' && !submitting;

  const handleSendCode = async () => {
    if (!canSendCode) return;
    setFormError('');
    setSendingCode(true);
    try {
      await authApi.sendVerificationEmail({ name: name.trim(), email: email.trim() });
      setVerificationState('sent');
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSendingCode(false);
    }
  };

  const handleVerifyCode = async () => {
    if (!canVerifyCode) return;
    setFormError('');
    setVerifyingCode(true);
    try {
      await authApi.verifyEmail({ email: email.trim(), otp: otp.trim() });
      setVerificationState('verified');
    } catch (err) {
      setFormError(err.message);
    } finally {
      setVerifyingCode(false);
    }
  };

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
          <Input label="Full Name" value={name} onChangeText={setName} placeholder="Jane Doe" editable={verificationState === 'idle'} />

          <Input
            label="Email"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            placeholder="you@example.com"
            editable={verificationState === 'idle'}
          />
          {verificationState === 'idle' && (
            <Press style={styles.verifyBtnWrap} onPress={handleSendCode} disabled={!canSendCode}>
              <Text style={[styles.verifyBtnText, !canSendCode && styles.verifyBtnTextDisabled]}>{sendingCode ? 'Sending…' : 'Send Code'}</Text>
            </Press>
          )}

          {verificationState === 'sent' && (
            <Card overlayColor="rgba(34,197,94,0.12)" blurAmount={8} style={styles.statusCard}>
              <Text style={styles.statusTitle}>Check your email</Text>
              <Text style={styles.statusBody}>Enter the 6-digit code we sent to {email.trim()}.</Text>
              <View style={styles.otpRow}>
                <Input
                  value={otp}
                  onChangeText={t => setOtp(t.replace(/\D/g, '').slice(0, 6))}
                  keyboardType="number-pad"
                  placeholder="123456"
                  style={{ flex: 1 }}
                />
                <Press style={styles.otpVerifyBtn} onPress={handleVerifyCode} disabled={!canVerifyCode}>
                  <Text style={styles.otpVerifyLabel}>{verifyingCode ? 'Checking…' : 'Verify'}</Text>
                </Press>
              </View>
              <Press onPress={handleSendCode} disabled={sendingCode}>
                <Text style={styles.resendText}>{sendingCode ? 'Sending…' : 'Resend code'}</Text>
              </Press>
            </Card>
          )}

          {verificationState === 'verified' && (
            <Card overlayColor="rgba(34,197,94,0.12)" blurAmount={8} style={styles.statusCard}>
              <Text style={styles.statusVerified}>✓ Email has been successfully verified!</Text>
            </Card>
          )}

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
  verifyBtnWrap: { alignSelf: 'flex-end', marginTop: -10, marginBottom: 16 },
  verifyBtnText: { fontFamily: SANS.semibold, fontSize: 14, color: C.brand },
  verifyBtnTextDisabled: { color: C.ink3 },
  statusCard: { padding: 14, marginBottom: 16, marginTop: -2 },
  statusTitle: { fontFamily: SANS.semibold, fontSize: 14.5, color: C.ink },
  statusBody: { fontFamily: SANS.regular, fontSize: 13, color: C.ink2, marginTop: 3, lineHeight: 18 },
  statusVerified: { fontFamily: SANS.semibold, fontSize: 14.5, color: C.brand2 },
  otpRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12 },
  otpVerifyBtn: { backgroundColor: C.brand, borderRadius: 14, paddingVertical: 15, paddingHorizontal: 16 },
  otpVerifyLabel: { fontFamily: SANS.semibold, fontSize: 14, color: '#FFFFFF' },
  resendText: { fontFamily: SANS.medium, fontSize: 13, color: C.brand, marginTop: 10 },
  errorText: { fontFamily: SANS.regular, fontSize: 13.5, color: C.stage2, marginBottom: 14 },
  bottomLinkWrap: { alignItems: 'center', marginTop: 24, marginBottom: 20 },
  bottomLinkText: { fontFamily: SANS.regular, fontSize: 14.5, color: C.ink2 },
  bottomLinkStrong: { fontFamily: SANS.semibold, color: C.brand },
});
