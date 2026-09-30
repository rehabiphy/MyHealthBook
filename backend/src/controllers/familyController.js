import mongoose from 'mongoose';
import User from '../models/User.js';
import FamilyLink, { FAMILY_SCOPES } from '../models/FamilyLink.js';
import { messaging } from '../utils/firebaseAdmin.js';
import { isValidUsername, normalizeUsername } from '../utils/validators.js';
import { resolveEntitlement, limitOf } from '../utils/entitlements.js';

const personOf = u => (u ? { id: u._id.toString(), name: u.name, username: u.username || null } : null);

function cleanScopes(scopes) {
  if (!Array.isArray(scopes)) return null;
  const out = [...new Set(scopes)].filter(s => FAMILY_SCOPES.includes(s));
  return out.length === scopes.length && out.length > 0 ? out : null;
}

async function findLink(id) {
  if (!mongoose.isValidObjectId(id)) return null;
  return FamilyLink.findById(id);
}

/* Best-effort push to the invitee's devices — an invite still works
   (they see it on their Family page) if this fails or they have none. */
async function notifyInvite(member, owner) {
  const tokens = member.fcmTokens || [];
  if (!tokens.length) return;
  try {
    await messaging.sendEachForMulticast({
      tokens,
      notification: {
        title: 'Family invitation',
        body: `${owner.name} (@${owner.username}) wants to share their health record with you`,
      },
      data: { type: 'family_invite' },
    });
  } catch (err) {
    console.warn('Family invite push failed:', err.message);
  }
}

/* GET /api/family
     sharedWithMe — people whose data I can open (accepted, I'm the member)
     invites      — pending invitations waiting for my answer
     myFamily     — people I've shared my own data with (pending or accepted) */
export async function getFamily(req, res) {
  const me = req.user.id;
  const links = await FamilyLink.find({ $or: [{ ownerId: me }, { memberId: me }] })
    .sort({ createdAt: -1 })
    .populate('ownerId', 'name username')
    .populate('memberId', 'name username')
    .lean();

  const sharedWithMe = [];
  const invites = [];
  const myFamily = [];
  for (const l of links) {
    const base = { id: l._id.toString(), scopes: l.scopes, status: l.status, createdAt: l.createdAt, acceptedAt: l.acceptedAt };
    if (l.ownerId?._id.toString() === me) {
      myFamily.push({ ...base, member: personOf(l.memberId) });
    } else if (l.status === 'accepted') {
      sharedWithMe.push({ ...base, owner: personOf(l.ownerId) });
    } else {
      invites.push({ ...base, owner: personOf(l.ownerId) });
    }
  }
  const ent = await resolveEntitlement(me);
  return res.json({ success: true, sharedWithMe, invites, myFamily, scopes: FAMILY_SCOPES, memberLimit: limitOf(ent, 'familyMembers') });
}

/* GET /api/family/lookup?username=mom — confirms who a username belongs
   to before inviting, so a typo doesn't share a record with a stranger. */
export async function lookupUser(req, res) {
  const username = normalizeUsername(req.query.username);
  if (!isValidUsername(username)) {
    return res.status(400).json({ success: false, message: 'Enter a valid username' });
  }
  const user = await User.findOne({ username }, 'name username').lean();
  if (!user) {
    return res.status(404).json({ success: false, message: `No one uses @${username}` });
  }
  if (user._id.toString() === req.user.id) {
    return res.status(400).json({ success: false, message: "That's your own username" });
  }
  return res.json({ success: true, user: personOf(user) });
}

export async function invite(req, res) {
  const username = normalizeUsername(req.body?.username);
  const scopes = cleanScopes(req.body?.scopes);

  if (!isValidUsername(username)) {
    return res.status(400).json({ success: false, message: 'Enter a valid username' });
  }
  if (!scopes) {
    return res.status(400).json({ success: false, message: 'Choose at least one section to share' });
  }

  const [owner, member] = await Promise.all([User.findById(req.user.id), User.findOne({ username })]);
  if (!member) {
    return res.status(404).json({ success: false, message: `No one uses @${username}` });
  }
  if (member._id.toString() === req.user.id) {
    return res.status(400).json({ success: false, message: "You can't invite yourself" });
  }

  const existing = await FamilyLink.findOne({ ownerId: req.user.id, memberId: member._id });
  if (existing?.status === 'accepted') {
    return res.status(409).json({ success: false, message: `@${username} is already in your family — change what they can see from your list` });
  }
  if (existing) {
    existing.scopes = scopes;
    await existing.save();
    return res.json({ success: true, link: { id: existing._id.toString(), scopes, status: existing.status, member: personOf(member) } });
  }

  /* How many people you can share your record with depends on your
     plan (pending invites count). Going over it after a Family plan
     ends never removes anyone — those links keep working; you just
     can't add more until you're back under the limit or on Family. */
  const limit = limitOf(await resolveEntitlement(req.user.id), 'familyMembers');
  if (limit !== null && (await FamilyLink.countDocuments({ ownerId: req.user.id })) >= limit) {
    return res.status(403).json({
      success: false,
      limitReached: 'familyMembers',
      message: `Your plan lets you share with up to ${limit} family member${limit === 1 ? '' : 's'}. The Family plan allows up to 6.`,
    });
  }

  const link = await FamilyLink.create({ ownerId: req.user.id, memberId: member._id, scopes });
  notifyInvite(member, owner);
  return res.status(201).json({ success: true, link: { id: link._id.toString(), scopes, status: link.status, member: personOf(member) } });
}

export async function acceptInvite(req, res) {
  const link = await findLink(req.params.id);
  if (!link || link.memberId.toString() !== req.user.id) {
    return res.status(404).json({ success: false, message: 'Invitation not found' });
  }
  if (link.status !== 'accepted') {
    link.status = 'accepted';
    link.acceptedAt = new Date();
    await link.save();
  }
  return res.json({ success: true });
}

// declining a pending invite, or leaving someone's family later, both just remove the link
export async function removeLink(req, res) {
  const link = await findLink(req.params.id);
  const me = req.user.id;
  if (!link || (link.ownerId.toString() !== me && link.memberId.toString() !== me)) {
    return res.status(404).json({ success: false, message: 'Not found' });
  }
  await link.deleteOne();
  return res.json({ success: true });
}

// only the owner decides what of their data is shared
export async function updateScopes(req, res) {
  const scopes = cleanScopes(req.body?.scopes);
  if (!scopes) {
    return res.status(400).json({ success: false, message: 'Choose at least one section to share' });
  }
  const link = await findLink(req.params.id);
  if (!link || link.ownerId.toString() !== req.user.id) {
    return res.status(404).json({ success: false, message: 'Not found' });
  }
  link.scopes = scopes;
  await link.save();
  return res.json({ success: true, scopes });
}
