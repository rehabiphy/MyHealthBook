import Subscription from '../models/Subscription.js';
import Transaction from '../models/Transaction.js';
import { PLANS, STATUS } from '../utils/subscription.js';
import { resolveEntitlement } from '../utils/entitlements.js';
import { settleTransaction, logEvent } from '../utils/purchases.js';
import { verifyPayment } from '../utils/payu.js';
import { isOneOf } from '../utils/validators.js';

const CATALOG = Object.entries(PLANS).map(([id, p]) => ({ id, ...p }));

// events the app may report itself; everything to do with money is recorded server-side only
const CLIENT_EVENTS = ['subscription_screen_viewed', 'plan_selected'];

const RESTORE_LOOKBACK_MS = 7 * 24 * 60 * 60 * 1000;

const respond = async (res, userId, extra = {}) => res.json({ success: true, ...(await resolveEntitlement(userId)), plans: CATALOG, ...extra });

/* GET /api/subscription — the signed-in user's plan, what it unlocks
   (features + limits) and the plan catalog. The app decides what to
   show from this, and the server enforces the same answers itself. */
export async function getSubscription(req, res) {
  return respond(res, req.user.id);
}

/* POST /api/subscription/cancel — stops the plan being renewed. Plus
   stays on until the end of what's already paid for; nothing is
   refunded and nothing is deleted. */
export async function cancelSubscription(req, res) {
  const ent = await resolveEntitlement(req.user.id);
  if (ent.subscription.status !== STATUS.ACTIVE) {
    return res.status(400).json({ success: false, message: "You don't have an active plan to cancel." });
  }
  await Subscription.updateOne({ userId: req.user.id }, { $set: { cancelledAt: new Date() } });
  await logEvent(req.user.id, 'subscription_cancelled', { plan: ent.subscription.plan });
  return respond(res, req.user.id);
}

// POST /api/subscription/resume — undoes a cancel while the plan is still running
export async function resumeSubscription(req, res) {
  const ent = await resolveEntitlement(req.user.id);
  if (ent.subscription.status !== STATUS.CANCELLED) {
    return res.status(400).json({ success: false, message: 'Your plan is not cancelled.' });
  }
  await Subscription.updateOne({ userId: req.user.id }, { $set: { cancelledAt: null } });
  await logEvent(req.user.id, 'subscription_resumed', { plan: ent.subscription.plan });
  return respond(res, req.user.id);
}

/* POST /api/subscription/restore — for a reinstall, a new phone, or a
   payment whose confirmation never reached us (app closed mid-payment).
   The plan is tied to the account, so signing in already restores it;
   this additionally asks PayU about any of this user's payments from
   the last week that are still pending here, and applies the ones PayU
   says went through. */
export async function restorePurchases(req, res) {
  const pending = await Transaction.find({ userId: req.user.id, status: 'pending', createdAt: { $gt: new Date(Date.now() - RESTORE_LOOKBACK_MS) } }).lean();

  let recovered = 0;
  for (const txn of pending) {
    try {
      const payu = await verifyPayment(txn.txnid);
      // PayU returns "Not Found" for checkouts that were opened but never paid — leave those pending
      if (!payu || !payu.status || payu.status === 'Not Found') continue;
      const ok = payu.status === 'success';
      if (!ok && payu.status !== 'failure') continue; // still in progress at PayU
      const settled = await settleTransaction(txn.txnid, { success: ok, amount: payu.amt ?? payu.transaction_amount, mihpayid: payu.mihpayid });
      if (settled === 'success') recovered++;
    } catch (err) {
      console.warn('Restore: PayU check failed for', txn.txnid, '—', err.message);
    }
  }

  const ent = await resolveEntitlement(req.user.id);
  if (ent.source === 'own') await logEvent(req.user.id, 'subscription_restored', { plan: ent.subscription.plan });
  return res.json({ success: true, ...ent, plans: CATALOG, recovered });
}

// POST /api/subscription/events { event, plan? }
export async function recordEvent(req, res) {
  const { event, plan } = req.body || {};
  if (!isOneOf(event, CLIENT_EVENTS)) {
    return res.status(400).json({ success: false, message: 'Unknown event' });
  }
  await logEvent(req.user.id, event, { plan: PLANS[plan] ? plan : null });
  return res.json({ success: true });
}
