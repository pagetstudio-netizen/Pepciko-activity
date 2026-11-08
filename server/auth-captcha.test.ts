import assert from "node:assert/strict";
import test from "node:test";
import {
  CAPTCHA_DELAY_SECONDS,
  CAPTCHA_LIFETIME_MS,
  CAPTCHA_MAX_ATTEMPTS,
  createAuthCaptcha,
  verifyAuthCaptcha,
} from "./auth-captcha";

function readCodeFromImage(image: string) {
  const svg = Buffer.from(image.split(",")[1], "base64").toString("utf8");
  return Array.from(svg.matchAll(/<text\b[^>]*>([A-Z2-9])<\/text>/g), (match) => match[1]).join("");
}

test("captcha generation waits five seconds and exposes a six-character visual challenge", () => {
  const created = createAuthCaptcha("register", 1_000);
  const code = readCodeFromImage(created.image);

  assert.equal(CAPTCHA_DELAY_SECONDS, 5);
  assert.equal(code.length, 6);
  assert.equal(created.challenge.scope, "register");
  assert.equal(created.challenge.expiresAt, 1_000 + CAPTCHA_LIFETIME_MS);
  assert.equal(created.challenge.attempts, 0);
  assert.equal(verifyAuthCaptcha(created.challenge, "register", code.toLowerCase(), 2_000).status, "valid");
});

test("captcha rejects an incorrect answer and locks after five attempts", () => {
  const { challenge } = createAuthCaptcha("transaction_password", 1_000);
  let current = challenge;

  for (let attempt = 1; attempt < CAPTCHA_MAX_ATTEMPTS; attempt += 1) {
    const result = verifyAuthCaptcha(current, "transaction_password", "XXXXXX", 2_000);
    assert.equal(result.status, "invalid");
    if (result.status === "invalid") current = result.nextChallenge;
    assert.equal(current.attempts, attempt);
  }

  assert.deepEqual(
    verifyAuthCaptcha(current, "transaction_password", "XXXXXX", 2_000),
    { status: "locked", nextChallenge: null },
  );
});

test("captcha expires and cannot be reused for another action", () => {
  const { challenge } = createAuthCaptcha("register", 1_000);

  assert.deepEqual(
    verifyAuthCaptcha(challenge, "register", "AAAAAA", 1_000 + CAPTCHA_LIFETIME_MS),
    { status: "expired", nextChallenge: null },
  );
  assert.deepEqual(
    verifyAuthCaptcha(challenge, "transaction_password", "AAAAAA", 2_000),
    { status: "missing", nextChallenge: null },
  );
});
