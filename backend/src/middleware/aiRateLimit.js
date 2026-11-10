/* Per-user limit on the AI endpoints (coach, insights, assistant), so a
   leaked token or a script in a loop can't run up the AI bill. Counts
   live in memory on this server, which is enough to stop a runaway
   caller; with several servers each one counts on its own.

   Limits: AI_LIMIT_PER_MINUTE (default 10) and AI_LIMIT_PER_DAY
   (default 300) requests per user. Must run after requireAuth. */

const MINUTE = 60 * 1000;
const DAY = 24 * 60 * MINUTE;
const hits = new Map(); // userId → timestamps of recent AI requests (last 24h)

const limit = (name, fallback) => {
  const n = Number(process.env[name]);
  return Number.isFinite(n) && n > 0 ? n : fallback;
};

export default function aiRateLimit(req, res, next) {
  const now = Date.now();
  const id = req.user?.id;
  if (!id) return res.status(401).json({ success: false, message: 'Not signed in' });

  const recent = (hits.get(id) || []).filter(t => now - t < DAY);
  const lastMinute = recent.filter(t => now - t < MINUTE).length;

  if (lastMinute >= limit('AI_LIMIT_PER_MINUTE', 10) || recent.length >= limit('AI_LIMIT_PER_DAY', 300)) {
    hits.set(id, recent);
    res.set('Retry-After', lastMinute >= limit('AI_LIMIT_PER_MINUTE', 10) ? '60' : '3600');
    return res.status(429).json({ success: false, message: "You're sending requests too quickly. Please wait a moment and try again." });
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
