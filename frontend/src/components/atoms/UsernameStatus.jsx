import React from 'react';
import { ActivityIndicator, StyleSheet, Text } from 'react-native';
import { C } from '../../theme/colors';
import { SANS } from '../../theme/typography';
import Press from './Press';

/* The indicator inside a username field (Input's `right` slot), driven
   by useUsernameCheck: a Check button while typing pauses (it checks on
   its own a moment later), a spinner while the lookup runs, then a
   clear Available / Taken — or Retry if the check failed. */
export default function UsernameStatus({ uname }) {
  switch (uname.status) {
    case 'waiting':
      return (
        <Press onPress={uname.check} style={styles.btn} hitSlop={8}>
          <Text style={styles.btnLabel}>Check</Text>
        </Press>
      );
    case 'checking':
      return <ActivityIndicator color={C.brand2} style={{ marginRight: 8 }} />;
    case 'available':
      return <Text style={[styles.badge, { color: C.brand2 }]}>✓ Available</Text>;
    case 'taken':
      return <Text style={[styles.badge, { color: C.stage2 }]}>✗ Taken</Text>;
    case 'invalid':
      return <Text style={[styles.badge, { color: C.stage2 }]}>✗ Invalid</Text>;
    case 'error':
      return (
        <Press onPress={uname.check} style={styles.btn} hitSlop={8}>
          <Text style={styles.btnLabel}>Retry</Text>
        </Press>
      );
    default:
      return null;
  }
}

const styles = StyleSheet.create({
  btn: { backgroundColor: C.brand2, borderRadius: 999, paddingVertical: 7, paddingHorizontal: 14 },
  btnLabel: { fontFamily: SANS.semibold, fontSize: 13.5, color: '#FFFFFF' },
  badge: { fontFamily: SANS.semibold, fontSize: 13.5, marginRight: 4 },
});
