import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View, useWindowDimensions } from 'react-native';
import MaskedView from '@react-native-masked-view/masked-view';
import LinearGradient from 'react-native-linear-gradient';

/* The Siri / Gemini "the whole phone is listening" edge glow.

   A multi-colour gradient much larger than the screen spins slowly
   behind a mask that only lets the outer rim of the screen through —
   four edge strips, each fading from opaque at the bezel to clear
   toward the middle, so the colour looks like light leaking in from
   the edges rather than a drawn border. Three copies are stacked: a
   thin crisp rim, a soft breathing bloom, and a deep wash that only
   rises with the voice `level` (0..1).

   The spin, fade-in and breathing all run on the native driver, so
   the glow stays smooth while JS is busy parsing or waiting on the
   network. The phone's own rounded display corners clip the rim, so
   no corner radius has to be guessed here.

   phase: 'listening' — bright, fast, reacts to voice
          'thinking'  — dimmer, faster spin
          'idle'      — gentle and slow */

export const GLOW_COLORS = ['#22C55E', '#22D3EE', '#6366F1', '#C026D3', '#F43F5E', '#F59E0B', '#22C55E'];

function EdgeMask({ size }) {
  const solid = '#000';
  const clear = 'rgba(0,0,0,0)';
  return (
    <View style={StyleSheet.absoluteFill}>
      <LinearGradient colors={[solid, clear]} style={[styles.edge, { top: 0, left: 0, right: 0, height: size }]} />
      <LinearGradient colors={[clear, solid]} style={[styles.edge, { bottom: 0, left: 0, right: 0, height: size }]} />
      <LinearGradient colors={[solid, clear]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={[styles.edge, { top: 0, bottom: 0, left: 0, width: size }]} />
      <LinearGradient colors={[clear, solid]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={[styles.edge, { top: 0, bottom: 0, right: 0, width: size }]} />
    </View>
  );
}

function Spinner({ spin, diag, width, height }) {
  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  return (
    <Animated.View
      style={{
        position: 'absolute',
        width: diag,
        height: diag,
        left: (width - diag) / 2,
        top: (height - diag) / 2,
        transform: [{ rotate }],
      }}>
      <LinearGradient colors={GLOW_COLORS} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
    </Animated.View>
  );
}

export default function GlowBorder({ visible, phase = 'idle', level }) {
  const { width, height } = useWindowDimensions();
  const diag = Math.ceil(Math.hypot(width, height)) + 40;

  const spin = useRef(new Animated.Value(0)).current;
  const appear = useRef(new Animated.Value(0)).current;
  const breathe = useRef(new Animated.Value(0)).current;
  const fallbackLevel = useRef(new Animated.Value(0)).current;
  const voice = level ?? fallbackLevel;

  useEffect(() => {
    Animated.timing(appear, { toValue: visible ? 1 : 0, duration: visible ? 420 : 260, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [visible, appear]);

  useEffect(() => {
    if (!visible) return undefined;
    spin.setValue(0);
    const loop = Animated.loop(
      Animated.timing(spin, { toValue: 1, duration: phase === 'thinking' ? 2400 : phase === 'listening' ? 4200 : 7000, easing: Easing.linear, useNativeDriver: true }),
    );
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(breathe, { toValue: 1, duration: 1300, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(breathe, { toValue: 0, duration: 1300, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]),
    );
    loop.start();
    pulse.start();
    return () => {
      loop.stop();
      pulse.stop();
    };
  }, [visible, phase, spin, breathe]);

  const base = phase === 'listening' ? 0.6 : phase === 'thinking' ? 0.45 : 0.35;
  const bloomOpacity = Animated.multiply(
    appear,
    Animated.add(
      breathe.interpolate({ inputRange: [0, 1], outputRange: [base, base + 0.15] }),
      voice.interpolate({ inputRange: [0, 1], outputRange: [0, 0.4], extrapolate: 'clamp' }),
    ),
  );
  // the deep wash only shows while the user is actually speaking
  const surgeOpacity = Animated.multiply(appear, voice.interpolate({ inputRange: [0, 1], outputRange: [0, 0.75], extrapolate: 'clamp' }));

  /* Masks are kept static (only the gradient behind them and the
     wrappers' opacity animate) — Android's MaskedView doesn't reliably
     redraw an animating mask. */
  return (
    <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { opacity: appear }]}>
      {/* deep wash reaching into the screen as the voice gets louder */}
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: surgeOpacity }]}>
        <MaskedView style={StyleSheet.absoluteFill} androidRenderingMode="hardware" maskElement={<EdgeMask size={110} />}>
          <Spinner spin={spin} diag={diag} width={width} height={height} />
        </MaskedView>
      </Animated.View>
      {/* soft bloom, always breathing */}
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: bloomOpacity }]}>
        <MaskedView style={StyleSheet.absoluteFill} androidRenderingMode="hardware" maskElement={<EdgeMask size={44} />}>
          <Spinner spin={spin} diag={diag} width={width} height={height} />
        </MaskedView>
      </Animated.View>
      {/* crisp rim right at the bezel */}
      <MaskedView style={StyleSheet.absoluteFill} androidRenderingMode="hardware" maskElement={<EdgeMask size={9} />}>
        <Spinner spin={spin} diag={diag} width={width} height={height} />
      </MaskedView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  edge: { position: 'absolute' },
});
