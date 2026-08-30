import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Pressable, StyleSheet } from 'react-native';
import { C } from '../../theme/colors';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/* The frosted-glass card that carries almost every reading in the app —
   a tinted, hairline-bordered panel (reproduces `background:
   rgba(255,255,255,.10); backdrop-filter: blur(22px)`) that fades/rises
   in on mount and scales down 0.97 on press, like the original
   `.rise`/`.press` classes.

   This is simulated translucency (a flat tinted View), not a live
   native blur. Card renders many times per screen (Home alone has ~7),
   and Android's blur library samples the *entire* activity's root
   content view on every frame per instance — with that many
   auto-updating BlurViews stacked, their outputs compound into a
   visibly darker/muddier result than a single CSS backdrop-filter ever
   would, and it's expensive to boot. Real blur stays on the few
   singular, always-mounted surfaces (header, tab bar, dialog) where a
   single instance can't compound with itself. */
export default function Card({ children, style, onClick, onPress, delay = 0, overlayColor = 'rgba(255,255,255,0.14)' }) {
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
  const shellStyle = [styles.shell, { backgroundColor: overlayColor }, style, animStyle];

  if (handler) {
    const onPressIn = () => Animated.timing(scale, { toValue: 0.97, duration: 120, useNativeDriver: true }).start();
    const onPressOut = () => Animated.timing(scale, { toValue: 1, duration: 120, useNativeDriver: true }).start();
    return (
      <AnimatedPressable onPress={handler} onPressIn={onPressIn} onPressOut={onPressOut} style={shellStyle}>
        {children}
      </AnimatedPressable>
    );
  }

  return <Animated.View style={shellStyle}>{children}</Animated.View>;
}

const styles = StyleSheet.create({
  shell: {
    borderRadius: 24,
    borderWidth: 1,
    borderColor: C.hair,
    overflow: 'hidden',
    padding: 20,
  },
});
