import mongoose from 'mongoose';

const bpReadingSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    ts: { type: Number, required: true },
    sys: { type: Number, required: true },
    dia: { type: Number, required: true },
    pulse: { type: Number },
  },
  { timestamps: true },
);

bpReadingSchema.index({ userId: 1, ts: -1 });

export default mongoose.model('BpReading', bpReadingSchema);
