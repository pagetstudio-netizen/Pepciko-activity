import assert from "node:assert/strict";
import test from "node:test";
import { signSecurityPayload, verifySecurityPayload } from "./security-tokens";

test("signed payloads verify only with the matching secret and content", () => {
  const token = signSecurityPayload({ purpose: "callback", depositId: 7 }, "test-secret");
  assert.deepEqual(
    verifySecurityPayload(token, "test-secret"),
    { purpose: "callback", depositId: 7 },
  );
  assert.equal(verifySecurityPayload(token, "different-secret"), null);
  assert.equal(verifySecurityPayload(`${token}x`, "test-secret"), null);
});

test("signed payload verifier rejects malformed tokens", () => {
  assert.equal(verifySecurityPayload("not-a-token", "test-secret"), null);
  assert.equal(verifySecurityPayload(null, "test-secret"), null);
});
