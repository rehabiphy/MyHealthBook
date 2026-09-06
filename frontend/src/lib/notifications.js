import { Platform, PermissionsAndroid } from 'react-native';
import { getMessaging, getToken, onTokenRefresh, onMessage } from '@react-native-firebase/messaging';
import notifee, { AndroidImportance } from '@notifee/react-native';

/* @react-native-firebase/messaging v26 uses the modular API (no more
   messaging().getToken()) — every call takes the Messaging instance
   as its first argument. */
const messagingInstance = getMessaging();

const DEFAULT_CHANNEL_ID = 'default';

export async function requestNotificationPermission() {
  if (Platform.OS === 'android' && Platform.Version >= 33) {
    await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
  }
}

export async function getFcmToken() {
  return getToken(messagingInstance);
}

export function onFcmTokenRefresh(callback) {
  return onTokenRefresh(messagingInstance, callback);
}

/* FCM only auto-displays a system notification when the app is
   backgrounded/killed — in the foreground, `onMessage` fires instead
   and nothing appears unless the app shows it itself. Notifee is what
   actually renders it, since @react-native-firebase/messaging has no
   display API of its own. Channel creation is required on Android 8+
   before any notification can be shown on that channel. */
async function ensureDefaultChannel() {
  return notifee.createChannel({ id: DEFAULT_CHANNEL_ID, name: 'General', importance: AndroidImportance.HIGH });
}

/* Registered once at app startup (not gated on login state) so no
   foreground message is missed while auth is still initializing. */
export function setupForegroundNotifications() {
  ensureDefaultChannel();

  return onMessage(messagingInstance, async remoteMessage => {
    const { title, body } = remoteMessage.notification || {};
    if (!title && !body) return; // data-only message — nothing to show without app-specific handling
    await notifee.displayNotification({
      title,
      body,
      android: { channelId: DEFAULT_CHANNEL_ID, pressAction: { id: 'default' } },
    });
  });
}
