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
  const lines = Array.from({ length: 6 }, () => {
    const x1 = randomInt(8, 188);
    const x2 = randomInt(8, 188);
    const y1 = randomInt(8, 66);
    const y2 = randomInt(8, 66);
    const opacity = (0.18 + Math.random() * 0.28).toFixed(2);
    return `<path d="M${x1} ${y1} L${x2} ${y2}" stroke="#52656d" stroke-width="1.2" opacity="${opacity}"/>`;
  }).join("");
  const dots = Array.from({ length: 24 }, () => {
    const cx = randomInt(4, 192);
    const cy = randomInt(4, 70);
    return `<circle cx="${cx}" cy="${cy}" r="1.2" fill="#687b82" opacity=".35"/>`;
  }).join("");
  const glyphs = code.split("").map((character, index) => {
    const x = 29 + index * 27;
    const y = 44 + randomInt(-5, 6);
    const rotation = randomInt(-16, 17);
    return `<text x="${x}" y="${y}" transform="rotate(${rotation} ${x} ${y})" fill="#203a49" font-family="Arial,sans-serif" font-size="29" font-weight="700">${character}</text>`;
  }).join("");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 196 74" role="img" aria-label="Code de vérification"><rect width="196" height="74" rx="9" fill="#f2f2f2"/>${lines}${dots}${glyphs}</svg>`;

  return {
    challenge: {
      scope,
      salt,
      hash: digestCaptchaCode(salt, code),
      expiresAt: now + CAPTCHA_LIFETIME_MS,
      attempts: 0,
    } satisfies AuthCaptchaChallenge,
    image: `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`,
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
