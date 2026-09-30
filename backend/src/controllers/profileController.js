import Profile from '../models/Profile.js';

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

const MAX_UPCOMING = 50;
const str = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

/* Follow-ups / appointments — only these fields, only this many, so the
   Mixed column can't be used to stash arbitrary data. */
function cleanUpcoming(list) {
  return list.slice(0, MAX_UPCOMING).flatMap(u => {
    const title = str(u?.title, 200);
    const date = Number(u?.date);
    if (!title || !Number.isFinite(date)) return [];
    return [{ id: str(u.id, 40) || Math.random().toString(36).slice(2, 10), title, date, doctor: str(u.doctor, 150), place: str(u.place, 150) }];
  });
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
  if (upcoming !== undefined) patch['health.upcoming'] = cleanUpcoming(upcoming);

  const profile = await Profile.findOneAndUpdate({ userId: req.user.id }, patch, {
    upsert: true,
    new: true,
    setDefaultsOnInsert: true,
  });
  return res.json({ success: true, ...publicProfile(profile) });
}
