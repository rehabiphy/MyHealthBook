import AsyncStorage from '@react-native-async-storage/async-storage';

const SESSION_KEY = 'aneroid:auth:session:v1';
const PENDING_KEY = 'aneroid:auth:pending:v1';

export async function loadSession() {
  try {
    const raw = await AsyncStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export async function saveSession(session) {
  try {
    await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(session));
  } catch {
    // best-effort
  }
}

export async function clearSession() {
  try {
    await AsyncStorage.removeItem(SESSION_KEY);
  } catch {
    // best-effort
  }
}

/* Registration progress is not persisted across app restarts (it used
   to be, via save/loadPendingRegistration — removed because it locked
   the Register form on a stale, already-sent verification with no way
   to start over). This just wipes any such leftover from before that
   was removed. */
export async function clearPendingRegistration() {
  try {
    await AsyncStorage.removeItem(PENDING_KEY);
  } catch {
    // best-effort
  }
}
