import mongoose from 'mongoose';
import HistoryRecord from '../models/HistoryRecord.js';
import { isNonEmptyString, isOneOf } from '../utils/validators.js';
import { resolveEntitlement, canAccess, limitOf, FEATURES } from '../utils/entitlements.js';
import {
  ATTACHMENT_TYPES,
  MAX_ATTACHMENT_BYTES,
  deleteObject,
  headObject,
  markAttached,
  presignUpload,
  presignView,
  s3Configured,
  userRecordsPrefix,
} from '../utils/s3.js';

const HISTORY_TYPES = ['test', 'diagnosis', 'treatment', 'procedure', 'other'];
// `attachment` is handled on its own (resolveAttachment), never written straight from the body
const PATCHABLE_FIELDS = ['type', 'date', 'title', 'details', 'doctor', 'hospital', 'medName', 'medDose', 'notes', 'file', 'promoted'];
const MAX_MB = MAX_ATTACHMENT_BYTES / 1024 / 1024;
const KEY_SHAPE = new RegExp(`^users/[0-9a-f]{24}/records/[0-9a-f-]{36}\\.(${[...new Set(Object.values(ATTACHMENT_TYPES))].join('|')})$`);

class AttachmentError extends Error {}

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
    // the S3 key stays server-side — the app opens a file through GET /:id/attachment
    attachment: doc.attachment ? { name: doc.attachment.name, type: doc.attachment.type, size: doc.attachment.size } : null,
    promoted: doc.promoted,
    createdAt: doc.createdAt,
  };
}

/* Turns { key, name } from the app into a stored attachment — but only
   after checking S3 really holds a file at that key, in this record
   owner's own folder, of an allowed type and size. Then tags it
   "attached" so the bucket's cleanup rule keeps it. A file that fails a
   check is deleted. */
async function resolveAttachment(userId, input) {
  const key = typeof input?.key === 'string' ? input.key : '';
  if (!KEY_SHAPE.test(key) || !key.startsWith(userRecordsPrefix(userId))) {
    throw new AttachmentError('That file upload is not valid. Please attach it again.');
  }
  const stored = await headObject(key);
  if (!stored) throw new AttachmentError("The file didn't finish uploading. Please attach it again.");
  if (stored.size > MAX_ATTACHMENT_BYTES || !ATTACHMENT_TYPES[stored.type]) {
    await deleteObject(key).catch(() => {});
    throw new AttachmentError(`Reports must be a PDF or a photo, up to ${MAX_MB} MB.`);
  }
  await markAttached(key);
  const name = typeof input.name === 'string' && input.name.trim() ? input.name.trim().slice(0, 200) : `report.${ATTACHMENT_TYPES[stored.type]}`;
  return { key, name, type: stored.type, size: stored.size, uploadedAt: new Date() };
}

// best-effort: a record is never left undeletable because S3 hiccupped — the file is just orphaned
function removeFile(key) {
  if (!key) return;
  deleteObject(key).catch(err => console.warn('Could not delete report file', key, '—', err.message));
}

/* The Free plan keeps up to limits.documents report files. Past that,
   every file already stored stays viewable and downloadable — only
   attaching another one needs Plus. Checked against the record owner's
   plan (req.user.id is the owner when a family member is acting). */
async function documentLimitReached(userId) {
  const ent = await resolveEntitlement(userId);
  const limit = limitOf(ent, 'documents');
  if (canAccess(ent, FEATURES.EXTENDED_STORAGE) || limit === null) return null;
  const count = await HistoryRecord.countDocuments({ userId, attachment: { $ne: null } });
  if (count < limit) return null;
  return {
    success: false,
    limitReached: 'documents',
    message: `You have ${count} medical document${count === 1 ? '' : 's'}. The Free plan allows ${limit}. Your existing documents are safe, but adding more requires MyHealthBook Plus.`,
  };
}

const attachmentFailure = (res, err) => {
  if (err instanceof AttachmentError) return res.status(400).json({ success: false, message: err.message });
  console.error('Report attachment failed:', err);
  return res.status(502).json({ success: false, message: "Couldn't save the report file right now. Please try again." });
};

export async function getRecords(req, res) {
  const records = await HistoryRecord.find({ userId: req.user.id }).sort({ date: -1 });
  return res.json({ success: true, records: records.map(publicRecord) });
}

/* POST /api/records/attachments/upload-url  { type, size }
   A 5-minute link the phone uploads one report file to, straight to S3. */
export async function getUploadUrl(req, res) {
  if (!s3Configured()) {
    return res.status(503).json({ success: false, message: "Report uploads aren't set up on the server yet." });
  }
  const { type, size, replacing } = req.body || {};
  // `replacing` only spares a pointless upload — create/update below enforce the limit for real
  if (!replacing) {
    const full = await documentLimitReached(req.user.id);
    if (full) return res.status(403).json(full);
  }
  if (!ATTACHMENT_TYPES[type]) {
    return res.status(400).json({ success: false, message: 'Please choose a PDF or a photo (JPG, PNG, WEBP or HEIC).' });
  }
  if (typeof size === 'number' && size > MAX_ATTACHMENT_BYTES) {
    return res.status(400).json({ success: false, message: `This file is too large. Reports can be up to ${MAX_MB} MB.` });
  }
  const upload = await presignUpload(req.user.id, type);
  return res.json({ success: true, upload });
}

export async function createRecord(req, res) {
  const { type, title, date, details, doctor, hospital, medName, medDose, notes, file, attachment } = req.body || {};

  if (!isOneOf(type, HISTORY_TYPES)) {
    return res.status(400).json({ success: false, message: 'Please choose a record type' });
  }
  if (!isNonEmptyString(title, { max: 200 })) {
    return res.status(400).json({ success: false, message: 'Please enter a title' });
  }

  let stored = null;
  if (attachment?.key) {
    const full = await documentLimitReached(req.user.id);
    if (full) return res.status(403).json(full);
    try {
      stored = await resolveAttachment(req.user.id, attachment);
    } catch (err) {
      return attachmentFailure(res, err);
    }
  }

  const record = await HistoryRecord.create({
    userId: req.user.id,
    type,
    title: title.trim(),
    date: typeof date === 'number' ? date : Date.now(),
    details, doctor, hospital, medName, medDose, notes, file,
    attachment: stored,
  });
  return res.status(201).json({ success: true, record: publicRecord(record) });
}

/* PATCH /api/records/:id — `attachment`: omitted (or without a key) keeps
   the file, null removes it, { key, name } of a new upload replaces it. */
export async function updateRecord(req, res) {
  const { id } = req.params;
  const patch = req.body || {};

  if (patch.type !== undefined && !isOneOf(patch.type, HISTORY_TYPES)) {
    return res.status(400).json({ success: false, message: 'Please choose a valid record type' });
  }
  if (patch.title !== undefined && !isNonEmptyString(patch.title, { max: 200 })) {
    return res.status(400).json({ success: false, message: 'Please enter a title' });
  }
  if (!mongoose.isValidObjectId(id)) {
    return res.status(404).json({ success: false, message: 'Record not found' });
  }

  const whitelisted = {};
  for (const key of PATCHABLE_FIELDS) {
    if (patch[key] !== undefined) whitelisted[key] = patch[key];
  }

  let oldKey = null;
  if (patch.attachment !== undefined) {
    const current = await HistoryRecord.findOne({ _id: id, userId: req.user.id }, 'attachment').lean();
    if (!current) return res.status(404).json({ success: false, message: 'Record not found' });
    const currentKey = current.attachment?.key || null;
    if (patch.attachment === null) {
      whitelisted.attachment = null;
      oldKey = currentKey;
    } else if (patch.attachment?.key && patch.attachment.key !== currentKey) {
      // swapping one file for another doesn't add a document; only a record gaining its first file does
      if (!currentKey) {
        const full = await documentLimitReached(req.user.id);
        if (full) return res.status(403).json(full);
      }
      try {
        whitelisted.attachment = await resolveAttachment(req.user.id, patch.attachment);
      } catch (err) {
        return attachmentFailure(res, err);
      }
      oldKey = currentKey;
    }
    // same key as now, or the record's own { name, type, size } echoed back by an edit → file unchanged
  }

  const record = await HistoryRecord.findOneAndUpdate({ _id: id, userId: req.user.id }, whitelisted, { new: true });
  if (!record) {
    return res.status(404).json({ success: false, message: 'Record not found' });
  }
  removeFile(oldKey); // only once the record no longer points at it
  return res.json({ success: true, record: publicRecord(record) });
}

export async function deleteRecord(req, res) {
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id)) {
    return res.status(404).json({ success: false, message: 'Record not found' });
  }
  const record = await HistoryRecord.findOneAndDelete({ _id: id, userId: req.user.id }, { projection: { attachment: 1 } });
  if (!record) {
    return res.status(404).json({ success: false, message: 'Record not found' });
  }
  removeFile(record.attachment?.key);
  return res.json({ success: true });
}

/* GET /api/records/:id/attachment — a 5-minute link that opens the
   report. Family members with the records share reach this through
   familyAccess like every other records route. */
export async function getAttachmentUrl(req, res) {
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id)) {
    return res.status(404).json({ success: false, message: 'Record not found' });
  }
  const record = await HistoryRecord.findOne({ _id: id, userId: req.user.id }, 'attachment').lean();
  if (!record?.attachment) {
    return res.status(404).json({ success: false, message: 'This record has no report file' });
  }
  const { key, name, type, size } = record.attachment;
  const url = await presignView(key, name, type);
  return res.json({ success: true, url, name, type, size });
}
