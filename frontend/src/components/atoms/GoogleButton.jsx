import React, { useRef } from 'react';
import { ActivityIndicator, Animated, Pressable, StyleSheet, Text } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { C } from '../../theme/colors';
import { SANS } from '../../theme/typography';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

function GoogleG() {
  return (
    <Svg width="18" height="18" viewBox="0 0 18 18">
      <Path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z" />
      <Path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z" />
      <Path fill="#FBBC05" d="M3.964 10.707c-.18-.54-.282-1.117-.282-1.707s.102-1.167.282-1.707V4.961H.957C.347 6.175 0 7.55 0 9s.348 2.825.957 4.039l3.007-2.332z" />
      <Path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.961L3.964 7.293C4.672 5.166 6.656 3.58 9 3.58z" />
    </Svg>
  );
}

/* Google's own brand button guidelines call for a neutral (white,
   gray border) button — never this app's green — so this is its own
   atom rather than a `Btn` variant. Same width/radius/padding as
   `Btn` so it drops in identically below it. */
export default function GoogleButton({ onPress, disabled, loading, style }) {
  const scale = useRef(new Animated.Value(1)).current;
  const isDisabled = disabled || loading;
  const onPressIn = () => !isDisabled && Animated.timing(scale, { toValue: 0.97, duration: 120, useNativeDriver: true }).start();
  const onPressOut = () => !isDisabled && Animated.timing(scale, { toValue: 1, duration: 120, useNativeDriver: true }).start();

  return (
    <AnimatedPressable
      onPress={isDisabled ? undefined : onPress}
      disabled={isDisabled}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      style={[styles.base, style, { transform: [{ scale }], opacity: isDisabled ? 0.6 : 1 }]}>
      {loading ? <ActivityIndicator color={C.ink2} /> : <GoogleG />}
      <Text style={styles.label} numberOfLines={1}>
        {loading ? 'Signing in…' : 'Continue with Google'}
      </Text>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  base: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    borderRadius: 15,
    paddingVertical: 16,
    paddingHorizontal: 18,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: C.hair,
  },
  label: {
    fontFamily: SANS.semibold,
    fontSize: 15.5,
    letterSpacing: -0.15,
    color: '#3C4043',
  },
});
