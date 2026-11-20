export interface RateLimitDecision {
  allowed: boolean;
  retryAfterMs: number;
  remaining: number;
}

interface WindowEntry {
  startedAt: number;
  count: number;
  lastSeenAt: number;
}

/**
 * Small, bounded process-local limiter for API abuse controls.
 * Keys should be opaque for account identifiers; never pass raw phone numbers.
 */
export class MemoryWindowRateLimiter {
  private readonly entries = new Map<string, WindowEntry>();

  constructor(private readonly maxEntries = 20_000) {}

  check(key: string, limit: number, windowMs: number, now = Date.now()): RateLimitDecision {
    const entry = this.getCurrentEntry(key, windowMs, now);
    if (!entry) return { allowed: true, retryAfterMs: 0, remaining: limit };

    entry.lastSeenAt = now;
    this.touch(key, entry);
    const retryAfterMs = Math.max(0, entry.startedAt + windowMs - now);
    return {
      allowed: entry.count < limit,
      retryAfterMs: entry.count >= limit ? retryAfterMs : 0,
      remaining: Math.max(0, limit - entry.count),
    };
  }

  record(key: string, windowMs: number, now = Date.now()): void {
    const entry = this.getCurrentEntry(key, windowMs, now) ?? {
      startedAt: now,
      count: 0,
      lastSeenAt: now,
    };
    entry.count += 1;
    entry.lastSeenAt = now;
    this.touch(key, entry);
    this.pruneIfNeeded(now);
  }

  consume(key: string, limit: number, windowMs: number, now = Date.now()): RateLimitDecision {
    const decision = this.check(key, limit, windowMs, now);
    if (decision.allowed) this.record(key, windowMs, now);
    return decision.allowed
      ? { ...decision, remaining: Math.max(0, decision.remaining - 1) }
      : decision;
  }

  clear(key: string): void {
    this.entries.delete(key);
  }

  private getCurrentEntry(key: string, windowMs: number, now: number): WindowEntry | undefined {
    const entry = this.entries.get(key);
    if (!entry) return undefined;
    if (entry.startedAt + windowMs <= now) {
      this.entries.delete(key);
      return undefined;
    }
    return entry;
  }

  private touch(key: string, entry: WindowEntry): void {
    this.entries.delete(key);
    this.entries.set(key, entry);
  }

  private pruneIfNeeded(now: number): void {
    if (this.entries.size <= this.maxEntries) return;

    for (const [key, entry] of Array.from(this.entries.entries())) {
      if (entry.startedAt + 24 * 60 * 60 * 1000 <= now) this.entries.delete(key);
    }
    while (this.entries.size > this.maxEntries) {
      const oldestKey = this.entries.keys().next().value as string | undefined;
      if (!oldestKey) break;
      this.entries.delete(oldestKey);
    }
  }
}
