import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'aneroid:v1';

export async function loadData() {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export async function saveData(data) {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    // best-effort — same silent-fail behaviour as the original web app
  }
}
