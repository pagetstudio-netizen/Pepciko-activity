import test from "node:test";
import assert from "node:assert/strict";
import {
  calculateDailyCheckinStreak,
  calculateDailyCheckinStreakAfterClaim,
  daysBetweenCheckinDates,
  getDailyCheckinRewardForVip,
  getDailyCheckinCooldownUntil,
  getDailyCheckinDateKey,
} from "../shared/daily-checkin";

test("daily check-in rewards increase with VIP level and cap at VIP8", () => {
  assert.deepEqual(
    Array.from({ length: 8 }, (_, index) => getDailyCheckinRewardForVip(index + 1)),
    [45, 60, 75, 90, 105, 120, 135, 150],
  );
  assert.equal(getDailyCheckinRewardForVip(0), 45);
  assert.equal(getDailyCheckinRewardForVip(20), 150);
});

test("daily check-in dates use the member's West African local calendar", () => {
  const instant = new Date("2026-11-05T23:30:00.000Z");
  assert.equal(getDailyCheckinDateKey(instant, "TG"), "2026-11-05");
  assert.equal(getDailyCheckinDateKey(instant, "CM"), "2026-11-06");
});

test("a missed calendar day resets the visible consecutive-day streak", () => {
  assert.equal(
    calculateDailyCheckinStreak(["2026-11-03", "2026-11-02"], "2026-11-05"),
    0,
  );
});

test("the streak remains visible while today's claim is still pending", () => {
  assert.equal(
    calculateDailyCheckinStreak(["2026-11-04", "2026-11-03"], "2026-11-05"),
    2,
  );
});

test("a claim after a continuous day extends the streak", () => {
  assert.equal(
    calculateDailyCheckinStreakAfterClaim(["2026-11-04", "2026-11-03"], "2026-11-05"),
    3,
  );
});

test("a claim after a gap starts a new streak without changing prior claims", () => {
  assert.equal(
    calculateDailyCheckinStreakAfterClaim(["2026-11-03", "2026-11-02"], "2026-11-05"),
    1,
  );
  assert.equal(daysBetweenCheckinDates("2026-11-03", "2026-11-05"), 2);
});

test("claims are separated by a full 24-hour cooldown", () => {
  const previousClaim = new Date("2026-11-04T10:00:00.000Z");
  assert.equal(
    getDailyCheckinCooldownUntil(previousClaim, new Date("2026-11-05T09:59:59.999Z"))?.toISOString(),
    "2026-11-05T10:00:00.000Z",
  );
  assert.equal(
    getDailyCheckinCooldownUntil(previousClaim, new Date("2026-11-05T10:00:00.000Z")),
    null,
  );
});
