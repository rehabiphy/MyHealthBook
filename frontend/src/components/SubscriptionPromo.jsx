import React from 'react';
import { Modal, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import Svg, { Path } from 'react-native-svg';
import { C } from '../theme/colors';
import { GRAD } from '../theme/gradients';
import { SANS } from '../theme/typography';
import { useSubscription } from '../state/SubscriptionContext';
import Btn from './atoms/Btn';
import Press from './atoms/Press';
import { G } from './icons/ScreenGlyphs';

const BENEFITS = [
  ['Trends over any period', 'See how your readings have moved over months, not just 30 days.'],
  ['Doctor-ready Health Summary', 'One PDF with your history, medicines, tests and readings.'],
  ['Unlimited report storage', 'Keep every test report and scan with your records.'],
  ['Unlimited AI Health Insights', 'Plain-language explanations of your recorded trends.'],
];

function Check() {
  return (
    <View style={styles.check}>
      <Svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
        <Path d="M5 12.5l4.5 4.5L19 7.5" />
      </Svg>
    </View>
  );
}

/* The occasional plans pop-up (RootNavigator decides when — see
   lib/promo.js). Calm on purpose: what Plus adds, what it costs, and
   that nothing is taken away from anyone who says no. */
export default function SubscriptionPromo({ visible, onClose, onSeePlans }) {
  const insets = useSafeAreaInsets();
  const { plans } = useSubscription();
  const price = id => plans.find(p => p.id === id)?.amount;

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent navigationBarTranslucent onRequestClose={onClose}>
      <View style={[styles.backdrop, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 16 }]}>
        <View style={styles.card}>
          <ScrollView bounces={false} contentContainerStyle={styles.cardBody} showsVerticalScrollIndicator={false}>
            <View style={styles.topRow}>
              <LinearGradient colors={GRAD.colors} start={GRAD.start} end={GRAD.end} style={styles.badge}>
                {G.premium('#FFFFFF')}
              </LinearGradient>
              <Press onPress={onClose} style={styles.close} accessibilityLabel="Close" hitSlop={10}>
                <Svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={C.ink} strokeWidth="2.4" strokeLinecap="round">
                  <Path d="M6 6l12 12M18 6L6 18" />
                </Svg>
              </Press>
            </View>

            <Text style={styles.title}>Get more from MyHealthBook</Text>
            <Text style={styles.lead}>Upgrade to access advanced health management features.</Text>

            <View style={{ marginTop: 18, gap: 14 }}>
              {BENEFITS.map(([t, d]) => (
                <View key={t} style={styles.benefit}>
                  <Check />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.benefitTitle}>{t}</Text>
                    <Text style={styles.benefitText}>{d}</Text>
                  </View>
                </View>
              ))}
            </View>

            <View style={styles.priceBox}>
              <Text style={styles.priceMain}>Plus from ₹{price('PLUS_MONTHLY') ?? 49}/month</Text>
              <Text style={styles.priceSub}>
                or ₹{price('PLUS_ANNUAL') ?? 399}/year · Family ₹{price('FAMILY_MONTHLY') ?? 79}/month for up to 6 people
              </Text>
            </View>

            <Btn style={{ marginTop: 18 }} onClick={onSeePlans}>
              See plans
            </Btn>
            <Btn kind="quiet" style={{ marginTop: 8 }} onClick={onClose}>
              Not now
            </Btn>

            <Text style={styles.foot}>Your existing health information remains available even if you don't subscribe.</Text>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(10,20,15,0.55)', justifyContent: 'center', paddingHorizontal: 16 },
  card: { backgroundColor: C.cardSolid, borderRadius: 28, maxHeight: '100%', overflow: 'hidden' },
  cardBody: { padding: 22 },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  badge: { width: 52, height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  close: { width: 40, height: 40, borderRadius: 999, backgroundColor: 'rgba(22,36,28,0.06)', alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: SANS.bold, fontSize: 25, letterSpacing: -0.8, lineHeight: 31, color: C.ink, marginTop: 16 },
  lead: { fontFamily: SANS.regular, fontSize: 16, lineHeight: 23, color: C.ink2, marginTop: 6 },
  benefit: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  check: { width: 24, height: 24, borderRadius: 12, backgroundColor: C.brand, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  benefitTitle: { fontFamily: SANS.semibold, fontSize: 16.5, color: C.ink },
  benefitText: { fontFamily: SANS.regular, fontSize: 14.5, lineHeight: 20, color: C.ink2, marginTop: 2 },
  priceBox: { marginTop: 20, backgroundColor: C.panelSoft, borderRadius: 16, padding: 16 },
  priceMain: { fontFamily: SANS.bold, fontSize: 18, color: C.ink },
  priceSub: { fontFamily: SANS.regular, fontSize: 14.5, lineHeight: 20, color: C.ink2, marginTop: 4 },
  foot: { fontFamily: SANS.regular, fontSize: 13.5, lineHeight: 19, color: C.ink3, textAlign: 'center', marginTop: 14 },
});
