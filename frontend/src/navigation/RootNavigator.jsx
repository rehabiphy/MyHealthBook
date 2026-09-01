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

import HomeScreen from '../screens/HomeScreen';
import LogScreen from '../screens/LogScreen';
import HistoryScreen from '../screens/HistoryScreen';
import MedsScreen from '../screens/MedsScreen';
import ProfileScreen from '../screens/ProfileScreen';
import HealthScreen from '../screens/HealthScreen';
import CoachScreen from '../screens/CoachScreen';
import LearnScreen from '../screens/LearnScreen';
import ViewerScreen from '../screens/ViewerScreen';

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
  const { ready: authReady, user, pendingRegistration } = useAuth();
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
    return <AuthStack initialRouteName={pendingRegistration ? 'Register' : 'Login'} />;
  }

  return <RootShell navigationRef={navigationRef} activeKey={activeKey} />;
}

function RootShell({ navigationRef, activeKey }) {
  const { data, setData } = useData();

  const isViewer = data.care?.role === 'viewer';
  const go = key => navigationRef.navigate(key);

  return (
    <View style={styles.root}>
      <AmbientBackground />
      {activeKey !== 'coach' && <TopHeader data={data} onPressBell={() => go('meds')} />}
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
        </Tab.Navigator>
        <TabBar activeKey={activeKey} onNavigate={go} />
      </View>
      {!isViewer && activeKey !== 'meds' && <DoseBanner data={data} setData={setData} go={go} />}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.paper },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: C.paper },
  loadingText: { fontSize: 14 },
});
