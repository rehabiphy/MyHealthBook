import Redis from 'ioredis';

/* Shared cache on Amazon ElastiCache (Valkey). Holds only data that can
   be rebuilt — search results and request counters, never health
   records — so it can be switched off or deleted at any time.

   On with CACHE_ENABLED=true + CACHE_URL (rediss://<primary endpoint>:6379
   for a cache with encryption in transit). Every call gives up after a
   short timeout and returns "no value", so when the cache is off, down
   or slow, callers carry on exactly as they would without it. */

export const cacheEnabled = () => process.env.CACHE_ENABLED === 'true' && Boolean(process.env.CACHE_URL);

const PREFIX = 'mhb:';

let client = null;
function redis() {
  if (!client) {
    client = new Redis(process.env.CACHE_URL.trim(), {
      keyPrefix: PREFIX,
      connectTimeout: 2000,
      commandTimeout: 300,
      maxRetriesPerRequest: 0,
      // fail at once while disconnected instead of queueing requests behind a dead connection
      enableOfflineQueue: false,
      retryStrategy: times => Math.min(times * 500, 10000),
    });
    client.on('error', warnCacheDown);
    client.on('ready', () => console.log('Cache connected'));
  }
  return client;
}

/** Opens the connection at server start, so the first requests don't
    skip the cache while it is still connecting. */
export function startCache() {
  if (cacheEnabled()) redis();
}

// one log line a minute at most while the cache is unreachable
let lastWarn = 0;
function warnCacheDown(err) {
  if (Date.now() - lastWarn < 60 * 1000) return;
  lastWarn = Date.now();
  console.warn('Cache unavailable, continuing without it —', err.message);
}

/** The stored value, or undefined if missing, expired, or the cache is off/down. */
export async function cacheGet(key) {
  if (!cacheEnabled()) return undefined;
  try {
    const raw = await redis().get(key);
    return raw == null ? undefined : JSON.parse(raw);
  } catch (err) {
    warnCacheDown(err);
    return undefined;
  }
}

/** Stores value for ttlSeconds. Failures are logged and ignored. */
export async function cacheSet(key, value, ttlSeconds) {
  if (!cacheEnabled()) return;
  try {
    await redis().set(key, JSON.stringify(value), 'EX', ttlSeconds);
  } catch (err) {
    warnCacheDown(err);
  }
}

/** Adds 1 to a counter that expires ttlSeconds after it was first set.
    Returns the new count, or null if the cache is off or down. */
export async function cacheIncr(key, ttlSeconds) {
  if (!cacheEnabled()) return null;
  try {
    const results = await redis().multi().incr(key).expire(key, ttlSeconds, 'NX').exec();
    if (!results) throw new Error('cache transaction aborted');
    const [[incrErr, count], [expireErr]] = results;
    if (incrErr || expireErr) throw incrErr || expireErr;
    return count;
  } catch (err) {
    warnCacheDown(err);
    return null;
  }
}
