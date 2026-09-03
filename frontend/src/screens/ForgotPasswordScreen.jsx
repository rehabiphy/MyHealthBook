import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { C } from '../theme/colors';
import { SANS } from '../theme/typography';
import { GRAD } from '../theme/gradients';
import * as authApi from '../lib/authApi';
import AmbientBackground from '../components/AmbientBackground';
import Card from '../components/atoms/Card';
import Btn from '../components/atoms/Btn';
import Input from '../components/atoms/Input';
import GradientText from '../components/atoms/GradientText';
import Press from '../components/atoms/Press';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const STEP_COPY = {
  email: { heading: 'Reset password', subheading: 'Enter your email and we’ll send you a code.' },
  otp: { heading: 'Check your email', subheading: 'Enter the 6-digit code we sent you.' },
  password: { heading: 'New password', subheading: 'Choose a new password for your account.' },
};

export default function ForgotPasswordScreen({ navigation }) {
  const [step, setStep] = useState('email'); // email | otp | password
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const emailValid = EMAIL_RE.test(email.trim());
  const otpValid = otp.trim().length === 6;
  const passwordValid = password.length >= 6 && password === confirmPassword;

  const handleSendCode = async () => {
    if (!emailValid || loading) return;
    setError('');
    setLoading(true);
    try {
      await authApi.forgotPasswordSendOtp({ email: email.trim() });
      setStep('otp');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCode = async () => {
    if (!otpValid || loading) return;
    setError('');
    setLoading(true);
    try {
      await authApi.forgotPasswordVerifyOtp({ email: email.trim(), otp: otp.trim() });
      setStep('password');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async () => {
    if (!passwordValid || loading) return;
    setError('');
    setLoading(true);
    try {
      await authApi.forgotPasswordReset({ email: email.trim(), password });
      navigation.navigate('Login');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const copy = STEP_COPY[step];

  return (
    <View style={styles.root}>
      <AmbientBackground />
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <View style={styles.headerWrap}>
          <GradientText gradient={GRAD} style={styles.heading}>
            {copy.heading}
          </GradientText>
          <Text style={styles.subheading}>{copy.subheading}</Text>
        </View>

        <Card style={{ padding: 20 }}>
          {step === 'email' && (
            <>
              <Input label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" placeholder="you@example.com" />
              {error ? <Text style={styles.errorText}>{error}</Text> : null}
              <Btn kind="solid" onPress={handleSendCode} disabled={!emailValid || loading} style={{ marginTop: 4 }}>
                {loading ? 'Sending…' : 'Send Code'}
              </Btn>
            </>
          )}

          {step === 'otp' && (
            <>
              <Input value={otp} onChangeText={t => setOtp(t.replace(/\D/g, '').slice(0, 6))} keyboardType="number-pad" placeholder="123456" />
              {error ? <Text style={styles.errorText}>{error}</Text> : null}
              <Btn kind="solid" onPress={handleVerifyCode} disabled={!otpValid || loading} style={{ marginTop: 4 }}>
                {loading ? 'Checking…' : 'Verify Code'}
              </Btn>
              <Press onPress={handleSendCode} disabled={loading} style={{ alignItems: 'center', marginTop: 14 }}>
                <Text style={styles.resendText}>{loading ? 'Sending…' : 'Resend code'}</Text>
              </Press>
            </>
          )}

          {step === 'password' && (
            <>
              <Input label="New Password" value={password} onChangeText={setPassword} secureTextEntry placeholder="••••••••" />
              <Input
                label="Confirm Password"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry
                placeholder="••••••••"
                error={confirmPassword.length > 0 && confirmPassword !== password ? "Passwords don't match" : ''}
              />
              {error ? <Text style={styles.errorText}>{error}</Text> : null}
              <Btn kind="solid" onPress={handleReset} disabled={!passwordValid || loading} style={{ marginTop: 4 }}>
                {loading ? 'Resetting…' : 'Reset Password'}
              </Btn>
            </>
          )}
        </Card>

        <Press style={styles.bottomLinkWrap} onPress={() => navigation.navigate('Login')}>
          <Text style={styles.bottomLinkText}>
            Remembered it? <Text style={styles.bottomLinkStrong}>Log In</Text>
          </Text>
        </Press>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.paper },
  container: { flexGrow: 1, padding: 20, justifyContent: 'center' },
  headerWrap: { marginBottom: 24 },
  heading: { fontFamily: SANS.bold, fontSize: 30, letterSpacing: -1, lineHeight: 35 },
  subheading: { fontFamily: SANS.regular, fontSize: 15, color: C.ink2, marginTop: 8 },
  errorText: { fontFamily: SANS.regular, fontSize: 13.5, color: C.stage2, marginTop: -6, marginBottom: 14 },
  resendText: { fontFamily: SANS.medium, fontSize: 14, color: C.brand },
  bottomLinkWrap: { alignItems: 'center', marginTop: 24 },
  bottomLinkText: { fontFamily: SANS.regular, fontSize: 14.5, color: C.ink2 },
  bottomLinkStrong: { fontFamily: SANS.semibold, color: C.brand },
});
