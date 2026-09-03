import mongoose from 'mongoose';

const sugarReadingSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    ts: { type: Number, required: true },
    mgdl: { type: Number, required: true },
    kind: { type: String, enum: ['fasting', 'post'], required: true },
  },
  { timestamps: true },
);

sugarReadingSchema.index({ userId: 1, ts: -1 });

export default mongoose.model('SugarReading', sugarReadingSchema);
