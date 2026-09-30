import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import { C } from '../theme/colors';
import { GRAD } from '../theme/gradients';
import { SANS } from '../theme/typography';
import Ico from '../components/icons/NavIcons';
import Press from '../components/atoms/Press';

const TABS = [
  { key: 'home', label: 'Home' },
  { key: 'log', label: 'Readings' },
  { key: 'history', label: 'Records' },
  { key: 'meds', label: 'Medicines' },
  { key: 'me', label: 'Profile' },
];

// pages without a tab of their own light up the tab they belong to
const PARENT_TAB = {
  health: 'home',
  trends: 'home',
  insights: 'home',
  learn: 'home',
  family: 'me',
  familyMember: 'me',
  premium: 'me',
  subscription: 'me',
  profileDetails: 'me',
  notificationSettings: 'me',
  safety: 'me',
  dataReports: 'me',
};

// the bar's own height above the bottom safe-area inset
const BAR_HEIGHT = 64;

/* How far above the screen bottom the bar's top edge sits — what
   anything floating (dose banner, voice orb, toasts) must clear. */
export function useTabBarTop() {
  const insets = useSafeAreaInsets();
  return BAR_HEIGHT + Math.max(insets.bottom, 8);
}

// how much every scrolling page pads its end, so the last item isn't under the bar
export function useTabBarClearance() {
  return useTabBarTop() + 28;
}

/* Docked to the bottom edge (not floating), solid white, with plain
   sentence-case labels — the most familiar pattern there is, and the
   easiest to read. The active tab gets the app's one gradient. */
export default function TabBar({ activeKey, onNavigate }) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, 8) }]}>
      {TABS.map(t => {
        const on = activeKey === t.key || PARENT_TAB[activeKey] === t.key;
        return (
          <Press key={t.key} onPress={() => onNavigate(t.key)} style={styles.tabBtn} accessibilityRole="tab" accessibilityState={{ selected: on }} accessibilityLabel={t.label}>
            {on ? (
              <LinearGradient colors={GRAD.colors} start={GRAD.start} end={GRAD.end} style={styles.pill}>
                <Ico name={t.key} on />
              </LinearGradient>
            ) : (
              <View style={styles.pill}>
                <Ico name={t.key} on={false} />
              </View>
            )}
            {/* one line on every phone: shrinks to fit a narrow screen, and caps how far the
                system font-size setting can grow it (some phones, e.g. OnePlus, default large) */}
            <Text style={[styles.label, on && styles.labelOn]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75} maxFontSizeMultiplier={1.15}>
              {t.label}
            </Text>
          </Press>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    paddingTop: 8,
    paddingHorizontal: 2,
    backgroundColor: C.cardSolid,
    borderTopWidth: 1,
    borderTopColor: C.hair,
    elevation: 16,
    shadowColor: '#16A34A',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: -2 },
  },
  tabBtn: { flex: 1, minWidth: 0, alignItems: 'center', gap: 3, height: BAR_HEIGHT - 8, paddingHorizontal: 2 },
  pill: { width: 48, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  label: { fontFamily: SANS.medium, fontSize: 12.5, color: C.ink3, textAlign: 'center', alignSelf: 'stretch' },
  labelOn: { fontFamily: SANS.bold, color: C.brand2 },
});
