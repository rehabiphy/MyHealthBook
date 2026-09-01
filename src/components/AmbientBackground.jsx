import React from 'react';
import { StyleSheet } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';

/* A smooth diagonal linear gradient backdrop, matching the reference
   app's mint/white wash — replaces the earlier flat colour + sharp
   diagnostic squares now that the real BlurView glass on Card/TabBar/
   TopHeader has been verified working. */
export default function AmbientBackground() {
  return (
    <LinearGradient
      pointerEvents="none"
      colors={['#E7F6EF', '#CBEBDA', '#F6FBF8']}
      locations={[0, 0.5, 1]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={StyleSheet.absoluteFill}
    />
  );
}
