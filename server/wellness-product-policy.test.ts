import assert from "node:assert/strict";
import test from "node:test";
import {
  getWellnessCardTotalRevenue,
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
