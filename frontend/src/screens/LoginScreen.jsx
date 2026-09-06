import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { C } from '../theme/colors';
import { SANS } from '../theme/typography';
import { GRAD } from '../theme/gradients';
import { useAuth } from '../state/AuthContext';
import * as authApi from '../lib/authApi';
import { signInWithGoogle, isSignInCancelled } from '../lib/googleAuth';
import AmbientBackground from '../components/AmbientBackground';
import Card from '../components/atoms/Card';
import Btn from '../components/atoms/Btn';
import GoogleButton from '../components/atoms/GoogleButton';
import Input from '../components/atoms/Input';
import GradientText from '../components/atoms/GradientText';
import Press from '../components/atoms/Press';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function LoginScreen({ navigation }) {
  const auth = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState('');

  const canSubmit = EMAIL_RE.test(email.trim()) && password.length > 0 && !loading;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setError('');
    setLoading(true);
    try {
      const res = await authApi.login({ email: email.trim(), password });
      auth.signIn(res.token, res.user);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError('');
    setGoogleLoading(true);
    try {
      const idToken = await signInWithGoogle();
      const res = await authApi.googleSignIn({ idToken });
      auth.signIn(res.token, res.user);
    } catch (err) {
      if (!isSignInCancelled(err)) setError(err.message);
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <View style={styles.root}>
      <AmbientBackground />
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <View style={styles.headerWrap}>
          <GradientText gradient={GRAD} style={styles.heading}>
            {'Welcome back'}
          </GradientText>
          <Text style={styles.subheading}>Sign in to continue tracking your health.</Text>
        </View>

        <Card style={{ padding: 20 }}>
          <Input label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" placeholder="you@example.com" />
          <Input label="Password" value={password} onChangeText={setPassword} secureTextEntry placeholder="••••••••" />

          <Press style={styles.forgotWrap} onPress={() => navigation.navigate('ForgotPassword')}>
            <Text style={styles.forgotText}>Forgot Password?</Text>
          </Press>

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <Btn kind="solid" onPress={handleSubmit} disabled={!canSubmit} style={{ marginTop: 4 }}>
            {loading ? 'Logging in…' : 'Log In'}
          </Btn>

          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>or</Text>
            <View style={styles.dividerLine} />
          </View>

          <GoogleButton onPress={handleGoogleSignIn} loading={googleLoading} disabled={loading} />
        </Card>

        <Press style={styles.bottomLinkWrap} onPress={() => navigation.navigate('Register')}>
          <Text style={styles.bottomLinkText}>
            Don't have an account? <Text style={styles.bottomLinkStrong}>Sign Up</Text>
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
  forgotWrap: { alignSelf: 'flex-end', marginTop: -4, marginBottom: 18 },
  forgotText: { fontFamily: SANS.medium, fontSize: 14, color: C.brand },
  errorText: { fontFamily: SANS.regular, fontSize: 13.5, color: C.stage2, marginBottom: 14 },
  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: 16 },
  dividerLine: { flex: 1, height: 1, backgroundColor: C.hair },
  dividerText: { fontFamily: SANS.medium, fontSize: 13, color: C.ink3 },
  bottomLinkWrap: { alignItems: 'center', marginTop: 24 },
  bottomLinkText: { fontFamily: SANS.regular, fontSize: 14.5, color: C.ink2 },
  bottomLinkStrong: { fontFamily: SANS.semibold, color: C.brand },
});
