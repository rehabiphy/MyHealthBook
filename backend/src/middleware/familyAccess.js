import mongoose from 'mongoose';
import FamilyLink from '../models/FamilyLink.js';

export const FAMILY_OWNER_HEADER = 'x-family-owner';

const SCOPE_LABEL = { readings: 'readings', medicines: 'medicines', records: 'medical records', health: 'health details' };

/* Lets a family member act on the data of someone who shared it with
   them. When the request carries `X-Family-Owner: <ownerUserId>`, this
   checks for an accepted FamilyLink from that owner to the signed-in
   user that includes `scope`, then swaps req.user.id to the owner so the
   existing controllers read/write the owner's data unchanged. The real
   caller stays available as req.user.actorId.

   Must run after requireAuth on EVERY per-user data route — a route that
   ignored the header would silently act on the caller's own data.
     scope = 'readings' | 'medicines' | 'records' | 'health'
     scope = 'any'   → any accepted link will do (e.g. basic profile)
     scope = null    → never allowed on someone else's behalf */
export default function familyAccess(scope) {
  return async (req, res, next) => {
    const ownerId = req.get(FAMILY_OWNER_HEADER);
    if (!ownerId) return next();

    if (!scope) {
      return res.status(403).json({ success: false, message: "This can't be done on a family member's behalf" });
    }
    if (!mongoose.isValidObjectId(ownerId)) {
      return res.status(400).json({ success: false, message: 'Invalid family member' });
    }
    if (ownerId === req.user.id) return next();

    try {
      const link = await FamilyLink.findOne({ ownerId, memberId: req.user.id, status: 'accepted' }).lean();
      if (!link || (scope !== 'any' && !link.scopes.includes(scope))) {
        const what = scope === 'any' ? 'their data' : `their ${SCOPE_LABEL[scope] || scope}`;
        return res.status(403).json({ success: false, message: `This family member hasn't shared ${what} with you` });
      }
      req.user = { id: ownerId, actorId: req.user.id };
      return next();
    } catch (err) {
      return next(err);
    }
  };
}
