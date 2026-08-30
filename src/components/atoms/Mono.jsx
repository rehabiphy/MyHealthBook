import React from 'react';
import { Text } from 'react-native';
import { C } from '../../theme/colors';
import { monoCaption } from '../../theme/typography';

/* The small uppercase mono caption used for labels, timestamps and
   units throughout the app — its signature typographic voice. */
export default function Mono({ children, style }) {
  return <Text style={[monoCaption, { color: C.ink3 }, style]}>{children}</Text>;
}
