import mongoose from 'mongoose';

export const SUBSCRIPTION_EVENTS = [
  'subscription_screen_viewed',
  'plan_selected',
  'checkout_started',
  'payment_success',
  'payment_failed',
  'subscription_renewed',
  'subscription_cancelled',
  'subscription_resumed',
  'subscription_expired',
  'subscription_restored',
  'plan_changed',
];

/* Funnel analytics for the subscription flow only. Holds the plan and
   event name — never anything from the user's health record. */
const subscriptionEventSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    event: { type: String, enum: SUBSCRIPTION_EVENTS, required: true },
    plan: { type: String, default: null },
    fromPlan: { type: String, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

subscriptionEventSchema.index({ event: 1, createdAt: -1 });
subscriptionEventSchema.index({ userId: 1, createdAt: -1 });

export default mongoose.model('SubscriptionEvent', subscriptionEventSchema);
