import React from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from '@react-native-community/blur';
import Svg, { Path } from 'react-native-svg';
import { C } from '../theme/colors';
import { SANS } from '../theme/typography';
import { APP_NAME } from '../lib/appName';
import { dosesToday, isTaken } from '../lib/meds';
import GradientText from '../components/atoms/GradientText';
import Press from '../components/atoms/Press';
import { G } from '../components/icons/ScreenGlyphs';

export default function TopHeader({ data, onPressBell, onPressLearn }) {
  const insets = useSafeAreaInsets();
  const hasDue = dosesToday(data).some(d => !isTaken(data, d.id));

  return (
    <View style={[styles.wrap, { paddingTop: insets.top + 13 }]}>
      {/* Android: solid frosted fill instead of a live blur — see TabBar.jsx for why */}
      {Platform.OS === 'ios' ? (
        <BlurView style={StyleSheet.absoluteFill} blurAmount={18} overlayColor="rgba(255,255,255,0.4)" reducedTransparencyFallbackColor={C.paper} />
      ) : (
        <View style={[StyleSheet.absoluteFill, styles.frosted]} />
      )}
      <View style={styles.row}>
        <GradientText style={styles.appName}>{APP_NAME}</GradientText>
        <View style={styles.iconRow}>
          <Press onPress={onPressLearn} style={styles.bell} accessibilityLabel="learn">
            {G.learn(C.ink)}
          </Press>
          <Press onPress={onPressBell} style={styles.bell} accessibilityLabel="reminders">
            <Svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={C.ink} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <Path d="M18 9a6 6 0 1 0-12 0c0 5-2 6.5-2 6.5h16S18 14 18 9z" />
              <Path d="M13.7 19.5a2 2 0 0 1-3.4 0" />
            </Svg>
            {hasDue && <View style={styles.badge} />}
          </Press>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: 18,
    paddingBottom: 13,
    borderBottomWidth: 1,
    borderBottomColor: C.hair,
    overflow: 'hidden',
  },
  frosted: { backgroundColor: 'rgba(241,248,244,0.96)' },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  iconRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  appName: { fontFamily: SANS.bold, fontSize: 18, letterSpacing: -0.55 },
  bell: {
    width: 38,
    height: 38,
    borderRadius: 999,
    backgroundColor: 'rgba(22,36,28,0.06)',
    borderWidth: 1,
    borderColor: C.hair,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    top: 6,
    right: 7,
    width: 8,
    height: 8,
    borderRadius: 999,
    backgroundColor: C.stage2,
    borderWidth: 1.5,
    borderColor: C.paper,
  },
});
