import * as coachApi from './coachApi';

/* The AI coach is proxied through the backend now — it builds the
   "about your account/progress" context itself from what's actually
   stored for this user (never from anything the client sends), and
   holds the real OpenAI key server-side. This just forwards the
   local chat log and returns the reply. */
export async function sendToCoach(messages, token) {
  const res = await coachApi.sendMessage({ messages }, token);
  return res.reply;
}
