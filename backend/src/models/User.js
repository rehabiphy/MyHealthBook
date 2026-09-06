import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 100 },
    email: { type: String, required: true, unique: true, trim: true, lowercase: true },
    phone: { type: String, required: false, trim: true, default: '' },
    passwordHash: { type: String, required: true },
    isEmailVerified: { type: Boolean, default: false },
    googleId: { type: String, unique: true, sparse: true },
  },
  { timestamps: true },
);

export default mongoose.model('User', userSchema);
