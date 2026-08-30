import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import { C } from '../theme/colors';
import { GRAD } from '../theme/gradients';
import { MONO } from '../theme/typography';
import { useData } from '../state/DataContext';
import Ico from '../components/icons/NavIcons';
import Press from '../components/atoms/Press';

/* Today · Records · [+] · Medicines · Profile for the person logging
   readings; Updates · Coach · Learn · Profile for the family member
   who only receives the weekly summary. */
const TABS = [
  { key: 'home', label: 'Home' },
  { key: 'log', label: 'Readings' },
  { key: 'history', label: 'Records' },
  { key: 'meds', label: 'Medicines' },
  { key: 'me', label: 'Profile' },
];

const VIEWER_TABS = [
  { key: 'family', label: 'Updates' },
  { key: 'coach', label: 'Coach' },
  { key: 'learn', label: 'Learn' },
  { key: 'me', label: 'Profile' },
];

export default function TabBar({ state, navigation }) {
  const { data } = useData();
  const insets = useSafeAreaInsets();
  const isViewer = data.care?.role === 'viewer';
  const navTabs = isViewer ? VIEWER_TABS : TABS;
  const activeKey = state.routeNames[state.index];

  return (
    <View style={[styles.wrap, { paddingBottom: Math.max(insets.bottom, 13) }]}>
      <View style={styles.row}>
        {navTabs.map(t => {
          const on = activeKey === t.key || (t.key === 'home' && activeKey === 'health');
          return (
            <Press key={t.key} onPress={() => navigation.navigate(t.key)} style={styles.tabBtn}>
              {on ? (
                <LinearGradient colors={GRAD.colors} start={GRAD.start} end={GRAD.end} style={styles.iconWrap}>
                  <Ico name={t.key} on />
                </LinearGradient>
              ) : (
                <View style={styles.iconWrap}>
                  <Ico name={t.key} on={false} />
                </View>
              )}
              <Text style={[styles.label, { color: on ? '#FFFFFF' : C.ink3 }]}>{t.label}</Text>
            </Press>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderTopWidth: 1,
    borderTopColor: C.hair,
    paddingTop: 8,
    paddingHorizontal: 2,
    backgroundColor: 'rgba(43,27,99,0.60)',
  },
  row: { flexDirection: 'row' },
  tabBtn: { flex: 1, alignItems: 'center', gap: 4, paddingVertical: 2 },
  iconWrap: { width: 44, height: 34, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  label: { fontFamily: MONO.regular, fontSize: 8.5, letterSpacing: 0.5, textTransform: 'uppercase' },
});
