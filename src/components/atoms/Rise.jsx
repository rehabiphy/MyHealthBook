import React, { useEffect, useRef } from 'react';
import { Animated, Easing } from 'react-native';

/* Replaces the web app's `.rise` fade + translateY-in on mount:
   `@keyframes rise { from { opacity:0; translateY(10px) } to { opacity:1; none } }` */
export default function Rise({ delay = 0, style, children }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(10)).current;

  useEffect(() => {
    const anim = Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 460, delay, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration: 460, delay, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]);
    anim.start();
    return () => anim.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <Animated.View style={[style, { opacity, transform: [{ translateY }] }]}>{children}</Animated.View>;
}
