import React, { useEffect, useRef, useState } from 'react';
import { AppState, StyleSheet, View } from 'react-native';
import { DefaultTheme, NavigationContainer, useNavigationContainerRef } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useData } from '../state/DataContext';
import { useAuth } from '../state/AuthContext';
import { useSubscription } from '../state/SubscriptionContext';
import { C } from '../theme/colors';
import AmbientBackground from '../components/AmbientBackground';
import Mono from '../components/atoms/Mono';
import TabBar, { useTabBarTop } from './TabBar';
import DoseBanner from './DoseBanner';
import AuthStack from './AuthStack';
import ChooseUsernameScreen from '../screens/ChooseUsernameScreen';
import { useReminders } from '../lib/meds';
import { registerOpen, RESUME_AFTER_MS } from '../lib/promo';
import AssistantOrb from '../components/assistant/AssistantOrb';
import AssistantOverlay from '../components/assistant/AssistantOverlay';
import useLaunchGreeting from '../lib/assistant/useLaunchGreeting';
import SosLayer from '../components/sos/SosLayer';
import SubscriptionPromo from '../components/SubscriptionPromo';
import { displayName } from '../lib/appName';

import HomeScreen from '../screens/HomeScreen';
import LogScreen from '../screens/LogScreen';
import HistoryScreen from '../screens/HistoryScreen';
import MedsScreen from '../screens/MedsScreen';
import ProfileScreen from '../screens/ProfileScreen';
import HealthScreen from '../screens/HealthScreen';
import CoachScreen from '../screens/CoachScreen';
import LearnScreen from '../screens/LearnScreen';
import FamilyScreen from '../screens/FamilyScreen';
import FamilyMemberScreen from '../screens/FamilyMemberScreen';
import PricingScreen from '../screens/PricingScreen';
import CheckoutScreen from '../screens/CheckoutScreen';
import SubscriptionScreen from '../screens/SubscriptionScreen';
import TrendsScreen from '../screens/TrendsScreen';
import InsightsScreen from '../screens/InsightsScreen';
import ProfileDetailsScreen from '../screens/ProfileDetailsScreen';
import NotificationSettingsScreen from '../screens/NotificationSettingsScreen';
import SafetyScreen from '../screens/SafetyScreen';
import DataReportsScreen from '../screens/DataReportsScreen';

const Tab = createBottomTabNavigator();

/* React Navigation paints its own opaque theme background behind every
   screen by default, which otherwise hides AmbientBackground entirely —
   make that background transparent so the ambient blooms show through. */
const NAV_THEME = { ...DefaultTheme, colors: { ...DefaultTheme.colors, background: 'transparent' } };

// full-screen pages: no tab bar, no floating helpers over them
const FULL_SCREEN = ['coach', 'premiumCheckout'];
// no dose banner / voice orb over these — money, chat, or someone else's record
const QUIET = ['meds', 'coach', 'premium', 'premiumCheckout', 'subscription', 'familyMember'];
// never interrupt these with the plans pop-up
const NO_PROMO = ['premium', 'premiumCheckout', 'subscription', 'coach', 'familyMember'];

/* Every page is a screen of one bottom-tab navigator; the five in the
   tab bar are the main sections, the rest are pages reached from them.
   backBehavior="history" makes Back (the header arrow and Android's
   back button) return to wherever you came from.

   TabBar/DoseBanner render as siblings of <Tab.Navigator>, not as one
   of its screens, so the container's own ref tracks the active route
   into local state and is used to navigate from them. */
export default function RootNavigator() {
  const navigationRef = useNavigationContainerRef();
  const [activeKey, setActiveKey] = useState('home');

  const syncActiveKey = () => setActiveKey(navigationRef.getCurrentRoute()?.name ?? 'home');

  return (
    <NavigationContainer ref={navigationRef} theme={NAV_THEME} onReady={syncActiveKey} onStateChange={syncActiveKey}>
      <AuthGate navigationRef={navigationRef} activeKey={activeKey} />
    </NavigationContainer>
  );
}

function AuthGate({ navigationRef, activeKey }) {
  const { ready: authReady, user } = useAuth();
  const { ready: dataReady } = useData();

  if (!authReady || !dataReady) {
    return (
      <View style={styles.loadingWrap}>
        <AmbientBackground />
        <Mono style={styles.loadingText}>Opening your record…</Mono>
      </View>
    );
  }

  if (!user) {
    return <AuthStack />;
  }

  if (!user.username) {
    return <ChooseUsernameScreen />;
  }

  return <RootShell navigationRef={navigationRef} activeKey={activeKey} />;
}

/* The plans pop-up, for people without a plan: counted per app open
   (lib/promo.js decides which open), shown only once the server has
   confirmed they're on Free — never to a subscriber whose plan simply
   hasn't loaded yet. */
function usePlanPromo(activeKey) {
  const { loaded, tier } = useSubscription();
  const [visible, setVisible] = useState(false);
  const eligible = loaded && tier === 'free';
  const eligibleRef = useRef(eligible);
  eligibleRef.current = eligible;
  const activeRef = useRef(activeKey);
  activeRef.current = activeKey;
  const countedLaunch = useRef(false);
  const backgroundedAt = useRef(null);

  const count = async () => {
    if (!eligibleRef.current) return;
    const show = await registerOpen();
    if (show && eligibleRef.current && !NO_PROMO.includes(activeRef.current)) setVisible(true);
  };

  // the launch itself counts once the plan is known
  useEffect(() => {
    if (!eligible || countedLaunch.current) return;
    countedLaunch.current = true;
    count();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eligible]);

  // …and so does coming back after a while away
  useEffect(() => {
    const sub = AppState.addEventListener('change', state => {
      if (state === 'background') backgroundedAt.current = Date.now();
      else if (state === 'active' && backgroundedAt.current) {
        const away = Date.now() - backgroundedAt.current;
        backgroundedAt.current = null;
        if (away >= RESUME_AFTER_MS) count();
      }
    });
    return () => sub.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return [visible, () => setVisible(false)];
}

function RootShell({ navigationRef, activeKey }) {
  const { data, loaded } = useData();
  const insets = useSafeAreaInsets();
  const tabTop = useTabBarTop();
  const reminders = useReminders(data);
  const [assistantOpen, setAssistantOpen] = useState(false);
  const { user } = useAuth();
  const [promoVisible, closePromo] = usePlanPromo(activeKey);
  useLaunchGreeting(displayName(data.profile, user), loaded);

  const go = (key, params) => navigationRef.navigate(key, params);

  const fullScreen = FULL_SCREEN.includes(activeKey);
  /* The dose banner is about the signed-in user's own medicines, so it
     stays off while looking at a family member's record. The orb lifts
     above it rather than covering its "Taken" button. */
  const showBanner = !QUIET.includes(activeKey);
  const bannerShown = showBanner && (reminders.doses.length > 0 || reminders.refills.length > 0);
  const showOrb = !QUIET.includes(activeKey) || activeKey === 'meds';
  const orbBottom = tabTop + 14 + (bannerShown ? 84 : 0);

  return (
    <View style={styles.root}>
      <AmbientBackground />
      <View style={{ flex: 1 }}>
        <Tab.Navigator tabBar={() => null} backBehavior="history" screenOptions={{ headerShown: false }} sceneStyle={{ backgroundColor: 'transparent' }}>
          <Tab.Screen name="home" component={HomeScreen} />
          <Tab.Screen name="log" component={LogScreen} />
          <Tab.Screen name="history" component={HistoryScreen} />
          <Tab.Screen name="meds" component={MedsScreen} />
          <Tab.Screen name="me" component={ProfileScreen} />
          <Tab.Screen name="health" component={HealthScreen} />
          <Tab.Screen name="trends" component={TrendsScreen} />
          <Tab.Screen name="insights" component={InsightsScreen} />
          <Tab.Screen name="coach" component={CoachScreen} />
          <Tab.Screen name="learn" component={LearnScreen} />
          <Tab.Screen name="family" component={FamilyScreen} />
          <Tab.Screen name="familyMember" component={FamilyMemberScreen} />
          <Tab.Screen name="profileDetails" component={ProfileDetailsScreen} />
          <Tab.Screen name="notificationSettings" component={NotificationSettingsScreen} />
          <Tab.Screen name="safety" component={SafetyScreen} />
          <Tab.Screen name="dataReports" component={DataReportsScreen} />
          <Tab.Screen name="premium" component={PricingScreen} />
          <Tab.Screen name="premiumCheckout" component={CheckoutScreen} />
          <Tab.Screen name="subscription" component={SubscriptionScreen} />
        </Tab.Navigator>
        {!fullScreen && <TabBar activeKey={activeKey} onNavigate={go} />}
      </View>

      {/* content scrolls up under the translucent status bar — this keeps the clock readable over it */}
      {!fullScreen && <View pointerEvents="none" style={[styles.statusScrim, { height: insets.top }]} />}

      {showBanner && <DoseBanner data={data} go={go} bottom={tabTop + 10} />}
      {showOrb && <AssistantOrb size={58} onPress={() => setAssistantOpen(true)} style={[styles.orb, { bottom: orbBottom }]} />}
      <AssistantOverlay visible={assistantOpen} onClose={() => setAssistantOpen(false)} go={go} />
      <SubscriptionPromo
        visible={promoVisible}
        onClose={closePromo}
        onSeePlans={() => {
          closePromo();
          go('premium');
        }}
      />
      {/* last, so a family SOS covers everything else */}
      <SosLayer />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.paper },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: C.paper },
  loadingText: { fontSize: 15 },
  statusScrim: { position: 'absolute', top: 0, left: 0, right: 0, backgroundColor: 'rgba(236,247,241,0.96)', zIndex: 30 },
  orb: { position: 'absolute', right: 16, zIndex: 50 },
});
