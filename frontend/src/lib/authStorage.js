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

/* { name, email, phone } only — never the password. Lets the app
   resume a half-finished registration if it gets killed while the
   user is off in their mail app tapping the verify link. */
export async function loadPendingRegistration() {
  try {
    const raw = await AsyncStorage.getItem(PENDING_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export async function savePendingRegistration(pending) {
  try {
    await AsyncStorage.setItem(PENDING_KEY, JSON.stringify(pending));
  } catch {
    // best-effort
  }
}

export async function clearPendingRegistration() {
  try {
    await AsyncStorage.removeItem(PENDING_KEY);
  } catch {
    // best-effort
  }
}
