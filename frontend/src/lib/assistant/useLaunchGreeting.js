import { useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { dayPart } from '../appName';
import { LANG_KEY, speak } from './speak';

const HINDI = { morning: 'सुप्रभात', afternoon: 'नमस्ते, शुभ दोपहर', evening: 'शुभ संध्या' };

// module-level, so it's once per app launch — not on every re-mount or re-login
let greeted = false;

/* Says "Good morning / afternoon / evening, <first name>" out loud the
   first time the signed-in app appears after a launch, in the language
   chosen for MyHealth AI (Hindi → "सुप्रभात, Parth जी").

   `loaded` must be true before it speaks: the app can appear a moment
   before the profile arrives from the server, and greeting then would
   use a stale or missing name. */
export default function useLaunchGreeting(profileName, loaded) {
  useEffect(() => {
    if (greeted || !loaded) return undefined;
    const first = String(profileName || '').trim().split(/\s+/)[0];
    const part = dayPart();
    const english = `Good ${part}${first ? `, ${first}` : ''}.`;

    // a short pause so it doesn't talk over the app still drawing its first screen
    const t = setTimeout(async () => {
      if (greeted) return;
      greeted = true; // set here, not above, so a dev StrictMode double-mount still greets once
      const lang = await AsyncStorage.getItem(LANG_KEY).catch(() => null);
      const hindi = `${HINDI[part]}${first ? `, ${first} जी` : ''}`;
      if (__DEV__) console.log('Launch greeting:', lang === 'hi-IN' ? hindi : english);
      if (lang === 'hi-IN') speak(hindi, { lang: 'hi-IN', fallback: english });
      else speak(english, { lang: 'en-IN' });
    }, 700);
    return () => clearTimeout(t);
  }, [loaded, profileName]);
}
