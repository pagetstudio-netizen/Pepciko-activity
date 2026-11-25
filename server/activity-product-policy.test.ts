import assert from "node:assert/strict";
import { test } from "node:test";
import {
  compareActivityProductOrder,
  getActivityDailyProfit,
  getActivityDailyProfitEstimate,
  getActivityProductRank,
  getActivityProfit,
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

test("activity cards derive daily earnings from profit and cycle without changing payout", () => {
  const payout = getActivityTotalPayout(3_000, 1_250);
  const daily = getActivityDailyProfit(payout, 3_000, 3);
  assert.equal(daily, 1_250 / 3);
  assert.equal(daily * 3, 1_250);
  assert.equal(getActivityProfit(payout, 3_000), 1_250);
  assert.equal(payout, 4_250);
});

test("activity product ranks sort by their VIP number", () => {
  assert.equal(getActivityProductRank("VIP1 Activity"), 1);
  assert.equal(getActivityProductRank("VIP 4 Activité"), 4);
  assert.equal(getActivityProductRank("Activity VIP"), null);
  const products = [
    { id: 4, name: "VIP4 Activity", price: 45_000 },
    { id: 3, name: "VIP3 Activity", price: 17_000 },
    { id: 1, name: "VIP1 Activity", price: 3_000 },
    { id: 2, name: "VIP2 Activity", price: 7_000 },
  ];
  assert.deepEqual(products.sort(compareActivityProductOrder).map((product) => product.name), [
    "VIP1 Activity",
    "VIP2 Activity",
    "VIP3 Activity",
    "VIP4 Activity",
  ]);
});

test("activity total payout rejects invalid or unsupported values", () => {
  assert.equal(getActivityTotalPayout(0, 100), 0);
  assert.equal(getActivityTotalPayout(1_000, 0), 0);
  assert.equal(getActivityTotalPayout(2_147_483_647, 1), 0);
});
