import { Platform, PermissionsAndroid } from 'react-native';
import { getMessaging, getToken, onTokenRefresh, onMessage } from '@react-native-firebase/messaging';
import notifee, { AndroidImportance, AuthorizationStatus } from '@notifee/react-native';
import { handleSosPush } from './sos';
import { ensureMedChannel } from './medReminders';
import { ACCENT, LARGE_ICON } from './notificationStyle';

/* @react-native-firebase/messaging v26 uses the modular API (no more
   messaging().getToken()) — every call takes the Messaging instance
   as its first argument. */
const messagingInstance = getMessaging();

const DEFAULT_CHANNEL_ID = 'default';
/* The server's daily AI tip is sent on this channel (backend/src/jobs/
   healthTips.js). High importance so it pops up as a banner, in the app
   or out of it. Android freezes a channel's importance when it's first
   created, so this is a new id rather than raising the old one. */
const HEALTH_TIP_CHANNEL_ID = 'daily_health_tip';

export async function requestNotificationPermission() {
  if (Platform.OS === 'android' && Platform.Version >= 33) {
    await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
  }
}

/** False when the user has turned this app's notifications off (in the permission prompt or in settings). */
export async function notificationsAllowed() {
  const s = await notifee.getNotificationSettings();
  return s.authorizationStatus !== AuthorizationStatus.DENIED;
}

export const openNotificationSettings = () => notifee.openNotificationSettings();

export async function getFcmToken() {
  return getToken(messagingInstance);
}

export function onFcmTokenRefresh(callback) {
  return onTokenRefresh(messagingInstance, callback);
}

/* Channel creation is required on Android 8+ before any notification
   can be shown on that channel. Safe to call repeatedly — and it has to
   run in the headless background task too, not only in the open app. */
async function ensureChannels() {
  await Promise.all([
    notifee.createChannel({ id: DEFAULT_CHANNEL_ID, name: 'General', importance: AndroidImportance.HIGH }),
    notifee.createChannel({
      id: HEALTH_TIP_CHANNEL_ID,
      name: 'Daily health tip',
      description: 'One short tip a day, written for you from your own readings and medicines',
      importance: AndroidImportance.HIGH,
    }),
    ensureMedChannel(),
  ]);
  // the tip's first channel was created at normal importance (no pop-up) — superseded by the one above
  await notifee.deleteChannel('health_tips').catch(() => {});
}

const KNOWN_CHANNELS = [DEFAULT_CHANNEL_ID, HEALTH_TIP_CHANNEL_ID];
let channelsReady = null;

/* Draws a server push (health tip, family invite) with Notifee — the
   same way whether the app is open, in the background or closed, so it
   always carries the app logo as its large icon. The server sends these
   as data messages with title / body / channelId in `data`
   (backend/src/utils/push.js), because a plain FCM notification is drawn
   by Android itself with the app closed, and that can't show a large
   icon. Older-style pushes with a `notification` block still work.
   Returns false when the message isn't something to show. */
export async function displayPush(remoteMessage) {
  const data = remoteMessage?.data || {};
  const title = data.title || remoteMessage?.notification?.title;
  const body = data.body || remoteMessage?.notification?.body;
  if (!title && !body) return false;

  channelsReady ||= ensureChannels().catch(() => {});
  await channelsReady; // a push in the first moments after launch mustn't beat its channel into existence
  // the server's channel when it's one this app creates, so per-channel settings apply
  const requested = data.channelId || remoteMessage?.notification?.android?.channelId;
  const channelId = KNOWN_CHANNELS.includes(requested) ? requested : DEFAULT_CHANNEL_ID;
  try {
    await notifee.displayNotification({
      id: remoteMessage.messageId,
      title,
      body,
      data,
      android: {
        channelId,
        smallIcon: 'ic_stat_heart',
        largeIcon: LARGE_ICON,
        color: ACCENT,
        importance: AndroidImportance.HIGH,
        pressAction: { id: 'default' },
      },
    });
  } catch (err) {
    // never lose a notification over styling — retry plainly on the General channel
    console.warn('Notification failed, retrying plainly:', err?.message);
    await notifee.displayNotification({ title, body, android: { channelId: DEFAULT_CHANNEL_ID, pressAction: { id: 'default' } } }).catch(() => {});
  }
  return true;
}

/* Registered once at app startup (not gated on login state) so no
   foreground message is missed while auth is still initializing. With
   the app open, FCM hands every push to onMessage and shows nothing
   itself. (Medicine reminders are Notifee's own scheduled notifications,
   so they appear in the foreground without any of this.) */
export function setupForegroundNotifications() {
  channelsReady ||= ensureChannels().catch(() => {});

  return onMessage(messagingInstance, async remoteMessage => {
    if (handleSosPush(remoteMessage)) return; // rings natively, shown in-app by SosLayer
    await displayPush(remoteMessage);
  });
}
