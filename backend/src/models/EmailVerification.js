import mongoose from 'mongoose';

/* Verification happens before a User row exists, so this is its own
   short-lived collection rather than fields on User. TTL-indexed so
   Mongo sweeps expired entries automatically (unlike an in-memory
   store, this survives a server restart). The sweep only runs every
   ~60s though, so callers must still check `expiresAt` themselves
   rather than trusting mere document existence. */
const emailVerificationSchema = new mongoose.Schema({
  email: { type: String, required: true, trim: true, lowercase: true, unique: true },
  token: { type: String, required: true },
  verified: { type: Boolean, default: false },
  expiresAt: { type: Date, required: true },
});

emailVerificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.model('EmailVerification', emailVerificationSchema);
