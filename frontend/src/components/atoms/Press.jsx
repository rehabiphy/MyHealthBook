import React, { useRef } from 'react';
import { Animated, Pressable } from 'react-native';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/* Replaces the web app's `.press { transition: transform 120ms; }
   .press:active { transform: scale(0.97) }` — a tactile scale-down on
   touch. A single animated node (not a wrapper around another node),
   so the full `style` (including flex/margin from a parent row) lands
   on the one element that actually participates in that layout. */
export default function Press({ onPress, disabled, style, children, ...rest }) {
  const scale = useRef(new Animated.Value(1)).current;

  const onPressIn = () => Animated.timing(scale, { toValue: 0.97, duration: 120, useNativeDriver: true }).start();
  const onPressOut = () => Animated.timing(scale, { toValue: 1, duration: 120, useNativeDriver: true }).start();

  return (
    <AnimatedPressable
      onPress={onPress}
      disabled={disabled}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      style={[style, { transform: [{ scale }], opacity: disabled ? 0.35 : 1 }]}
      {...rest}>
      {children}
    </AnimatedPressable>
  );
}
