import React, { useCallback } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { C } from '../theme/colors';
import { SANS } from '../theme/typography';
import { useAuth } from '../state/AuthContext';
import { useSubscription } from '../state/SubscriptionContext';
import { useGo } from '../navigation/useGo';
import * as subscriptionApi from '../lib/subscriptionApi';
import Screen from '../components/layout/Screen';
import Card from '../components/atoms/Card';
import Btn from '../components/atoms/Btn';
import Mono from '../components/atoms/Mono';

/* Plain, calm copy on purpose — no countdowns, no "don't miss out".
   Prices shown come from the server's plan catalog when it has loaded,
   so the screen can never advertise a price checkout won't charge. */
const PLAN_CARDS = [
  { id: 'PLUS_MONTHLY', title: 'MyHealthBook Plus', fallback: 49, per: 'month', sub: 'Advanced personal health management', cta: 'Start Plus' },
  {
    id: 'PLUS_ANNUAL',
    title: 'Plus Annual',
    fallback: 399,
    per: 'year',
    sub: 'Best-value individual plan',
    note: 'About ₹33.25/month — better value than paying monthly',
    cta: 'Choose Annual',
    hero: true,
  },
  { id: 'FAMILY_MONTHLY', title: 'Family', fallback: 79, per: 'month', sub: 'Up to 6 family members', cta: 'Choose Family' },
  { id: 'FAMILY_ANNUAL', title: 'Family Annual', fallback: 699, per: 'year', sub: 'Up to 6 family members', note: 'About ₹58.25/month for the whole family', cta: 'Choose Family Annual' },
];

const COMPARE = [
  ['Medical history, medicines & reminders', true, true, true],
  ['Readings & basic Health Summary', true, true, true],
  ['Report documents', '10', 'More storage', 'More storage'],
  ['Trends & charts', '30 days', 'Full history', 'Full history'],
  ['AI Health Insights', '3 a month', 'Unlimited', 'Unlimited'],
  ['Advanced Health Summary & reports', false, true, true],
  ['Share your record with family', 'Up to 2', 'Up to 2', 'Up to 6'],
];

const rupees = n => `₹${Number(n).toLocaleString('en-IN')}`;

function PlanCard({ title, price, per, sub, note, cta, hero, current, onPress }) {
  return (
    <Card style={[styles.planCard, hero && styles.planCardHero]}>
      {(hero || current) && (
        <View style={[styles.badge, current && styles.badgeCurrent]}>
          <Text style={[styles.badgeLabel, current && styles.badgeLabelCurrent]}>{current ? 'CURRENT PLAN' : 'BEST VALUE'}</Text>
        </View>
      )}
      <Mono>{title}</Mono>
      <Text style={styles.planPrice}>
        {price}
        {per ? <Text style={styles.planPer}>/{per}</Text> : null}
      </Text>
      <Text style={styles.planSub}>{sub}</Text>
      {note ? <Text style={styles.planNote}>{note}</Text> : null}
      <Btn style={{ marginTop: 16 }} kind={current ? 'quiet' : 'solid'} onClick={onPress}>
        {current ? 'Renew or extend' : cta}
      </Btn>
    </Card>
  );
}

function Cell({ v }) {
  if (v === true) return <Text style={[styles.cell, { color: C.normal }]}>✓</Text>;
  if (v === false) return <Text style={[styles.cell, { color: C.ink3 }]}>—</Text>;
  return <Text style={styles.cell}>{v}</Text>;
}

export default function PricingScreen() {
  const { token } = useAuth();
  const { plans, subscription } = useSubscription();
  const go = useGo();

  useFocusEffect(
    useCallback(() => {
      subscriptionApi.trackEvent('subscription_screen_viewed', null, token);
    }, [token]),
  );

  const priceOf = card => rupees(plans.find(p => p.id === card.id)?.amount ?? card.fallback);
  const entitled = ['ACTIVE', 'CANCELLED', 'GRACE_PERIOD'].includes(subscription.status);

  const choose = plan => {
    subscriptionApi.trackEvent('plan_selected', plan, token);
    go('premiumCheckout', { plan, startedAt: Date.now() });
  };

  return (
    <Screen title="Choose the plan that works for you" subtitle="Simple, affordable health management for you and your family." back>
      <Card style={styles.reassure}>
        <Text style={styles.reassureText}>Your existing health information remains available even if you don't subscribe.</Text>
      </Card>

      {entitled && (
        <Btn kind="quiet" style={{ marginTop: 10 }} onClick={() => go('subscription')}>
          Manage your {subscription.label} plan
        </Btn>
      )}

      <View style={{ gap: 12, marginTop: 12 }}>
        <PlanCard title="Free" price="₹0" sub="Basic Health Book" cta="Continue with Free" current={!entitled} onPress={() => go('home')} />
        {PLAN_CARDS.map(card => (
          <PlanCard key={card.id} {...card} price={priceOf(card)} current={entitled && subscription.plan === card.id} onPress={() => choose(card.id)} />
        ))}
      </View>

      <Text style={styles.fineprint}>
        Plans are paid in advance for a month or a year and don't renew automatically — we'll remind you once, a few days before yours ends. Switching plans carries over the unused value of your
        current one. Monthly and annual versions of a plan include exactly the same features.
      </Text>

      <View style={styles.sectionPad}>
        <Mono>Compare plans</Mono>
      </View>
      <Card style={{ padding: 16 }}>
        <View style={styles.compareRow}>
          <Text style={[styles.compareLabel, styles.compareHead]} />
          {['Free', 'Plus', 'Family'].map(h => (
            <Text key={h} style={[styles.cell, styles.compareHead]}>
              {h}
            </Text>
          ))}
        </View>
        {COMPARE.map(([label, ...vals]) => (
          <View key={label} style={styles.compareRow}>
            <Text style={styles.compareLabel}>{label}</Text>
            {vals.map((v, i) => (
              <Cell key={i} v={v} />
            ))}
          </View>
        ))}
      </Card>

      <Text style={styles.fineprint}>
        On the Family plan, each person you add sees only the parts of your record you choose to share with them — nothing is shared automatically. MyHealthBook shows no advertising.
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, paddingTop: 20 },
  reassure: { padding: 16 },
  reassureText: { fontFamily: SANS.regular, fontSize: 14.5, color: C.ink2, lineHeight: 20 },
  planCard: { padding: 20 },
  planCardHero: { borderColor: C.brand, borderWidth: 1.5 },
  badge: { position: 'absolute', top: 16, right: 16, backgroundColor: C.brand, borderRadius: 999, paddingVertical: 4, paddingHorizontal: 10 },
  badgeCurrent: { backgroundColor: C.panelSoft },
  badgeLabel: { fontFamily: SANS.semibold, fontSize: 11, letterSpacing: 0.6, color: '#FFFFFF' },
  badgeLabelCurrent: { color: C.normal },
  planPrice: { fontFamily: SANS.bold, fontSize: 28, letterSpacing: -1, color: C.ink, marginTop: 8 },
  planPer: { fontFamily: SANS.regular, fontSize: 16, letterSpacing: 0, color: C.ink2 },
  planSub: { fontFamily: SANS.regular, fontSize: 14.5, color: C.ink2, marginTop: 3 },
  planNote: { fontFamily: SANS.regular, fontSize: 13.5, color: C.normal, marginTop: 6 },
  fineprint: { fontFamily: SANS.regular, fontSize: 13, color: C.ink3, lineHeight: 19, marginTop: 14, paddingHorizontal: 4 },
  sectionPad: { paddingTop: 22, paddingHorizontal: 4, paddingBottom: 10 },
  compareRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.hair },
  compareHead: { fontFamily: SANS.semibold, color: C.ink },
  compareLabel: { flex: 2, fontFamily: SANS.regular, fontSize: 13.5, color: C.ink, paddingRight: 6 },
  cell: { flex: 1, fontFamily: SANS.regular, fontSize: 12.5, color: C.ink2, textAlign: 'center' },
});
