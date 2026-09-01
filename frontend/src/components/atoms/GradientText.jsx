import React from 'react';
import { Text } from 'react-native';
import MaskedView from '@react-native-masked-view/masked-view';
import LinearGradient from 'react-native-linear-gradient';
import { GRAD } from '../../theme/gradients';

/* Reproduces the web app's `background-clip: text` gradient headings
   (Home greeting, the sticky header's app name). */
export default function GradientText({ children, style, gradient = GRAD }) {
  return (
    <MaskedView maskElement={<Text style={style}>{children}</Text>}>
      <LinearGradient colors={gradient.colors} start={gradient.start} end={gradient.end}>
        <Text style={[style, { opacity: 0 }]}>{children}</Text>
      </LinearGradient>
    </MaskedView>
  );
}
