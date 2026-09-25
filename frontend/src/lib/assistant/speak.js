import Tts from 'react-native-tts';

/* Text-to-speech through the phone's own engine (Google TTS on
   Android, Apple's on iOS) — out of the loudspeaker, no network, no
   LLM. Kept behind speak()/stopSpeaking() so the engine can be swapped
   without touching callers. */

// the speech language chosen in MyHealth AI (AssistantOverlay); the greeting follows it too
export const LANG_KEY = 'assistant.lang';

let ready = null;

function init() {
  if (!ready) {
    ready = Tts.getInitStatus()
      .then(() => {
        Tts.setDucking(true).catch(() => {}); // lower music etc. while speaking
        Tts.setDefaultRate(0.45).catch(() => {}); // a touch slower than default — easier to follow
        return true;
      })
      .catch(err => {
        if (err?.code === 'no_engine') Tts.requestInstallEngine().catch(() => {});
        ready = null; // try again next time
        return false;
      });
  }
  return ready;
}

/* Speaks `text` in `lang`. If the phone has no voice for that language
   (e.g. Hindi voice data not downloaded), speaks `fallback` in Indian
   English instead of reading Devanagari with an English voice. */
export async function speak(text, { lang = 'en-IN', fallback } = {}) {
  if (!(await init())) return false;
  let say = text;
  try {
    await Tts.setDefaultLanguage(lang);
  } catch {
    if (!fallback) return false;
    say = fallback;
    await Tts.setDefaultLanguage('en-IN').catch(() => Tts.setDefaultLanguage('en-US').catch(() => {}));
  }
  try {
    await Tts.stop();
    await Tts.speak(say, { androidParams: { KEY_PARAM_STREAM: 'STREAM_MUSIC', KEY_PARAM_VOLUME: 1 } });
    return true;
  } catch {
    return false;
  }
}

export function stopSpeaking() {
  Tts.stop().catch(() => {});
}
