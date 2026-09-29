import mongoose from 'mongoose';
import User from '../models/User.js';
import FamilyLink from '../models/FamilyLink.js';
import SosAlert, { SOS_WINDOW_MS } from '../models/SosAlert.js';
import { messaging } from '../utils/firebaseAdmin.js';

/* A late push still reaches the phone (it then shows a quiet "missed
   SOS" instead of ringing), so let FCM hold it well past the window. */
const PUSH_TTL_MS = 10 * 60 * 1000;

const expiryTimers = new Map(); // alertId → timeout that ends it at expiresAt

/* The phone's { lat, lng, accuracy, at } from the request body, or null
   if it's missing or not a real coordinate — an SOS still goes out without one. */
function parseLocation(raw) {
  const lat = Number(raw?.lat);
  const lng = Number(raw?.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  const accuracy = Number(raw.accuracy);
  const at = raw.at != null ? new Date(Number(raw.at)) : null;
  return {
    lat,
    lng,
    accuracy: Number.isFinite(accuracy) && accuracy >= 0 ? accuracy : null,
    at: at && !Number.isNaN(at.getTime()) ? at : null,
  };
}

// opens the Google Maps app on Android (the browser elsewhere) with a pin on the spot
const mapsUrlOf = loc => (loc ? `https://www.google.com/maps/search/?api=1&query=${loc.lat.toFixed(6)},${loc.lng.toFixed(6)}` : null);

// the location fields every SOS push carries (empty strings when there's no location)
const locationPush = loc => ({
  mapsUrl: mapsUrlOf(loc),
  lat: loc?.lat,
  lng: loc?.lng,
  accuracy: loc?.accuracy != null ? Math.round(loc.accuracy) : null,
});

const personOf = u => (u ? { id: u._id.toString(), name: u.name, username: u.username || null } : null);

/* Everyone linked with `userId` by an accepted family link, in either
   direction. Shared scopes don't matter — an SOS is about safety, not
   access to data. */
async function familyCircleOf(userId) {
  const links = await FamilyLink.find({ status: 'accepted', $or: [{ ownerId: userId }, { memberId: userId }] }, 'ownerId memberId').lean();
  const ids = new Set();
  for (const l of links) ids.add((l.ownerId.toString() === userId ? l.memberId : l.ownerId).toString());
  return [...ids];
}

/* Data-only, high priority: that's what wakes a killed app so its
   background handler can start the alarm itself. FCM data values must
   all be strings. Tokens FCM reports as dead are dropped from the user. */
async function pushTo(userIds, data) {
  const users = await User.find({ _id: { $in: userIds } }, 'fcmTokens').lean();
  const tokens = users.flatMap(u => u.fcmTokens || []);
  if (!tokens.length) return;
  try {
    const res = await messaging.sendEachForMulticast({
      tokens,
      data: Object.fromEntries(Object.entries(data).map(([k, v]) => [k, String(v ?? '')])),
      android: { priority: 'high', ttl: PUSH_TTL_MS },
    });
    const dead = tokens.filter(
      (t, i) =>
        !res.responses[i].success &&
        ['messaging/registration-token-not-registered', 'messaging/invalid-registration-token'].includes(res.responses[i].error?.code),
    );
    if (dead.length) await User.updateMany({ fcmTokens: { $in: dead } }, { $pull: { fcmTokens: { $in: dead } } });
  } catch (err) {
    console.warn('SOS push failed:', err.message);
  }
}

// a ref field's id whether or not it was populated (null if the user is gone)
const idOf = ref => (ref?._id || ref)?.toString() || null;
const refPerson = ref => (ref?._id ? personOf(ref) : { id: idOf(ref) });

function serialize(alert, me) {
  const mine = idOf(alert.userId) === me;
  const out = {
    id: alert._id.toString(),
    from: refPerson(alert.userId),
    mine,
    trigger: alert.trigger,
    status: alert.status,
    createdAt: alert.createdAt,
    expiresAt: alert.expiresAt,
    endedAt: alert.endedAt,
    location: alert.location ? { ...alert.location, mapsUrl: mapsUrlOf(alert.location) } : null,
  };
  if (mine) {
    out.recipients = alert.recipients.map(r => ({ ...refPerson(r.userId), state: r.state, at: r.at }));
  } else {
    const r = alert.recipients.find(x => idOf(x.userId) === me);
    out.myState = r?.state || null;
  }
  return out;
}

/* Ends an active alert and tells every recipient's phone to stop.
   Conditional update so a cancel racing the expiry timer ends it once. */
async function endAlert(alertId, status) {
  clearTimeout(expiryTimers.get(alertId));
  expiryTimers.delete(alertId);
  const alert = await SosAlert.findOneAndUpdate({ _id: alertId, status: 'active' }, { status, endedAt: new Date() }, { new: true })
    .populate('userId', 'name username')
    .lean();
  if (!alert) return null;
  await pushTo(
    alert.recipients.map(r => r.userId),
    {
      type: 'sos_end',
      alertId: alert._id,
      reason: status,
      fromName: alert.userId?.name,
      sentAt: alert.createdAt.getTime(),
      ...locationPush(alert.location),
    },
  );
  return alert;
}

function scheduleExpiry(alert) {
  const ms = Math.max(0, new Date(alert.expiresAt).getTime() - Date.now());
  const id = alert._id.toString();
  expiryTimers.set(
    id,
    setTimeout(() => endAlert(id, 'expired').catch(err => console.warn('SOS expiry failed:', err.message)), ms),
  );
}

/* Timers live in memory, so a restart would leave alerts "active"
   forever — on boot, end the overdue ones and re-arm the rest. */
export async function resumeSosTimers() {
  const active = await SosAlert.find({ status: 'active' }, 'expiresAt').lean();
  for (const a of active) scheduleExpiry(a);
}

async function findAlert(id) {
  if (!mongoose.isValidObjectId(id)) return null;
  return SosAlert.findById(id);
}

/* POST /api/sos  { trigger: 'fall' | 'manual', location?: { lat, lng, accuracy, at } }
   One active alert per person: a second fall inside the window returns
   the one already ringing instead of paging the family again. */
export async function raiseSos(req, res) {
  const me = req.user.id;
  const trigger = req.body?.trigger === 'manual' ? 'manual' : 'fall';
  const location = parseLocation(req.body?.location);

  const current = await SosAlert.findOne({ userId: me, status: 'active', expiresAt: { $gt: new Date() } }).populate('recipients.userId', 'name username');
  if (current) {
    // the one already ringing had no location — keep this one for the follow-up notes and the app
    if (location && !current.location) {
      current.location = location;
      await current.save();
    }
    return res.json({ success: true, alert: serialize(current.toObject(), me), reused: true });
  }

  const family = await familyCircleOf(me);
  if (!family.length) {
    return res.status(409).json({ success: false, message: 'No one in your family circle to alert. Add family first.' });
  }

  const sender = await User.findById(me, 'name username').lean();
  const alert = await SosAlert.create({
    userId: me,
    trigger,
    expiresAt: new Date(Date.now() + SOS_WINDOW_MS),
    recipients: family.map(userId => ({ userId })),
    location,
  });
  scheduleExpiry(alert);

  await pushTo(family, {
    type: 'sos',
    alertId: alert._id,
    trigger,
    fromName: sender.name,
    fromUsername: sender.username,
    sentAt: alert.createdAt.getTime(),
    expiresAt: alert.expiresAt.getTime(),
    ...locationPush(location),
  });

  await alert.populate('recipients.userId', 'name username');
  return res.status(201).json({ success: true, alert: serialize(alert.toObject(), me) });
}

// POST /api/sos/:id/cancel — only the person who raised it can call it off
export async function cancelSos(req, res) {
  const alert = await findAlert(req.params.id);
  if (!alert || alert.userId.toString() !== req.user.id) {
    return res.status(404).json({ success: false, message: 'SOS not found' });
  }
  if (alert.status !== 'active') {
    return res.json({ success: true, status: alert.status });
  }
  await endAlert(alert._id.toString(), 'cancelled');
  return res.json({ success: true, status: 'cancelled' });
}

/* POST /api/sos/:id/ack  { action: 'silenced' | 'dismissed' }
   A recipient quieting the alarm on their own phone. Recorded so the
   sender can see who has seen it; changes nothing for anyone else. */
export async function ackSos(req, res) {
  const action = req.body?.action;
  if (!['silenced', 'dismissed'].includes(action)) {
    return res.status(400).json({ success: false, message: 'Unknown action' });
  }
  const alert = await findAlert(req.params.id);
  const r = alert?.recipients.find(x => x.userId.toString() === req.user.id);
  if (!r) {
    return res.status(404).json({ success: false, message: 'SOS not found' });
  }
  if (r.state !== 'dismissed') {
    r.state = action; // dismissed is final — a late "silenced" doesn't undo it
    r.at = new Date();
    await alert.save();
  }
  return res.json({ success: true });
}

// GET /api/sos/:id — the sender sees who has responded; a recipient sees their own state
export async function getSos(req, res) {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(404).json({ success: false, message: 'SOS not found' });
  }
  const alert = await SosAlert.findById(req.params.id).populate('userId', 'name username').populate('recipients.userId', 'name username').lean();
  const me = req.user.id;
  const involved = alert && (idOf(alert.userId) === me || alert.recipients.some(r => idOf(r.userId) === me));
  if (!involved) {
    return res.status(404).json({ success: false, message: 'SOS not found' });
  }
  return res.json({ success: true, alert: serialize(alert, me) });
}

// GET /api/sos/active — alerts still ringing that I raised or received
export async function getActiveSos(req, res) {
  const me = req.user.id;
  const alerts = await SosAlert.find({ status: 'active', $or: [{ userId: me }, { 'recipients.userId': me }] })
    .sort({ createdAt: -1 })
    .populate('userId', 'name username')
    .populate('recipients.userId', 'name username')
    .lean();
  return res.json({ success: true, alerts: alerts.map(a => serialize(a, me)) });
}
