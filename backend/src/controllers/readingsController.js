import BpReading from '../models/BpReading.js';
import BodyReading from '../models/BodyReading.js';
import SugarReading from '../models/SugarReading.js';
import { isValidNumber, isOneOf } from '../utils/validators.js';

const MODEL_BY_TYPE = { bp: BpReading, body: BodyReading, sugar: SugarReading };

function publicBpReading(doc) {
  return { id: doc._id.toString(), ts: doc.ts, sys: doc.sys, dia: doc.dia, pulse: doc.pulse };
}

function publicBodyReading(doc) {
  return { id: doc._id.toString(), ts: doc.ts, weightKg: doc.weightKg };
}

function publicSugarReading(doc) {
  return { id: doc._id.toString(), ts: doc.ts, mgdl: doc.mgdl, kind: doc.kind };
}

export async function getReadings(req, res) {
  const [bp, body, sugar] = await Promise.all([
    BpReading.find({ userId: req.user.id }).sort({ ts: -1 }),
    BodyReading.find({ userId: req.user.id }).sort({ ts: -1 }),
    SugarReading.find({ userId: req.user.id }).sort({ ts: -1 }),
  ]);
  return res.json({
    success: true,
    bp: bp.map(publicBpReading),
    body: body.map(publicBodyReading),
    sugar: sugar.map(publicSugarReading),
  });
}

export async function createBpReading(req, res) {
  const { sys, dia, pulse } = req.body || {};

  if (!isValidNumber(sys, { min: 0, max: 400 }) || !isValidNumber(dia, { min: 0, max: 300 })) {
    return res.status(400).json({ success: false, message: 'Please enter a valid blood pressure reading' });
  }
  if (pulse !== undefined && !isValidNumber(pulse, { min: 0, max: 300 })) {
    return res.status(400).json({ success: false, message: 'Please enter a valid pulse' });
  }

  const reading = await BpReading.create({ userId: req.user.id, ts: Date.now(), sys, dia, pulse });
  return res.status(201).json({ success: true, reading: publicBpReading(reading) });
}

export async function createBodyReading(req, res) {
  const { weightKg } = req.body || {};

  if (!isValidNumber(weightKg, { min: 0, max: 500 })) {
    return res.status(400).json({ success: false, message: 'Please enter a valid weight' });
  }

  const reading = await BodyReading.create({ userId: req.user.id, ts: Date.now(), weightKg });
  return res.status(201).json({ success: true, reading: publicBodyReading(reading) });
}

export async function createSugarReading(req, res) {
  const { mgdl, kind } = req.body || {};

  if (!isValidNumber(mgdl, { min: 0, max: 1000 })) {
    return res.status(400).json({ success: false, message: 'Please enter a valid blood sugar reading' });
  }
  if (!isOneOf(kind, ['fasting', 'post'])) {
    return res.status(400).json({ success: false, message: 'Please choose fasting or post-meal' });
  }

  const reading = await SugarReading.create({ userId: req.user.id, ts: Date.now(), mgdl, kind });
  return res.status(201).json({ success: true, reading: publicSugarReading(reading) });
}

export async function deleteReading(req, res) {
  const { type, id } = req.params;

  if (!isOneOf(type, ['bp', 'body', 'sugar'])) {
    return res.status(400).json({ success: false, message: 'Invalid reading type' });
  }

  const Model = MODEL_BY_TYPE[type];
  const result = await Model.deleteOne({ _id: id, userId: req.user.id });
  if (result.deletedCount === 0) {
    return res.status(404).json({ success: false, message: 'Reading not found' });
  }
  return res.json({ success: true });
}

export async function deleteAllReadings(req, res) {
  await Promise.all([
    BpReading.deleteMany({ userId: req.user.id }),
    BodyReading.deleteMany({ userId: req.user.id }),
    SugarReading.deleteMany({ userId: req.user.id }),
  ]);
  return res.json({ success: true });
}
