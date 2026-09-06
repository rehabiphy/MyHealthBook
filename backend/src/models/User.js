import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 100 },
    email: { type: String, required: true, unique: true, trim: true, lowercase: true },
    phone: { type: String, required: false, trim: true, default: '' },
    passwordHash: { type: String, required: true },
    isEmailVerified: { type: Boolean, default: false },
    googleId: { type: String, unique: true, sparse: true },
    subscription: { type: String, enum: ['free', 'premium'], default: 'free' },
    premiumExpiry: { type: Date, default: null },
    insightsUsedThisMonth: { type: Number, default: 0 },
    insightsMonthKey: { type: String, default: '' },
    fcmTokens: { type: [String], default: [] },
  },
  { timestamps: true },
);

export default mongoose.model('User', userSchema);
