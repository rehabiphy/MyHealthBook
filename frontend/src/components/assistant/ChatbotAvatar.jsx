import React from 'react';
import { Image, View } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { C } from '../../theme/colors';

/* The AI chat's face — on the floating chat button and the chat page
   header. A picture when one is set here (white background, one robot);
   null falls back to the drawn robot below. */
const CHATBOT_LOGO = require('../../../assets/images/chatbotLogo.jpeg');
// the picture is portrait, so it's fitted whole inside the circle (antenna and shoulders kept) rather than cropped
const LOGO_SCALE = 0.84;

const LINE = C.brand2;
const FILL = C.panelSoft;

// a friendly robot: antenna, a screen for a face, a smile, shoulders — drawn on a 64-unit grid
function Robot({ size }) {
  const s = { stroke: LINE, strokeWidth: 2.6, strokeLinecap: 'round', strokeLinejoin: 'round' };
  return (
    <Svg width={size} height={size} viewBox="0 0 64 64">
      <Circle cx="32" cy="32" r="32" fill="#FFFFFF" />
      <Path {...s} d="M13 62c1.5-10.5 9-16.5 19-16.5S49.5 51.5 51 62" fill={FILL} />
      <Path {...s} d="M32 11.5v4" fill="none" />
      <Circle {...s} cx="32" cy="8.5" r="3" fill={FILL} />
      <Rect {...s} x="11.5" y="24" width="6" height="11" rx="3" fill="#FFFFFF" />
      <Rect {...s} x="46.5" y="24" width="6" height="11" rx="3" fill="#FFFFFF" />
      <Rect {...s} x="16" y="15.5" width="32" height="28" rx="11" fill="#FFFFFF" />
      <Rect {...s} x="21" y="20.5" width="22" height="17" rx="6" fill={FILL} />
      <Circle cx="27" cy="27.5" r="2.2" fill={LINE} />
      <Circle cx="37" cy="27.5" r="2.2" fill={LINE} />
      <Path {...s} d="M28.2 31.8c1.7 2 5.9 2 7.6 0" fill="none" />
    </Svg>
  );
}

export default function ChatbotAvatar({ size = 40, style }) {
  return (
    <View style={[{ width: size, height: size, borderRadius: size / 2, overflow: 'hidden', backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' }, style]}>
      {CHATBOT_LOGO ? <Image source={CHATBOT_LOGO} style={{ width: size * LOGO_SCALE, height: size * LOGO_SCALE }} resizeMode="contain" accessibilityIgnoresInvertColors /> : <Robot size={size} />}
    </View>
  );
}
