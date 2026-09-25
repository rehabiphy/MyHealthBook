/* On-device, rule-based understanding for MyHealth AI. Runs first on
   every command — instant, offline, private (nothing leaves the phone)
   and predictable. Only when this returns null does the sentence go to
   the backend's LLM fallback (/api/assistant/interpret).

   Returns the same shape the backend does:
   { intent, sys, dia, pulse, mgdl, sugarKind, weightKg, slot, medName, metric, days, screen }
   plus one intent only this file produces: 'red_flag' — emergency
   symptoms are detected by fixed rules, never left to an LLM.

   Speech-to-text in hi-IN returns Devanagari, so every keyword list
   carries English, Hinglish and Devanagari forms. JS `\b` only knows
   ASCII word characters, so it's used on English words only. */

const RE = {
  redFlag:
    /(chest pain|pain in (my )?chest|heart attack|can'?t breathe|cannot breathe|unable to breathe|short(ness)? of breath|fainted|passed out|unconscious|stroke|slurred|face (is )?drooping|paralys|seene (me|mein) dard|saans (nahi|lene)|behosh|lakwa|सीने में दर्द|सांस नहीं|साँस नहीं|बेहोश|लकवा)/,
  bp: /(\bbp\b|b\.p|blood pressure|\bpressure\b|बीपी|ब्लड प्रेशर|रक्तचाप)/,
  pulse: /(pulse|heart ?rate|\bhr\b|dhadkan|धड़कन|पल्स)/,
  sugar: /(sugar|glucose|shugar|shakkar|\bpp\b|\bfasting\b|शुगर|शक्कर|ग्लूकोज)/,
  weight: /(weight|\bweigh|wajan|vajan|वजन|वज़न)/,
  fasting: /(fasting|empty stomach|khali pet|before (breakfast|food|eating|a meal|meal)|खाली पेट|फास्टिंग)/,
  post: /(after (breakfast|lunch|dinner|food|eating|a meal|meal)|\bpost\b|\bpp\b|random|khane ke baad|खाने के बाद)/,
  med: /(medicine|meds|tablet|pill|dose|dawa|dawai|goli|दवा|दवाई|गोली)/,
  took: /(\btook\b|\btaken\b|\bhad\b|\bfinished\b|le li|kha li|li hai|le liya|kha liya|ले ली|खा ली|ली है|ले लिया|खा लिया)/,
  askStatus: /(did i|have i|forgot|forget|whether|not sure|kya maine|क्या मैंने|भूल)/,
  askMeds: /(\bwhat\b|\bwhich\b|kaun|konsi|kya|कौन|क्या|\bdue\b)/,
  trend: /(\bshow\b|how is|how's|how has|trend|history|last \d+|last (week|month)|past|pichhle|पिछले|दिखा)/,
  nav: /(open|go to|take me to|show)\s+(?:me\s+)?(?:my\s+|the\s+)?(medicines?|meds|records?|history|profile|readings?|home|insights|coach|learn|health)/,
};

const SLOT_GROUPS = [
  { key: 'morning', re: /(morning|breakfast|subah|सुबह|नाश्ते)/ },
  { key: 'afternoon', re: /(afternoon|lunch|dopahar|दोपहर)/ },
  { key: 'bedtime', re: /(bedtime|bed time|before (bed|sleep)|sone se pehle|सोने)/ },
  { key: 'tonight', re: /(evening|night|tonight|dinner|raat|shaam|रात|शाम)/ },
];

export const SLOTS_IN_GROUP = {
  morning: ['empty', 'breakfast'],
  afternoon: ['lunch'],
  tonight: ['dinner', 'bed'],
  bedtime: ['bed'],
};

const NAV_TARGETS = {
  medicine: 'meds', medicines: 'meds', meds: 'meds',
  record: 'history', records: 'history', history: 'history',
  reading: 'log', readings: 'log',
  profile: 'me', home: 'home', insights: 'insights', coach: 'coach', learn: 'learn', health: 'health',
};

// "142/88", "142 over 88", "142 by 88", "142 बटा 88", "142 ओवर 88"
const BP_PAIR = /(\d{2,3})\s*(?:\/|\\|over|by|upon|slash|on|pe|par|and|बटा|ओवर|और|पर|x|-)\s*(\d{2,3})/;

// Hindi speech-to-text may write numbers in Devanagari (१४०) and units as words
const toAsciiDigits = s => s.replace(/[०-९]/g, d => String(d.charCodeAt(0) - 0x0966));

/* The range a real reading plausibly falls in. Outside it the value is
   still allowed, but the overlay asks before saving instead of
   auto-saving, since it's more likely a mis-hearing. */
export const PLAUSIBLE = {
  sys: [60, 260],
  dia: [30, 160],
  pulse: [30, 220],
  mgdl: [20, 700],
  weightKg: [10, 300],
};
export const plausible = (field, v) => v != null && v >= PLAUSIBLE[field][0] && v <= PLAUSIBLE[field][1];

const numbers = t => (t.match(/\d+(?:\.\d+)?/g) || []).map(Number);

// ---- adding a medicine ----

const ADD_MED = /(\badd\b|\bnew (medicine|tablet|med)|start(ed)? (taking|on)|\bprescribed\b|doctor (gave|has given|told)|jod(o|na|en|iye)|जोड़\S*|शुरू\S*|नई दवा\S*)/;
const DOSE_UNIT = /(\d+(?:\.\d+)?)\s*(mg|mcg|µg|gm|g|ml|units?|iu)\b/;
const FREQ = /(once|twice|thrice|\d\s*times|two times|three times|daily|every day|a day|\bbd\b|\btds\b|\bod\b)/;

/* Daily time slots (the Medicine model's keys) mentioned in a sentence.
   "Before breakfast" / empty stomach is checked (and removed) first so
   it doesn't also count as "breakfast". */
export function medSlotsOf(text) {
  let t = ` ${text.toLowerCase()} `;
  const out = new Set();
  if (/(thrice|three times|3 times|\btds\b|teen baar|तीन बार)/.test(t)) ['breakfast', 'lunch', 'dinner'].forEach(s => out.add(s));
  if (/(twice|two times|2 times|\bbd\b|morning and (night|evening)|subah (aur )?shaam|सुबह (और )?शाम|do baar|दो बार)/.test(t)) ['breakfast', 'dinner'].forEach(s => out.add(s));
  if (/(empty stomach|before (breakfast|food)|khali pet|खाली पेट)/.test(t)) {
    out.add('empty');
    t = t.replace(/(empty stomach|before (breakfast|food)|khali pet|खाली पेट)/g, ' ');
  }
  if (/(morning|breakfast|subah|सुबह|नाश्ते)/.test(t)) out.add('breakfast');
  if (/(afternoon|lunch|dopahar|दोपहर)/.test(t)) out.add('lunch');
  if (/(bedtime|bed time|before (bed|sleep)|sone se pehle|सोने)/.test(t)) {
    out.add('bed');
    t = t.replace(/(bedtime|bed time|before (bed|sleep)|sone se pehle|सोने)/g, ' ');
  }
  if (/(evening|night|dinner|raat|shaam|रात|शाम)/.test(t)) out.add('dinner');
  const order = ['empty', 'breakfast', 'lunch', 'dinner', 'bed'];
  return out.size ? order.filter(s => out.has(s)) : null;
}

const WORD_NUM = { one: 1, two: 2, three: 3, ek: 1, do: 2, teen: 3 };

/* Pulls the medicine name out of "add Metformin 500 mg twice a day":
   everything after the "add" phrase, minus filler words, up to the
   first dose number or timing word. Keeps the user's capitalisation. */
export function medNameOf(text, { whole = false } = {}) {
  let s = ` ${text} `;
  if (!whole) {
    const m = s.match(new RegExp(ADD_MED.source, 'i'));
    if (!m) return null;
    s = s.slice(m.index + m[0].length);
  }
  const filler = /^\s*(a|an|the|my|new|medicine|medicines|meds|tablet|tablets|tab|capsule|capsules|pill|pills|called|named|of|syrup|dawai|dawa|goli|to|list|me|for|:|-)\b\s*/i;
  let prev;
  do {
    prev = s;
    s = s.replace(filler, ' ');
  } while (s !== prev);
  const stop =
    /(\s\d|\s(for|every|daily|once|twice|thrice|times|in the|at|after|before|morning|night|evening|afternoon|bedtime|with|and|to my|subah|raat|shaam|roz|din|khane|tablet|tablets|goli|mg)\b|[,.;])/i;
  const cut = s.search(stop);
  const name = (cut >= 0 ? s.slice(0, cut) : s).trim().split(/\s+/).slice(0, 4).join(' ');
  if (!name || name.length < 2 || /^(it|this|that|one)$/i.test(name)) return null;
  return name.charAt(0).toUpperCase() + name.slice(1);
}

function parseAddMedicine(text, t) {
  const out = blank('add_medicine');
  out.medName = medNameOf(text);
  const dose = t
    .replace(/(milli ?grams?|मिलीग्राम|मिलिग्राम|एमजी)/g, 'mg')
    .replace(/(micro ?grams?|माइक्रोग्राम)/g, 'mcg')
    .match(DOSE_UNIT);
  if (dose) out.medDose = `${dose[1]} ${dose[2] === 'gm' ? 'g' : dose[2]}`;
  out.medSlots = medSlotsOf(t);
  const stock = t.match(/(\d+)\s*(tablets?|pills?|capsules?|goli)?\s*(left|remaining|in stock|at home|in the (box|strip|pack))|(have|got|bought)\s*(\d+)/);
  if (stock) out.stock = Number(stock[1] || stock[6]);
  const per = t.match(/(\d+|one|two|three|ek|do|teen)\s*(tablets?|tabs?|capsules?|pills?|goli)\s*(each|every|at a time|per|har|ek baar)?/);
  if (per && !(stock && per.index === stock.index)) {
    const n = WORD_NUM[per[1]] ?? Number(per[1]);
    if (n >= 1 && n <= 4) out.perDose = n;
  }
  return out;
}

const blank = intent => ({
  intent,
  sys: null,
  dia: null,
  pulse: null,
  mgdl: null,
  sugarKind: null,
  weightKg: null,
  slot: null,
  medName: null,
  medDose: null,
  medSlots: null,
  perDose: null,
  stock: null,
  metric: null,
  days: null,
  screen: null,
});

function slotOf(t) {
  return SLOT_GROUPS.find(g => g.re.test(t))?.key ?? null;
}

function daysOf(t) {
  const m = t.match(/(\d+)\s*(day|days|din|दिन)/);
  if (m) return Number(m[1]);
  if (/(month|mahine|महीने)/.test(t)) return 30;
  return 7;
}

function metricOf(t) {
  if (RE.bp.test(t)) return 'bp';
  if (RE.sugar.test(t)) return 'sugar';
  if (RE.weight.test(t)) return 'weight';
  return null;
}

function sugarKindOf(t) {
  if (RE.fasting.test(t)) return 'fasting';
  if (RE.post.test(t)) return 'post';
  return null;
}

function parseBp(t, { assumeBp = false } = {}) {
  const out = blank('log_bp');
  const pair = t.match(BP_PAIR);
  if (pair) {
    out.sys = Number(pair[1]);
    out.dia = Number(pair[2]);
  } else if (assumeBp) {
    // a bare follow-up answer like "142 88"
    const [a, b] = numbers(t);
    if (a != null && b != null) {
      out.sys = a;
      out.dia = b;
    }
  }
  const pulse = t.match(new RegExp(`${RE.pulse.source}\\D{0,15}(\\d{2,3})`));
  if (pulse) out.pulse = Number(pulse[pulse.length - 1]);
  return out;
}

function parseSugar(t) {
  const out = blank('log_sugar');
  out.mgdl = numbers(t).find(n => n >= 10) ?? null;
  out.sugarKind = sugarKindOf(t);
  return out;
}

function parseWeight(t) {
  const out = blank('log_weight');
  out.weightKg = numbers(t)[0] ?? null;
  return out;
}

/* pending: the intent (+ partial values) the assistant is waiting on
   after a follow-up question like "What is your BP reading?", or null. */
export function parseCommand(rawText, pending = null) {
  const text = toAsciiDigits(String(rawText));
  const t = ` ${text.toLowerCase().trim()} `;
  if (!t.trim()) return null;

  if (RE.redFlag.test(t)) return blank('red_flag');

  /* Mid-way through adding a medicine: the answer fills whatever was
     missing (name first, then times), keeping what's already known. */
  if (pending && /(\bcancel\b|\bstop\b|never ?mind|\bleave it\b|rehne do|रहने दो|कैंसल)/.test(t)) return blank('cancel');

  if (pending?.intent === 'add_medicine') {
    const heard = parseAddMedicine(` add ${text} `, ` add ${t} `);
    const merged = { ...pending };
    if (!merged.medName) merged.medName = medNameOf(text, { whole: true });
    for (const k of ['medDose', 'medSlots', 'perDose', 'stock']) if (merged[k] == null && heard[k] != null) merged[k] = heard[k];
    return merged;
  }

  if (pending && numbers(t).length) {
    if (pending.intent === 'log_bp') return parseBp(t, { assumeBp: true });
    if (pending.intent === 'log_sugar') return { ...parseSugar(t), sugarKind: sugarKindOf(t) ?? pending.sugarKind ?? null };
    if (pending.intent === 'log_weight') return parseWeight(t);
  }
  if (pending?.intent === 'log_sugar' && pending.mgdl != null && sugarKindOf(t)) {
    return { ...blank('log_sugar'), mgdl: pending.mgdl, sugarKind: sugarKindOf(t) };
  }

  const hasMed = RE.med.test(t);

  // "add Metformin 500 mg twice a day", "doctor prescribed …", or "I take X 500 mg daily"
  if (ADD_MED.test(t) && (hasMed || DOSE_UNIT.test(t) || ((medSlotsOf(t) || FREQ.test(t)) && !metricOf(t)))) return parseAddMedicine(text, t);
  if (!RE.took.test(t) && DOSE_UNIT.test(t) && (medSlotsOf(t) || FREQ.test(t)) && /\b(i take|i have to take|i am taking|i'm taking|lena hai|leta|leti)\b/.test(t)) {
    const parsed = parseAddMedicine(text.replace(/\b(i take|i have to take|i am taking|i'm taking)\b/i, 'add'), t);
    if (parsed.medName) return parsed;
  }

  if (hasMed && RE.askStatus.test(t)) return { ...blank('ask_dose_status'), slot: slotOf(t) };
  if (hasMed && RE.took.test(t) && !/\?\s*$/.test(t.trim())) return { ...blank('dose_taken'), slot: slotOf(t) };
  if (hasMed && RE.askMeds.test(t)) return { ...blank('ask_meds'), slot: slotOf(t) };

  const metric = metricOf(t);
  if (metric && RE.trend.test(t)) return { ...blank('show_trend'), metric, days: daysOf(t) };

  if (metric === 'bp' || (!metric && BP_PAIR.test(t))) {
    const bp = parseBp(t);
    // a bare "a/b" with no BP word only counts if it looks like a BP
    if (metric === 'bp' || (plausible('sys', bp.sys) && plausible('dia', bp.dia) && bp.sys > bp.dia)) return bp;
  }
  if (metric === 'sugar') return parseSugar(t);
  if (metric === 'weight') return parseWeight(t);

  const nav = t.match(RE.nav);
  if (nav) return { ...blank('navigate'), screen: NAV_TARGETS[nav[2]] ?? null };

  return null;
}
