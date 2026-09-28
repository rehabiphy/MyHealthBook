import { DeviceEventEmitter } from 'react-native';
import { endAlarm, startAlarm } from './sosNative';

export const SOS_PUSH_EVENT = 'myhealthbook:sos-push';

/* Routes an SOS push from FCM — called from both the killed/background
   handler (index.js) and the foreground one (notifications.js). The
   native side does the ringing; the open app, if any, just refreshes
   its SOS screen. Returns false for pushes that aren't about SOS. */
export function handleSosPush(remoteMessage) {
  const data = remoteMessage?.data;
  if (data?.type === 'sos') startAlarm(data);
  else if (data?.type === 'sos_end') endAlarm(data);
  else return false;
  DeviceEventEmitter.emit(SOS_PUSH_EVENT, data);
  return true;
}
