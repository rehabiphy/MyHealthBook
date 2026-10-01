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

/* What MyHealth AI read from the attached file (utils/documentReader.js),
   so the chat can answer questions about it without opening the file
   every time. Reset to pending whenever the file changes. */
const extractSchema = new mongoose.Schema(
  {
    status: { type: String, enum: ['pending', 'done', 'failed', 'unsupported'], default: 'pending' },
    text: { type: String, default: '' },
    attempts: { type: Number, default: 0 },
    at: { type: Date, default: null },
  },
  { _id: false },
);

export const RECORD_TYPES = ['test', 'prescription', 'diagnosis', 'treatment', 'procedure', 'bill', 'other'];

const historyRecordSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    type: { type: String, required: true, enum: RECORD_TYPES },
    date: { type: Number, required: true },
    title: { type: String, required: true, trim: true, maxlength: 200 },
    details: { type: String, trim: true, default: '' },
    doctor: { type: String, trim: true, default: '' },
    hospital: { type: String, trim: true, default: '' },
    medName: { type: String, trim: true, default: '' },
    medDose: { type: String, trim: true, default: '' },
    notes: { type: String, trim: true, default: '' },
    // bills: the total paid, in rupees
    amount: { type: Number, default: null, min: 0 },
    // older records: only a "name · size" label was kept, never the file — still shown, can't be opened
    file: { type: String, trim: true, default: '' },
    attachment: { type: attachmentSchema, default: null },
    extract: { type: extractSchema, default: null },
    promoted: { type: Boolean, default: false },
  },
  { timestamps: true },
);

historyRecordSchema.index({ userId: 1, date: -1 });
historyRecordSchema.index({ 'extract.status': 1 });

export default mongoose.model('HistoryRecord', historyRecordSchema);
