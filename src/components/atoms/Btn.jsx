import React, { useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { C } from '../../theme/colors';
import { GRAD, GRAD_MINT } from '../../theme/gradients';
import { SANS } from '../../theme/typography';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const KIND_TEXT_COLOR = {
  solid: '#FFFFFF',
  brand: '#06231A',
  quiet: C.ink,
};

/* Full-width action button — solid (violet→pink gradient, the app's
   one primary action colour), brand (mint→teal, used for "taken"
   affirmative actions), or quiet (translucent outline).

   A single animated Pressable node carries the merged style (so a
   caller's `style={{ flex: 1 }}`, used to sit two buttons side by
   side, lands on the node that actually participates in that row);
   the gradient is an absolute-fill background layer inside it. */
export default function Btn({ children, onClick, onPress, kind = 'solid', disabled, style, textStyle }) {
  const handler = onPress || onClick;
  const scale = useRef(new Animated.Value(1)).current;
  const onPressIn = () => !disabled && Animated.timing(scale, { toValue: 0.97, duration: 120, useNativeDriver: true }).start();
  const onPressOut = () => !disabled && Animated.timing(scale, { toValue: 1, duration: 120, useNativeDriver: true }).start();

  const label =
    typeof children === 'string' || typeof children === 'number' ? (
      <Text style={[styles.label, { color: KIND_TEXT_COLOR[kind] }, textStyle]} numberOfLines={1}>
        {children}
      </Text>
    ) : (
      children
    );

  const gradColors = kind === 'brand' ? GRAD_MINT.colors : GRAD.colors;
  const gradStart = kind === 'brand' ? GRAD_MINT.start : GRAD.start;
  const gradEnd = kind === 'brand' ? GRAD_MINT.end : GRAD.end;

  return (
    <AnimatedPressable
      onPress={disabled ? undefined : handler}
      disabled={disabled}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      style={[styles.base, kind === 'quiet' && styles.quiet, style, { transform: [{ scale }], opacity: disabled ? 0.35 : 1 }]}>
      {kind !== 'quiet' && <LinearGradient colors={gradColors} start={gradStart} end={gradEnd} style={StyleSheet.absoluteFill} />}
      {label}
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  base: {
    width: '100%',
    borderRadius: 15,
    paddingVertical: 16,
    paddingHorizontal: 18,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  quiet: {
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1,
    borderColor: C.hair,
  },
  label: {
    fontFamily: SANS.semibold,
    fontSize: 15,
    letterSpacing: -0.15,
  },
});
