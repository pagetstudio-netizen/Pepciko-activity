import test from "node:test";
import assert from "node:assert/strict";
import { resolveSignupBonus } from "./signup-bonus";

test("signup bonus accepts zero and nonnegative whole FCFA amounts", () => {
  assert.equal(resolveSignupBonus("0"), 0);
  assert.equal(resolveSignupBonus(0), 0);
  assert.equal(resolveSignupBonus("500"), 500);
});

test("signup bonus safely defaults invalid and negative values to zero", () => {
  assert.equal(resolveSignupBonus(undefined), 0);
  assert.equal(resolveSignupBonus("invalid"), 0);
  assert.equal(resolveSignupBonus("-100"), 0);
  assert.equal(resolveSignupBonus("12.5"), 0);
});
