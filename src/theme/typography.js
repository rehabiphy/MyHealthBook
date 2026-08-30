import { Platform } from 'react-native';

/* Bundled static-weight instances of Schibsted Grotesk + IBM Plex Mono
   (see assets/fonts). Each weight is its own font family name, linked
   via react-native.config.js, because RN does not resolve a single
   family + fontWeight the way CSS does. */
export const SANS = {
  regular: 'SchibstedGrotesk-Regular',
  medium: 'SchibstedGrotesk-Medium',
  semibold: 'SchibstedGrotesk-SemiBold',
  bold: 'SchibstedGrotesk-Bold',
};

export const MONO = {
  regular: 'IBMPlexMono-Regular',
  medium: 'IBMPlexMono-Medium',
};

/* Maps a CSS-style numeric weight onto the closest bundled family, so
   ported styles that said `fontWeight: 700` keep working unchanged. */
export function sansWeight(weight) {
  const w = Number(weight) || 400;
  if (w >= 700) return SANS.bold;
  if (w >= 600) return SANS.semibold;
  if (w >= 500) return SANS.medium;
  return SANS.regular;
}

export function monoWeight(weight) {
  const w = Number(weight) || 400;
  if (w >= 500) return MONO.medium;
  return MONO.regular;
}

/* The small uppercase mono caption used everywhere for labels,
   timestamps and units — the app's signature typographic voice. */
export const monoCaption = {
  fontFamily: MONO.regular,
  fontSize: 10.5,
  letterSpacing: 1.4,
  textTransform: 'uppercase',
};

/* Android needs an explicit line-height or tightly tracked/large text
   clips; iOS is more forgiving. Small helper for headline-sized text. */
export const tight = Platform.select({ android: 1.08, ios: 1.02, default: 1.05 });
