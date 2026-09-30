import { useEffect, useRef, useState } from 'react';
import { Animated, PermissionsAndroid, Platform } from 'react-native';
import Voice from '@react-native-voice/voice';
import { stopSpeaking } from './speak';

/* Wraps the platform speech recognizer (Google on Android, Apple
   Speech on iOS) behind one hook, so the overlay never touches the
   native module directly and it can be swapped for a server-side
   transcriber later.

   Listening goes on until the person taps Stop — a pause to think, or
   to read a number off the BP monitor, doesn't end it. iOS keeps
   listening by itself. Android's recognizer ends its own session after
   a short silence (with a result, or a "no match" / "speech timeout"
   error), so while we're still meant to be listening it's quietly
   restarted, and each finished stretch is kept: everything said, across
   restarts, is delivered together on Stop.

   A hard cap stops a mic left running by mistake (phone put down)
   from listening forever — whatever was heard is still delivered.

   `level` is a 0..1 Animated.Value of mic loudness that drives the
   glow. Android reports it; iOS doesn't, so there the glow just
   breathes on its own. */

const RESTART_MS = 250; // Android: gap before reopening the recognizer
const STOP_WAIT_MS = 1200; // after Stop, how long to wait for the recognizer's final words
const MAX_LISTEN_MS = 2 * 60 * 1000;
const MAX_RESTART_FAILS = 3; // consecutive failures to reopen before giving up

const joinText = (...parts) => parts.map(p => (p || '').trim()).filter(Boolean).join(' ');

export default function useSpeech({ locale, onFinal, onError }) {
  const [available, setAvailable] = useState(false);
  const [listening, setListening] = useState(false);
  const [partial, setPartial] = useState('');
  const level = useRef(new Animated.Value(0)).current;

  const cb = useRef({ onFinal, onError });
  cb.current = { onFinal, onError };
  const localeRef = useRef(locale);
  localeRef.current = locale;

  const done = useRef(true); // true once the current listen has ended (delivered or cancelled)
  const stopping = useRef(false); // Stop tapped — waiting for the last words
  const kept = useRef(''); // Android: text from sessions that already ended
  const current = useRef(''); // the session in progress
  const timers = useRef({});
  const fails = useRef(0);

  const clearTimers = () => Object.values(timers.current).forEach(clearTimeout);

  const all = () => joinText(kept.current, current.current);

  const reset = () => {
    clearTimers();
    setListening(false);
    setPartial('');
    Animated.timing(level, { toValue: 0, duration: 200, useNativeDriver: true }).start();
  };

  // end of the listen: hand over everything heard
  const deliver = () => {
    if (done.current) return;
    done.current = true;
    stopping.current = false;
    reset();
    Voice.cancel().catch(() => {});
    const text = all();
    if (text) cb.current.onFinal(text);
    else cb.current.onError?.("I didn't catch that.");
  };

  const fail = message => {
    if (done.current) return;
    done.current = true;
    stopping.current = false;
    reset();
    Voice.cancel().catch(() => {});
    cb.current.onError?.(message);
  };

  // Android ended its session on its own — keep what it heard and listen again
  const restart = () => {
    if (done.current || stopping.current) return;
    kept.current = all();
    current.current = '';
    clearTimeout(timers.current.restart);
    timers.current.restart = setTimeout(async () => {
      if (done.current || stopping.current) return;
      try {
        await Voice.start(localeRef.current);
        fails.current = 0;
      } catch {
        fails.current += 1;
        if (fails.current >= MAX_RESTART_FAILS) {
          if (kept.current) deliver();
          else fail('The microphone is not available right now.');
        } else restart();
      }
    }, RESTART_MS);
  };

  const heard = text => {
    if (done.current || !text) return;
    current.current = text;
    setPartial(all());
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
      if (stopping.current) return deliver(); // the final words after Stop
      if (Platform.OS === 'android') restart(); // iOS results are running totals of one session — nothing to do
    };
    Voice.onSpeechVolumeChanged = e => {
      const v = Math.max(0, Math.min(1, ((e.value ?? 0) + 2) / 12));
      Animated.timing(level, { toValue: v, duration: 90, useNativeDriver: true }).start();
    };
    Voice.onSpeechError = e => {
      if (done.current) return;
      if (stopping.current) return deliver();
      const code = String(e.error?.code ?? e.error?.message ?? '');
      // 6 speech timeout / 7 no match: silence, not a failure — keep listening
      // 5 client / 8 busy: the recognizer hadn't finished closing yet — try again
      if (/^(5|6|7|8)\b|no match|timeout|busy|client/i.test(code)) return restart();
      if (all()) return deliver();
      fail('The microphone is not available right now.');
    };

    return () => {
      clearTimers();
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
    clearTimers();
    kept.current = '';
    current.current = '';
    fails.current = 0;
    stopping.current = false;
    done.current = false;
    setPartial('');
    try {
      await Voice.start(locale);
      setListening(true);
      timers.current.cap = setTimeout(stop, MAX_LISTEN_MS);
    } catch {
      done.current = true;
      cb.current.onError?.('The microphone is not available right now.');
    }
  };

  /* The person tapped Stop: ask the recognizer to finish, deliver on its
     final result — or after a short wait if it has nothing more to say. */
  function stop() {
    if (done.current || stopping.current) return;
    stopping.current = true;
    clearTimeout(timers.current.restart);
    clearTimeout(timers.current.cap);
    setListening(false);
    Voice.stop().catch(() => {});
    timers.current.stop = setTimeout(deliver, STOP_WAIT_MS);
  }

  // overlay closed: drop everything, deliver nothing
  const cancel = () => {
    done.current = true;
    stopping.current = false;
    reset();
    level.setValue(0);
    Voice.cancel().catch(() => {});
  };

  return { available, listening, partial, level, start, stop, cancel };
}
