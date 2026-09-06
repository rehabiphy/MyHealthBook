import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { C } from '../theme/colors';
import { SANS } from '../theme/typography';
import { GRAD } from '../theme/gradients';
import { useAuth } from '../state/AuthContext';
import { useGo } from '../navigation/useGo';
import { useTabBarClearance } from '../navigation/TabBar';
import Head from '../components/atoms/Head';
import Card from '../components/atoms/Card';
import Btn from '../components/atoms/Btn';
import Mono from '../components/atoms/Mono';
import GradientText from '../components/atoms/GradientText';
import { G } from '../components/icons/ScreenGlyphs';

const FEATURES = ['Unlimited AI Health Insights', 'Understand trends in your BP, sugar & weight', 'More premium features coming soon'];

function PlanCard({ label, price, sub, hero, onPress }) {
  return (
    <Card style={[styles.planCard, hero && styles.planCardHero]} onPress={onPress}>
      {hero && (
        <View style={styles.heroBadge}>
          <Text style={styles.heroBadgeLabel}>BEST VALUE</Text>
        </View>
      )}
      <Mono>{label}</Mono>
      <Text style={styles.planPrice}>{price}</Text>
      <Text style={styles.planSub}>{sub}</Text>
      <Btn style={{ marginTop: 16 }} onClick={onPress}>
        Choose {label}
      </Btn>
    </Card>
  );
}

export default function PricingScreen() {
  const { user } = useAuth();
  const go = useGo();
  const bottomPad = useTabBarClearance();

  const isPremium = user?.subscription === 'premium' && user?.premiumExpiry && new Date(user.premiumExpiry).getTime() > Date.now();

  return (
    <ScrollView contentContainerStyle={[styles.container, { paddingBottom: bottomPad }]}>
      <Head title="Premium" caption="Health intelligence, not more storage" icon={G.premium(C.brand)} tint={C.brand} />

      {isPremium ? (
        <Card style={{ padding: 20 }}>
          <GradientText gradient={GRAD} style={styles.activeTitle}>
            Premium active
          </GradientText>
          <Text style={styles.activeSub}>
            Renews or expires on {new Date(user.premiumExpiry).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' })}.
          </Text>
        </Card>
      ) : (
        <>
          <View style={{ gap: 12 }}>
            <PlanCard label="Annual" price="₹1,999/year" sub="≈ ₹166.5/month" hero onPress={() => go('premiumCheckout', { plan: 'premium_annual' })} />
            <PlanCard label="Monthly" price="₹199/month" sub="Cancel anytime" onPress={() => go('premiumCheckout', { plan: 'premium_monthly' })} />
          </View>

          <View style={styles.sectionPad}>
            <Mono>Everything in Free, plus</Mono>
          </View>
          <Card style={{ padding: 20 }}>
            {FEATURES.map(f => (
              <View key={f} style={styles.featureRow}>
                <View style={styles.dot} />
                <Text style={styles.featureText}>{f}</Text>
              </View>
            ))}
          </Card>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, paddingTop: 20 },
  planCard: { padding: 20 },
  planCardHero: { borderColor: C.brand, borderWidth: 1.5 },
  heroBadge: { position: 'absolute', top: 16, right: 16, backgroundColor: C.brand, borderRadius: 999, paddingVertical: 4, paddingHorizontal: 10 },
  heroBadgeLabel: { fontFamily: SANS.semibold, fontSize: 11, letterSpacing: 0.6, color: '#FFFFFF' },
  planPrice: { fontFamily: SANS.bold, fontSize: 28, letterSpacing: -1, color: C.ink, marginTop: 8 },
  planSub: { fontFamily: SANS.regular, fontSize: 14.5, color: C.ink2, marginTop: 3 },
  sectionPad: { paddingTop: 22, paddingHorizontal: 4, paddingBottom: 10 },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 },
  dot: { width: 6, height: 6, borderRadius: 99, backgroundColor: C.brand },
  featureText: { fontFamily: SANS.regular, fontSize: 15, color: C.ink },
  activeTitle: { fontFamily: SANS.bold, fontSize: 20, letterSpacing: -0.6 },
  activeSub: { fontFamily: SANS.regular, fontSize: 15, color: C.ink2, marginTop: 8, lineHeight: 21 },
});
