import React from 'react';
import Svg, { Circle, G, Path, Rect } from 'react-native-svg';
import { C } from '../../theme/colors';

/* Tab-bar icons — same 20/24 glyph set as the header icons, but with
   an on/off stroke colour driven by whether the tab is active. */
export default function Ico({ name, on }) {
  const s = { fill: 'none', stroke: on ? '#FFFFFF' : C.ink3, strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round' };

  const shapes = {
    home: (
      <G>
        <Circle {...s} cx="12" cy="12" r="8" />
        <Path {...s} d="M12 12l4-3" />
      </G>
    ),
    log: (
      <G>
        <Path {...s} d="M4 17.5l4.5-5 3.2 3 4.3-6 4 4.4" />
        <Path {...s} d="M4 20.5h16" />
      </G>
    ),
    meds: (
      <G>
        <Rect {...s} x="2.6" y="8.6" width="18.8" height="6.8" rx="3.4" transform="rotate(-45 12 12)" />
        <Path {...s} d="M9.6 9.6l4.8 4.8" />
      </G>
    ),
    health: (
      <G>
        <Path {...s} d="M12 20s-7-4.4-7-9.3A3.9 3.9 0 0 1 12 8a3.9 3.9 0 0 1 7 2.7C19 15.6 12 20 12 20z" />
        <Path {...s} d="M8 12.5h2l1.2-2 1.6 3.2 1-1.2h2.2" />
      </G>
    ),
    history: (
      <G>
        <Path {...s} d="M6 3.8h8.2L18.5 8v12.2H6z" />
        <Path {...s} d="M14 3.8V8h4.4M9 12h6M9 15.5h4" />
      </G>
    ),
    coach: (
      <G>
        <Path {...s} d="M4 6.5h16v9H10l-4.5 3.5v-3.5H4z" />
      </G>
    ),
    learn: (
      <G>
        <Path {...s} d="M4 5.5h6.5a1.5 1.5 0 0 1 1.5 1.5v11a1.2 1.2 0 0 0-1.2-1.2H4zM20 5.5h-6.5A1.5 1.5 0 0 0 12 7v11a1.2 1.2 0 0 1 1.2-1.2H20z" />
      </G>
    ),
    family: (
      <G>
        <Circle {...s} cx="9" cy="9" r="3" />
        <Circle {...s} cx="16.5" cy="10.5" r="2.2" />
        <Path {...s} d="M3.5 19c1-2.6 3-4 5.5-4s4.5 1.4 5.5 4M16 14.2c2 .2 3.5 1.5 4.3 3.4" />
      </G>
    ),
    me: (
      <G>
        <Circle {...s} cx="12" cy="8.6" r="3.3" />
        <Path {...s} d="M5.5 19.5c1.3-3.2 3.8-4.8 6.5-4.8s5.2 1.6 6.5 4.8" />
      </G>
    ),
  };

  return (
    <Svg width="20" height="20" viewBox="0 0 24 24">
      {shapes[name]}
    </Svg>
  );
}
