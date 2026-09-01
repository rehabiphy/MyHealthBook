import { bmiOf, classifyBP, kg1 } from './calc';

/* The web original called api.anthropic.com directly with no key — that
   only worked because Claude Artifacts proxy the request. A shipped
   mobile app can't embed a real API key, so this is a stub: it builds
   the same context string the original sent as the system prompt, but
   returns a canned reply instead of calling a model.

   TO CONNECT A REAL COACH: replace the body of sendToCoach() with a
   call to your own backend (recommended) or, for local testing only,
   a fetch to api.anthropic.com using a key the user has entered in
   Profile settings. Keep the same signature so CoachScreen needs no
   changes. */

export function buildCoachContext(data) {
  const bp = data.bp[0],
    w = data.body[0],
    s = data.sugar[0];
  const bmi = bmiOf(w?.weightKg, data.profile.heightCm);
  const p = [];
  if (bp) p.push(`blood pressure ${bp.sys}/${bp.dia} mmHg (${classifyBP(bp.sys, bp.dia).label})`);
  if (bmi) p.push(`BMI ${bmi} on Asia-Pacific cut-offs, ${kg1(w.weightKg)} kg at ${data.profile.heightCm} cm`);
  if (s) p.push(`${s.kind === 'fasting' ? 'fasting' : 'post-meal'} glucose ${s.mgdl} mg/dL`);
  if (data.profile.age) p.push(`age ${data.profile.age}`);
  p.push(`diet: ${data.profile.diet === 'veg' ? 'vegetarian' : data.profile.diet === 'egg' ? 'eggetarian' : 'non-vegetarian'}`);
  return p.join('; ');
}

export async function sendToCoach(messages, data) {
  void buildCoachContext(data); // kept ready for whichever backend gets wired in
  void messages;
  await new Promise(res => setTimeout(res, 500));
  return "The coach isn't connected yet — this build ships the chat screen only. Once a backend or API key is wired up in src/lib/coach.js, replies will use your recorded numbers the same way the original did.";
}
