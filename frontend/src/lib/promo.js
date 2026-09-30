import AsyncStorage from '@react-native-async-storage/async-storage';

/* How often the plans pop-up appears for someone without a plan: once
   every 5 or 6 app opens (picked at random each time, so it doesn't
   feel mechanical). An "open" is a cold start, or coming back to the
   app after it's been in the background for a while — flicking to
   WhatsApp and back isn't a new open. Kept on the phone only: it's a
   courtesy setting, not something the server needs to know. */

const KEY = 'mhb_plan_promo';
export const RESUME_AFTER_MS = 30 * 60 * 1000;

const nextThreshold = () => 5 + Math.round(Math.random()); // 5 or 6

async function read() {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    const v = raw ? JSON.parse(raw) : null;
    if (v && Number.isFinite(v.opens) && Number.isFinite(v.threshold)) return v;
  } catch {
    // unreadable — start over
  }
  return { opens: 0, threshold: nextThreshold() };
}

async function write(v) {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(v));
  } catch {
    // not worth surfacing — worst case the count restarts
  }
}

/* Counts one open. Resolves true when this is the open the pop-up
   should appear on (and starts the next countdown). */
export async function registerOpen() {
  const v = await read();
  const opens = v.opens + 1;
  if (opens >= v.threshold) {
    await write({ opens: 0, threshold: nextThreshold() });
    return true;
  }
  await write({ ...v, opens });
  return false;
}
