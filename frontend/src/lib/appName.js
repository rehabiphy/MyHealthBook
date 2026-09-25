export const APP_NAME = 'MyHealthBook';

/* 'morning' | 'afternoon' | 'evening' — one source for both the Home
   screen's written greeting and the spoken one at launch. */
export const dayPart = (d = new Date()) => {
  const h = d.getHours();
  return h < 12 ? 'morning' : h < 17 ? 'afternoon' : 'evening';
};

export const greeting = () => `Good ${dayPart()}`;

/* The name to greet someone by: what they set in Profile, else the
   name they signed up with (always present on the account). Google
   sign-ins without a name get a placeholder account name, which is
   never used as a greeting. */
export const displayName = (profile, user) => {
  const n = String(profile?.name || user?.name || '').trim();
  return n && n !== 'MyHealthBook User' ? n : '';
};
