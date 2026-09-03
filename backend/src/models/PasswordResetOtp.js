import mongoose from 'mongoose';

/* Same shape as EmailVerification, kept as its own collection rather
   than a shared "purpose"-tagged model — a registration code and a
   password-reset code gate completely different next actions (create
   a user vs. replace one's password), and this codebase already
   prefers small explicit models over one polymorphic one. */
const passwordResetOtpSchema = new mongoose.Schema({
  email: { type: String, required: true, trim: true, lowercase: true, unique: true },
  otp: { type: String, required: true },
  attempts: { type: Number, default: 0 },
  verified: { type: Boolean, default: false },
  expiresAt: { type: Date, required: true },
});

passwordResetOtpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.model('PasswordResetOtp', passwordResetOtpSchema);
