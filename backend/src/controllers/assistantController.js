import { complete, LlmError } from '../utils/llm.js';
import { buildAccountContext, SYSTEM_PROMPT } from './coachController.js';
import { isOneOf, isValidNumber } from '../utils/validators.js';

/* MyHealth AI — the fallback for voice/text commands the app's own
   on-device rule parser (frontend/src/lib/assistant/parse.js) couldn't
   understand, e.g. "sugar was one forty after lunch" or Hinglish.

   This endpoint NEVER writes anything. It only turns a sentence into a
   structured intent; the app shows it to the user and saves through
   the normal Readings/Meds APIs only after they confirm. Intent parsing
   is sent the sentence alone — no health data — and the user's record
   summary is only looked up for the 'chat' intent, which needs it. */

const INTENTS = ['log_bp', 'log_sugar', 'log_weight', 'add_medicine', 'dose_taken', 'ask_dose_status', 'ask_meds', 'show_trend', 'navigate', 'chat'];
const SLOT_GROUPS = ['morning', 'afternoon', 'tonight', 'bedtime'];
const SCREENS = ['home', 'log', 'history', 'meds', 'me', 'insights', 'coach', 'learn', 'health'];
const MED_SLOTS = ['empty', 'breakfast', 'lunch', 'dinner', 'bed'];

const nullable = type => ({ type: [type, 'null'] });

const INTENT_SCHEMA = {
  name: 'assistant_intent',
  schema: {
    type: 'object',
    additionalProperties: false,
    required: [
      'intent', 'sys', 'dia', 'pulse', 'mgdl', 'sugarKind', 'weightKg', 'slot', 'medName',
      'medDose', 'medSlots', 'perDose', 'stock', 'metric', 'days', 'screen',
    ],
    properties: {
      intent: { type: 'string', enum: INTENTS },
      sys: nullable('number'),
      dia: nullable('number'),
      pulse: nullable('number'),
      mgdl: nullable('number'),
      sugarKind: { type: ['string', 'null'], enum: ['fasting', 'post', null] },
      weightKg: nullable('number'),
      slot: { type: ['string', 'null'], enum: [...SLOT_GROUPS, null] },
      medName: nullable('string'),
      medDose: nullable('string'),
      medSlots: { type: ['array', 'null'], items: { type: 'string', enum: MED_SLOTS } },
      perDose: nullable('number'),
      stock: nullable('number'),
      metric: { type: ['string', 'null'], enum: ['bp', 'sugar', 'weight', null] },
      days: nullable('number'),
      screen: { type: ['string', 'null'], enum: [...SCREENS, null] },
    },
  },
};

const INTENT_PROMPT = pending => `You convert what an older adult says to the MyHealthBook health app into ONE structured intent. Input may be English, Hindi, or Hinglish, and may come from speech-to-text (expect mis-hearings; Hindi number words like "ek sau chalis" = 140).

Intents:
- log_bp: recording a blood pressure reading (sys/dia, optional pulse).
- log_sugar: recording blood glucose in mg/dL. sugarKind "fasting" (empty stomach/before food) or "post" (after a meal/random), null if not said.
- log_weight: recording body weight in kg.
- add_medicine: user wants to add a medicine they have been told to take to their list. medName = the medicine's name exactly as said (fix obvious speech-to-text spelling of well-known drug names only). medDose = strength as said, e.g. "500 mg". medSlots = daily times from: empty (empty stomach/before breakfast), breakfast (morning/after breakfast), lunch (afternoon), dinner (evening/night/after dinner), bed (bedtime). "Twice a day" = breakfast+dinner, "three times a day" = breakfast+lunch+dinner; null if no time was said. perDose = tablets per dose if said. stock = tablets they have if said.
- dose_taken: user says they took their medicine. slot = which time of day if said; medName if a specific medicine was named.
- ask_dose_status: user is unsure / asking whether they took a dose.
- ask_meds: asking which medicines to take (now, tonight, morning...).
- show_trend: asking to see or understand past readings. metric + days (7 for "week", 30 for "month").
- navigate: asking to open a section of the app.
- chat: anything else — symptoms, feelings, diet, exercise, general health questions.

Rules: NEVER invent a number the user did not say — use null. NEVER suggest, add or change a medicine, dose or timing the user did not state themselves. Fill only fields relevant to the intent; everything else null.${
  pending ? `\n\nThe app just asked the user a follow-up question for intent "${pending}", so a bare answer (e.g. "142 88", "fasting") most likely belongs to that intent.` : ''
}`;

const VOICE_STYLE =
  '\n\nThis reply will be shown in a voice assistant and may be read aloud: answer in at most 3 short, plain sentences, in the same language the user used. If they describe a symptom, suggest recording it and contacting their doctor if it is severe, new or getting worse.';

/* Belt and braces over the JSON schema: keep only plausible values
   so a hallucinated field can never reach the confirm card. */
function sanitize(raw) {
  const num = (v, min, max) => (isValidNumber(v, { min, max }) ? v : null);
  const intent = isOneOf(raw.intent, INTENTS) ? raw.intent : 'chat';
  return {
    intent,
    sys: num(raw.sys, 40, 300),
    dia: num(raw.dia, 20, 200),
    pulse: num(raw.pulse, 20, 250),
    mgdl: num(raw.mgdl, 10, 1000),
    sugarKind: isOneOf(raw.sugarKind, ['fasting', 'post']) ? raw.sugarKind : null,
    weightKg: num(raw.weightKg, 5, 400),
    slot: isOneOf(raw.slot, SLOT_GROUPS) ? raw.slot : null,
    medName: typeof raw.medName === 'string' && raw.medName.trim() ? raw.medName.trim().slice(0, 80) : null,
    medDose: typeof raw.medDose === 'string' && raw.medDose.trim() ? raw.medDose.trim().slice(0, 40) : null,
    medSlots: Array.isArray(raw.medSlots) && raw.medSlots.length ? [...new Set(raw.medSlots.filter(s => MED_SLOTS.includes(s)))] : null,
    perDose: num(raw.perDose, 1, 10),
    stock: num(raw.stock, 0, 5000),
    metric: isOneOf(raw.metric, ['bp', 'sugar', 'weight']) ? raw.metric : null,
    days: num(raw.days, 1, 365),
    screen: isOneOf(raw.screen, SCREENS) ? raw.screen : null,
  };
}

export async function interpret(req, res) {
  const { text, pending } = req.body || {};

  if (typeof text !== 'string' || !text.trim() || text.length > 500) {
    return res.status(400).json({ success: false, message: 'Please say or type something' });
  }
  const pendingIntent = isOneOf(pending, INTENTS) ? pending : null;

  try {
    const raw = await complete({
      messages: [
        { role: 'system', content: INTENT_PROMPT(pendingIntent) },
        { role: 'user', content: text.trim() },
      ],
      temperature: 0,
      jsonSchema: INTENT_SCHEMA,
    });
    const intent = sanitize(raw);

    if (intent.intent === 'chat') {
      const context = await buildAccountContext(req.user.id);
      intent.reply = await complete({
        messages: [
          { role: 'system', content: SYSTEM_PROMPT(context) + VOICE_STYLE },
          { role: 'user', content: text.trim() },
        ],
      });
    }

    return res.json({ success: true, intent });
  } catch (err) {
    if (err instanceof LlmError && err.code === 'not-configured') {
      return res.status(500).json({ success: false, message: "MyHealth AI isn't configured yet. Ask the app owner to add an OpenAI API key." });
    }
    if (err instanceof LlmError) {
      return res.status(502).json({ success: false, message: "I couldn't understand that right now. Please try again." });
    }
    throw err;
  }
}
