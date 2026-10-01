import React from 'react';
import { StyleSheet } from 'react-native';
import { C } from '../../theme/colors';
import Press from '../atoms/Press';
import ChatbotAvatar from './ChatbotAvatar';

/* One tap into the AI chat (the Coach page), stacked just above the
   voice orb — typing a question shouldn't mean finding Coach on Home
   first. Smaller than the orb and wearing the chat's robot face, so the
   mic stays the main thing and the two don't read as one button. */
export default function ChatFab({ onPress, style, size = 48 }) {
  return (
    <Press onPress={onPress} style={[styles.fab, { width: size, height: size, borderRadius: size / 2 }, style]} accessibilityRole="button" accessibilityLabel="Chat with MyHealth AI" hitSlop={6}>
      <ChatbotAvatar size={size - 4} />
    </Press>
  );
}

const styles = StyleSheet.create({
  fab: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: C.brand,
    shadowColor: '#16A34A',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
});
