import assert from "node:assert/strict";
import test from "node:test";
import { MemoryWindowRateLimiter } from "./security-rate-limit";

test("rate limit buckets enforce IP and account keys independently", () => {
  const limiter = new MemoryWindowRateLimiter();
  const now = 1_000_000;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    assert.equal(limiter.check("ip:shared", 3, 60_000, now).allowed, true);
    limiter.record("ip:shared", 60_000, now);
  }
  for (let attempt = 0; attempt < 2; attempt += 1) {
    assert.equal(limiter.check("account:opaque-a", 2, 60_000, now).allowed, true);
    limiter.record("account:opaque-a", 60_000, now);
  }

  assert.equal(limiter.check("account:opaque-a", 2, 60_000, now).allowed, false);
  assert.equal(limiter.check("account:opaque-b", 2, 60_000, now).allowed, true);
  assert.equal(limiter.check("ip:shared", 3, 60_000, now).allowed, true);
});

test("rate limit windows expire and reset", () => {
  const limiter = new MemoryWindowRateLimiter();
  limiter.record("first", 1_000, 0);
  limiter.record("second", 1_000, 0);

  assert.equal(limiter.check("first", 1, 1_000, 500).allowed, false);
  assert.equal(limiter.check("second", 1, 1_000, 1_000).allowed, true);
});
