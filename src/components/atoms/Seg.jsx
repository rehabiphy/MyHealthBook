import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { C } from '../../theme/colors';
import { GRAD } from '../../theme/gradients';
import { SANS } from '../../theme/typography';

/* Segmented control — Systolic/Body/Sugar tabs, Veg/Egg/Non-veg, etc.
   The active option gets the app's one gradient as a pill. */
export default function Seg({ options, value, onChange, style }) {
  return (
    <View style={[styles.track, style]}>
      {options.map(o => {
        const on = value === o.value;
        return (
          <Pressable key={o.value} onPress={() => onChange(o.value)} style={({ pressed }) => [styles.opt, pressed && !on && styles.pressed]}>
            {on && <LinearGradient colors={GRAD.colors} start={GRAD.start} end={GRAD.end} style={StyleSheet.absoluteFill} />}
            <Text style={[styles.label, { color: on ? '#FFFFFF' : C.ink2 }]} numberOfLines={1}>
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    flexDirection: 'row',
    gap: 3,
    backgroundColor: 'rgba(22,36,28,0.05)',
    padding: 4,
    borderRadius: 16,
  },
  opt: {
    flex: 1,
    borderRadius: 11,
    paddingVertical: 10,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  pressed: {
    opacity: 0.7,
  },
  label: {
    fontFamily: SANS.semibold,
    fontSize: 15,
  },
});
