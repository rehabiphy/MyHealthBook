import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { C } from '../theme/colors';
import { SANS } from '../theme/typography';
import { useAuth } from '../state/AuthContext';
import { useGo } from '../navigation/useGo';
import { useTabBarClearance } from '../navigation/TabBar';
import * as insightsApi from '../lib/insightsApi';
import Head from '../components/atoms/Head';
import Card from '../components/atoms/Card';
import Btn from '../components/atoms/Btn';
import Mono from '../components/atoms/Mono';
import { G } from '../components/icons/ScreenGlyphs';

const FREE_LIMIT = 3;

export default function InsightsScreen() {
  const { user, token } = useAuth();
  const go = useGo();
  const bottomPad = useTabBarClearance();
  const [busy, setBusy] = useState(false);
  const [insights, setInsights] = useState('');
  const [quotaExceeded, setQuotaExceeded] = useState(false);
  const [error, setError] = useState('');

  const isPremium = user?.subscription === 'premium' && user?.premiumExpiry && new Date(user.premiumExpiry).getTime() > Date.now();
  const used = user?.insightsUsedThisMonth || 0;

  const generate = async () => {
    setBusy(true);
    setError('');
    setQuotaExceeded(false);
    try {
      const res = await insightsApi.generateInsights(token);
      setInsights(res.insights);
    } catch (err) {
      if (err.quotaExceeded) setQuotaExceeded(true);
      else setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={[styles.container, { paddingBottom: bottomPad }]}>
      <Head title="AI Health Insights" caption="Reads your BP, sugar & weight trends" icon={G.insights(C.brand)} tint={C.brand} />

      <Card style={{ padding: 16 }}>
        <Mono>{isPremium ? 'Unlimited · Premium' : `${used} of ${FREE_LIMIT} free this month`}</Mono>
      </Card>

      <Btn style={{ marginTop: 12 }} disabled={busy} onClick={generate}>
        {busy ? 'Analyzing…' : 'Generate my insights'}
      </Btn>

      {quotaExceeded && (
        <Card overlayColor="rgba(34,197,94,0.12)" style={{ marginTop: 12, padding: 18 }}>
          <Text style={styles.upgradeTitle}>You've used your {FREE_LIMIT} free insights this month</Text>
          <Text style={styles.upgradeSub}>Premium gives you unlimited AI Health Insights.</Text>
          <Btn style={{ marginTop: 14 }} onClick={() => go('premium')}>
            See Premium
          </Btn>
        </Card>
      )}

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      {insights ? (
        <Card style={{ marginTop: 12, padding: 18 }}>
          <Text style={styles.insightsText}>{insights}</Text>
        </Card>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, paddingTop: 20 },
  upgradeTitle: { fontFamily: SANS.semibold, fontSize: 16, letterSpacing: -0.3, color: C.ink },
  upgradeSub: { fontFamily: SANS.regular, fontSize: 14.5, color: C.ink2, marginTop: 5, lineHeight: 21 },
  errorText: { fontFamily: SANS.regular, fontSize: 14.5, color: C.stage2, marginTop: 12, textAlign: 'center' },
  insightsText: { fontFamily: SANS.regular, fontSize: 15, lineHeight: 23, color: C.ink2 },
});
