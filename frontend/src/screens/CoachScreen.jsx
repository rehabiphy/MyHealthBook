import React, { useEffect, useRef, useState } from 'react';
import { Animated, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import Svg, { Path } from 'react-native-svg';
import { C } from '../theme/colors';
import { GRAD } from '../theme/gradients';
import { SANS } from '../theme/typography';
import { sendToCoach } from '../lib/coach';
import { useData } from '../state/DataContext';
import { useAuth } from '../state/AuthContext';
import Mono from '../components/atoms/Mono';
import Press from '../components/atoms/Press';

const PROMPTS = [
  'Plan a low-salt day of meals for me',
  'Better evening snacks than namkeen',
  'What to eat before a fasting sugar test',
  'How much walking do I need this week?',
  'A 20-minute workout I can do at home',
  'Strength exercises without any gym',
];

function TypingDots() {
  const dots = [useRef(new Animated.Value(0.25)).current, useRef(new Animated.Value(0.25)).current, useRef(new Animated.Value(0.25)).current];
  useEffect(() => {
    const anims = dots.map((v, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 140),
          Animated.timing(v, { toValue: 1, duration: 500, useNativeDriver: true }),
          Animated.timing(v, { toValue: 0.25, duration: 500, useNativeDriver: true }),
        ]),
      ),
    );
    anims.forEach(a => a.start());
    return () => anims.forEach(a => a.stop());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <View style={styles.dotsRow}>
      {dots.map((v, i) => (
        <Animated.View key={i} style={[styles.dot, { opacity: v }]} />
      ))}
    </View>
  );
}

export default function CoachScreen() {
  const { data, setData } = useData();
  const { token } = useAuth();
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef(null);
  const insets = useSafeAreaInsets();
  const msgs = data.chat;

  useEffect(() => {
    const t = setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 60);
    return () => clearTimeout(t);
  }, [msgs.length, busy]);

  const send = async text => {
    const q = (text ?? input).trim();
    if (!q || busy) return;
    const next = [...msgs, { role: 'user', content: q }];
    setData(d => ({ ...d, chat: next }));
    setInput('');
    setBusy(true);
    try {
      const reply = await sendToCoach(next, token);
      setData(d => ({ ...d, chat: [...next, { role: 'assistant', content: reply }] }));
    } catch (err) {
      setData(d => ({ ...d, chat: [...next, { role: 'assistant', content: err.message }] }));
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={insets.top}>
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.h1}>AI coach</Text>
            <Mono style={{ marginTop: 4 }}>Reads your numbers · food, movement, habits</Mono>
          </View>
          {msgs.length > 0 && (
            <Press onPress={() => setData(d => ({ ...d, chat: [] }))} style={styles.clearBtn}>
              <Text style={styles.clearLabel}>Clear</Text>
            </Press>
          )}
        </View>
      </View>

      <ScrollView ref={scrollRef} style={{ flex: 1 }} contentContainerStyle={styles.body}>
        {msgs.length === 0 && (
          <>
            <View style={styles.introCard}>
              <Text style={styles.introText}>Ask about meals, portions, salt, snacks, walking, workouts or sleep. The more you record, the more the answers are about you and not about everyone.</Text>
            </View>
            {PROMPTS.map(p => (
              <Press key={p} onPress={() => send(p)} style={styles.promptBtn}>
                <Text style={styles.promptLabel}>{p}</Text>
                <Svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={C.ink3} strokeWidth="2" strokeLinecap="round">
                  <Path d="M9 6l6 6-6 6" />
                </Svg>
              </Press>
            ))}
          </>
        )}

        {msgs.map((m, i) => (
          <View key={i} style={[styles.bubbleRow, { justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start' }]}>
            {m.role === 'user' ? (
              <LinearGradient colors={GRAD.colors} start={GRAD.start} end={GRAD.end} style={[styles.bubble, styles.bubbleUser]}>
                <Text style={styles.bubbleTextUser}>{m.content}</Text>
              </LinearGradient>
            ) : (
              <View style={[styles.bubble, styles.bubbleAssistant]}>
                <Text style={styles.bubbleTextAssistant}>{m.content}</Text>
              </View>
            )}
          </View>
        ))}

        {busy && <TypingDots />}
      </ScrollView>

      <View style={[styles.inputBar, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        <View style={styles.inputRow}>
          <TextInput
            value={input}
            onChangeText={setInput}
            onSubmitEditing={() => send()}
            placeholder="Ask about food, exercise or habits"
            placeholderTextColor={C.ink3}
            style={styles.input}
          />
          <Press onPress={() => send()} disabled={busy || !input.trim()} style={styles.sendBtn}>
            <LinearGradient colors={GRAD.colors} start={GRAD.start} end={GRAD.end} style={StyleSheet.absoluteFill} />
            <Svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <Path d="M12 19V5M5 12l7-7 7 7" />
            </Svg>
          </Press>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: C.hair },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  h1: { fontFamily: SANS.bold, fontSize: 22, letterSpacing: -0.75, color: C.ink },
  clearBtn: { borderWidth: 1, borderColor: C.hair, backgroundColor: C.card, borderRadius: 999, paddingVertical: 7, paddingHorizontal: 13 },
  clearLabel: { fontFamily: SANS.medium, fontSize: 13, letterSpacing: 0.6, textTransform: 'uppercase', color: C.ink2 },
  body: { padding: 16, paddingBottom: 150 },
  introCard: { backgroundColor: C.panelSoft, borderRadius: 18, padding: 18, marginBottom: 14 },
  introText: { fontFamily: SANS.regular, fontSize: 15, color: C.onPanel2, lineHeight: 23 },
  promptBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.hair,
    borderRadius: 16,
    paddingVertical: 15,
    paddingHorizontal: 17,
    marginBottom: 8,
  },
  promptLabel: { flex: 1, fontFamily: SANS.regular, fontSize: 14.5, color: C.ink },
  bubbleRow: { flexDirection: 'row', marginBottom: 10 },
  bubble: { maxWidth: '86%', paddingVertical: 14, paddingHorizontal: 16, borderRadius: 18 },
  bubbleUser: { borderBottomRightRadius: 6 },
  bubbleAssistant: { backgroundColor: C.card, borderWidth: 1, borderColor: C.hair, borderBottomLeftRadius: 6 },
  bubbleTextUser: { fontFamily: SANS.regular, fontSize: 14.5, lineHeight: 23, color: '#FFFFFF' },
  bubbleTextAssistant: { fontFamily: SANS.regular, fontSize: 14.5, lineHeight: 23, color: C.ink2 },
  dotsRow: { flexDirection: 'row', gap: 4, paddingVertical: 6, paddingHorizontal: 4 },
  dot: { width: 6, height: 6, borderRadius: 99, backgroundColor: C.ink3 },
  inputBar: { paddingHorizontal: 16, paddingTop: 10, backgroundColor: C.paper },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(22,36,28,0.04)',
    borderWidth: 1,
    borderColor: C.hair,
    borderRadius: 16,
    paddingVertical: 5,
    paddingLeft: 16,
    paddingRight: 5,
  },
  input: { flex: 1, fontFamily: SANS.regular, fontSize: 15, color: C.ink, paddingVertical: 10 },
  sendBtn: { width: 42, height: 42, borderRadius: 13, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
});
