import mongoose from 'mongoose';

const profileSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    name: { type: String, trim: true, default: '' },
    age: { type: String, default: '' },
    sex: { type: String, default: '' },
    heightCm: { type: String, default: '' },
    diet: { type: String, default: 'veg' },
    docPhone: { type: String, trim: true, default: '' },
    docEmail: { type: String, trim: true, default: '' },
    health: {
      conditions: { type: [String], default: [] },
      allergies: { type: String, default: '' },
      bloodGroup: { type: String, default: '' },
      upcoming: { type: [mongoose.Schema.Types.Mixed], default: [] },
    },
    care: {
      role: { type: String, enum: ['logger', 'viewer'], default: 'logger' },
      circle: { type: [mongoose.Schema.Types.Mixed], default: [] },
      received: { type: [mongoose.Schema.Types.Mixed], default: [] },
      day: { type: Number, default: 0 },
    },
  },
  { timestamps: true },
);

export default mongoose.model('Profile', profileSchema);
