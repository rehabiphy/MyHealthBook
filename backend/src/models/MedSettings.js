import mongoose from 'mongoose';

const medSettingsSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    times: {
      type: mongoose.Schema.Types.Mixed,
      default: { empty: '07:00', breakfast: '09:00', lunch: '14:00', dinner: '21:00', bed: '22:30' },
    },
    lead: { type: Number, default: 10 },
    notify: { type: Boolean, default: false },
  },
  { timestamps: true },
);

export default mongoose.model('MedSettings', medSettingsSchema);
