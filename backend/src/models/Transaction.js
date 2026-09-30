import mongoose from 'mongoose';
import { PAID_PLANS } from '../utils/subscription.js';

/* One PayU payment attempt. Created as `pending` when checkout starts,
   so the amount and plan the user was charged for are fixed by the
   server, not by whatever PayU posts back; the callback (or a later
   Restore Purchases check with PayU) settles it to success/failure.
   premium_* are purchases made before the current plans existed. */
const transactionSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    txnid: { type: String, required: true, unique: true },
    plan: { type: String, enum: [...PAID_PLANS, 'premium_monthly', 'premium_annual'], required: true },
    amount: { type: Number, required: true },
    status: { type: String, enum: ['pending', 'success', 'failure'], required: true },
    mihpayid: { type: String, default: null }, // PayU's own payment id
    fromPlan: { type: String, default: null }, // the plan in force when this was bought, for plan_changed / renewed
  },
  { timestamps: true },
);

transactionSchema.index({ userId: 1, createdAt: -1 });
transactionSchema.index({ status: 1, createdAt: -1 });

export default mongoose.model('Transaction', transactionSchema);
