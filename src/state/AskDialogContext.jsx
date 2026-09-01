import React, { createContext, useContext, useRef, useState } from 'react';
import { Animated, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { C } from '../theme/colors';
import { SANS } from '../theme/typography';
import Btn from '../components/atoms/Btn';
import Rise from '../components/atoms/Rise';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/* Native confirm()/prompt() don't exist on RN — this is a global
   `ask(opts)` dialog any screen can await, replacing the web app's
   useAsk() hook (it noted native confirm/prompt get silently blocked
   in some WebViews; here there's simply no such API to begin with). */
const AskContext = createContext(null);

export function AskDialogProvider({ children }) {
  const [q, setQ] = useState(null);
  const [val, setVal] = useState('');
  const resolve = useRef(null);

  const ask = opts =>
    new Promise(res => {
      resolve.current = res;
      setVal(opts.defaultValue || '');
      setQ(opts);
    });

  const close = result => {
    const r = resolve.current;
    resolve.current = null;
    setQ(null);
    setVal('');
    r?.(result);
  };

  return (
    <AskContext.Provider value={ask}>
      {children}
      <Modal visible={!!q} transparent animationType="fade" onRequestClose={() => close(null)}>
        <Pressable style={styles.backdrop} onPress={() => close(null)}>
          <Pressable onPress={() => {}} style={styles.sheetOuter}>
            <Rise style={styles.sheet}>
              <View style={styles.content}>
                <Text style={styles.title}>{q?.title}</Text>
                {q?.body ? <Text style={styles.body}>{q.body}</Text> : null}
                {q?.input ? (
                  <TextInput
                    value={val}
                    autoFocus
                    placeholder={q?.placeholder || ''}
                    placeholderTextColor={C.ink3}
                    onChangeText={setVal}
                    onSubmitEditing={() => close(val)}
                    style={styles.input}
                  />
                ) : null}
                <View style={styles.actions}>
                  <Btn kind="quiet" style={styles.actionBtn} onClick={() => close(null)}>
                    {q?.cancelLabel || 'Cancel'}
                  </Btn>
                  <ConfirmButton danger={q?.danger} onPress={() => close(q?.input ? val || '' : true)}>
                    {q?.confirmLabel || 'Confirm'}
                  </ConfirmButton>
                </View>
              </View>
            </Rise>
          </Pressable>
        </Pressable>
      </Modal>
    </AskContext.Provider>
  );
}

/* The confirm action in the original is a plain solid colour (panel,
   or crisis-red for a destructive action) rather than the app's usual
   gradient button — kept as a small local button instead of stretching
   the Btn atom's API for this one case. */
function ConfirmButton({ danger, onPress, children }) {
  const scale = useRef(new Animated.Value(1)).current;
  const onPressIn = () => Animated.timing(scale, { toValue: 0.97, duration: 120, useNativeDriver: true }).start();
  const onPressOut = () => Animated.timing(scale, { toValue: 1, duration: 120, useNativeDriver: true }).start();
  return (
    <AnimatedPressable
      onPress={onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      style={[styles.actionBtn, styles.confirmBtn, { backgroundColor: danger ? C.stage2 : C.brand, transform: [{ scale }] }]}>
      <Text style={styles.confirmLabel}>{children}</Text>
    </AnimatedPressable>
  );
}

export function useAsk() {
  const ctx = useContext(AskContext);
  if (!ctx) throw new Error('useAsk must be used inside <AskDialogProvider>');
  return ctx;
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(10,20,15,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  sheetOuter: {
    width: '100%',
    maxWidth: 430,
  },
  sheet: {
    width: '100%',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: C.hair,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.97)',
  },
  content: {
    padding: 22,
  },
  title: {
    fontFamily: SANS.bold,
    fontSize: 20,
    letterSpacing: -0.6,
    lineHeight: 26,
    color: C.ink,
  },
  body: {
    fontFamily: SANS.regular,
    fontSize: 15,
    color: C.ink2,
    marginTop: 10,
    lineHeight: 23,
  },
  input: {
    width: '100%',
    marginTop: 16,
    borderWidth: 1,
    borderColor: C.hair,
    borderRadius: 14,
    paddingVertical: 15,
    paddingHorizontal: 14,
    fontFamily: SANS.regular,
    fontSize: 16,
    color: C.ink,
    backgroundColor: 'rgba(22,36,28,0.05)',
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 20,
  },
  actionBtn: {
    flex: 1,
    paddingVertical: 16,
  },
  confirmBtn: {
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmLabel: {
    fontFamily: SANS.semibold,
    fontSize: 16,
    color: '#FFFFFF',
  },
});
