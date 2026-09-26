import mongoose from 'mongoose';

/* Sections of a user's record that can be shared. Sharing a section
   grants the member both view and edit on it. */
export const FAMILY_SCOPES = ['readings', 'medicines', 'records', 'health'];

/* One-way share: `ownerId` invites `memberId` (by username) into their
   family and chooses which sections of THEIR OWN data the member can
   see and edit. The member must accept before anything is shared. For
   the other direction the member sends their own invite back. */
const familyLinkSchema = new mongoose.Schema(
  {
    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    memberId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    scopes: { type: [String], enum: FAMILY_SCOPES, default: [] },
    status: { type: String, enum: ['pending', 'accepted'], default: 'pending' },
    acceptedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

familyLinkSchema.index({ ownerId: 1, memberId: 1 }, { unique: true });
familyLinkSchema.index({ memberId: 1, status: 1 });

export default mongoose.model('FamilyLink', familyLinkSchema);
