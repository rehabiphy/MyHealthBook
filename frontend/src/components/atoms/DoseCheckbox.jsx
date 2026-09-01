import React from 'react';
import { View } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Svg, { Path } from 'react-native-svg';
import { C } from '../../theme/colors';
import { GRAD_MINT } from '../../theme/gradients';
import Press from './Press';

/* The round "mark taken" checkbox used on Home's today list and the
   Meds schedule — mint gradient fill with a check when done. */
export default function DoseCheckbox({ done, onPress, size = 30 }) {
  const circleStyle = { width: size, height: size, borderRadius: 999, alignItems: 'center', justifyContent: 'center' };
  return (
    <Press onPress={onPress} accessibilityLabel="mark taken" style={circleStyle}>
      {done ? (
        <LinearGradient colors={GRAD_MINT.colors} start={GRAD_MINT.start} end={GRAD_MINT.end} style={[circleStyle, { position: 'absolute' }]}>
          <Svg width={size * 0.5} height={size * 0.5} viewBox="0 0 24 24" fill="none" stroke="#08221A" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round">
            <Path d="M5 13l4 4L19 7" />
          </Svg>
        </LinearGradient>
      ) : (
        <View style={[circleStyle, { position: 'absolute', backgroundColor: 'rgba(22,36,28,0.05)', borderWidth: 1.5, borderColor: C.hair }]} />
      )}
    </Press>
  );
}
