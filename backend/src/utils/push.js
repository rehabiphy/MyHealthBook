import User from '../models/User.js';
import Notification from '../models/Notification.js';
import { messaging } from './firebaseAdmin.js';

const DEAD_TOKEN_CODES = ['messaging/registration-token-not-registered', 'messaging/invalid-registration-token'];

/* Saves a notification to each user's in-app list (the Notifications
   page). Best-effort: a failed write never stops the push itself.
   Returns the saved notification ids, keyed by user id. */
export async function recordNotification(userIds, { type = 'general', title = '', body = '', data = {} }) {
  try {
    const docs = await Notification.insertMany(userIds.map(userId => ({ userId, type, title, body, data })));
    return Object.fromEntries(docs.map(d => [d.userId.toString(), d._id.toString()]));
  } catch (err) {
    console.warn('Saving notification failed:', err.message);
    return {};
  }
}

/* A notification to every phone one user is signed in on.

   Sent as a data message — title, body and channelId ride in `data` and
   the app draws it with Notifee (src/lib/notifications.js displayPush),
   open or closed. A plain FCM notification would be drawn by Android
   itself while the app is closed, and that can't carry the app logo as
   a large icon. Needs an app build that has displayPush: older builds
   don't show these at all. `channelId` must be one the app creates.
   It's also saved to the user's in-app list first (data.type is its
   type), so it shows there even if no phone gets it. Tokens FCM
   reports as dead are dropped from the user. Returns how many phones
   accepted it. */
export async function notifyUser(user, { title, body, data = {}, channelId = 'default' }) {
  const saved = await recordNotification([user._id], { type: data.type, title, body, data });
  const notificationId = saved[user._id.toString()];

  const tokens = user.fcmTokens || [];
  if (!tokens.length) return 0;

  const res = await messaging.sendEachForMulticast({
    tokens,
    // FCM data values must all be strings
    data: Object.fromEntries(Object.entries({ ...data, title, body, channelId, notificationId }).map(([k, v]) => [k, String(v ?? '')])),
    // high priority is what wakes a closed app to draw it
    android: { priority: 'high' },
  });

  const dead = tokens.filter((t, i) => !res.responses[i].success && DEAD_TOKEN_CODES.includes(res.responses[i].error?.code));
  if (dead.length) await User.updateOne({ _id: user._id }, { $pull: { fcmTokens: { $in: dead } } });
  return res.successCount;
}
