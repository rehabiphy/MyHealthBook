import React from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { C } from '../../theme/colors';
import { SANS } from '../../theme/typography';
import { CloseButton } from './Screen';

/* A bottom sheet for a focused task (add a reading…): slides up over
   the page, title and ✕ on top, and always clear of the system
   navigation bar at the bottom. Tapping outside closes it. */
export default function Sheet({ visible, title, subtitle, onClose, children, footer }) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" statusBarTranslucent navigationBarTranslucent onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close" />
        <View style={[styles.sheet, { paddingBottom: insets.bottom + 12, maxHeight: '92%' }]}>
          <View style={styles.grabber} />
          <View style={styles.head}>
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>{title}</Text>
              {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
            </View>
            <CloseButton onPress={onClose} />
          </View>
          <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled" bounces={false}>
            {children}
          </ScrollView>
          {footer ? <View style={styles.footer}>{footer}</View> : null}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(10,20,15,0.5)' },
  sheet: { backgroundColor: C.cardSolid, borderTopLeftRadius: 28, borderTopRightRadius: 28 },
  grabber: { alignSelf: 'center', width: 44, height: 5, borderRadius: 3, backgroundColor: C.hair, marginTop: 10 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingTop: 12, paddingBottom: 8 },
  title: { fontFamily: SANS.bold, fontSize: 22, letterSpacing: -0.6, color: C.ink },
  subtitle: { fontFamily: SANS.regular, fontSize: 15, color: C.ink2, marginTop: 2 },
  body: { paddingHorizontal: 20, paddingBottom: 8 },
  footer: { paddingHorizontal: 20, paddingTop: 10 },
});
