import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { DefaultTheme, NavigationContainer, useNavigationContainerRef } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useData } from '../state/DataContext';
import { useAuth } from '../state/AuthContext';
import { C } from '../theme/colors';
import AmbientBackground from '../components/AmbientBackground';
import Mono from '../components/atoms/Mono';
import TabBar from './TabBar';
import TopHeader from './TopHeader';
import DoseBanner from './DoseBanner';
import AuthStack from './AuthStack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useReminders } from '../lib/meds';
import AssistantOrb from '../components/assistant/AssistantOrb';
import AssistantOverlay from '../components/assistant/AssistantOverlay';
import useLaunchGreeting from '../lib/assistant/useLaunchGreeting';
import CoachFab from '../components/assistant/CoachFab';

const COACH_FAB = 56;
const FAB_GAP = 14;
import { displayName } from '../lib/appName';

import HomeScreen from '../screens/HomeScreen';
import LogScreen from '../screens/LogScreen';
import HistoryScreen from '../screens/HistoryScreen';
import MedsScreen from '../screens/MedsScreen';
import ProfileScreen from '../screens/ProfileScreen';
import HealthScreen from '../screens/HealthScreen';
import CoachScreen from '../screens/CoachScreen';
import LearnScreen from '../screens/LearnScreen';
import ViewerScreen from '../screens/ViewerScreen';
import PricingScreen from '../screens/PricingScreen';
import CheckoutScreen from '../screens/CheckoutScreen';
import InsightsScreen from '../screens/InsightsScreen';

const Tab = createBottomTabNavigator();

/* React Navigation paints its own opaque theme background behind every
   screen by default, which otherwise hides AmbientBackground entirely —
   make that background transparent so the ambient blooms show through. */
const NAV_THEME = { ...DefaultTheme, colors: { ...DefaultTheme.colors, background: 'transparent' } };

/* "health" has no tab-bar button of its own (TabBar.jsx lights up
   "home" while it's active) — it's reached only via go("health") from
   Home/Profile, exactly like the original's hidden sixth `tab` value.

   TopHeader/DoseBanner render as siblings of <Tab.Navigator>, not as
   one of its screens, so they can't use useNavigation()/useNavigationState()
   (those only work inside a screen a navigator actually renders). Instead
   the container's own ref tracks the active route into local state, and
   that same ref is used to navigate imperatively from the bell/banner. */
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

/* Gates which whole navigator sits under NavigationContainer, rather
   than nesting a Stack inside the existing Tab.Navigator — RootShell
   below is otherwise completely untouched. Mirrors the pre-existing
   `ready` loading pattern for useData(), just with a second ready
   flag (auth) added to it. */
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

  return <RootShell navigationRef={navigationRef} activeKey={activeKey} />;
}

function RootShell({ navigationRef, activeKey }) {
  const { data } = useData();
  const insets = useSafeAreaInsets();
  const reminders = useReminders(data);
  const [assistantOpen, setAssistantOpen] = useState(false);
  const { user } = useAuth();
  const { loaded } = useData();
  useLaunchGreeting(displayName(data.profile, user), loaded);

  const isViewer = data.care?.role === 'viewer';
  const go = key => navigationRef.navigate(key);

  /* Same condition DoseBanner renders under — the orb lifts above it
     rather than covering its "Taken" button. */
  const bannerShown =
    !isViewer && activeKey !== 'meds' && activeKey !== 'coach' && activeKey !== 'premium' && activeKey !== 'premiumCheckout' && (reminders.doses.length > 0 || reminders.refills.length > 0);
  const showOrb = !isViewer && activeKey !== 'coach' && activeKey !== 'premium' && activeKey !== 'premiumCheckout';
  const fabBase = Math.max(insets.bottom, 12) + (bannerShown ? 178 : 100);

  return (
    <View style={styles.root}>
      <AmbientBackground />
      {activeKey !== 'coach' && activeKey !== 'premiumCheckout' && <TopHeader data={data} onPressBell={() => go('meds')} onPressLearn={() => go('learn')} />}
      <View style={{ flex: 1 }}>
        {/* The built-in tab bar is suppressed (tabBar={() => null}) and TabBar
            is rendered separately below, absolutely positioned over the scene —
            that overlap is what lets scrolled content actually pass underneath
            the glass bar instead of stopping above a normal-flow sibling. */}
        <Tab.Navigator tabBar={() => null} screenOptions={{ headerShown: false }} sceneStyle={{ backgroundColor: 'transparent' }}>
          <Tab.Screen name="home" component={HomeScreen} />
          <Tab.Screen name="log" component={LogScreen} />
          <Tab.Screen name="history" component={HistoryScreen} />
          <Tab.Screen name="meds" component={MedsScreen} />
          <Tab.Screen name="me" component={ProfileScreen} />
          <Tab.Screen name="health" component={HealthScreen} />
          <Tab.Screen name="coach" component={CoachScreen} />
          <Tab.Screen name="learn" component={LearnScreen} />
          <Tab.Screen name="family" component={ViewerScreen} />
          <Tab.Screen name="premium" component={PricingScreen} />
          <Tab.Screen name="premiumCheckout" component={CheckoutScreen} />
          <Tab.Screen name="insights" component={InsightsScreen} />
        </Tab.Navigator>
        {/* The coach chat is a full-screen page with its own back button —
            the floating bar and the dose banner would sit on top of its
            message box. */}
        {activeKey !== 'coach' && <TabBar activeKey={activeKey} onNavigate={go} />}
      </View>
      {!isViewer && activeKey !== 'meds' && activeKey !== 'coach' && activeKey !== 'premium' && activeKey !== 'premiumCheckout' && <DoseBanner data={data} go={go} />}
      {/* Bottom-right stack: AI coach chat in the corner, the MyHealth AI
          voice orb directly above it. */}
      {showOrb && (
        <>
          <CoachFab onPress={() => go('coach')} style={[styles.coachFab, { bottom: fabBase }]} />
          <AssistantOrb onPress={() => setAssistantOpen(true)} style={[styles.orb, { bottom: fabBase + COACH_FAB + FAB_GAP }]} />
        </>
      )}
      <AssistantOverlay visible={assistantOpen} onClose={() => setAssistantOpen(false)} go={go} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.paper },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: C.paper },
  loadingText: { fontSize: 14 },
  // orb (64) and chat button (56) share a centre line on the right edge
  orb: { position: 'absolute', right: 18, zIndex: 50 },
  coachFab: { position: 'absolute', right: 22, zIndex: 50 },
});
