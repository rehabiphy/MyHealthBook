/* Per-user limit on the AI endpoints (coach, insights, assistant), so a
   leaked token or a script in a loop can't run up the AI bill.

   With the shared cache on (utils/cache.js), counts live there: they
   survive restarts and are shared by every server, per calendar minute
   and per day. Otherwise, or whenever the cache can't answer, counts
   live in memory on this server (rolling minute and 24 hours).

   Limits: AI_LIMIT_PER_MINUTE (default 10) and AI_LIMIT_PER_DAY
   (default 300) requests per user. Must run after requireAuth. */

import { cacheIncr } from '../utils/cache.js';

const MINUTE = 60 * 1000;
const DAY = 24 * 60 * MINUTE;
const hits = new Map(); // userId → timestamps of recent AI requests (last 24h)

const limit = (name, fallback) => {
  const n = Number(process.env[name]);
  return Number.isFinite(n) && n > 0 ? n : fallback;
};

const TOO_FAST = "You're sending requests too quickly. Please wait a moment and try again.";

function reject(res, retryAfter) {
  res.set('Retry-After', String(retryAfter));
  return res.status(429).json({ success: false, message: TOO_FAST });
}

export default async function aiRateLimit(req, res, next) {
  const id = req.user?.id;
  if (!id) return res.status(401).json({ success: false, message: 'Not signed in' });

  const shared = await sharedLimit(id);
  if (shared === 'minute') return reject(res, 60);
  if (shared === 'day') return reject(res, 3600);
  if (shared === 'ok') return next();
  return memoryLimit(id, res, next);
}

/* 'ok', 'minute' or 'day' from the shared counters; null if the cache is
   off or down. The day counter only moves for requests that passed the
   minute limit. */
async function sharedLimit(id) {
  const now = Date.now();
  const perMinute = await cacheIncr(`ai:m:${id}:${Math.floor(now / MINUTE)}`, 60);
  if (perMinute == null) return null;
  if (perMinute > limit('AI_LIMIT_PER_MINUTE', 10)) return 'minute';
  const perDay = await cacheIncr(`ai:d:${id}:${Math.floor(now / DAY)}`, 24 * 60 * 60);
  if (perDay == null) return null;
  return perDay > limit('AI_LIMIT_PER_DAY', 300) ? 'day' : 'ok';
}

function memoryLimit(id, res, next) {
  const now = Date.now();
  const recent = (hits.get(id) || []).filter(t => now - t < DAY);
  const lastMinute = recent.filter(t => now - t < MINUTE).length;

  if (lastMinute >= limit('AI_LIMIT_PER_MINUTE', 10) || recent.length >= limit('AI_LIMIT_PER_DAY', 300)) {
    hits.set(id, recent);
    return reject(res, lastMinute >= limit('AI_LIMIT_PER_MINUTE', 10) ? 60 : 3600);
  }

  recent.push(now);
  hits.set(id, recent);
  next();
}

// drop users with no requests in the last day, so the map doesn't grow for ever
setInterval(() => {
  const now = Date.now();
  for (const [id, times] of hits) if (!times.some(t => now - t < DAY)) hits.delete(id);
}, 60 * MINUTE).unref();
