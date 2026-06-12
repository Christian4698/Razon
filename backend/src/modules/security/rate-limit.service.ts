import type { RateLimitResult, RateLimitRule } from "./security.types";

interface Bucket {
  readonly resetAtMs: number;
  count: number;
}

export class RateLimitService {
  private readonly buckets = new Map<string, Bucket>();

  constructor(private readonly defaultRule: RateLimitRule = { windowMs: 60_000, maxRequests: 120 }) {}

  checkLimit(key: string, rule: RateLimitRule = this.defaultRule, nowMs = Date.now()): RateLimitResult {
    const current = this.buckets.get(key);

    if (!current || current.resetAtMs <= nowMs) {
      const resetAtMs = nowMs + rule.windowMs;
      this.buckets.set(key, { resetAtMs, count: 1 });
      return {
        allowed: true,
        key,
        remaining: rule.maxRequests - 1,
        resetAt: new Date(resetAtMs).toISOString(),
        retryAfterMs: 0,
      };
    }

    current.count += 1;
    const allowed = current.count <= rule.maxRequests;

    return {
      allowed,
      key,
      remaining: Math.max(0, rule.maxRequests - current.count),
      resetAt: new Date(current.resetAtMs).toISOString(),
      retryAfterMs: allowed ? 0 : current.resetAtMs - nowMs,
    };
  }

  reset(key: string): void {
    this.buckets.delete(key);
  }
}
