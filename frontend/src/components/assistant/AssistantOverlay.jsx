import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BlurView } from '@react-native-community/blur';
import LinearGradient from 'react-native-linear-gradient';
import Svg, { Path, Rect } from 'react-native-svg';
import { C } from '../../theme/colors';
import { GRAD } from '../../theme/gradients';
import { MONO, SANS } from '../../theme/typography';
import { useData } from '../../state/DataContext';
import { useAuth } from '../../state/AuthContext';
import * as assistantApi from '../../lib/assistantApi';
import { parseCommand, plausible } from '../../lib/assistant/parse';
import { answerDoseStatus, answerMeds, answerTrend, dosesToMark, readingAlert } from '../../lib/assistant/answers';
import useSpeech from '../../lib/assistant/useSpeech';
import { LANG_KEY } from '../../lib/assistant/speak';
import { SLOTS, prettyTime, slotOf } from '../../lib/meds';
import Press from '../atoms/Press';
import GlowBorder, { GLOW_COLORS } from './GlowBorder';
import { MicIcon } from './AssistantOrb';

const LANGS = [
  { key: 'en-IN', label: 'English' },
  { key: 'hi-IN', label: 'हिंदी' },
];

/* Examples and screen text follow the chosen speech language. Every
   Hindi example is phrased the way Google's hi-IN recogniser writes
   it out, and is covered by lib/assistant/parse.js — so tapping or
   saying one always works, even offline. */
const UI = {
  'en-IN': {
    examples: [
      'My BP is 140 over 90',
      'Sugar 110 fasting',
      'Add Metformin 500 mg twice a day',
      'I took my morning medicine',
      'What medicines tonight?',
      'Show my BP for the last 7 days',
    ],
    trySaying: 'Try saying',
    listening: 'Listening…',
    thinking: 'Thinking…',
    tapAndSpeak: 'Tap the mic and speak',
    typeInstead: 'Type what you want to record',
    tapToSpeak: 'Tap to speak',
    tapWhenDone: 'Tap when you finish',
    orType: 'Or type here',
    typeExample: 'e.g. My BP is 140 over 90',
    retry: 'Tap the mic to try again, or type below.',
  },
  'hi-IN': {
    examples: [
      'मेरा बीपी 140 बटा 90 है',
      'शुगर 110 खाली पेट',
      'दवाई जोड़ो मेटफॉर्मिन 500 एमजी सुबह शाम',
      'मैंने सुबह की दवाई ले ली',
      'आज रात कौन सी दवाई लेनी है',
      'पिछले 7 दिन का बीपी दिखाओ',
    ],
    trySaying: 'ऐसे बोलें',
    listening: 'सुन रहा हूँ…',
    thinking: 'समझ रहा हूँ…',
    tapAndSpeak: 'माइक दबाएँ और बोलें',
    typeInstead: 'जो दर्ज करना है, लिखें',
    tapToSpeak: 'बोलने के लिए दबाएँ',
    tapWhenDone: 'बोलना खत्म हो तो दबाएँ',
    orType: 'या यहाँ लिखें',
    typeExample: 'जैसे: मेरा बीपी 140 बटा 90 है',
    retry: 'फिर से कोशिश करने के लिए माइक दबाएँ, या नीचे लिखें।',
  },
};

const TONE = {
  good: { bg: 'rgba(22,163,74,0.12)', fg: C.normal },
  warn: { bg: 'rgba(217,119,6,0.13)', fg: '#92400E' },
  danger: { bg: 'rgba(225,29,72,0.12)', fg: C.crisis },
};

const MED_TIME_PRESETS = [
  { label: 'Morning', slots: ['breakfast'] },
  { label: 'Night', slots: ['dinner'] },
  { label: 'Morning + night', slots: ['breakfast', 'dinner'] },
  { label: '3 times a day', slots: ['breakfast', 'lunch', 'dinner'] },
  { label: 'Bedtime', slots: ['bed'] },
];

const YES = /^\s*(yes|yeah|yep|save|save it|add|add it|ok|okay|confirm|correct|haan|han|ha|theek hai|हाँ|हां|ठीक है)\b/i;

const bpText = i => `${i.sys}/${i.dia}${i.pulse ? `, pulse ${i.pulse}` : ''}`;
const sugarText = i => `${i.mgdl} mg/dL ${i.sugarKind === 'fasting' ? 'fasting' : 'after a meal'}`;

/* MyHealth AI. Opens over whatever screen is showing, lights the
   edges of the phone, and starts listening straight away.

   Every command goes: on-device rules (lib/assistant/parse.js) →
   backend LLM only if the rules didn't understand → act.
   Writes follow one policy:
   · rule-parsed and plausible → saved at once, with Undo;
   · LLM-parsed, or an unusual number → shown first, saved on "Save".
   The AI never changes medicines; it can only mark a dose as taken. */
export default function AssistantOverlay({ visible, onClose, go }) {
  const { data, addBpReading, addSugarReading, addBodyReading, deleteReading, toggleDoseTaken, addMedicine, deleteMedicine } = useData();
  const { token } = useAuth();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();

  const [lang, setLangState] = useState('en-IN');
  const ui = UI[lang];

  // the chosen language is remembered, so a Hindi speaker picks it once
  useEffect(() => {
    AsyncStorage.getItem(LANG_KEY)
      .then(v => v && UI[v] && setLangState(v))
      .catch(() => {});
  }, []);
  const relisten = useRef(false);
  const setLang = v => {
    if (v === lang) return;
    // switching mid-listen restarts the recogniser in the new language
    if (speech.listening) {
      speech.cancel();
      relisten.current = true;
    }
    setLangState(v);
    AsyncStorage.setItem(LANG_KEY, v).catch(() => {});
  };
  const [busy, setBusy] = useState(false);
  const [heard, setHeard] = useState('');
  const [result, setResult] = useState(null);
  const [pending, setPending] = useState(null);
  const [typed, setTyped] = useState('');
  const viaVoice = useRef(false);
  const session = useRef(0); // bumps on open/close so late replies from a closed session are dropped

  const speech = useSpeech({
    locale: lang,
    onFinal: text => {
      viaVoice.current = true;
      handle(text);
    },
    onError: msg => setResult({ say: msg, sub: UI[lang].retry }),
  });

  useEffect(() => {
    if (!relisten.current) return undefined;
    relisten.current = false;
    const t = setTimeout(() => speech.start(), 300); // this render's start() carries the new locale
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang]);

  const appear = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(appear, { toValue: visible ? 1 : 0, duration: 380, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
    session.current += 1;
    if (!visible) {
      speech.cancel();
      return undefined;
    }
    setHeard('');
    setResult(null);
    setPending(null);
    setTyped('');
    setBusy(false);
    const t = setTimeout(() => speech.available && speech.start(), 380);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const close = () => {
    speech.cancel();
    onClose();
  };

  const listenAgain = () => {
    if (viaVoice.current && speech.available) setTimeout(() => speech.start(), 700);
  };

  // ---- actions ----

  const ask = (question, next, quick) => {
    setPending(next);
    setResult({ say: question, quick });
    listenAgain();
  };

  const guarded = async fn => {
    const id = session.current;
    setBusy(true);
    try {
      await fn(() => id === session.current);
    } catch (err) {
      if (id === session.current) setResult({ say: err.message || 'Something went wrong. Please try again.', tone: 'warn' });
    } finally {
      if (id === session.current) setBusy(false);
    }
  };

  const save = intent =>
    guarded(async alive => {
      setPending(null);
      let reading;
      let type;
      let label;
      if (intent.intent === 'log_bp') {
        reading = await addBpReading({ sys: intent.sys, dia: intent.dia, ...(intent.pulse ? { pulse: intent.pulse } : {}) });
        type = 'bp';
        label = `BP ${bpText(intent)}`;
      } else if (intent.intent === 'log_sugar') {
        reading = await addSugarReading({ mgdl: intent.mgdl, kind: intent.sugarKind });
        type = 'sugar';
        label = `Sugar ${sugarText(intent)}`;
      } else {
        reading = await addBodyReading({ weightKg: intent.weightKg, heightCm: data.profile.heightCm });
        type = 'body';
        label = `Weight ${intent.weightKg} kg`;
      }
      if (!alive()) return;
      const alert = readingAlert(intent);
      setResult({
        say: `Saved. ${label} recorded for today.`,
        tone: alert ? 'warn' : 'good',
        note: alert,
        actions: [
          {
            label: 'Undo',
            onPress: () =>
              guarded(async () => {
                await deleteReading(type, reading.id);
                setResult({ say: 'Okay, I removed that reading.' });
              }),
          },
          { label: 'Done', primary: true, onPress: close },
        ],
      });
    });

  /* Rule-parsed + plausible → save straight away (Undo is offered).
     Anything the LLM extracted, or an odd number, is confirmed first. */
  const saveOrConfirm = (intent, source) => {
    const fields = intent.intent === 'log_bp' ? ['sys', 'dia', ...(intent.pulse ? ['pulse'] : [])] : intent.intent === 'log_sugar' ? ['mgdl'] : ['weightKg'];
    const odd = fields.some(f => !plausible(f, intent[f])) || (intent.intent === 'log_bp' && intent.sys <= intent.dia);
    if (source === 'rules' && !odd) return save(intent);

    const what =
      intent.intent === 'log_bp' ? `BP ${bpText(intent)}` : intent.intent === 'log_sugar' ? `sugar ${sugarText(intent)}` : `weight ${intent.weightKg} kg`;
    setPending(null);
    setResult({
      say: `Save ${what}?`,
      note: odd ? 'This number looks unusual. Please check it before saving.' : null,
      tone: odd ? 'warn' : null,
      actions: [
        { label: 'Cancel', onPress: () => setResult({ say: 'Okay, not saved.' }) },
        { label: 'Save', primary: true, onPress: () => save(intent) },
      ],
    });
  };

  const markTaken = doses =>
    guarded(async alive => {
      for (const d of doses) await toggleDoseTaken(d.id);
      if (!alive()) return;
      setResult({
        say: `Marked as taken: ${doses.map(d => d.med.name).join(', ')}.`,
        tone: 'good',
        actions: [
          {
            label: 'Undo',
            onPress: () =>
              guarded(async () => {
                for (const d of doses) await toggleDoseTaken(d.id);
                setResult({ say: 'Okay, I unmarked it.' });
              }),
          },
          { label: 'Done', primary: true, onPress: close },
        ],
      });
    });

  /* Medicines are ALWAYS confirmed on an editable card, whatever
     understood them — a misheard drug name must never be saved
     silently. The user can fix the name, strength, times and count
     there, or just say "yes". */
  const confirmMedicine = med => {
    setPending(null);
    const dup = data.meds.find(m => (m.status || 'active') === 'active' && m.name.trim().toLowerCase() === med.medName.trim().toLowerCase());
    setResult({
      say: 'Add this medicine?',
      sub: 'Check the name and times. Tap to change anything.',
      med: { ...med, perDose: med.perDose || 1 },
      note: dup ? `${dup.name} is already in your medicines list.` : null,
      tone: dup ? 'warn' : null,
    });
    listenAgain();
  };

  const saveMedicine = med =>
    guarded(async alive => {
      const saved = await addMedicine({
        name: med.medName.trim(),
        dose: (med.medDose || '').trim(),
        slots: med.medSlots,
        perDose: med.perDose || 1,
        ...(med.stock != null ? { stock: med.stock } : {}),
      });
      if (!alive()) return;
      const times = data.medSettings?.times || {};
      setResult({
        say: `Added ${saved.name}${saved.dose ? ` ${saved.dose}` : ''}.`,
        tone: 'good',
        lines: saved.slots.map(s => `${slotOf(s).label} · ${prettyTime(times[s] || slotOf(s).time)}`),
        sub: "You'll get reminders at these times.",
        actions: [
          {
            label: 'Undo',
            onPress: () =>
              guarded(async () => {
                await deleteMedicine(saved.id);
                setResult({ say: `Okay, I removed ${saved.name}.` });
              }),
          },
          {
            label: 'Open medicines',
            primary: true,
            onPress: () => {
              close();
              go('meds');
            },
          },
        ],
      });
    });

  const run = (intent, source) => {
    setPending(null);
    switch (intent.intent) {
      case 'cancel':
        return setResult({ say: 'Okay, cancelled.' });

      case 'add_medicine':
        if (!intent.medName) return ask('What is the name of the medicine?', { ...intent });
        if (!intent.medSlots?.length)
          return ask(
            `When do you take ${intent.medName}?`,
            { ...intent },
            MED_TIME_PRESETS.map(p => ({ label: p.label, onPress: () => run({ ...intent, medSlots: p.slots }, source) })),
          );
        return confirmMedicine(intent);

      case 'red_flag':
        return setResult({
          say: 'This could be an emergency.',
          note: 'If you have chest pain, trouble breathing, fainting, or sudden weakness or slurred speech, call emergency services now.',
          tone: 'danger',
          actions: [{ label: 'Call 112', danger: true, primary: true, onPress: () => Linking.openURL('tel:112') }],
        });

      case 'log_bp':
        if (intent.sys == null || intent.dia == null) return ask('What is your BP reading? For example, "140 over 90".', { intent: 'log_bp' });
        return saveOrConfirm(intent, source);

      case 'log_sugar':
        if (intent.mgdl == null) return ask('What is your sugar reading?', { intent: 'log_sugar', sugarKind: intent.sugarKind });
        if (!intent.sugarKind)
          return ask(`Was ${intent.mgdl} fasting, or after a meal?`, { intent: 'log_sugar', mgdl: intent.mgdl }, [
            { label: 'Fasting', onPress: () => run({ ...intent, sugarKind: 'fasting' }, source) },
            { label: 'After a meal', onPress: () => run({ ...intent, sugarKind: 'post' }, source) },
          ]);
        return saveOrConfirm(intent, source);

      case 'log_weight':
        if (intent.weightKg == null) return ask('What is your weight in kg?', { intent: 'log_weight' });
        return saveOrConfirm(intent, source);

      case 'dose_taken': {
        const doses = dosesToMark(data, intent.slot, intent.medName);
        if (!doses.length) return setResult(answerDoseStatus(data, intent.slot));
        if (source === 'rules') return markTaken(doses);
        return setResult({
          say: `Mark as taken: ${doses.map(d => d.med.name).join(', ')}?`,
          actions: [
            { label: 'Cancel', onPress: () => setResult({ say: 'Okay, nothing changed.' }) },
            { label: 'Mark taken', primary: true, onPress: () => markTaken(doses) },
          ],
        });
      }

      case 'ask_dose_status': {
        const r = answerDoseStatus(data, intent.slot);
        return setResult({
          ...r,
          actions: r.untaken?.length ? [{ label: 'I did take it · mark taken', primary: true, onPress: () => markTaken(r.untaken) }] : null,
        });
      }

      case 'ask_meds':
        return setResult(answerMeds(data, intent.slot));

      case 'show_trend':
        return setResult({
          ...answerTrend(data, intent.metric || 'bp', intent.days || 7),
          actions: [
            {
              label: 'Open readings',
              primary: true,
              onPress: () => {
                close();
                go('log');
              },
            },
          ],
        });

      case 'navigate':
        if (!intent.screen) break;
        close();
        return go(intent.screen);

      case 'chat':
        if (intent.reply) return setResult({ say: intent.reply, ai: true, small: true });
        break;

      default:
        break;
    }
    return setResult({ say: "Sorry, I didn't understand that.", sub: 'Try "My BP is 140 over 90" or "What medicines tonight?"' });
  };

  const handle = text => {
    const q = text.trim();
    if (!q) return;
    setHeard(q);
    // "yes" / "save" while the medicine card is showing
    if (result?.med && YES.test(q)) {
      if (result.med.medName?.trim() && result.med.medSlots?.length) return saveMedicine(result.med);
      return undefined;
    }
    if (result?.med && /^\s*(no|nope|cancel|don'?t|nahi|mat|नहीं)\b/i.test(q)) return setResult({ say: 'Okay, not added.' });
    setResult(null);
    const local = parseCommand(q, pending);
    if (local) return run(local, 'rules');
    return guarded(async alive => {
      const res = await assistantApi.interpret({ text: q, pending: pending?.intent }, token);
      if (alive()) run(res.intent, 'ai');
    });
  };

  const submitTyped = () => {
    viaVoice.current = false;
    const q = typed;
    setTyped('');
    handle(q);
  };

  const tapMic = () => {
    if (speech.listening) return speech.stop();
    viaVoice.current = true;
    setResult(null);
    setHeard('');
    return speech.start();
  };

  // ---- view ----

  const phase = speech.listening ? 'listening' : busy ? 'thinking' : 'idle';
  const status = speech.listening ? ui.listening : busy ? ui.thinking : result ? 'MyHealth AI' : speech.available ? ui.tapAndSpeak : ui.typeInstead;
  const liveText = speech.listening ? speech.partial : heard;
  const showSuggestions = !liveText && !result && !busy;
  const tone = result?.tone ? TONE[result.tone] : null;

  return (
    <Modal visible={visible} transparent animationType="none" statusBarTranslucent navigationBarTranslucent onRequestClose={close}>
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: appear }]}>
        <Pressable style={[StyleSheet.absoluteFill, styles.backdrop]} onPress={close} accessibilityLabel="Close assistant" />
      </Animated.View>

      <GlowBorder visible={visible} phase={phase} level={speech.level} />

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.flexEnd} pointerEvents="box-none">
        <Animated.View
          style={[
            styles.card,
            { marginBottom: Math.max(insets.bottom, 12) + 8, maxHeight: height * 0.78 },
            { opacity: appear, transform: [{ translateY: appear.interpolate({ inputRange: [0, 1], outputRange: [60, 0] }) }] },
          ]}>
          <BlurView style={StyleSheet.absoluteFill} blurAmount={30} overlayColor="rgba(255,255,255,0.72)" reducedTransparencyFallbackColor={C.cardSolid} />

          <View style={styles.headRow}>
            <View style={styles.langRow}>
              {LANGS.map(l => (
                <Press key={l.key} onPress={() => setLang(l.key)} style={[styles.langChip, lang === l.key && styles.langChipOn]} accessibilityLabel={`Speak in ${l.label}`}>
                  <Text style={[styles.langLabel, lang === l.key && styles.langLabelOn]}>{l.label}</Text>
                </Press>
              ))}
            </View>
            <Press onPress={close} style={styles.closeBtn} accessibilityLabel="Close">
              <Svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={C.ink} strokeWidth="2.2" strokeLinecap="round">
                <Path d="M6 6l12 12M18 6L6 18" />
              </Svg>
            </Press>
          </View>

          <ScrollView style={styles.scroll} contentContainerStyle={{ paddingBottom: 6 }} keyboardShouldPersistTaps="handled">
            <Text style={[styles.status, phase !== 'idle' && { color: C.brand2 }]}>{status}</Text>

            {!!liveText && <Text style={styles.heard}>“{liveText}”</Text>}

            {result && (
              <View style={{ marginTop: 6 }}>
                {result.ai && <Text style={styles.aiBadge}>AI-generated · not medical advice</Text>}
                <Text style={[styles.say, result.small && styles.saySmall, tone && { color: tone.fg }]}>{result.say}</Text>
                {!!result.sub && <Text style={styles.sub}>{result.sub}</Text>}
                {result.lines?.map(l => (
                  <Text key={l} style={styles.line}>
                    {l}
                  </Text>
                ))}
                {result.med && (
                  <MedicineCard
                    med={result.med}
                    times={data.medSettings?.times || {}}
                    busy={busy}
                    onChange={patch => setResult(r => ({ ...r, med: { ...r.med, ...patch } }))}
                    onSave={() => saveMedicine(result.med)}
                    onCancel={() => setResult({ say: 'Okay, not added.' })}
                  />
                )}
                {!!result.note && (
                  <View style={[styles.note, { backgroundColor: (tone || TONE.warn).bg }]}>
                    <Text style={[styles.noteText, { color: (tone || TONE.warn).fg }]}>{result.note}</Text>
                  </View>
                )}
                {!!result.quick?.length && (
                  <View style={styles.btnRow}>
                    {result.quick.map(q => (
                      <BigButton key={q.label} label={q.label} onPress={q.onPress} />
                    ))}
                  </View>
                )}
                {!!result.actions?.length && (
                  <View style={styles.btnRow}>
                    {result.actions.map(a => (
                      <BigButton key={a.label} {...a} disabled={busy} />
                    ))}
                  </View>
                )}
              </View>
            )}

            {showSuggestions && (
              <View style={styles.suggestWrap}>
                <Text style={styles.tryLabel}>{ui.trySaying}</Text>
                {ui.examples.map(s => (
                  <Press
                    key={s}
                    onPress={() => {
                      viaVoice.current = false;
                      speech.cancel();
                      handle(s);
                    }}
                    style={styles.suggest}>
                    <Text style={styles.suggestText}>{s}</Text>
                  </Press>
                ))}
              </View>
            )}
          </ScrollView>

          {speech.available && (
            <View style={styles.micWrap}>
              <MicButton listening={speech.listening} onPress={tapMic} />
              <Text style={styles.micHint}>{speech.listening ? ui.tapWhenDone : ui.tapToSpeak}</Text>
            </View>
          )}

          <View style={styles.inputRow}>
            <TextInput
              value={typed}
              onChangeText={setTyped}
              onSubmitEditing={submitTyped}
              onFocus={() => speech.listening && speech.cancel()}
              placeholder={speech.available ? ui.orType : ui.typeExample}
              placeholderTextColor={C.ink3}
              style={styles.input}
              returnKeyType="send"
              autoFocus={!speech.available}
            />
            <Press onPress={submitTyped} disabled={!typed.trim() || busy} style={styles.sendBtn} accessibilityLabel="Send">
              <LinearGradient colors={GRAD.colors} start={GRAD.start} end={GRAD.end} style={StyleSheet.absoluteFill} />
              <Svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                <Path d="M12 19V5M5 12l7-7 7 7" />
              </Svg>
            </Press>
          </View>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

/* The editable "Add this medicine?" card. Every field is prefilled
   from what was heard; times are big toggle chips showing the user's
   own reminder times, so fixing a mishearing is a tap, not a retry. */
function MedicineCard({ med, times, busy, onChange, onSave, onCancel }) {
  const slots = med.medSlots || [];
  const toggle = key => onChange({ medSlots: slots.includes(key) ? slots.filter(s => s !== key) : SLOTS.map(s => s.key).filter(k => k === key || slots.includes(k)) });
  const count = med.perDose || 1;
  const canSave = !!med.medName?.trim() && slots.length > 0;

  return (
    <View style={styles.medCard}>
      <Text style={styles.fieldLabel}>Medicine name</Text>
      <TextInput value={med.medName || ''} onChangeText={t => onChange({ medName: t })} style={styles.medName} placeholder="Name" placeholderTextColor={C.ink3} />

      <Text style={styles.fieldLabel}>Strength</Text>
      <TextInput
        value={med.medDose || ''}
        onChangeText={t => onChange({ medDose: t })}
        style={styles.medDose}
        placeholder="e.g. 500 mg (optional)"
        placeholderTextColor={C.ink3}
      />

      <Text style={styles.fieldLabel}>When</Text>
      <View style={styles.slotWrap}>
        {SLOTS.map(s => {
          const on = slots.includes(s.key);
          return (
            <Press key={s.key} onPress={() => toggle(s.key)} style={[styles.slotChip, on && styles.slotChipOn]} accessibilityState={{ selected: on }}>
              <Text style={[styles.slotLabel, on && styles.slotLabelOn]}>
                {on ? '✓ ' : ''}
                {s.label}
              </Text>
              <Text style={[styles.slotTime, on && styles.slotLabelOn]}>{prettyTime(times[s.key] || s.time)}</Text>
            </Press>
          );
        })}
      </View>

      <View style={styles.countRow}>
        <Text style={styles.countLabel}>Tablets each time</Text>
        <View style={styles.stepper}>
          <Press onPress={() => onChange({ perDose: Math.max(1, count - 1) })} disabled={count <= 1} style={styles.stepBtn} accessibilityLabel="One fewer">
            <Text style={styles.stepText}>−</Text>
          </Press>
          <Text style={styles.countValue}>{count}</Text>
          <Press onPress={() => onChange({ perDose: Math.min(4, count + 1) })} disabled={count >= 4} style={styles.stepBtn} accessibilityLabel="One more">
            <Text style={styles.stepText}>+</Text>
          </Press>
        </View>
      </View>
      {med.stock != null && <Text style={styles.stockNote}>Stock: {med.stock} tablets</Text>}

      <View style={styles.btnRow}>
        <BigButton label="Cancel" onPress={onCancel} disabled={busy} />
        <BigButton label="Add medicine" primary onPress={onSave} disabled={busy || !canSave} />
      </View>
    </View>
  );
}

function BigButton({ label, onPress, primary, danger, disabled }) {
  if (primary) {
    return (
      <Press onPress={onPress} disabled={disabled} style={[styles.bigBtn, styles.bigBtnPrimary]}>
        <LinearGradient
          colors={danger ? ['#F43F5E', C.crisis] : GRAD.colors}
          start={GRAD.start}
          end={GRAD.end}
          style={StyleSheet.absoluteFill}
        />
        <Text style={[styles.bigBtnLabel, { color: '#FFFFFF' }]}>{label}</Text>
      </Press>
    );
  }
  return (
    <Press onPress={onPress} disabled={disabled} style={styles.bigBtn}>
      <Text style={styles.bigBtnLabel}>{label}</Text>
    </Press>
  );
}

function MicButton({ listening, onPress }) {
  const ring = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!listening) {
      ring.setValue(0);
      return undefined;
    }
    const a = Animated.loop(Animated.timing(ring, { toValue: 1, duration: 1200, easing: Easing.out(Easing.quad), useNativeDriver: true }));
    a.start();
    return () => a.stop();
  }, [listening, ring]);

  return (
    <View style={styles.micOuter}>
      {listening && (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.micRing,
            { opacity: ring.interpolate({ inputRange: [0, 1], outputRange: [0.5, 0] }), transform: [{ scale: ring.interpolate({ inputRange: [0, 1], outputRange: [1, 1.6] }) }] },
          ]}>
          <LinearGradient colors={GLOW_COLORS} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[StyleSheet.absoluteFill, { borderRadius: 60 }]} />
        </Animated.View>
      )}
      <Press onPress={onPress} style={styles.micBtn} accessibilityLabel={listening ? 'Stop listening' : 'Start speaking'}>
        <LinearGradient colors={listening ? GLOW_COLORS.slice(1, 5) : GRAD.colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
        {listening ? (
          <Svg width="26" height="26" viewBox="0 0 24 24">
            <Rect x="6" y="6" width="12" height="12" rx="3" fill="#FFFFFF" />
          </Svg>
        ) : (
          <MicIcon size={32} />
        )}
      </Press>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: { backgroundColor: 'rgba(8,16,12,0.38)' },
  flexEnd: { flex: 1, justifyContent: 'flex-end' },
  card: {
    marginHorizontal: 12,
    borderRadius: 30,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.8)',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 16,
  },
  headRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  langRow: { flexDirection: 'row', gap: 6 },
  langChip: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 999, borderWidth: 1, borderColor: C.hair, backgroundColor: 'rgba(255,255,255,0.6)' },
  langChipOn: { backgroundColor: C.ink, borderColor: C.ink },
  langLabel: { fontFamily: SANS.medium, fontSize: 15, color: C.ink2 },
  langLabelOn: { color: '#FFFFFF' },
  closeBtn: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(22,36,28,0.07)' },
  scroll: { flexGrow: 0 },
  status: { fontFamily: MONO.medium, fontSize: 14, letterSpacing: 1, textTransform: 'uppercase', color: C.ink3, marginTop: 8 },
  heard: { fontFamily: SANS.regular, fontSize: 20, lineHeight: 28, color: C.ink2, marginTop: 10 },
  aiBadge: { fontFamily: MONO.medium, fontSize: 12, letterSpacing: 0.8, textTransform: 'uppercase', color: '#6366F1', marginBottom: 6 },
  say: { fontFamily: SANS.semibold, fontSize: 26, lineHeight: 33, letterSpacing: -0.5, color: C.ink, marginTop: 4 },
  saySmall: { fontSize: 20, lineHeight: 29, fontFamily: SANS.medium },
  sub: { fontFamily: SANS.regular, fontSize: 17, lineHeight: 24, color: C.ink2, marginTop: 6 },
  line: { fontFamily: SANS.regular, fontSize: 18, lineHeight: 26, color: C.ink, marginTop: 8 },
  note: { borderRadius: 16, padding: 14, marginTop: 14 },
  noteText: { fontFamily: SANS.medium, fontSize: 16.5, lineHeight: 24 },
  btnRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 16 },
  bigBtn: {
    flexGrow: 1,
    minWidth: 120,
    minHeight: 58,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.85)',
    borderWidth: 1,
    borderColor: C.hair,
  },
  bigBtnPrimary: { borderWidth: 0 },
  bigBtnLabel: { fontFamily: SANS.semibold, fontSize: 18, color: C.ink },
  medCard: { marginTop: 14, backgroundColor: 'rgba(255,255,255,0.7)', borderRadius: 20, borderWidth: 1, borderColor: C.hair, padding: 16 },
  fieldLabel: { fontFamily: MONO.medium, fontSize: 12.5, letterSpacing: 1, textTransform: 'uppercase', color: C.ink3, marginTop: 10, marginBottom: 6 },
  medName: {
    fontFamily: SANS.semibold,
    fontSize: 22,
    color: C.ink,
    borderWidth: 1,
    borderColor: C.hair,
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: '#FFFFFF',
  },
  medDose: {
    fontFamily: SANS.regular,
    fontSize: 18,
    color: C.ink,
    borderWidth: 1,
    borderColor: C.hair,
    borderRadius: 14,
    paddingVertical: 9,
    paddingHorizontal: 14,
    backgroundColor: '#FFFFFF',
  },
  slotWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  slotChip: { borderWidth: 1, borderColor: C.hair, backgroundColor: '#FFFFFF', borderRadius: 14, paddingVertical: 10, paddingHorizontal: 13, minWidth: 128 },
  slotChipOn: { backgroundColor: C.brand2, borderColor: C.brand2 },
  slotLabel: { fontFamily: SANS.semibold, fontSize: 16, color: C.ink },
  slotTime: { fontFamily: MONO.medium, fontSize: 13, color: C.ink3, marginTop: 2 },
  slotLabelOn: { color: '#FFFFFF' },
  countRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 16 },
  countLabel: { fontFamily: SANS.medium, fontSize: 17, color: C.ink },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  stepBtn: { width: 48, height: 48, borderRadius: 24, borderWidth: 1, borderColor: C.hair, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  stepText: { fontFamily: SANS.semibold, fontSize: 24, color: C.ink },
  countValue: { fontFamily: SANS.bold, fontSize: 22, color: C.ink, minWidth: 20, textAlign: 'center' },
  stockNote: { fontFamily: SANS.regular, fontSize: 16, color: C.ink2, marginTop: 10 },
  suggestWrap: { marginTop: 14, gap: 8 },
  tryLabel: { fontFamily: MONO.medium, fontSize: 13, letterSpacing: 1, textTransform: 'uppercase', color: C.ink3 },
  suggest: { backgroundColor: 'rgba(255,255,255,0.75)', borderWidth: 1, borderColor: C.hair, borderRadius: 16, paddingVertical: 14, paddingHorizontal: 16 },
  suggestText: { fontFamily: SANS.medium, fontSize: 17, color: C.ink },
  micWrap: { alignItems: 'center', marginTop: 14 },
  micOuter: { width: 84, height: 84, alignItems: 'center', justifyContent: 'center' },
  micRing: { position: 'absolute', width: 84, height: 84, borderRadius: 42, overflow: 'hidden' },
  micBtn: { width: 84, height: 84, borderRadius: 42, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  micHint: { fontFamily: SANS.medium, fontSize: 15, color: C.ink2, marginTop: 8 },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 14,
    backgroundColor: 'rgba(255,255,255,0.8)',
    borderWidth: 1,
    borderColor: C.hair,
    borderRadius: 18,
    paddingVertical: 5,
    paddingLeft: 16,
    paddingRight: 5,
  },
  input: { flex: 1, fontFamily: SANS.regular, fontSize: 17, color: C.ink, paddingVertical: 10 },
  sendBtn: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
});
