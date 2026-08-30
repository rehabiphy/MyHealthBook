import React from 'react';
import { StyleSheet, useWindowDimensions } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, RadialGradient, Rect, Stop } from 'react-native-svg';

/* Ambient light — soft colour blooms behind the glass, replacing the
   web app's stacked CSS `radial-gradient` backdrop (which react-native-
   linear-gradient can't express — it's linear-only — so this composites
   the same look with react-native-svg's <RadialGradient> instead). */
const BLOOMS = [
  { xPct: 0.12, yPct: -0.08, r: 380, rgb: '139,92,246', opacity: 0.75 },
  { xPct: 1.04, yPct: 0.08, r: 310, rgb: '236,72,153', opacity: 0.42 },
  { xPct: 0.92, yPct: 0.88, r: 340, rgb: '56,189,248', opacity: 0.32 },
  { xPct: -0.1, yPct: 0.96, r: 280, rgb: '167,139,250', opacity: 0.4 },
];

export default function AmbientBackground() {
  const { width, height } = useWindowDimensions();

  return (
    <Svg style={StyleSheet.absoluteFill} width={width} height={height} pointerEvents="none">
      <Defs>
        <LinearGradient id="base" x1="15%" y1="0%" x2="85%" y2="100%">
          <Stop offset="0%" stopColor="#3B1E8F" />
          <Stop offset="46%" stopColor="#2B1B63" />
          <Stop offset="100%" stopColor="#1E1B4B" />
        </LinearGradient>
        {BLOOMS.map((b, i) => (
          <RadialGradient key={i} id={`bloom${i}`} cx="50%" cy="50%" r="50%">
            <Stop offset="0%" stopColor={`rgb(${b.rgb})`} stopOpacity={b.opacity} />
            <Stop offset="100%" stopColor={`rgb(${b.rgb})`} stopOpacity={0} />
          </RadialGradient>
        ))}
      </Defs>
      <Rect x={0} y={0} width={width} height={height} fill="url(#base)" />
      {BLOOMS.map((b, i) => (
        <Circle key={i} cx={width * b.xPct} cy={height * b.yPct} r={b.r} fill={`url(#bloom${i})`} />
      ))}
    </Svg>
  );
}
