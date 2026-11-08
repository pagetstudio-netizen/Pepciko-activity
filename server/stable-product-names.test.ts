import assert from "node:assert/strict";
import test from "node:test";
import {
  FIRST_STABLE_PRODUCT_VIP_LEVEL,
  formatStableProductName,
  getNextStableProductVipLevel,
} from "../shared/stable-product-names";

test("stable product names start at Buy to become VIP1", () => {
  assert.equal(FIRST_STABLE_PRODUCT_VIP_LEVEL, 1);
  assert.equal(formatStableProductName(FIRST_STABLE_PRODUCT_VIP_LEVEL), "Buy to become VIP1");
});

test("stable product numbering ignores other product types", () => {
  assert.equal(getNextStableProductVipLevel([
    { name: "VIP1 Activity", productType: "activity" },
  ]), 1);
});

test("stable product numbering continues after existing catalog entries", () => {
  assert.equal(getNextStableProductVipLevel([
    { name: "Buy to become VIP1", productType: "stable" },
    { name: "Buy to become VIP2", productType: "stable" },
    { name: "VIP1 Activity", productType: "activity" },
  ]), 3);
});

test("stable product numbering does not reuse the highest assigned VIP level", () => {
  assert.equal(getNextStableProductVipLevel([
    { name: "Buy to become VIP1", productType: "stable" },
    { name: "Buy to become VIP8", productType: "stable" },
  ]), 9);
});

test("stable product formatter rejects levels below VIP1", () => {
  assert.throws(() => formatStableProductName(0), RangeError);
});
