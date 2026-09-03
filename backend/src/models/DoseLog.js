import mongoose from 'mongoose';

const doseLogSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    medId: { type: mongoose.Schema.Types.ObjectId, ref: 'Medicine', required: true },
    slotKey: { type: String, required: true },
    day: { type: String, required: true },
    takenAt: { type: Number, required: true },
  },
  { timestamps: true },
);

doseLogSchema.index({ userId: 1, medId: 1, slotKey: 1, day: 1 }, { unique: true });
doseLogSchema.index({ userId: 1, day: 1 });

export default mongoose.model('DoseLog', doseLogSchema);
