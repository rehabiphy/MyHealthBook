import User from '../models/User.js';
import Subscription from '../models/Subscription.js';
import { PLANS, STATUS } from '../utils/subscription.js';
import { resolveEntitlement } from '../utils/entitlements.js';
import { notifyUser } from '../utils/push.js';

/* Hourly subscription upkeep.

   1. Keeps each stored status in step with its dates, so plans that ran
      out overnight read as GRACE_PERIOD / EXPIRED in reporting (and are
      logged as subscription_expired) without waiting for their owner to
      open the app. Access checks never depend on this — they recompute.
   2. One reminder, three days before a pass ends, since prepaid passes
      don't renew by themselves. Only for plans not cancelled, and at
      most once per pass (claimed atomically on reminderSentFor). Nothing
      is sent when a plan ends: the app says so itself next time it's
      opened. Medicine reminders are scheduled on the phone and don't
      depend on the plan at all. */

const TICK_MS = 60 * 60 * 1000;
const REMIND_BEFORE_MS = 3 * 24 * 60 * 60 * 1000;
const ENTITLED = [STATUS.ACTIVE, STATUS.CANCELLED, STATUS.GRACE_PERIOD];

const fmtDate = d => new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Kolkata' });

async function syncEnded() {
  const stale = await Subscription.find({ status: { $in: ENTITLED }, expiryDate: { $lte: new Date() } }, 'userId').lean();
  for (const s of stale) {
    await resolveEntitlement(s.userId).catch(err => console.warn('Subscription sync failed for', s.userId.toString(), '—', err.message));
  }
}

async function sendReminders() {
  const now = Date.now();
  const due = await Subscription.find({
    status: STATUS.ACTIVE,
    cancelledAt: null,
    expiryDate: { $gt: new Date(now), $lte: new Date(now + REMIND_BEFORE_MS) },
  }).lean();

  for (const sub of due) {
    if (sub.reminderSentFor && new Date(sub.reminderSentFor).getTime() === new Date(sub.expiryDate).getTime()) continue;
    const claimed = await Subscription.updateOne({ _id: sub._id, expiryDate: sub.expiryDate, reminderSentFor: sub.reminderSentFor }, { $set: { reminderSentFor: sub.expiryDate } });
    if (!claimed.modifiedCount) continue;
    const user = await User.findById(sub.userId, 'fcmTokens').lean();
    if (!user) continue;
    const label = PLANS[sub.plan]?.label || 'Your plan';
    try {
      await notifyUser(user, {
        title: `${label} ends on ${fmtDate(sub.expiryDate)}`,
        body: 'Renew from Profile → Subscription to keep Plus features. Your health information stays available either way.',
        data: { type: 'subscription_ending' },
      });
    } catch (err) {
      console.warn('Subscription reminder failed for', sub.userId.toString(), '—', err.message);
    }
  }
}

async function tick() {
  await syncEnded();
  // like the health tips: a dev server on the real database mustn't message real users
  if (process.env.SUBSCRIPTION_REMINDERS_ENABLED === 'true') await sendReminders();
}

let timer = null;

export function startSubscriptionJobs() {
  if (timer) return;
  const run = () => tick().catch(err => console.warn('Subscription job failed:', err.message));
  setTimeout(run, 60 * 1000);
  timer = setInterval(run, TICK_MS);
}
