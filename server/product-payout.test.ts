import assert from "node:assert/strict";
import test from "node:test";
import {
  calculateDailyPayoutCatchUp,
  calculateMaturityPayout,
  calculateWellnessDailyPayout,
  getProductPayoutMode,
} from "./product-payout";
import {
  getWellnessCardTotalRevenue,
  getWellnessDailyEarnings,
} from "../shared/wellness-product-policy";

test("maturity payout deducts earnings already paid before the policy change", () => {
  assert.equal(calculateMaturityPayout(1500, 500), 1000);
});

test("maturity payout pays the full return when nothing was previously paid", () => {
  assert.equal(calculateMaturityPayout(1500, 0), 1500);
});

test("maturity payout never becomes negative when prior payments exceed the return", () => {
  assert.equal(calculateMaturityPayout(1500, 1800), 0);
});

test("wellness uses daily payouts while stable and activity products stay at maturity", () => {
  assert.equal(getProductPayoutMode("wellness"), "daily");
  assert.equal(getProductPayoutMode("stable"), "maturity");
  assert.equal(getProductPayoutMode("activity"), "maturity");
});

test("a wellness revenue of 4,000 FCFA over two days pays 2,000 daily including purchase price", () => {
  const totalCycleRevenue = getWellnessCardTotalRevenue(3000, 1000);
  assert.equal(getWellnessDailyEarnings(totalCycleRevenue, 2), 2000);
  assert.equal(calculateWellnessDailyPayout(totalCycleRevenue, 2, 0, 1, 0), 2000);
  assert.equal(calculateWellnessDailyPayout(totalCycleRevenue, 2, 1, 1, 2000), 2000);
  assert.equal(calculateWellnessDailyPayout(totalCycleRevenue, 2, 2, 1, 4000), 0);
});

test("wellness spreads indivisible amounts across daily credits, not as a final lump", () => {
  const totalCycleRevenue = 4001;
  const dailyEarnings = getWellnessDailyEarnings(totalCycleRevenue, 2);
  const firstDay = calculateWellnessDailyPayout(totalCycleRevenue, 2, 0, 1, 0);
  const finalDay = calculateWellnessDailyPayout(totalCycleRevenue, 2, 1, 1, firstDay);

  assert.equal(dailyEarnings, 2000);
  assert.equal(firstDay, 2001);
  assert.equal(finalDay, 2000);
  assert.equal(firstDay + finalDay, totalCycleRevenue);
});

test("daily payout migration catches up only accrued earnings not already paid", () => {
  assert.equal(calculateDailyPayoutCatchUp(600, 200), 400);
  assert.equal(calculateDailyPayoutCatchUp(200, 300), 0);
});
