import User from '../models/User.js';
import { sendHealthTip } from '../jobs/healthTips.js';

const TEST_COOLDOWN_MS = 30 * 1000; // each test is an AI call — stop a finger on the button running up a bill
const lastTest = new Map(); // userId → when they last asked

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
