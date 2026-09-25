import React from 'react';
import { StyleSheet, View } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Svg, { Path } from 'react-native-svg';
import { GRAD } from '../../theme/gradients';
import Press from '../atoms/Press';

/* Floating shortcut to the AI coach chat. Sits in the bottom-right
   corner with the MyHealth AI voice orb stacked above it — chat to
   talk things through, the orb to speak a quick command. */
export default function CoachFab({ onPress, style, size = 56 }) {
  return (
    <View style={[{ width: size, height: size }, style]} pointerEvents="box-none">
      <Press onPress={onPress} style={[styles.fab, { borderRadius: size / 2 }]} accessibilityRole="button" accessibilityLabel="Open AI coach chat">
        <LinearGradient colors={GRAD.colors} start={GRAD.start} end={GRAD.end} style={StyleSheet.absoluteFill} />
        <Svg width={size * 0.44} height={size * 0.44} viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <Path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z" />
          <Path d="M8.5 11h.01M12 11h.01M15.5 11h.01" strokeWidth="2.6" />
        </Svg>
      </Press>
    </View>
  );
}

const styles = StyleSheet.create({
  fab: {
    flex: 1,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#16A34A',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 9,
  },
});
