import mongoose from 'mongoose';

/* Small key → value settings the server reads at runtime, so they can
   be changed in the database without a new app or server release.
   Used for the plan → feature map ('entitlements', see
   utils/entitlements.js). */
const appConfigSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true },
    value: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true },
);

export default mongoose.model('AppConfig', appConfigSchema);
