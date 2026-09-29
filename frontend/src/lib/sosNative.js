import { NativeEventEmitter, NativeModules, PermissionsAndroid, Platform } from 'react-native';

/* Thin wrapper over the Android SosModule (android/app/src/main/java/
   com/myhealthbook/sos). The alarm, fall detection and notification
   buttons all live natively so they work with the app killed; this is
   how the JS app drives them. Everything is a no-op off Android. */
const Native = Platform.OS === 'android' ? NativeModules.SosModule : null;
const emitter = Native ? new NativeEventEmitter(Native) : null;

export const sosSupported = !!Native;

export const configureSos = (apiBaseUrl, token) => Native?.configure(apiBaseUrl, token || null);

export const setFallDetection = async enabled => (Native ? Native.setFallDetection(enabled) : false);

export const getSosStatus = async () =>
  Native
    ? Native.getStatus()
    : { fallEnabled: false, fallRunning: false, batteryUnrestricted: true, fullScreenAllowed: true, locationAllowed: true, locationAlways: true };

/* Location for the SOS's Google Maps link. Two steps, as Android requires:
   precise location first, then "Allow all the time" — on Android 11+
   that second request opens the app's location settings page rather
   than a dialog. Resolves true once "all the time" is granted, 'blocked'
   if location was denied for good (only app settings can change it now). */
export async function requestSosLocation() {
  if (!Native) return false;
  const P = PermissionsAndroid.PERMISSIONS;
  const G = PermissionsAndroid.RESULTS.GRANTED;
  const res = await PermissionsAndroid.requestMultiple([P.ACCESS_FINE_LOCATION, P.ACCESS_COARSE_LOCATION]);
  if (res[P.ACCESS_FINE_LOCATION] !== G && res[P.ACCESS_COARSE_LOCATION] !== G) {
    return res[P.ACCESS_FINE_LOCATION] === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN ? 'blocked' : false;
  }
  if (Platform.Version < 29) return true; // no separate background permission before Android 10
  return (await PermissionsAndroid.request(P.ACCESS_BACKGROUND_LOCATION)) === G;
}

// FCM data values are all strings — passed through as-is
export const startAlarm = data => Native?.startAlarm(data);
export const endAlarm = data => Native?.endAlarm(data);
export const silenceAlarm = id => Native?.silenceAlarm(id);
export const dismissAlarm = id => Native?.dismissAlarm(id);
export const cancelMySos = id => Native?.cancelMySos(id);
export const simulateFall = () => Native?.simulateFall();
export const testAlarm = () => Native?.testAlarm();
export const openBatterySettings = () => Native?.openBatterySettings();
export const openFullScreenSettings = () => Native?.openFullScreenSettings();
export const openAppSettings = () => Native?.openAppSettings();

/* "SosRaised" (this phone detected a fall and sent an SOS), "SosChanged"
   (a notification button was pressed), "SosEnded" (cancel went through).
   Each carries the alert id. Returns an unsubscribe function. */
export function onSosEvent(callback) {
  if (!emitter) return () => {};
  const subs = ['SosRaised', 'SosChanged', 'SosEnded'].map(name => emitter.addListener(name, id => callback(name, id)));
  return () => subs.forEach(s => s.remove());
}
