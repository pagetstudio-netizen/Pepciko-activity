import assert from "node:assert/strict";
import test from "node:test";
import {
  formatActivityProductName,
  getNextActivityProductNumber,
} from "../shared/activity-product-names";

test("activity product names start at VIP1 Activity when there are no activities", () => {
  assert.equal(formatActivityProductName(getNextActivityProductNumber([])), "VIP1 Activity");
});

test("activity product numbering ignores stable products", () => {
  assert.equal(getNextActivityProductNumber([
    { name: "Produit stable", productType: "stable" },
  ]), 1);
});

test("activity product numbering continues after the largest existing VIP number", () => {
  assert.equal(getNextActivityProductNumber([
    { name: "VIP1 Activity", productType: "activity" },
    { name: "VIP4 Activity", productType: "activity" },
  ]), 5);
});

test("legacy and unrecognized activity names still reserve sequence numbers", () => {
  assert.equal(getNextActivityProductNumber([
    { name: "Ancien nom", productType: "activity" },
    { name: "Robotics-fund AVC1", productType: "activity" },
  ]), 3);
});

test("legacy AVC names still reserve their sequence number", () => {
  assert.equal(getNextActivityProductNumber([
    { name: "PepsiCo AVC5", productType: "activity" },
  ]), 6);
});

test("activity product names reject invalid sequence numbers", () => {
  assert.throws(() => formatActivityProductName(0), RangeError);
});
