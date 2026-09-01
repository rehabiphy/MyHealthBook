import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from '@react-native-community/blur';
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

/* A floating glass pill, like iOS's tab bar — inset from all four
   edges (rather than flush with the screen) with a fully rounded
   stadium shape, so the ambient background is visible all the way
   around it. It sits on top of the scene as an absolutely-positioned
   overlay (Tab.Navigator's own tab bar is suppressed via
   `tabBar={() => null}` in RootNavigator, and this is rendered
   separately over it) rather than in normal layout flow below the
   scene, so card content actually scrolls underneath it instead of
   stopping above a solid bar.

   Unlike Card (a flat tint, many instances per screen, real blur
   there compounds), this is exactly ONE always-mounted instance
   sitting over genuinely detailed content (text/icons scrolling
   past), not a smooth gradient — a flat low-opacity tint let that
   text show through sharply enough to visually collide with the tab
   labels. A real blur is what turns it into an indistinct wash
   instead, which is the one case here where that trade-off is safe. */
export default function TabBar({ activeKey, onNavigate }) {
  const { data } = useData();
  const insets = useSafeAreaInsets();
  const isViewer = data.care?.role === 'viewer';
  const navTabs = isViewer ? VIEWER_TABS : TABS;

  return (
    <>
      {/* The pill only blurs what's directly behind its own rounded
          shape — the inset margins around it (and its rounded corner
          cutouts) aren't covered by that at all, so content scrolling
          into the gap next to the pill showed up fully sharp, right
          beside the blurred glass. This wider, unclipped fade softens
          everything approaching the bottom edge — pill included or
          not — so nothing near it is ever sharp. */}
      <LinearGradient
        pointerEvents="none"
        colors={['rgba(244,248,246,0)', 'rgba(244,248,246,0.85)', 'rgba(244,248,246,0.97)']}
        locations={[0, 0.55, 1]}
        style={styles.fade}
      />
      <View style={[styles.wrap, { bottom: Math.max(insets.bottom, 12) + 10 }]}>
        <BlurView style={StyleSheet.absoluteFill} blurAmount={24} overlayColor="rgba(255,255,255,0.4)" reducedTransparencyFallbackColor={C.cardSolid} />
        <View style={styles.row}>
          {navTabs.map(t => {
            const on = activeKey === t.key || (t.key === 'home' && activeKey === 'health');
            return (
              <Press key={t.key} onPress={() => onNavigate(t.key)} style={styles.tabBtn}>
                {on ? (
                  <LinearGradient colors={GRAD.colors} start={GRAD.start} end={GRAD.end} style={styles.iconCircle}>
                    <Ico name={t.key} on />
                  </LinearGradient>
                ) : (
                  <View style={styles.iconCircle}>
                    <Ico name={t.key} on={false} />
                  </View>
                )}
                <Text style={[styles.label, { color: on ? C.brand : C.ink3 }]}>{t.label}</Text>
              </Press>
            );
          })}
        </View>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  fade: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 150,
  },
  wrap: {
    position: 'absolute',
    left: 16,
    right: 16,
    borderRadius: 34,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.7)',
    paddingVertical: 9,
    paddingHorizontal: 6,
    overflow: 'hidden',
  },
  row: { flexDirection: 'row', gap: 4 },
  tabBtn: { flex: 1, alignItems: 'center', gap: 4, paddingVertical: 2 },
  iconCircle: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  label: { fontFamily: MONO.medium, fontSize: 11.5, letterSpacing: 0.3, textTransform: 'uppercase' },
});
