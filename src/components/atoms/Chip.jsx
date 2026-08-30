import React from 'react';
import { View } from 'react-native';

/* A tinted glyph chip — the small round icon on each stat tile. */
export default function Chip({ color, children, size = 34 }) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: 999,
        backgroundColor: `${color}30`,
        borderWidth: 1,
        borderColor: `${color}55`,
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}>
      {children}
    </View>
  );
}
