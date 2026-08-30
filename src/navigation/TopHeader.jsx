import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { C } from '../theme/colors';
import { SANS } from '../theme/typography';
import { APP_NAME } from '../lib/appName';
import { dosesToday, isTaken } from '../lib/meds';
import GradientText from '../components/atoms/GradientText';
import Press from '../components/atoms/Press';

export default function TopHeader({ data, onPressBell }) {
  const insets = useSafeAreaInsets();
  const hasDue = dosesToday(data).some(d => !isTaken(data, d.id));

  return (
    <View style={[styles.wrap, { paddingTop: insets.top + 13 }]}>
      <View style={styles.row}>
        <GradientText style={styles.appName}>{APP_NAME}</GradientText>
        <Press onPress={onPressBell} style={styles.bell} accessibilityLabel="reminders">
          <Svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={C.ink} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <Path d="M18 9a6 6 0 1 0-12 0c0 5-2 6.5-2 6.5h16S18 14 18 9z" />
            <Path d="M13.7 19.5a2 2 0 0 1-3.4 0" />
          </Svg>
          {hasDue && <View style={styles.badge} />}
        </Press>
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
    backgroundColor: 'rgba(43,27,99,0.55)',
  },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  appName: { fontFamily: SANS.bold, fontSize: 18, letterSpacing: -0.55 },
  bell: {
    width: 38,
    height: 38,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.14)',
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
