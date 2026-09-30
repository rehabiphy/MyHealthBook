import React, { useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { C } from '../theme/colors';
import { SANS } from '../theme/typography';
import { useAuth } from '../state/AuthContext';
import { useSubscription, FEATURES } from '../state/SubscriptionContext';
import { useGo } from '../navigation/useGo';
import * as insightsApi from '../lib/insightsApi';
import Screen from '../components/layout/Screen';
import Card from '../components/atoms/Card';
import Btn from '../components/atoms/Btn';
import Mono from '../components/atoms/Mono';

export default function InsightsScreen() {
  const { user, token } = useAuth();
  const { can, limit } = useSubscription();
  const go = useGo();
  const [busy, setBusy] = useState(false);
  const [insights, setInsights] = useState('');
  const [quotaExceeded, setQuotaExceeded] = useState(false);
  const [error, setError] = useState('');

  const unlimited = can(FEATURES.UNLIMITED_INSIGHTS) || limit('insightsPerMonth') === null;
  const monthlyLimit = limit('insightsPerMonth');
  // the server's count after each run, else the one from sign-in
  const [usedNow, setUsedNow] = useState(null);
  const used = usedNow ?? (user?.insightsUsedThisMonth || 0);

  const generate = async () => {
    setBusy(true);
    setError('');
    setQuotaExceeded(false);
    try {
      const res = await insightsApi.generateInsights(token);
      setInsights(res.insights);
      if (res.usage?.used != null) setUsedNow(res.usage.used);
    } catch (err) {
      if (err.quotaExceeded) setQuotaExceeded(true);
      else setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen title="AI health insights" subtitle="Your recorded trends, explained in plain words" back>
      <Card style={{ padding: 16 }}>
        <Mono>{unlimited ? 'Unlimited · included in your plan' : `${used} of ${monthlyLimit} free this month`}</Mono>
      </Card>

      <Btn style={{ marginTop: 12 }} disabled={busy} onClick={generate}>
        {busy ? 'Analyzing…' : 'Generate my insights'}
      </Btn>

      {quotaExceeded && (
        <Card overlayColor="rgba(34,197,94,0.12)" style={{ marginTop: 12, padding: 18 }}>
          <Text style={styles.upgradeTitle}>You've used your {monthlyLimit} free insights this month</Text>
          <Text style={styles.upgradeSub}>MyHealthBook Plus includes unlimited AI Health Insights. Your readings and history stay available either way.</Text>
          <Btn style={{ marginTop: 14 }} onClick={() => go('premium')}>
            See plans
          </Btn>
        </Card>
      )}

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      {insights ? (
        <Card style={{ marginTop: 12, padding: 18 }}>
          <Text style={styles.insightsText}>{insights}</Text>
        </Card>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, paddingTop: 20 },
  upgradeTitle: { fontFamily: SANS.semibold, fontSize: 16, letterSpacing: -0.3, color: C.ink },
  upgradeSub: { fontFamily: SANS.regular, fontSize: 14.5, color: C.ink2, marginTop: 5, lineHeight: 21 },
  errorText: { fontFamily: SANS.regular, fontSize: 14.5, color: C.stage2, marginTop: 12, textAlign: 'center' },
  insightsText: { fontFamily: SANS.regular, fontSize: 15, lineHeight: 23, color: C.ink2 },
});
