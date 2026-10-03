export const APP_NAME = 'MyHealthBook';

/* 'morning' | 'afternoon' | 'evening' — one source for both the Home
   screen's written greeting and the spoken one at launch. */
export const dayPart = (d = new Date()) => {
  const h = d.getHours();
  return h < 12 ? 'morning' : h < 17 ? 'afternoon' : 'evening';
};

export const greeting = () => `Good ${dayPart()}`;

// a title from the sex set in Profile — none for "other" or unset, rather than guess
const TITLE = { male: 'Mr.', female: 'Ms.' };
// written out for the voice: some phones' text-to-speech spell "Ms." as letters
const SPOKEN_TITLE = { male: 'Mister', female: 'Miz' };

/* The name a greeting uses: the last name when one was entered ("Parth
   Panchal" → "Panchal"), otherwise the only name there is, with Mr./Ms.
   in front when the profile says which ("Mr. Panchal"). Shared by the
   Home screen and the spoken greeting at launch so they match;
   `spoken` gives the form text-to-speech pronounces properly. */
export const greetingName = (fullName, sex, { spoken = false } = {}) => {
  const parts = String(fullName || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!parts.length) return '';
  const name = parts[parts.length - 1];
  const title = (spoken ? SPOKEN_TITLE : TITLE)[sex];
  return title ? `${title} ${name}` : name;
};

/* The name to greet someone by: what they set in Profile, else the
   name they signed up with (always present on the account). Google
   sign-ins without a name get a placeholder account name, which is
   never used as a greeting. */
export const displayName = (profile, user) => {
  const n = String(profile?.name || user?.name || '').trim();
  return n && n !== 'MyHealthBook User' ? n : '';
};
