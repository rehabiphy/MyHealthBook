import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Svg, { Path, Rect } from 'react-native-svg';
import Press from '../atoms/Press';
import { GLOW_COLORS } from './GlowBorder';

export function MicIcon({ size = 26, color = '#FFFFFF' }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <Rect x="9" y="3" width="6" height="11" rx="3" />
      <Path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
    </Svg>
  );
}

/* The always-visible way into MyHealth AI: a Siri-colour orb with a
   mic, big enough to hit without looking closely.

   It swirls and pulses a few times when it appears, to be noticed, then
   rests. It used to animate forever — and any never-ending animation
   makes Android redraw the whole screen every frame, which is what made
   every page's scrolling feel laggy. */
const INTRO_PULSES = 3;

export default function AssistantOrb({ onPress, style, size = 64 }) {
  const spin = useRef(new Animated.Value(0)).current;
  const halo = useRef(new Animated.Value(1)).current; // 1 = halo fully faded

  useEffect(() => {
    const pulse = Animated.sequence([
      Animated.timing(halo, { toValue: 0, duration: 0, useNativeDriver: true }),
      Animated.timing(halo, { toValue: 1, duration: 1600, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      Animated.delay(500),
    ]);
    const intro = Animated.parallel([
      Animated.timing(spin, { toValue: 1, duration: 2100 * INTRO_PULSES, easing: Easing.inOut(Easing.cubic), useNativeDriver: true }),
      Animated.loop(pulse, { iterations: INTRO_PULSES }),
    ]);
    intro.start();
    return () => intro.stop();
  }, [spin, halo]);

  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  return (
    <View style={[{ width: size, height: size }, style]} pointerEvents="box-none">
      <Animated.View
        pointerEvents="none"
        style={[
          styles.halo,
          {
            borderRadius: size,
            opacity: halo.interpolate({ inputRange: [0, 1], outputRange: [0.55, 0] }),
            transform: [{ scale: halo.interpolate({ inputRange: [0, 1], outputRange: [1, 1.55] }) }],
          },
        ]}>
        <LinearGradient colors={GLOW_COLORS} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[StyleSheet.absoluteFill, { borderRadius: size }]} />
      </Animated.View>
      <Press onPress={onPress} style={[styles.orb, { borderRadius: size / 2 }]} accessibilityRole="button" accessibilityLabel="Talk to MyHealth AI">
        <Animated.View style={[styles.spinner, { transform: [{ rotate }] }]}>
          <LinearGradient colors={GLOW_COLORS} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
        </Animated.View>
        <View style={[styles.core, { borderRadius: size }]}>
          <MicIcon size={size * 0.42} />
        </View>
      </Press>
    </View>
  );
}

const styles = StyleSheet.create({
  halo: { ...StyleSheet.absoluteFillObject, overflow: 'hidden' },
  orb: {
    flex: 1,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 18,
    elevation: 10,
  },
  spinner: { position: 'absolute', top: '-25%', left: '-25%', width: '150%', height: '150%' },
  core: { ...StyleSheet.absoluteFillObject, margin: 4, backgroundColor: 'rgba(22,36,28,0.28)', alignItems: 'center', justifyContent: 'center' },
});
