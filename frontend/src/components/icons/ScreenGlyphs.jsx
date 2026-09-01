import React from 'react';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

/* Screen glyphs, reused in headers so a screen is recognisable before
   the title is read. Called as G.readings(color), matching the
   original web app's calling convention. */
export const G = {
  readings: c => (
    <Svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <Path d="M4 17.5l4.5-5 3.2 3 4.3-6 4 4.4" />
      <Path d="M4 20.5h16" />
    </Svg>
  ),
  records: c => (
    <Svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <Path d="M6 3.8h8.2L18.5 8v12.2H6z" />
      <Path d="M14 3.8V8h4.4M9 12h6M9 15.5h4" />
    </Svg>
  ),
  meds: c => (
    <Svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <Rect x="2.8" y="8.6" width="18.4" height="6.8" rx="3.4" transform="rotate(-45 12 12)" />
      <Path d="M9.6 9.6l4.8 4.8" />
    </Svg>
  ),
  health: c => (
    <Svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <Path d="M20 11.2c0 4.2-8 8.8-8 8.8s-8-4.6-8-8.8A3.6 3.6 0 0 1 12 8.6a3.6 3.6 0 0 1 8 2.6z" />
      <Path d="M7.5 12.4h2.2l1.2-2 1.7 3.4 1.1-1.4h2.6" />
    </Svg>
  ),
  me: c => (
    <Svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <Circle cx="12" cy="8.6" r="3.3" />
      <Path d="M5.5 19.5c1.3-3.2 3.8-4.8 6.5-4.8s5.2 1.6 6.5 4.8" />
    </Svg>
  ),
  learn: c => (
    <Svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <Path d="M4 5.5h6.5A1.5 1.5 0 0 1 12 7v11a1.2 1.2 0 0 0-1.2-1.2H4zM20 5.5h-6.5A1.5 1.5 0 0 0 12 7v11a1.2 1.2 0 0 1 1.2-1.2H20z" />
    </Svg>
  ),
  coach: c => (
    <Svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <Path d="M4 6.5h16v9H10l-4.5 3.5v-3.5H4z" />
    </Svg>
  ),
};

export const GaugeGlyph = ({ c }) => (
  <Svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.9" strokeLinecap="round">
    <Circle cx="12" cy="12" r="8" />
    <Path d="M12 12l3.5-2.5" />
  </Svg>
);

export const PulseGlyph = ({ c }) => (
  <Svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
    <Path d="M20 11.2c0 4.2-8 8.8-8 8.8s-8-4.6-8-8.8A3.6 3.6 0 0 1 12 8.6a3.6 3.6 0 0 1 8 2.6z" />
    <Path d="M7.5 12.4h2.2l1.2-2 1.7 3.4 1.1-1.4h2.6" />
  </Svg>
);
