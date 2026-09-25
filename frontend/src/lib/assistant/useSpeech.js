import { useEffect, useRef, useState } from 'react';
import { Animated, PermissionsAndroid, Platform } from 'react-native';
import Voice from '@react-native-voice/voice';
import { stopSpeaking } from './speak';

/* Wraps the platform speech recognizer (Google on Android, Apple
   Speech on iOS) behind one hook, so the overlay never touches the
   native module directly and it can be swapped for a server-side
   transcriber later.

   `level` is a 0..1 Animated.Value of mic loudness that drives the
   glow. Android reports it; iOS doesn't, so there the glow just
   breathes on its own.

   iOS keeps listening until told to stop, so a short silence timer
   ends the utterance there. Android ends it itself, but the same timer
   is harmless as a backstop. */

const SILENCE_MS = 1600;

export default function useSpeech({ locale, onFinal, onError }) {
  const [available, setAvailable] = useState(false);
  const [listening, setListening] = useState(false);
  const [partial, setPartial] = useState('');
  const level = useRef(new Animated.Value(0)).current;

  const cb = useRef({ onFinal, onError });
  cb.current = { onFinal, onError };
  const lastText = useRef('');
  const done = useRef(true); // true once the current utterance has been delivered
  const silence = useRef(null);

  const finish = () => {
    clearTimeout(silence.current);
    if (done.current) return;
    done.current = true;
    setListening(false);
    setPartial('');
    Animated.timing(level, { toValue: 0, duration: 200, useNativeDriver: true }).start();
    Voice.stop().catch(() => {});
    const text = lastText.current.trim();
    if (text) cb.current.onFinal(text);
    else cb.current.onError?.("I didn't catch that.");
  };

  const heard = text => {
    if (done.current || !text) return;
    lastText.current = text;
    setPartial(text);
    clearTimeout(silence.current);
    silence.current = setTimeout(finish, SILENCE_MS);
  };

  useEffect(() => {
    Voice.isAvailable()
      .then(ok => {
        if (!ok) console.warn('MyHealth AI: no speech recognizer on this device, voice disabled');
        setAvailable(Boolean(ok));
      })
      .catch(err => {
        console.warn('MyHealth AI: speech module unavailable, voice disabled', err?.message);
        setAvailable(false);
      });

    Voice.onSpeechPartialResults = e => heard(e.value?.[0]);
    Voice.onSpeechResults = e => {
      heard(e.value?.[0]);
      if (Platform.OS === 'android') finish();
    };
    Voice.onSpeechVolumeChanged = e => {
      const v = Math.max(0, Math.min(1, ((e.value ?? 0) + 2) / 12));
      Animated.timing(level, { toValue: v, duration: 90, useNativeDriver: true }).start();
    };
    Voice.onSpeechError = e => {
      if (done.current) return;
      // Android's "no match"/"speech timeout" with something already heard is just the end of speech
      if (lastText.current) return finish();
      done.current = true;
      clearTimeout(silence.current);
      setListening(false);
      setPartial('');
      level.setValue(0);
      const code = String(e.error?.code ?? e.error?.message ?? '');
      cb.current.onError?.(/7|6|no match|timeout/i.test(code) ? "I didn't catch that." : 'The microphone is not available right now.');
    };

    return () => {
      clearTimeout(silence.current);
      Voice.destroy()
        .then(Voice.removeAllListeners)
        .catch(() => {});
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const start = async () => {
    if (Platform.OS === 'android') {
      const res = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO, {
        title: 'Microphone',
        message: 'MyHealthBook uses the microphone so you can speak your readings and questions.',
        buttonPositive: 'Allow',
      });
      if (res !== PermissionsAndroid.RESULTS.GRANTED) {
        cb.current.onError?.('Microphone permission is off. You can type instead.');
        return;
      }
    }
    stopSpeaking(); // never listen to our own voice (e.g. the launch greeting)
    lastText.current = '';
    done.current = false;
    setPartial('');
    try {
      await Voice.start(locale);
      setListening(true);
    } catch {
      done.current = true;
      cb.current.onError?.('The microphone is not available right now.');
    }
  };

  // user tapped the mic while listening: use what was heard so far
  const stop = () => finish();

  // overlay closed: drop everything, deliver nothing
  const cancel = () => {
    clearTimeout(silence.current);
    done.current = true;
    setListening(false);
    setPartial('');
    level.setValue(0);
    Voice.cancel().catch(() => {});
  };

  return { available, listening, partial, level, start, stop, cancel };
}
