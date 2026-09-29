// A token bucket per client address, per function instance. Honest scope: each
// instance counts on its own, so the limit is per instance, not global.
const buckets = new Map();

export function clientIp(req) {
  return String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '?').split(',')[0].trim();
}

/** true if allowed; otherwise the number of seconds to wait. */
export function take(key, perMinute) {
  const now = Date.now();
  const rate = perMinute / 60000;
  const b = buckets.get(key) ?? { tokens: perMinute, at: now };
  b.tokens = Math.min(perMinute, b.tokens + (now - b.at) * rate);
  b.at = now;
  if (b.tokens >= 1) {
    b.tokens -= 1;
    buckets.set(key, b);
    return true;
  }
  buckets.set(key, b);
  if (buckets.size > 5000) for (const k of [...buckets.keys()].slice(0, 1000)) buckets.delete(k);
  return Math.ceil((1 - b.tokens) / rate / 1000);
}

export const LIMITS = { lens: 30, ident: 60 };
