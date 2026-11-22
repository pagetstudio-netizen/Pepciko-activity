import assert from "node:assert/strict";
import test from "node:test";
import {
  getWellnessCardTotalRevenue,
  getWellnessDailyEarnings,
  isValidWellnessCycleDays,
} from "../shared/wellness-product-policy";

test("wellness cycles accept any positive whole number of days", () => {
  for (const days of [1, 2, 3, 7, 20, 365]) {
    assert.equal(isValidWellnessCycleDays(days), true);
  }
  assert.equal(isValidWellnessCycleDays(0), false);
  assert.equal(isValidWellnessCycleDays(-7), false);
  assert.equal(isValidWellnessCycleDays(1.5), false);
  assert.equal(isValidWellnessCycleDays("20"), false);
});

test("wellness card total revenue adds purchase price and total profit", () => {
  assert.equal(getWellnessCardTotalRevenue(3000, 1050), 4050);
});

test("wellness daily earnings divide the total cycle profit by the cycle days", () => {
  assert.equal(getWellnessDailyEarnings(4000, 2), 2000);
  assert.equal(getWellnessDailyEarnings(4001, 2), 2000);
  assert.equal(getWellnessDailyEarnings(2000, 2), 1000);
  assert.equal(getWellnessDailyEarnings(1, 0), 0);
});
