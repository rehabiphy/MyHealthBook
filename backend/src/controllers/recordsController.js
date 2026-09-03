import HistoryRecord from '../models/HistoryRecord.js';
import { isNonEmptyString, isOneOf } from '../utils/validators.js';

const HISTORY_TYPES = ['test', 'diagnosis', 'treatment', 'procedure', 'other'];
const PATCHABLE_FIELDS = ['type', 'date', 'title', 'details', 'doctor', 'hospital', 'medName', 'medDose', 'notes', 'file', 'promoted'];

function publicRecord(doc) {
  return {
    id: doc._id.toString(),
    type: doc.type,
    date: doc.date,
    title: doc.title,
    details: doc.details,
    doctor: doc.doctor,
    hospital: doc.hospital,
    medName: doc.medName,
    medDose: doc.medDose,
    notes: doc.notes,
    file: doc.file,
    promoted: doc.promoted,
    createdAt: doc.createdAt,
  };
}

export async function getRecords(req, res) {
  const records = await HistoryRecord.find({ userId: req.user.id }).sort({ date: -1 });
  return res.json({ success: true, records: records.map(publicRecord) });
}

export async function createRecord(req, res) {
  const { type, title, date, details, doctor, hospital, medName, medDose, notes, file } = req.body || {};

  if (!isOneOf(type, HISTORY_TYPES)) {
    return res.status(400).json({ success: false, message: 'Please choose a record type' });
  }
  if (!isNonEmptyString(title, { max: 200 })) {
    return res.status(400).json({ success: false, message: 'Please enter a title' });
  }

  const record = await HistoryRecord.create({
    userId: req.user.id,
    type,
    title: title.trim(),
    date: typeof date === 'number' ? date : Date.now(),
    details, doctor, hospital, medName, medDose, notes, file,
  });
  return res.status(201).json({ success: true, record: publicRecord(record) });
}

export async function updateRecord(req, res) {
  const { id } = req.params;
  const patch = req.body || {};

  if (patch.type !== undefined && !isOneOf(patch.type, HISTORY_TYPES)) {
    return res.status(400).json({ success: false, message: 'Please choose a valid record type' });
  }
  if (patch.title !== undefined && !isNonEmptyString(patch.title, { max: 200 })) {
    return res.status(400).json({ success: false, message: 'Please enter a title' });
  }

  const whitelisted = {};
  for (const key of PATCHABLE_FIELDS) {
    if (patch[key] !== undefined) whitelisted[key] = patch[key];
  }

  const record = await HistoryRecord.findOneAndUpdate({ _id: id, userId: req.user.id }, whitelisted, { new: true });
  if (!record) {
    return res.status(404).json({ success: false, message: 'Record not found' });
  }
  return res.json({ success: true, record: publicRecord(record) });
}

export async function deleteRecord(req, res) {
  const { id } = req.params;
  const result = await HistoryRecord.deleteOne({ _id: id, userId: req.user.id });
  if (result.deletedCount === 0) {
    return res.status(404).json({ success: false, message: 'Record not found' });
  }
  return res.json({ success: true });
}
