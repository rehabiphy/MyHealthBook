import mongoose from 'mongoose';

/* How long an SOS rings on family phones. The sender can cancel inside
   this window; after it the alert expires on its own. */
export const SOS_WINDOW_MS = 30 * 1000;

const recipientSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    // what this recipient did on their own phone — never affects anyone else's
    state: { type: String, enum: ['sent', 'silenced', 'dismissed'], default: 'sent' },
    at: { type: Date, default: null },
  },
  { _id: false },
);

// where the sender's phone was when it raised the SOS (as reported by the phone)
const locationSchema = new mongoose.Schema(
  {
    lat: { type: Number, required: true },
    lng: { type: Number, required: true },
    accuracy: { type: Number, default: null }, // metres
    at: { type: Date, default: null }, // when the phone got the fix — can be older than the alert
  },
  { _id: false },
);

/* One SOS raised by `userId` — from a detected fall, or pressed by hand.
   Recipients are everyone in their family circle at the moment it fired. */
const sosAlertSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    trigger: { type: String, enum: ['fall', 'manual'], default: 'fall' },
    status: { type: String, enum: ['active', 'cancelled', 'expired'], default: 'active' },
    expiresAt: { type: Date, required: true },
    endedAt: { type: Date, default: null },
    recipients: { type: [recipientSchema], default: [] },
    location: { type: locationSchema, default: null },
  },
  { timestamps: true },
);

sosAlertSchema.index({ userId: 1, status: 1 });
sosAlertSchema.index({ 'recipients.userId': 1, status: 1 });

export default mongoose.model('SosAlert', sosAlertSchema);
