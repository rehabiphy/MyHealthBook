import mongoose from 'mongoose';
import { FREE_PLAN, PAID_PLANS, STATUS } from '../utils/subscription.js';

/* A user's current plan — one per user. Payment history lives in
   Transaction; this is only where the account stands now. `status` is
   kept in step with the dates by utils/entitlements.js (statusAt), so
   it's accurate to read for reporting, but access checks always
   recompute it rather than trusting the stored value. No card or UPI
   details are ever stored — PayU holds those. */
const subscriptionSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    plan: { type: String, enum: [FREE_PLAN, ...PAID_PLANS], default: FREE_PLAN },
    status: { type: String, enum: Object.values(STATUS), default: STATUS.FREE },
    billingPeriod: { type: String, enum: ['monthly', 'annual', null], default: null },
    provider: { type: String, enum: ['payu', 'legacy', null], default: null },
    providerTransactionId: { type: String, default: null }, // the PayU txnid of the latest purchase
    providerPaymentId: { type: String, default: null }, // PayU's own mihpayid for it
    purchaseDate: { type: Date, default: null },
    startDate: { type: Date, default: null },
    // prepaid passes don't renew by themselves, so the renewal date is simply when this one ends
    expiryDate: { type: Date, default: null },
    autoRenew: { type: Boolean, default: false },
    cancelledAt: { type: Date, default: null },
    // the expiryDate the "ends in 3 days" reminder was last sent for — one reminder per pass
    reminderSentFor: { type: Date, default: null },
  },
  { timestamps: true },
);

subscriptionSchema.index({ status: 1, plan: 1 });
subscriptionSchema.index({ expiryDate: 1 });

export default mongoose.model('Subscription', subscriptionSchema);
