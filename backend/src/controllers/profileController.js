import Profile from '../models/Profile.js';
import { isOneOf } from '../utils/validators.js';

const PROFILE_FIELDS = ['name', 'age', 'sex', 'heightCm', 'diet', 'docPhone', 'docEmail'];

function publicProfile(doc) {
  return {
    profile: {
      name: doc.name,
      age: doc.age,
      sex: doc.sex,
      heightCm: doc.heightCm,
      diet: doc.diet,
      docPhone: doc.docPhone,
      docEmail: doc.docEmail,
    },
    health: doc.health,
    care: doc.care,
  };
}

export async function getProfile(req, res) {
  const profile = await Profile.findOneAndUpdate(
    { userId: req.user.id },
    {},
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );
  return res.json({ success: true, ...publicProfile(profile) });
}

export async function updateProfile(req, res) {
  const body = req.body || {};
  const patch = {};
  for (const key of PROFILE_FIELDS) {
    if (body[key] !== undefined) patch[key] = String(body[key]);
  }

  const profile = await Profile.findOneAndUpdate({ userId: req.user.id }, patch, {
    upsert: true,
    new: true,
    setDefaultsOnInsert: true,
  });
  return res.json({ success: true, ...publicProfile(profile) });
}

export async function setCareRole(req, res) {
  const { role } = req.body || {};

  if (!isOneOf(role, ['logger', 'viewer'])) {
    return res.status(400).json({ success: false, message: 'Invalid role' });
  }

  const profile = await Profile.findOneAndUpdate(
    { userId: req.user.id },
    { 'care.role': role },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );
  return res.json({ success: true, ...publicProfile(profile) });
}

export async function updateHealth(req, res) {
  const { conditions, allergies, bloodGroup, upcoming } = req.body || {};

  if (conditions !== undefined && (!Array.isArray(conditions) || !conditions.every(c => typeof c === 'string'))) {
    return res.status(400).json({ success: false, message: 'Invalid conditions' });
  }
  if (upcoming !== undefined && !Array.isArray(upcoming)) {
    return res.status(400).json({ success: false, message: 'Invalid upcoming list' });
  }

  const patch = {};
  if (conditions !== undefined) patch['health.conditions'] = conditions;
  if (allergies !== undefined) patch['health.allergies'] = String(allergies);
  if (bloodGroup !== undefined) patch['health.bloodGroup'] = String(bloodGroup);
  if (upcoming !== undefined) patch['health.upcoming'] = upcoming;

  const profile = await Profile.findOneAndUpdate({ userId: req.user.id }, patch, {
    upsert: true,
    new: true,
    setDefaultsOnInsert: true,
  });
  return res.json({ success: true, ...publicProfile(profile) });
}
