import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { C } from '../theme/colors';
import { SANS } from '../theme/typography';
import { useAuth } from '../state/AuthContext';
import { useSubscription } from '../state/SubscriptionContext';
import { useAsk } from '../state/AskDialogContext';
import { useGo } from '../navigation/useGo';
import * as subscriptionApi from '../lib/subscriptionApi';
import Screen from '../components/layout/Screen';
import Card from '../components/atoms/Card';
import Btn from '../components/atoms/Btn';
import Mono from '../components/atoms/Mono';

const fmtDate = d => (d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }) : '—');
const addDays = (d, n) => new Date(new Date(d).getTime() + n * 864e5);

const STATUS_LABEL = {
  FREE: 'Free',
  ACTIVE: 'Active',
  CANCELLED: 'Cancelled',
  GRACE_PERIOD: 'Ended — grace period',
  PAYMENT_FAILED: 'Payment issue',
  EXPIRED: 'Ended',
};

/* What the account's plan is, and what happens next — in plain words.
   Every state keeps the same promise: the health record itself is
   never touched by anything on this screen. */
function statusMessage(sub, source) {
  const end = fmtDate(sub.expiryDate);
  const family = sub.plan?.startsWith('FAMILY');
  switch (sub.status) {
    case 'ACTIVE':
      return `Your plan is paid until ${end}. It doesn't renew automatically — we'll remind you once, a few days before.`;
    case 'CANCELLED':
      return `Your subscription is cancelled but remains active until ${end}.`;
    case 'GRACE_PERIOD':
      return `Your plan ended on ${end}. Its features stay on until ${fmtDate(addDays(sub.expiryDate, sub.graceDays || 3))} — renew before then to continue using ${
        family ? 'Family' : 'Plus'
      } features.`;
    case 'EXPIRED':
      return family
        ? 'Your Family plan has ended. Your family health information is secure and has not been deleted. Upgrade again anytime to restore Family features.'
        : 'Your subscription has ended. Your account has been moved to the Free plan. Nothing in your health record was deleted.';
    default:
      return source === 'family'
        ? "You're included in a family member's Family plan, so Plus features are on for you."
        : 'You are on the Free plan. Upgrade to access advanced health management features.';
  }
}

export default function SubscriptionScreen() {
  const { token } = useAuth();
  const { subscription: sub, source, tier, apply } = useSubscription();
  const ask = useAsk();
  const go = useGo();
  const [busy, setBusy] = useState('');
  const [note, setNote] = useState('');

  const run = async (key, fn, done) => {
    setBusy(key);
    setNote('');
    try {
      const res = await fn(token);
      apply(res);
      if (done) setNote(done(res));
    } catch (err) {
      setNote(err.message);
    } finally {
      setBusy('');
    }
  };

  const cancel = async () => {
    const ok = await ask({
      title: 'Cancel your plan?',
      body: `Plus features stay on until ${fmtDate(sub.expiryDate)}, then your account moves to Free. Nothing in your health record is deleted. You can resume anytime before then.`,
      confirmLabel: 'Cancel plan',
      cancelLabel: 'Keep plan',
      danger: true,
    });
    if (ok) run('cancel', subscriptionApi.cancelSubscription);
  };

  const restore = () =>
    run('restore', subscriptionApi.restorePurchases, res =>
      res.recovered
        ? 'We found a payment that hadn’t been applied and added it to your plan.'
        : res.subscription.status === 'ACTIVE' || res.subscription.status === 'CANCELLED'
        ? 'Your plan is up to date on this device.'
        : 'No purchases found for this account.',
    );

  const paid = sub.plan && sub.plan !== 'FREE';
  const showDates = paid && sub.status !== 'EXPIRED';

  return (
    <Screen title="Subscription" subtitle="Your plan and billing" back>
      <Card style={{ padding: 20 }}>
        <Mono>Current plan</Mono>
        <Text style={styles.planName}>{sub.status === 'EXPIRED' || !paid ? (source === 'family' ? 'Plus (via Family)' : 'Free') : sub.label}</Text>
        {paid && sub.status !== 'EXPIRED' ? (
          <Text style={styles.planPrice}>
            ₹{sub.amount}/{sub.billingPeriod === 'annual' ? 'year' : 'month'}
          </Text>
        ) : null}

        <View style={styles.metaRow}>
          <Text style={styles.metaLabel}>Status</Text>
          <Text style={[styles.metaValue, sub.status === 'GRACE_PERIOD' && { color: C.elevated }]}>{STATUS_LABEL[sub.status] || sub.status}</Text>
        </View>
        {showDates && (
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>{sub.status === 'ACTIVE' ? 'Renewal due' : 'Active until'}</Text>
            <Text style={styles.metaValue}>{fmtDate(sub.expiryDate)}</Text>
          </View>
        )}
        {showDates && sub.purchaseDate && (
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Last payment</Text>
            <Text style={styles.metaValue}>{fmtDate(sub.purchaseDate)}</Text>
          </View>
        )}

        <Text style={styles.message}>{statusMessage(sub, source)}</Text>
      </Card>

      <View style={{ gap: 8, marginTop: 12 }}>
        {sub.status === 'GRACE_PERIOD' || sub.status === 'EXPIRED' || !paid ? (
          <Btn onClick={() => go('premium')}>{paid ? 'Renew' : 'See plans'}</Btn>
        ) : (
          <Btn onClick={() => go('premium')}>Change plan or renew early</Btn>
        )}
        {sub.status === 'ACTIVE' && (
          <Btn kind="quiet" textStyle={{ color: C.stage2 }} disabled={!!busy} onClick={cancel}>
            {busy === 'cancel' ? 'Cancelling…' : 'Cancel subscription'}
          </Btn>
        )}
        {sub.status === 'CANCELLED' && (
          <Btn kind="quiet" disabled={!!busy} onClick={() => run('resume', subscriptionApi.resumeSubscription)}>
            {busy === 'resume' ? 'Resuming…' : 'Resume subscription'}
          </Btn>
        )}
        <Btn kind="quiet" disabled={!!busy} onClick={restore}>
          {busy === 'restore' ? 'Checking…' : 'Restore purchases'}
        </Btn>
      </View>

      {note ? <Text style={styles.note}>{note}</Text> : null}

      <Card style={{ marginTop: 14, padding: 18 }}>
        <Mono>Your data is yours</Mono>
        <Text style={styles.message}>
          Whatever your plan, your medical history, medicines, readings, reports and family connections are kept. Medicine reminders keep working on every plan. If a plan ends, only the advanced
          features pause — nothing is deleted.
        </Text>
        {tier === 'free' ? null : <Text style={[styles.message, { marginTop: 8 }]}>Your plan is tied to your account, so signing in on a new phone brings it with you.</Text>}
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, paddingTop: 20 },
  planName: { fontFamily: SANS.bold, fontSize: 24, letterSpacing: -0.8, color: C.ink, marginTop: 8 },
  planPrice: { fontFamily: SANS.regular, fontSize: 15.5, color: C.ink2, marginTop: 2 },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.hair, marginTop: 6 },
  metaLabel: { fontFamily: SANS.regular, fontSize: 14.5, color: C.ink3 },
  metaValue: { fontFamily: SANS.semibold, fontSize: 14.5, color: C.ink },
  message: { fontFamily: SANS.regular, fontSize: 14.5, color: C.ink2, lineHeight: 21, marginTop: 12 },
  note: { fontFamily: SANS.regular, fontSize: 14, color: C.ink2, textAlign: 'center', marginTop: 12, lineHeight: 20 },
});
