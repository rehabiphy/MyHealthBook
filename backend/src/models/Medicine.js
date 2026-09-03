import mongoose from 'mongoose';

const medicineSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    name: { type: String, required: true, trim: true, maxlength: 150 },
    dose: { type: String, trim: true, default: '' },
    slots: { type: [String], required: true },
    added: { type: Number, required: true },
    status: { type: String, enum: ['active', 'paused', 'discontinued'], default: 'active' },
    perDose: { type: Number, default: 1, min: 1 },
    stock: { type: Number, default: null },
    stockedAt: { type: Number, default: null },
    stoppedAt: { type: Number },
    stopReason: { type: String, trim: true, default: '' },
    fromHistory: { type: mongoose.Schema.Types.ObjectId, ref: 'HistoryRecord' },
  },
  { timestamps: true },
);

medicineSchema.index({ userId: 1, status: 1 });

export default mongoose.model('Medicine', medicineSchema);
