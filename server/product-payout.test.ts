import assert from "node:assert/strict";
import test from "node:test";
import {
  calculateDailyPayoutCatchUp,
  calculateDailyProductPayout,
  calculateMaturityPayout,
  getProductPayoutMode,
} from "./product-payout";

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

test("daily payouts credit each elapsed cycle and cap at the remaining return", () => {
  assert.equal(calculateDailyProductPayout(1000, 200, 100, 2, false), 200);
  assert.equal(calculateDailyProductPayout(250, 200, 100, 2, false), 50);
  assert.equal(calculateDailyProductPayout(1000, 950, 100, 1, false), 50);
});

test("the final daily payout settles any remaining return", () => {
  assert.equal(calculateDailyProductPayout(1000, 700, 100, 1, true), 300);
  assert.equal(calculateDailyProductPayout(1000, 1000, 100, 1, true), 0);
});

test("daily payout migration catches up only accrued earnings not already paid", () => {
  assert.equal(calculateDailyPayoutCatchUp(600, 200), 400);
  assert.equal(calculateDailyPayoutCatchUp(200, 300), 0);
});
