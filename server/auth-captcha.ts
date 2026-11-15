import { createHash, randomBytes, randomInt, timingSafeEqual } from "node:crypto";

export const CAPTCHA_DELAY_SECONDS = 5;
export const CAPTCHA_LIFETIME_MS = 2 * 60 * 1000;
export const CAPTCHA_MAX_ATTEMPTS = 5;
export const CAPTCHA_CODE_LENGTH = 6;

export type AuthCaptchaScope = "register" | "transaction_password";

export interface AuthCaptchaChallenge {
  scope: AuthCaptchaScope;
  salt: string;
  hash: string;
  expiresAt: number;
  attempts: number;
}

export type CaptchaVerification =
  | { status: "valid"; nextChallenge: null }
  | { status: "missing" | "expired" | "locked"; nextChallenge: null }
  | { status: "invalid"; nextChallenge: AuthCaptchaChallenge };

const CAPTCHA_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function digestCaptchaCode(salt: string, code: string): string {
  return createHash("sha256").update(`${salt}:${code}`).digest("hex");
}

export function createAuthCaptcha(scope: AuthCaptchaScope, now = Date.now()) {
  let code = "";
  for (let index = 0; index < CAPTCHA_CODE_LENGTH; index += 1) {
    code += CAPTCHA_ALPHABET[randomInt(CAPTCHA_ALPHABET.length)];
  }

  const salt = randomBytes(16).toString("hex");
  return {
    challenge: {
      scope,
      salt,
      hash: digestCaptchaCode(salt, code),
      expiresAt: now + CAPTCHA_LIFETIME_MS,
      attempts: 0,
    } satisfies AuthCaptchaChallenge,
    code,
  };
}

export function verifyAuthCaptcha(
  challenge: AuthCaptchaChallenge | undefined,
  scope: AuthCaptchaScope,
  submittedCode: unknown,
  now = Date.now(),
): CaptchaVerification {
  if (!challenge || challenge.scope !== scope) {
    return { status: "missing", nextChallenge: null };
  }
  if (challenge.expiresAt <= now) {
    return { status: "expired", nextChallenge: null };
  }
  if (challenge.attempts >= CAPTCHA_MAX_ATTEMPTS) {
    return { status: "locked", nextChallenge: null };
  }

  const normalizedCode = typeof submittedCode === "string"
    ? submittedCode.trim().toUpperCase()
    : "";
  const submittedHash = digestCaptchaCode(challenge.salt, normalizedCode);
  const expectedBuffer = Buffer.from(challenge.hash, "hex");
  const submittedBuffer = Buffer.from(submittedHash, "hex");
  const valid = normalizedCode.length === CAPTCHA_CODE_LENGTH &&
    expectedBuffer.length === submittedBuffer.length &&
    timingSafeEqual(expectedBuffer, submittedBuffer);

  if (valid) return { status: "valid", nextChallenge: null };

  const attempts = challenge.attempts + 1;
  if (attempts >= CAPTCHA_MAX_ATTEMPTS) {
    return { status: "locked", nextChallenge: null };
  }
  return {
    status: "invalid",
    nextChallenge: { ...challenge, attempts },
  };
}
