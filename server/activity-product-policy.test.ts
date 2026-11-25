import assert from "node:assert/strict";
import { test } from "node:test";
import {
  getActivityDailyProfitEstimate,
  getActivityTotalPayout,
} from "../shared/activity-product-policy";

test("activity product payout includes its purchase price and fixed profit", () => {
  assert.equal(getActivityTotalPayout(3_000, 1_250), 4_250);
  assert.equal(getActivityTotalPayout(7_000, 2_450), 9_450);
  assert.equal(getActivityTotalPayout(45_000, 15_750), 60_750);
});

test("activity daily profit estimate is informational and rounded down", () => {
  assert.equal(getActivityDailyProfitEstimate(1_250, 3), 416);
  assert.equal(getActivityDailyProfitEstimate(2_450, 3), 816);
  assert.equal(getActivityDailyProfitEstimate(15_750, 3), 5_250);
  assert.equal(getActivityDailyProfitEstimate(1, 3), 1);
});

test("activity total payout rejects invalid or unsupported values", () => {
  assert.equal(getActivityTotalPayout(0, 100), 0);
  assert.equal(getActivityTotalPayout(1_000, 0), 0);
  assert.equal(getActivityTotalPayout(2_147_483_647, 1), 0);
});
