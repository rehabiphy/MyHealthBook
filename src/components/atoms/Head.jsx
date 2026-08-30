import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { C } from '../../theme/colors';
import { SANS } from '../../theme/typography';
import Mono from './Mono';

/* Every screen opens the same way: title, mono caption, optional right
   slot and icon chip — built once so screens can't drift apart. */
export default function Head({ title, caption, right, size = 26, icon, tint }) {
  const t = tint || C.brand;
  return (
    <View style={styles.row}>
      <View style={styles.left}>
        {icon && (
          <View
            style={[
              styles.iconChip,
              {
                backgroundColor: `${t}2E`,
                borderColor: `${t}55`,
                shadowColor: t,
              },
            ]}>
            {icon}
          </View>
        )}
        <View style={styles.titleWrap}>
          <Text style={[styles.title, { fontSize: size }]}>{title}</Text>
          {caption ? <Mono style={styles.caption}>{caption}</Mono> : null}
        </View>
      </View>
      {right}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: 4,
    paddingBottom: 18,
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
    flexShrink: 1,
    minWidth: 0,
  },
  iconChip: {
    width: 42,
    height: 42,
    borderRadius: 14,
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 3,
  },
  titleWrap: {
    flexShrink: 1,
    minWidth: 0,
  },
  title: {
    fontFamily: SANS.bold,
    color: C.ink,
    letterSpacing: -1,
    lineHeight: undefined,
  },
  caption: {
    marginTop: 4,
  },
});
