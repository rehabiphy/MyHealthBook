import BpReading from '../models/BpReading.js';
import BodyReading from '../models/BodyReading.js';
import SugarReading from '../models/SugarReading.js';
import Profile from '../models/Profile.js';
import Medicine from '../models/Medicine.js';
import DoseLog from '../models/DoseLog.js';
import HistoryRecord from '../models/HistoryRecord.js';

const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';

function classifyBP(sys, dia) {
  if (sys > 180 || dia > 120) return 'hypertensive crisis';
  if (sys < 90 || dia < 60) return 'low';
  if (sys >= 140 || dia >= 90) return 'high, stage 2';
  if (sys >= 130 || dia >= 80) return 'high, stage 1';
  if (sys >= 120) return 'elevated';
  return 'normal';
}

function classifyBMI(bmi) {
  if (bmi < 18.5) return 'underweight';
  if (bmi < 23) return 'in the healthy range';
  if (bmi < 25) return 'overweight';
  if (bmi < 30) return 'obese class I';
  return 'obese class II';
}

function classifySugar(mgdl, kind) {
  if (mgdl < 70) return 'low';
  if (kind === 'fasting') return mgdl < 100 ? 'normal' : mgdl < 126 ? 'pre-diabetic range' : 'diabetic range';
  return mgdl < 140 ? 'normal' : mgdl < 200 ? 'pre-diabetic range' : 'diabetic range';
}

function bmiOf(weightKg, heightCm) {
  const h = Number(heightCm);
  const w = Number(weightKg);
  if (!h || !w) return null;
  return +(w / (h / 100) ** 2).toFixed(1);
}

/* Builds the "about your account/progress" context from what's
   actually on record for this user — never from anything the client
   sends — the same information src/lib/coach.js's buildCoachContext()
   already summarizes client-side, ported to query Mongo directly. */
export async function buildAccountContext(userId) {
  const [bp, body, sugar, profile, activeMeds] = await Promise.all([
    BpReading.findOne({ userId }).sort({ ts: -1 }),
    BodyReading.findOne({ userId }).sort({ ts: -1 }),
    SugarReading.findOne({ userId }).sort({ ts: -1 }),
    Profile.findOne({ userId }),
    Medicine.find({ userId, status: 'active' }),
  ]);

  const parts = [];

  if (bp) parts.push(`blood pressure ${bp.sys}/${bp.dia} mmHg (${classifyBP(bp.sys, bp.dia)})${bp.pulse ? `, pulse ${bp.pulse} bpm` : ''}`);
  if (body && profile?.heightCm) {
    const bmi = bmiOf(body.weightKg, profile.heightCm);
    if (bmi) parts.push(`BMI ${bmi} (${classifyBMI(bmi)}), ${body.weightKg} kg at ${profile.heightCm} cm`);
  }
  if (sugar) parts.push(`${sugar.kind === 'fasting' ? 'fasting' : 'post-meal'} glucose ${sugar.mgdl} mg/dL (${classifySugar(sugar.mgdl, sugar.kind)})`);
  if (profile?.age) parts.push(`age ${profile.age}`);
  if (profile?.diet) parts.push(`diet: ${profile.diet === 'veg' ? 'vegetarian' : profile.diet === 'egg' ? 'eggetarian' : 'non-vegetarian'}`);

  if (activeMeds.length) {
    const since = new Date();
    since.setDate(since.getDate() - 7);
    const sinceKey = since.toISOString().slice(0, 10);
    const medIds = activeMeds.map(m => m._id);
    const [doneCount, dueSlots] = await Promise.all([
      DoseLog.countDocuments({ userId, medId: { $in: medIds }, day: { $gte: sinceKey } }),
      activeMeds.reduce((sum, m) => sum + (m.slots?.length || 0), 0) * 7,
    ]);
    const pct = dueSlots ? Math.round((doneCount / dueSlots) * 100) : null;
    const names = activeMeds.map(m => `${m.name}${m.dose ? ` ${m.dose}` : ''}`).join(', ');
    parts.push(`${activeMeds.length} current medicine${activeMeds.length === 1 ? '' : 's'} (${names})${pct != null ? `, ~${pct}% dose adherence over the last 7 days` : ''}`);
  } else {
    parts.push('no active medicines on record');
  }

  const summary = parts.length ? parts.join('; ') : 'no health data recorded yet';
  return `${summary}.\n\n${await recordsContext(userId)}`;
}

const RECORD_LABEL = {
  test: 'Test or scan',
  prescription: 'Prescription',
  diagnosis: 'Diagnosis',
  treatment: 'Treatment',
  procedure: 'Procedure or hospital stay',
  bill: 'Bill',
  other: 'Other record',
  // records saved under the app's older type names
  report: 'Test or scan',
  hospital: 'Procedure or hospital stay',
  visit: 'Treatment',
  note: 'Other record',
};
const MAX_RECORDS = 25;
const MAX_DOC_CHARS = 1500;
const MAX_RECORDS_CHARS = 14000;

const fmtRecordDate = ms => new Date(ms).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' });
const oneLine = s =>
  String(s || '')
    .replace(/\s+/g, ' ')
    .trim();

/* The user's Records page — what they typed for each record, plus what
   MyHealth AI read from its uploaded file (jobs/documentReader.js) — so
   the chat can answer "what did my last blood test show?" or "how much
   were my hospital bills?". Newest first, capped so a long history
   can't crowd out the conversation. */
async function recordsContext(userId) {
  const records = await HistoryRecord.find({ userId }, 'type date title details doctor hospital medName medDose notes amount attachment.name attachment.type extract.status extract.text')
    .sort({ date: -1 })
    .limit(MAX_RECORDS)
    .lean();
  if (!records.length) return 'Medical records on file: none saved yet.';

  const lines = [];
  let used = 0;
  for (const r of records) {
    const facts = [
      `${fmtRecordDate(r.date)} · ${RECORD_LABEL[r.type] || 'Record'} · "${oneLine(r.title)}"`,
      r.details && `details: ${oneLine(r.details)}`,
      r.doctor && `doctor: ${oneLine(r.doctor)}`,
      r.hospital && `place: ${oneLine(r.hospital)}`,
      r.amount != null && `amount: ₹${r.amount.toLocaleString('en-IN', { minimumFractionDigits: r.amount % 1 ? 2 : 0, maximumFractionDigits: 2 })}`,
      r.medName && `medicine then: ${oneLine(r.medName)}${r.medDose ? ` ${oneLine(r.medDose)}` : ''}`,
      r.notes && `notes: ${oneLine(r.notes)}`,
    ].filter(Boolean);
    let entry = `- ${facts.join(' · ')}`;
    if (r.attachment) {
      const ex = r.extract;
      if (ex?.status === 'done' && ex.text && !ex.text.startsWith('NOT A MEDICAL DOCUMENT')) entry += `\n  Uploaded document says:\n  ${ex.text.slice(0, MAX_DOC_CHARS).replace(/\n/g, '\n  ')}`;
      else if (ex?.status === 'pending' || !ex) entry += "\n  (a document is attached but hasn't been read yet)";
      else entry += "\n  (a document is attached but its contents couldn't be read)";
    }
    if (used + entry.length > MAX_RECORDS_CHARS) {
      lines.push('- …older records not shown');
      break;
    }
    lines.push(entry);
    used += entry.length;
  }
  return `Medical records on file (newest first; "Uploaded document says" is text read from the user's uploaded file by AI and can contain reading mistakes):\n${lines.join('\n')}`;
}

export const SYSTEM_PROMPT = context =>
  `You are the AI health coach embedded in the MyHealthBook app. You help with practical advice about food, exercise, sleep and daily habits, tailored to what the user has recorded. You are NOT a doctor: never diagnose, never prescribe or suggest changing a medicine, and encourage seeing a real doctor for anything medical. Keep replies short and practical, and refer to the user's own numbers when relevant.

You can also answer questions about the user's own saved records — test reports, prescriptions, bills, diagnoses, procedures — using only what is listed below. Quote values, units, dates, medicines and amounts exactly as recorded and say which record (date and title) they come from. Totals of bills may be added up from the listed amounts. If the answer isn't in the records, say so plainly instead of guessing. You may say a result is marked high or low on the report, but don't diagnose from it. A medicine from an old prescription is history, not necessarily something they take now — their current medicines are the ones listed in the summary.

What's on record for this user right now: ${context}`;

export async function sendMessage(req, res) {
  const { messages } = req.body || {};

  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ success: false, message: 'No message to send' });
  }
  if (!messages.every(m => m && typeof m.content === 'string' && (m.role === 'user' || m.role === 'assistant'))) {
    return res.status(400).json({ success: false, message: 'Invalid message format' });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ success: false, message: "The AI coach isn't configured yet — ask the app owner to add an OpenAI API key." });
  }

  const context = await buildAccountContext(req.user.id);

  const response = await fetch(OPENAI_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || 'gpt-4.1-nano',
      messages: [{ role: 'system', content: SYSTEM_PROMPT(context) }, ...messages.map(m => ({ role: m.role, content: m.content }))],
      temperature: 0.6,
    }),
  });

  if (!response.ok) {
    const errBody = await response.text().catch(() => '');
    console.error('OpenAI request failed:', response.status, errBody);
    return res.status(502).json({ success: false, message: "The AI coach couldn't respond right now. Please try again." });
  }

  const json = await response.json();
  const reply = json.choices?.[0]?.message?.content?.trim();
  if (!reply) {
    return res.status(502).json({ success: false, message: "The AI coach couldn't respond right now. Please try again." });
  }

  return res.json({ success: true, reply });
}
