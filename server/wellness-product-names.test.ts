import assert from "node:assert/strict";
import test from "node:test";
import {
  formatWellnessProductName,
  getNextWellnessProductNumber,
} from "../shared/wellness-product-names";

test("wellness names start with Diwali Gift, then VIP1 welfare", () => {
  assert.equal(formatWellnessProductName(1), "Diwali Gift");
  assert.equal(formatWellnessProductName(2), "VIP1 welfare");
  assert.equal(formatWellnessProductName(3), "VIP2 welfare");
});

test("wellness naming ignores other product types and continues its own sequence", () => {
  assert.equal(getNextWellnessProductNumber([
    { name: "Buy to become VIP8", productType: "stable" },
    { name: "VIP1 Activity", productType: "activity" },
    { name: "Diwali Gift", productType: "wellness" },
  ]), 2);
  assert.equal(getNextWellnessProductNumber([
    { name: "Diwali Gift", productType: "wellness" },
    { name: "VIP4 welfare", productType: "wellness" },
  ]), 6);
});

test("wellness names reject invalid sequence values", () => {
  assert.throws(() => formatWellnessProductName(0), RangeError);
  assert.throws(() => formatWellnessProductName(1.5), RangeError);
});
