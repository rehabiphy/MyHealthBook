import mongoose from 'mongoose';

// the report file itself, in S3 (utils/s3.js) — type and size are what S3 actually holds, not what the phone claimed
const attachmentSchema = new mongoose.Schema(
  {
    key: { type: String, required: true },
    name: { type: String, trim: true, maxlength: 200, default: 'report' },
    type: { type: String, required: true },
    size: { type: Number, required: true },
    uploadedAt: { type: Date, default: Date.now },
  },
  { _id: false },
);

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
    // older records: only a "name · size" label was kept, never the file — still shown, can't be opened
    file: { type: String, trim: true, default: '' },
    attachment: { type: attachmentSchema, default: null },
    promoted: { type: Boolean, default: false },
  },
  { timestamps: true },
);

historyRecordSchema.index({ userId: 1, date: -1 });

export default mongoose.model('HistoryRecord', historyRecordSchema);
