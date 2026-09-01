import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import { C } from '../../theme/colors';
import { clamp } from '../../lib/calc';
import Mono from '../atoms/Mono';

/* Flat range scale, used where a dial would be too loud. */
export default function Scale({ bands, value, min, max, label }) {
  const pos = ((clamp(value, min, max) - min) / (max - min)) * 100;
  const anim = useRef(new Animated.Value(pos)).current;

  useEffect(() => {
    const t = Animated.timing(anim, { toValue: pos, duration: 600, easing: Easing.bezier(0.16, 1, 0.3, 1), useNativeDriver: false });
    t.start();
    return () => t.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pos]);

  const left = anim.interpolate({ inputRange: [0, 100], outputRange: ['0%', '100%'] });

  return (
    <View style={styles.wrap}>
      <View style={styles.trackRow}>
        <View style={styles.track}>
          {bands.map((b, i) => (
            <View key={i} style={{ flex: b.to - b.from, backgroundColor: b.color, opacity: 0.9 }} />
          ))}
        </View>
        {/* the "paper" ring is a padded outer box around a solid inner bar,
            standing in for the web version's `box-shadow: 0 0 0 3px paper` */}
        <Animated.View style={[styles.thumbRing, { left, marginLeft: -4.5 }]}>
          <View style={styles.thumb} />
        </Animated.View>
      </View>
      <View style={styles.labelsRow}>
        <Mono>{min}</Mono>
        {label ? <Mono>{label}</Mono> : <View />}
        <Mono>{max}</Mono>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: 14 },
  trackRow: { height: 8, position: 'relative' },
  track: { flexDirection: 'row', gap: 2, height: 8, borderRadius: 99, overflow: 'hidden' },
  thumbRing: {
    position: 'absolute',
    top: -5,
    width: 9,
    height: 24,
    borderRadius: 99,
    backgroundColor: C.cardSolid,
    padding: 3,
  },
  thumb: {
    width: 3,
    height: 18,
    borderRadius: 99,
    backgroundColor: C.ink,
  },
  labelsRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
});
