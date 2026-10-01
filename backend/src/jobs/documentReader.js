import HistoryRecord from '../models/HistoryRecord.js';
import { complete, LlmError } from '../utils/llm.js';
import { getObjectBytes, s3Configured } from '../utils/s3.js';

/* Reads each report file once with a vision model and keeps what it
   says as plain text on the record (record.extract), so the AI chat can
   answer "what was my last HbA1c?" or "how much was the hospital bill?"
   from the documents themselves, not only from the titles typed in.

   A record is queued (extract.status = pending) whenever it gains or
   changes a file; saving starts a read straight away, and a sweep every
   few minutes picks up anything missed — including files uploaded
   before this existed — with up to MAX_ATTEMPTS tries each.

   Photos (JPG/PNG/WEBP) and PDFs only: OpenAI can't open HEIC, so those
   are marked unsupported and the chat falls back to the typed details. */

const SWEEP_MS = 5 * 60 * 1000;
const BATCH = 20;
const MAX_ATTEMPTS = 3;
const MAX_TEXT = 4000;
const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
// a better reader than the chat's default nano model, still cheap — one call per file, ever
const MODEL = () => process.env.OPENAI_DOCUMENT_MODEL || 'gpt-4.1-mini';

const FOCUS = {
  test: 'every test name with its result, unit and reference range, flagging any marked high/low; the lab and date',
  prescription: 'every medicine with strength, dose, how often / when, and for how many days; the doctor, clinic, date and any advice or follow-up date',
  bill: 'the hospital/pharmacy, bill date, bill number, each item or service with its amount, discounts, tax, the total and how it was paid',
  diagnosis: 'the diagnosis, findings, the doctor and date, and any advice',
  treatment: 'the treatment or medicines given, doses, the doctor and date',
  procedure: 'the procedure, findings, admission and discharge dates, the doctor and hospital, and discharge advice or medicines',
  other: 'the key facts: names, dates, numbers and any instructions',
};

const PROMPT =
  type => `You are reading a medical document a patient uploaded to their own health record app. Write down what it actually says, as compact plain-text lines — no preamble, no markdown headings.

Capture: ${FOCUS[type] || FOCUS.other}.

Rules: copy numbers, units, names and dates exactly as printed. Never guess or add anything that isn't on the page; write "unreadable" for a part you can't read. Don't add advice or interpretation. If the file isn't a medical document or is blank, reply with exactly: NOT A MEDICAL DOCUMENT`;

function contentPart(bytes, type, name) {
  const b64 = bytes.toString('base64');
  if (type === 'application/pdf') return { type: 'file', file: { filename: name || 'report.pdf', file_data: `data:application/pdf;base64,${b64}` } };
  return { type: 'image_url', image_url: { url: `data:${type};base64,${b64}`, detail: 'high' } };
}

async function readOne(record) {
  const { key, type, name } = record.attachment;
  if (type !== 'application/pdf' && !IMAGE_TYPES.includes(type)) return { status: 'unsupported', text: '' };

  const bytes = await getObjectBytes(key);
  const text = await complete({
    model: MODEL(),
    temperature: 0,
    messages: [
      { role: 'system', content: PROMPT(record.type) },
      { role: 'user', content: [{ type: 'text', text: `Record: ${record.title}` }, contentPart(bytes, type, name)] },
    ],
  });
  return { status: 'done', text: text.slice(0, MAX_TEXT) };
}

/* Claims one record (so two sweeps never read the same file), reads it,
   and saves the result — only if the record still has that same file. */
async function processRecord(id) {
  const record = await HistoryRecord.findOneAndUpdate(
    { _id: id, attachment: { $ne: null }, 'extract.status': 'pending', 'extract.attempts': { $lt: MAX_ATTEMPTS } },
    { $inc: { 'extract.attempts': 1 } },
    { new: true },
  ).lean();
  if (!record) return;

  let result;
  try {
    result = await readOne(record);
  } catch (err) {
    if (err instanceof LlmError && err.code === 'not-configured') return; // stays pending until a key is added
    console.warn('Reading report', id.toString(), 'failed:', err.message);
    if (record.extract.attempts < MAX_ATTEMPTS) return; // the next sweep tries again
    result = { status: 'failed', text: '' };
  }
  await HistoryRecord.updateOne({ _id: id, 'attachment.key': record.attachment.key }, { $set: { extract: { ...result, attempts: record.extract.attempts, at: new Date() } } });
}

let running = false;
let again = false; // a file saved mid-sweep is read as soon as the sweep ends, not 5 minutes later

async function sweep() {
  if (!s3Configured() || !process.env.OPENAI_API_KEY) return;
  if (running) {
    again = true;
    return;
  }
  running = true;
  again = false;
  try {
    // files saved before reading existed have no extract at all — queue them first
    await HistoryRecord.updateMany({ attachment: { $ne: null }, extract: null }, { $set: { extract: { status: 'pending', text: '', attempts: 0, at: null } } });
    const due = await HistoryRecord.find({ 'extract.status': 'pending', 'extract.attempts': { $lt: MAX_ATTEMPTS }, attachment: { $ne: null } }, '_id')
      .sort({ updatedAt: -1 })
      .limit(BATCH)
      .lean();
    for (const r of due) await processRecord(r._id);
  } finally {
    running = false;
  }
  if (again) await sweep();
}

const run = () => sweep().catch(err => console.warn('Report reading sweep failed:', err.message));

// called after a record is saved with a new file — read it now rather than at the next sweep
export function queueDocumentRead() {
  setImmediate(run);
}

let timer = null;

export function startDocumentReader() {
  if (timer) return;
  setTimeout(run, 30 * 1000);
  timer = setInterval(run, SWEEP_MS);
}
