import mongoose from 'mongoose';
import User from '../models/User.js';
import Notification from '../models/Notification.js';
import { sendHealthTip } from '../jobs/healthTips.js';

const TEST_COOLDOWN_MS = 30 * 1000; // each test is an AI call — stop a finger on the button running up a bill
const lastTest = new Map(); // userId → when they last asked

const PAGE_SIZE = 30;

const serialize = n => ({
  id: n._id.toString(),
  type: n.type,
  title: n.title,
  body: n.body,
  data: n.data || {},
  read: !!n.readAt,
  createdAt: n.createdAt,
});

/* GET /api/notifications?before=<id> — newest first, a page at a time
   (`before` is the last id of the previous page), plus how many are unread. */
export async function listNotifications(req, res) {
  const filter = { userId: req.user.id };
  if (req.query.before && mongoose.isValidObjectId(req.query.before)) filter._id = { $lt: req.query.before };
  const [items, unread] = await Promise.all([
    Notification.find(filter)
      .sort({ _id: -1 })
      .limit(PAGE_SIZE + 1)
      .lean(),
    Notification.countDocuments({ userId: req.user.id, readAt: null }),
  ]);
  return res.json({ success: true, notifications: items.slice(0, PAGE_SIZE).map(serialize), hasMore: items.length > PAGE_SIZE, unread });
}

// GET /api/notifications/unread-count — for the badge on the Home bell
export async function unreadCount(req, res) {
  const unread = await Notification.countDocuments({ userId: req.user.id, readAt: null });
  return res.json({ success: true, unread });
}

// POST /api/notifications/read  { ids?: string[] } — those, or all when no ids
export async function markRead(req, res) {
  const filter = { userId: req.user.id, readAt: null };
  const ids = req.body?.ids;
  if (Array.isArray(ids)) filter._id = { $in: ids.filter(id => mongoose.isValidObjectId(id)) };
  await Notification.updateMany(filter, { $set: { readAt: new Date() } });
  return res.json({ success: true });
}

// DELETE /api/notifications/:id
export async function deleteNotification(req, res) {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ success: false, message: 'Notification not found' });
  await Notification.deleteOne({ _id: req.params.id, userId: req.user.id });
  return res.json({ success: true });
}

// DELETE /api/notifications — clears the whole list
export async function clearNotifications(req, res) {
  await Notification.deleteMany({ userId: req.user.id });
  return res.json({ success: true });
}

// GET /api/notifications/settings
export async function getNotificationSettings(req, res) {
  const user = await User.findById(req.user.id, 'healthTips').lean();
  if (!user) return res.status(404).json({ success: false, message: 'User not found' });
  return res.json({ success: true, settings: { healthTips: user.healthTips !== false } });
}

// PATCH /api/notifications/settings  { healthTips: boolean }
export async function updateNotificationSettings(req, res) {
  const { healthTips } = req.body || {};
  if (typeof healthTips !== 'boolean') {
    return res.status(400).json({ success: false, message: 'healthTips must be true or false' });
  }
  await User.updateOne({ _id: req.user.id }, { $set: { healthTips } });
  return res.json({ success: true, settings: { healthTips } });
}

/* POST /api/notifications/health-tip — today's tip, right now, to the
   caller's own phones. For trying it out; doesn't count as the day's tip. */
export async function sendHealthTipNow(req, res) {
  const since = Date.now() - (lastTest.get(req.user.id) || 0);
  if (since < TEST_COOLDOWN_MS) {
    return res.status(429).json({ success: false, message: `Please wait ${Math.ceil((TEST_COOLDOWN_MS - since) / 1000)} s before asking for another tip.` });
  }
  lastTest.set(req.user.id, Date.now());

  const user = await User.findById(req.user.id, 'name fcmTokens tzOffsetMin healthTipLast').lean();
  if (!user) return res.status(404).json({ success: false, message: 'User not found' });
  if (!user.fcmTokens?.length) {
    return res.status(409).json({ success: false, message: "This phone isn't registered for notifications yet. Allow notifications, then reopen the app." });
  }
  const tip = await sendHealthTip(user);
  if (!tip.sent) {
    return res.status(502).json({ success: false, message: "The tip couldn't be delivered to your phone. Try again in a minute." });
  }
  return res.json({ success: true, tip });
}
