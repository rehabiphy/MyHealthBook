import mongoose from 'mongoose';

const bodyReadingSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    ts: { type: Number, required: true },
    weightKg: { type: Number, required: true },
  },
  { timestamps: true },
);

bodyReadingSchema.index({ userId: 1, ts: -1 });

export default mongoose.model('BodyReading', bodyReadingSchema);
