import React from 'react';
import { StyleSheet, Text } from 'react-native';
import { C } from '../../theme/colors';
import { SANS } from '../../theme/typography';
import Rise from './Rise';

/* The floating confirmation pill (e.g. "Reading saved") used on the
   Readings screen, positioned just above the tab bar. */
export default function Toast({ children, bottom = 96 }) {
  if (!children) return null;
  return (
    <Rise style={[styles.pill, { bottom }]}>
      <Text style={styles.text}>{children}</Text>
    </Rise>
  );
}

const styles = StyleSheet.create({
  pill: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignSelf: 'center',
    backgroundColor: C.panel,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 999,
    zIndex: 40,
    alignItems: 'center',
  },
  text: {
    fontFamily: SANS.semibold,
    fontSize: 14,
    color: C.onPanel,
  },
});
