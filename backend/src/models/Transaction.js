import mongoose from 'mongoose';

const transactionSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    txnid: { type: String, required: true, unique: true },
    plan: { type: String, enum: ['premium_monthly', 'premium_annual'], required: true },
    amount: { type: Number, required: true },
    status: { type: String, enum: ['success', 'failure'], required: true },
  },
  { timestamps: true },
);

transactionSchema.index({ userId: 1 });

export default mongoose.model('Transaction', transactionSchema);
