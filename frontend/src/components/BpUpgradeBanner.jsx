import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { C } from '../theme/colors';
import { SANS } from '../theme/typography';
import Press from './atoms/Press';

/* Contextual upgrade prompt shown inline (in normal scroll flow, not a
   floating overlay like DoseBanner) right after a BP reading is saved
   — the moment the user has just seen a fresh number is when a "want
   to understand the pattern?" pitch actually lands. Throttled by the
   caller (LogScreen) so it doesn't nag on every single save. */
export default function BpUpgradeBanner({ onPress, onDismiss }) {
  return (
    <View style={styles.noteBanner}>
      <Press onPress={onPress} style={{ flex: 1 }}>
        <Text style={styles.noteText}>Want to understand your BP pattern? Premium can show your 7/30/90-day trend.</Text>
      </Press>
      <Press onPress={onDismiss} style={styles.closeBtn} accessibilityLabel="dismiss">
        <Svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.onPanel2} strokeWidth="2" strokeLinecap="round">
          <Path d="M6 6l12 12M18 6L6 18" />
        </Svg>
      </Press>
    </View>
  );
}

const styles = StyleSheet.create({
  noteBanner: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: C.panelSoft,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  noteText: { fontFamily: SANS.regular, fontSize: 14.5, color: C.onPanel2, lineHeight: 20 },
  closeBtn: { padding: 2, marginTop: 1 },
});
