import assert from "node:assert/strict";
import test from "node:test";
import {
  calculateVipLevels,
  isVipQualifyingCreditTransactionType,
  VIP_QUALIFYING_CREDIT_TRANSACTION_TYPES,
  VIP_LEVEL_THRESHOLDS_FCFA,
  VIP_LEVEL_THRESHOLDS_INR,
  VIP_INR_TO_FCFA_RATE,
} from "../shared/vip-levels";

test("VIP thresholds are fixed FCFA conversions of the confirmed INR schedule", () => {
  assert.equal(VIP_INR_TO_FCFA_RATE, 6.1859);
  assert.deepEqual(VIP_LEVEL_THRESHOLDS_INR, [0, 270, 770, 1_770, 17_700, 37_700, 57_700, 77_700, 97_700]);
  assert.deepEqual(VIP_LEVEL_THRESHOLDS_FCFA, [0, 1_670, 4_763, 10_949, 109_490, 233_208, 356_926, 480_644, 604_362]);
});

test("VIP level advances from the qualifying-credit total at exact boundaries", () => {
  for (let level = 0; level < VIP_LEVEL_THRESHOLDS_FCFA.length; level += 1) {
    const summary = calculateVipLevels(VIP_LEVEL_THRESHOLDS_FCFA[level]);
    assert.equal(summary.currentLevel, level);
    assert.equal(summary.levels.filter((item) => item.isCurrent).length, 1);
  }
});

test("VIP progress never exceeds 100 percent and retains the qualifying-credit total", () => {
  const summary = calculateVipLevels(VIP_LEVEL_THRESHOLDS_FCFA[4] + 500);

  assert.equal(summary.currentLevel, 4);
  assert.equal(summary.totalQualifyingCredits, VIP_LEVEL_THRESHOLDS_FCFA[4] + 500);
  assert.equal(summary.levels[1].progressPercent, 100);
  assert.equal(summary.levels[4].progressFcfa, summary.totalQualifyingCredits);
  assert.equal(summary.levels[5].progressPercent < 100, true);
});

test("invalid or negative deposit totals do not create a VIP level", () => {
  assert.equal(calculateVipLevels(-100).currentLevel, 0);
  assert.equal(calculateVipLevels(Number.NaN).currentLevel, 0);
});

test("VIP includes referral, invitation, check-in, and wheel credits without double-counting deposits", () => {
  assert.deepEqual(VIP_QUALIFYING_CREDIT_TRANSACTION_TYPES, [
    "commission",
    "deposit_commission",
    "task_reward",
    "daily_checkin",
    "wheel_prize_withdrawal",
  ]);
  for (const type of VIP_QUALIFYING_CREDIT_TRANSACTION_TYPES) {
    assert.equal(isVipQualifyingCreditTransactionType(type), true);
  }
  for (const excludedType of ["deposit", "bonus", "blog_reward", "product_earning", "withdrawal"]) {
    assert.equal(isVipQualifyingCreditTransactionType(excludedType), false);
  }
});
