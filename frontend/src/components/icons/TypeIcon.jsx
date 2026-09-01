import React from 'react';
import Svg, { G, Path, Rect } from 'react-native-svg';
import { normType } from '../../lib/history';

export default function TypeIcon({ k, color }) {
  const s = { fill: 'none', stroke: color, strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round' };

  const shapes = {
    test: (
      <G>
        <Path {...s} d="M10 3.5v6L5.6 17a2 2 0 0 0 1.7 3h9.4a2 2 0 0 0 1.7-3L14 9.5v-6" />
        <Path {...s} d="M9 3.5h6M8.3 14h7.4" />
      </G>
    ),
    diagnosis: (
      <G>
        <Rect {...s} x="5" y="4.5" width="14" height="16" rx="2.5" />
        <Path {...s} d="M9 4.5h6v2.5H9zM8.5 12.5h2l1.2-2 1.6 3.5 1-1.5h2.2" />
      </G>
    ),
    treatment: (
      <G>
        <Rect {...s} x="2.8" y="8.6" width="18.4" height="6.8" rx="3.4" transform="rotate(-45 12 12)" />
        <Path {...s} d="M9.6 9.6l4.8 4.8" />
      </G>
    ),
    procedure: (
      <G>
        <Path {...s} d="M19.5 4.5l-9 9M13.5 10.5l-6.8 6.8a2.4 2.4 0 1 1-2.4-2.4l6.8-6.8" />
        <Path {...s} d="M16 8l3.5-3.5" />
      </G>
    ),
    other: (
      <G>
        <Path {...s} d="M6 4.5h8.5L19 9v10.5H6z" />
        <Path {...s} d="M14 4.5V9h5M9 13h6M9 16.5h4" />
      </G>
    ),
  };

  return (
    <Svg width="24" height="24" viewBox="0 0 24 24">
      {shapes[normType(k)] || shapes.other}
    </Svg>
  );
}
