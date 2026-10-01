import mongoose from 'mongoose';

const KEEP_DAYS = 90;

/* The in-app copy of every push the server sends a user (health tip,
   family invite, SOS, plan reminder) — what the Notifications page
   lists. Written before the push goes out, so it's there even when the
   phone has no token or the push is lost. Old ones age out on their own. */
const notificationSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    type: { type: String, default: 'general' },
    title: { type: String, default: '' },
    body: { type: String, default: '' },
    data: { type: mongoose.Schema.Types.Mixed, default: {} },
    readAt: { type: Date, default: null },
  },
  { timestamps: true },
);

notificationSchema.index({ userId: 1, createdAt: -1 });
notificationSchema.index({ createdAt: 1 }, { expireAfterSeconds: KEEP_DAYS * 24 * 60 * 60 });

export default mongoose.model('Notification', notificationSchema);
