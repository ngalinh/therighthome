// Simple in-memory rate limiter (per-process). For multi-instance deploy,
// swap with Redis. We have a single app container so memory is fine.

declare global {
  // eslint-disable-next-line no-var
  var __trh_rateLimitBuckets: Map<string, { count: number; resetAt: number }> | undefined;
}

const buckets =
  globalThis.__trh_rateLimitBuckets ?? (globalThis.__trh_rateLimitBuckets = new Map());

export function rateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || b.resetAt < now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (b.count >= limit) return false;
  b.count++;
  return true;
}

export function clientKey(req: Request, ...parts: string[]): string {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown";
  return [ip, ...parts].join(":");
}
