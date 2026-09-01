import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Pressable, StyleSheet, View } from 'react-native';
import { BlurView } from '@react-native-community/blur';
import { C } from '../../theme/colors';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/* The frosted-glass card that carries almost every reading in the app —
   real native blur behind a neutral, low-opacity white wash and a
   subtle white glass-edge border, so whatever's behind it (mostly
   AmbientBackground's near-white ground, occasionally one of its soft
   green glows) actually reads through, blurred, rather than the card
   just looking like a flat green-tinted box. Fades/rises in on mount
   and scales down 0.97 on press, like the original `.rise`/`.press`
   classes.

   `autoUpdate={false}`: Card renders many times per screen (Home alone
   has ~7), and a continuously re-blurring instance per card is real
   GPU cost on Android. Each blurs a single snapshot on mount instead —
   safe here because what's behind a card is either the fixed ambient
   backdrop (doesn't move) or another card's own flat colour (no fine
   detail to go stale). TabBar blurs live content scrolling past it, so
   it keeps auto-update on; cards don't need to. */
export default function Card({ children, style, onClick, onPress, delay = 0, overlayColor = C.card, blurAmount = 14 }) {
  const handler = onPress || onClick;
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(10)).current;
  const scale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const anim = Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 460, delay, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration: 460, delay, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]);
    anim.start();
    return () => anim.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const animStyle = { opacity, transform: [{ translateY }, { scale }] };
  const shellStyle = [styles.shell, style, animStyle];

  const inner = (
    <>
      <BlurView style={StyleSheet.absoluteFill} blurAmount={blurAmount} autoUpdate={false} overlayColor={overlayColor} reducedTransparencyFallbackColor={C.cardSolid} />
      <View style={styles.content}>{children}</View>
    </>
  );

  if (handler) {
    const onPressIn = () => Animated.timing(scale, { toValue: 0.97, duration: 120, useNativeDriver: true }).start();
    const onPressOut = () => Animated.timing(scale, { toValue: 1, duration: 120, useNativeDriver: true }).start();
    return (
      <AnimatedPressable onPress={handler} onPressIn={onPressIn} onPressOut={onPressOut} style={shellStyle}>
        {inner}
      </AnimatedPressable>
    );
  }

  return <Animated.View style={shellStyle}>{inner}</Animated.View>;
}

const styles = StyleSheet.create({
  shell: {
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.8)',
    overflow: 'hidden',
    padding: 20,
  },
  content: {},
});
