import Medicine from '../models/Medicine.js';
import DoseLog from '../models/DoseLog.js';
import MedSettings from '../models/MedSettings.js';
import { isNonEmptyString, isValidStringArray, isOneOf, isValidNumber, isValidDayKey } from '../utils/validators.js';

const SLOT_KEYS = ['empty', 'breakfast', 'lunch', 'dinner', 'bed'];
const TAKEN_WINDOW_DAYS = 60;

function publicMedicine(doc) {
  return {
    id: doc._id.toString(),
    name: doc.name,
    dose: doc.dose,
    slots: doc.slots,
    added: doc.added,
    status: doc.status,
    perDose: doc.perDose,
    stock: doc.stock,
    stockedAt: doc.stockedAt,
    stoppedAt: doc.stoppedAt,
    stopReason: doc.stopReason,
    fromHistory: doc.fromHistory ? doc.fromHistory.toString() : undefined,
  };
}

function publicSettings(doc) {
  return { times: doc.times, lead: doc.lead, notify: doc.notify };
}

export async function getMedicines(req, res) {
  const meds = await Medicine.find({ userId: req.user.id });
  return res.json({ success: true, medicines: meds.map(publicMedicine) });
}

export async function createMedicine(req, res) {
  const { name, dose, slots, perDose, stock, fromHistory } = req.body || {};

  if (!isNonEmptyString(name, { max: 150 })) {
    return res.status(400).json({ success: false, message: 'Please enter a medicine name' });
  }
  if (!isValidStringArray(slots, { allowed: SLOT_KEYS, min: 1 })) {
    return res.status(400).json({ success: false, message: 'Please choose at least one time of day' });
  }
  if (perDose !== undefined && !isValidNumber(perDose, { min: 1 })) {
    return res.status(400).json({ success: false, message: 'Please enter a valid dose count' });
  }
  if (stock !== undefined && stock !== null && !isValidNumber(stock, { min: 0 })) {
    return res.status(400).json({ success: false, message: 'Please enter a valid stock count' });
  }

  const now = Date.now();
  const hasStock = stock !== undefined && stock !== null;
  const medicine = await Medicine.create({
    userId: req.user.id,
    name: name.trim(),
    dose: dose || '',
    slots,
    added: now,
    perDose: perDose ? Math.max(1, Math.round(perDose)) : 1,
    stock: hasStock ? stock : null,
    stockedAt: hasStock ? now : null,
    ...(fromHistory ? { fromHistory } : {}),
  });
  return res.status(201).json({ success: true, medicine: publicMedicine(medicine) });
}

export async function setMedicineStatus(req, res) {
  const { id } = req.params;
  const { status, reason } = req.body || {};

  if (!isOneOf(status, ['active', 'paused', 'discontinued'])) {
    return res.status(400).json({ success: false, message: 'Invalid status' });
  }

  const patch = { status };
  if (status === 'discontinued') {
    patch.stoppedAt = Date.now();
    patch.stopReason = reason || '';
  } else if (status === 'active') {
    patch.stoppedAt = null;
    patch.stopReason = '';
  }

  const medicine = await Medicine.findOneAndUpdate({ _id: id, userId: req.user.id }, patch, { new: true });
  if (!medicine) {
    return res.status(404).json({ success: false, message: 'Medicine not found' });
  }
  return res.json({ success: true, medicine: publicMedicine(medicine) });
}

export async function restockMedicine(req, res) {
  const { id } = req.params;
  const { qty } = req.body || {};

  if (!isValidNumber(qty, { min: 1 })) {
    return res.status(400).json({ success: false, message: 'Please enter a valid quantity' });
  }

  const medicine = await Medicine.findOneAndUpdate(
    { _id: id, userId: req.user.id },
    { stock: qty, stockedAt: Date.now() },
    { new: true },
  );
  if (!medicine) {
    return res.status(404).json({ success: false, message: 'Medicine not found' });
  }
  return res.json({ success: true, medicine: publicMedicine(medicine) });
}

export async function getTaken(req, res) {
  const { from, to } = req.query || {};

  let fromKey = from;
  let toKey = to;
  if (!fromKey || !toKey) {
    const now = new Date();
    toKey = now.toISOString().slice(0, 10);
    now.setDate(now.getDate() - TAKEN_WINDOW_DAYS);
    fromKey = now.toISOString().slice(0, 10);
  }
  if (!isValidDayKey(fromKey) || !isValidDayKey(toKey)) {
    return res.status(400).json({ success: false, message: 'Invalid date range' });
  }

  const rows = await DoseLog.find({ userId: req.user.id, day: { $gte: fromKey, $lte: toKey } });
  return res.json({
    success: true,
    rows: rows.map(r => ({ medId: r.medId.toString(), slotKey: r.slotKey, day: r.day, takenAt: r.takenAt })),
  });
}

export async function toggleTaken(req, res) {
  const { medId, slotKey, day } = req.body || {};

  if (!isNonEmptyString(medId, { max: 100 })) {
    return res.status(400).json({ success: false, message: 'Missing medicine id' });
  }
  if (!isOneOf(slotKey, SLOT_KEYS)) {
    return res.status(400).json({ success: false, message: 'Invalid time slot' });
  }
  if (!isValidDayKey(day)) {
    return res.status(400).json({ success: false, message: 'Invalid day' });
  }

  const existing = await DoseLog.findOne({ userId: req.user.id, medId, slotKey, day });
  if (existing) {
    await DoseLog.deleteOne({ _id: existing._id });
    return res.json({ success: true, taken: false });
  }

  const takenAt = Date.now();
  await DoseLog.create({ userId: req.user.id, medId, slotKey, day, takenAt });
  return res.json({ success: true, taken: true, takenAt });
}

export async function getSettings(req, res) {
  const settings = await MedSettings.findOneAndUpdate(
    { userId: req.user.id },
    {},
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );
  return res.json({ success: true, settings: publicSettings(settings) });
}

export async function updateSettings(req, res) {
  const { times, lead, notify } = req.body || {};

  if (times !== undefined) {
    if (typeof times !== 'object' || times === null) {
      return res.status(400).json({ success: false, message: 'Invalid times' });
    }
    for (const key of Object.keys(times)) {
      if (!isOneOf(key, SLOT_KEYS) || typeof times[key] !== 'string') {
        return res.status(400).json({ success: false, message: 'Invalid time slot' });
      }
    }
  }
  if (lead !== undefined && !isValidNumber(lead, { min: 0, max: 180 })) {
    return res.status(400).json({ success: false, message: 'Invalid reminder lead time' });
  }

  const current = await MedSettings.findOneAndUpdate(
    { userId: req.user.id },
    {},
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );

  const patch = {};
  if (times !== undefined) patch.times = { ...current.times, ...times };
  if (lead !== undefined) patch.lead = lead;
  if (notify !== undefined) patch.notify = !!notify;

  const settings = await MedSettings.findOneAndUpdate({ userId: req.user.id }, patch, { new: true });
  return res.json({ success: true, settings: publicSettings(settings) });
}
