import { createHmac, timingSafeEqual } from "node:crypto";

export function signSecurityPayload(payload: Record<string, unknown>, secret: string): string {
  if (!secret) throw new Error("A signing secret is required.");
  const encodedPayload = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const signature = createHmac("sha256", secret).update(encodedPayload).digest("base64url");
  return `${encodedPayload}.${signature}`;
}

export function verifySecurityPayload<T extends Record<string, unknown>>(
  token: unknown,
  secret: string,
): T | null {
  if (typeof token !== "string" || token.length > 6_000 || !secret) return null;
  const [encodedPayload, encodedSignature, ...extra] = token.split(".");
  if (
    extra.length > 0 ||
    !encodedPayload ||
    !encodedSignature ||
    !/^[A-Za-z0-9_-]+$/.test(encodedPayload) ||
    !/^[A-Za-z0-9_-]+$/.test(encodedSignature)
  ) {
    return null;
  }

  const expected = createHmac("sha256", secret).update(encodedPayload).digest();
  let received: Buffer;
  try {
    received = Buffer.from(encodedSignature, "base64url");
  } catch {
    return null;
  }
  if (received.length !== expected.length || !timingSafeEqual(received, expected)) return null;

  try {
    const parsed: unknown = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8"));
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed as T
      : null;
  } catch {
    return null;
  }
}
