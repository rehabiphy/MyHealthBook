import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 100 },
    email: { type: String, required: true, unique: true, trim: true, lowercase: true },
    // public handle family invites are sent to; sparse so accounts made before usernames existed stay valid until they pick one
    username: { type: String, unique: true, sparse: true, trim: true, lowercase: true },
    phone: { type: String, required: false, trim: true, default: '' },
    passwordHash: { type: String, required: true },
    isEmailVerified: { type: Boolean, default: false },
    googleId: { type: String, unique: true, sparse: true },
    // legacy — the old single "premium" pass. Read once to carry it over into a Subscription (utils/entitlements.js), never written now
    subscription: { type: String, enum: ['free', 'premium'], default: 'free' },
    premiumExpiry: { type: Date, default: null },
    insightsUsedThisMonth: { type: Number, default: 0 },
    insightsMonthKey: { type: String, default: '' },
    fcmTokens: { type: [String], default: [] },
    // the phone's UTC offset in minutes (IST = 330), reported with the FCM token — pushes go out by the user's own clock
    tzOffsetMin: { type: Number, default: null },
    // the once-a-day AI health tip push (jobs/healthTips.js)
    healthTips: { type: Boolean, default: true },
    healthTipDay: { type: String, default: '' }, // the user's local YYYY-MM-DD it was last sent — at most one a day
    healthTipLast: { type: String, default: '' }, // so tomorrow's tip doesn't repeat today's
  },
  { timestamps: true },
);

export default mongoose.model('User', userSchema);
