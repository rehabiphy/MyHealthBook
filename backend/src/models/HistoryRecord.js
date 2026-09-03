import mongoose from 'mongoose';

const historyRecordSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    type: { type: String, required: true, enum: ['test', 'diagnosis', 'treatment', 'procedure', 'other'] },
    date: { type: Number, required: true },
    title: { type: String, required: true, trim: true, maxlength: 200 },
    details: { type: String, trim: true, default: '' },
    doctor: { type: String, trim: true, default: '' },
    hospital: { type: String, trim: true, default: '' },
    medName: { type: String, trim: true, default: '' },
    medDose: { type: String, trim: true, default: '' },
    notes: { type: String, trim: true, default: '' },
    file: { type: String, trim: true, default: '' },
    promoted: { type: Boolean, default: false },
  },
  { timestamps: true },
);

historyRecordSchema.index({ userId: 1, date: -1 });

export default mongoose.model('HistoryRecord', historyRecordSchema);
