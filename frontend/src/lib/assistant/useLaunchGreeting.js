import { useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { dayPart, greetingName } from '../appName';
import { LANG_KEY, speak } from './speak';

const HINDI = { morning: 'सुप्रभात', afternoon: 'नमस्ते, शुभ दोपहर', evening: 'शुभ संध्या' };
// Hindi's own Mr./Ms. — with "जी" after the name, as before
const HINDI_TITLE = { male: 'श्री', female: 'सुश्री' };

// module-level, so it's once per app launch — not on every re-mount or re-login
let greeted = false;

/* Says "Good morning / afternoon / evening, Mr. <name>" out loud the
   first time the signed-in app appears after a launch, in the language
   chosen for MyHealth AI (Hindi → "सुप्रभात, श्री Panchal जी"). The name
   is the last name when there is one, else the first, with Mr./Ms. from
   the sex set in Profile, if any (greetingName).

   `loaded` must be true before it speaks: the app can appear a moment
   before the profile arrives from the server, and greeting then would
   use a stale or missing name. */
export default function useLaunchGreeting(profileName, loaded, sex) {
  useEffect(() => {
    if (greeted || !loaded) return undefined;
    const who = greetingName(profileName, sex, { spoken: true });
    const plain = greetingName(profileName); // no title, for the Hindi form
    const part = dayPart();
    const english = `Good ${part}${who ? `, ${who}` : ''}.`;

    // a short pause so it doesn't talk over the app still drawing its first screen
    const t = setTimeout(async () => {
      if (greeted) return;
      greeted = true; // set here, not above, so a dev StrictMode double-mount still greets once
      const lang = await AsyncStorage.getItem(LANG_KEY).catch(() => null);
      const hindi = `${HINDI[part]}${plain ? `, ${HINDI_TITLE[sex] ? `${HINDI_TITLE[sex]} ` : ''}${plain} जी` : ''}`;
      if (__DEV__) console.log('Launch greeting:', lang === 'hi-IN' ? hindi : english);
      if (lang === 'hi-IN') speak(hindi, { lang: 'hi-IN', fallback: english });
      else speak(english, { lang: 'en-IN' });
    }, 700);
    return () => clearTimeout(t);
  }, [loaded, profileName, sex]);
}
