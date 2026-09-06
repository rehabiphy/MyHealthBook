import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';

/* The Web OAuth client ID from Google Cloud Console — used both here
   (GoogleSignin needs the WEB client, not the Android one, to obtain
   an ID token audienced correctly) and as GOOGLE_CLIENT_ID on the
   backend, which verifies against this same value. The Android OAuth
   client (registered against com.myhealthbook + this app's signing
   certificate SHA-1) only needs to exist in the same Google Cloud
   project — its own client ID string is never used in code. */
const GOOGLE_WEB_CLIENT_ID = '156407535555-ra8tjlarhk2n16t5qp7ct993vto8jc6h.apps.googleusercontent.com';

export function configureGoogleSignIn() {
  GoogleSignin.configure({ webClientId: GOOGLE_WEB_CLIENT_ID });
}

export const isSignInCancelled = err => err?.code === statusCodes.SIGN_IN_CANCELLED;

export async function signInWithGoogle() {
  await GoogleSignin.hasPlayServices();
  // Clear the cached session first — otherwise GoogleSignin silently
  // re-signs-in with whichever account was used last instead of
  // showing the account picker.
  try {
    await GoogleSignin.signOut();
  } catch {
    // no cached session to clear — fine, proceed straight to sign-in
  }
  const result = await GoogleSignin.signIn();
  const idToken = result?.data?.idToken || result?.idToken;
  if (!idToken) {
    throw new Error('Google sign-in did not return a token. Please try again.');
  }
  return idToken;
}
