import Transaction from '../models/Transaction.js';
import Subscription from '../models/Subscription.js';
import SubscriptionEvent from '../models/SubscriptionEvent.js';
import { PLANS, STATUS, expiryAfterPurchase, isEntitled, statusAt } from './subscription.js';

export const logEvent = (userId, event, extra = {}) => SubscriptionEvent.create({ userId, event, ...extra }).catch(err => console.warn('Subscription event not recorded:', err.message));

/* Applies a paid transaction to the user's subscription. Written as a
   compare-and-set on the subscription's updatedAt, retried, so two
   payments settling at once can't both start from the same end date
   and lose one of them. */
async function applyPurchase(txn) {
  const plan = txn.plan;
  const info = PLANS[plan];
  for (let attempt = 0; attempt < 5; attempt++) {
    const now = Date.now();
    const sub = await Subscription.findOne({ userId: txn.userId }).lean();
    const entitled = isEntitled(statusAt(sub, now));
    const fromPlan = entitled ? sub.plan : null;
    const set = {
      plan,
      status: STATUS.ACTIVE,
      billingPeriod: info.billingPeriod,
      provider: 'payu',
      providerTransactionId: txn.txnid,
      providerPaymentId: txn.mihpayid || null,
      purchaseDate: new Date(now),
      startDate: fromPlan === plan && sub.startDate ? sub.startDate : new Date(now),
      expiryDate: expiryAfterPurchase(entitled ? sub : null, plan, now),
      autoRenew: false,
      cancelledAt: null,
    };
    if (!sub) {
      try {
        await Subscription.create({ userId: txn.userId, ...set });
        return { fromPlan };
      } catch (err) {
        if (err.code === 11000) continue; // created concurrently — go round again and extend it
        throw err;
      }
    }
    const res = await Subscription.updateOne({ _id: sub._id, updatedAt: sub.updatedAt }, { $set: set });
    if (res.modifiedCount) return { fromPlan };
  }
  throw new Error(`Could not apply transaction ${txn.txnid} to the subscription`);
}

/* Settles a pending transaction with what PayU reported. Safe to call
   more than once for the same txnid (a replayed callback, or the
   callback and Restore Purchases racing): only the call that moves it
   out of `pending` applies anything. The amount must match what we
   asked for at checkout — the plan and price always come from our own
   record, never from PayU's post. Returns the settled status. */
export async function settleTransaction(txnid, { success, amount, mihpayid }) {
  const pending = await Transaction.findOne({ txnid }).lean();
  if (!pending) return null;
  if (pending.status !== 'pending') return pending.status;

  if (success && Math.abs(Number(amount) - pending.amount) > 0.001) {
    console.error('PayU amount mismatch — not granting', { txnid, expected: pending.amount, got: amount });
    success = false;
  }

  const status = success ? 'success' : 'failure';
  const txn = await Transaction.findOneAndUpdate({ txnid, status: 'pending' }, { $set: { status, mihpayid: mihpayid || null } }, { new: true, lean: true });
  if (!txn) return (await Transaction.findOne({ txnid }, 'status').lean())?.status || null;

  if (!success) {
    await logEvent(txn.userId, 'payment_failed', { plan: txn.plan });
    return status;
  }

  const { fromPlan } = await applyPurchase(txn);
  await Transaction.updateOne({ _id: txn._id }, { $set: { fromPlan } });
  await logEvent(txn.userId, 'payment_success', { plan: txn.plan, fromPlan });
  if (fromPlan === txn.plan) await logEvent(txn.userId, 'subscription_renewed', { plan: txn.plan });
  else if (fromPlan) await logEvent(txn.userId, 'plan_changed', { plan: txn.plan, fromPlan });
  return status;
}
