/**
 * Simple in-memory rate limiter (dev / single-instance).
 * For production multi-instance deploy, replace with Upstash Redis / Vercel KV.
 */
const WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const MAX_ATTEMPTS = 10;

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

export function rateLimit(key: string): { ok: boolean; remaining: number; resetAt: number } {
  const now = Date.now();
  cleanupExpiredBuckets(now);
  const bucket = buckets.get(key);

  if (!bucket || now >= bucket.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return { ok: true, remaining: MAX_ATTEMPTS - 1, resetAt: now + WINDOW_MS };
  }

  if (bucket.count >= MAX_ATTEMPTS) {
    return { ok: false, remaining: 0, resetAt: bucket.resetAt };
  }

  bucket.count++;
  return { ok: true, remaining: MAX_ATTEMPTS - bucket.count, resetAt: bucket.resetAt };
}

export function getRateLimitInfo(key: string): { remaining: number; resetAt: number } {
  const bucket = buckets.get(key);
  const now = Date.now();
  if (!bucket || now >= bucket.resetAt) {
    return { remaining: MAX_ATTEMPTS, resetAt: now + WINDOW_MS };
  }
  return { remaining: Math.max(0, MAX_ATTEMPTS - bucket.count), resetAt: bucket.resetAt };
}

// Remove expired entries during normal traffic without keeping a process-alive timer.
function cleanupExpiredBuckets(now: number): void {
  for (const [k, v] of buckets) {
    if (now >= v.resetAt) buckets.delete(k);
  }
}