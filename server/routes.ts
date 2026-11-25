import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { createHmac, randomInt, randomUUID, timingSafeEqual } from "node:crypto";
import session from "express-session";
import multer from "multer";
import sharp from "sharp";
import { storage } from "./storage";
import { databaseUrl, pool } from "./db";
import { registerSchema, loginSchema, depositSchema, walletSchema, phoneNumberSchema, blogPostSchema, blogApprovalSchema, transactionPasswordSetupSchema, type Deposit, type Product, type User, type Withdrawal } from "@shared/schema";
import {
  changeUserPassword,
  hashPassword,
  resetUserPassword,
  verifyPassword,
} from "./password-utils";
import {
  CAPTCHA_DELAY_SECONDS,
  CAPTCHA_LIFETIME_MS,
  createAuthCaptcha,
  type AuthCaptchaChallenge,
  type AuthCaptchaScope,
  verifyAuthCaptcha,
} from "./auth-captcha";
import { isPpayProsPhoneFormatSupported, normalizeBeninPhone } from "@shared/phone";
import {
  PRODUCT_IMAGE_URL,
  WELLNESS_PRODUCT_IMAGE_URL,
} from "@shared/product-catalog";
import {
  getActivityDailyProfitEstimate,
  getActivityTotalPayout,
} from "@shared/activity-product-policy";
import {
  FORTUNE_WHEEL_PRIZES,
  selectFortuneWheelOutcome,
} from "@shared/fortune-wheel";
import { z } from "zod";
import {
  BLOG_DAILY_LIMIT_MESSAGE,
  BLOG_IMAGE_REQUIRED_MESSAGE,
  BLOG_WITHDRAWAL_REQUIRED_MESSAGE,
} from "./blog-policy";
import {
  BlogImageStorageError,
  BlogImageValidationError,
  deleteBlogImages,
  downloadBlogImage,
  downloadBlogImagePreview,
  uploadBlogImage,
} from "./blog-image-storage";
import { isProductAvailableForCountry, isValidLaunchSchedule } from "./product-schedule";
import {
  hasActiveWellnessProduct,
  hasPurchasedActivityLaunch,
  MAX_PRODUCT_PURCHASE_QUANTITY,
  isValidProductPurchaseQuantity,
} from "../shared/product-purchase-limit";
import {
  formatActivityProductName,
  getNextActivityProductNumber,
} from "../shared/activity-product-names";
import {
  formatStableProductName,
  getNextStableProductVipLevel,
} from "../shared/stable-product-names";
import {
  formatWellnessProductName,
  getNextWellnessProductNumber,
} from "../shared/wellness-product-names";
import {
  getWellnessCardTotalRevenue,
  getWellnessDailyEarnings,
  isValidWellnessCycleDays,
} from "../shared/wellness-product-policy";
import { calculateVipLevels } from "../shared/vip-levels";
import { MemoryWindowRateLimiter } from "./security-rate-limit";
import { signSecurityPayload, verifySecurityPayload } from "./security-tokens";

interface AuthCaptchaSessionEntry {
  readyAt: number | null;
  challenge: AuthCaptchaChallenge | null;
}

function authCaptchaSession(req: Request) {
  return req.session as typeof req.session & {
    authCaptchas?: Partial<Record<AuthCaptchaScope, AuthCaptchaSessionEntry>>;
  };
}

function verifySessionCaptcha(req: Request, scope: AuthCaptchaScope, submittedCode: unknown) {
  const sessionData = authCaptchaSession(req);
  const entry = sessionData.authCaptchas?.[scope];
  const result = verifyAuthCaptcha(entry?.challenge ?? undefined, scope, submittedCode);

  if (result.status === "valid" || result.status === "expired" || result.status === "locked" || result.status === "missing") {
    if (sessionData.authCaptchas) delete sessionData.authCaptchas[scope];
  } else if (entry) {
    entry.challenge = result.nextChallenge;
  }
  return result;
}

function isAllowedWellnessImageUrl(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const imageUrl = value.trim();
  if (!imageUrl || imageUrl.length > 2048) return false;
  if (imageUrl.startsWith("/") && !imageUrl.startsWith("//")) return true;
  try {
    return new URL(imageUrl).protocol === "https:";
  } catch {
    return false;
  }
}

import ConnectPgSimple from "connect-pg-simple";
import { 
  initiatePayment, 
  verifyPayment, 
  isSoleaspaySupported, 
  mapSoleaspayStatus,
  SOLEASPAY_SERVICE_MAP 
} from "./soleaspay";
import {
  createPayment as sendavapayCreate,
  initiatePayment as sendavapayInitiate,
  submitOtp as sendavapaySubmitOtp,
  retryPayment as sendavapayRetry,
  verifyPayment as sendavapayVerify,
  verifyWebhookSignature as sendavapayVerifySignature,
  mapSendavapayStatus,
  formatPhone as sendavapayFormatPhone,
  getCurrency as sendavapayGetCurrency,
  toSendavapayCountry,
} from "./sendavapay";
import {
  createPpayProsMerchantOrderNo,
  createPpayProsPayin,
  createPpayProsPayout,
  formatPpayProsPhone,
  getPpayProsBalance,
  getPpayProsCredentialStatus,
  getPpayProsCredentials,
  getPpayProsDefaultWayCode,
  getPpayProsCountryRegistrationMessage,
  parsePpayProsMerchantOrderNo,
  PPAYPROS_COUNTRIES,
  PpayProsApiError,
  queryPpayProsPayin,
  queryPpayProsPayout,
  resolvePpayProsPayoutAccountCode,
  toPpayProsAmount,
  verifyPpayProsSignature,
} from "./ppaypros";
import {
  buildPaymentUrl as westpayBuildUrl,
  verifyWebhookSignature as westpayVerifySignature,
  transfer as westpayTransfer,
  formatMsisdn as westpayFormatMsisdn,
} from "./westpay";
import {
  InpayRequestError,
  createPayin as inpayCreatePayin,
  createPayout as inpayCreatePayout,
  createOutTradeNo as inpayCreateOutTradeNo,
  findVerifiedAccount as inpayFindVerifiedAccount,
  getBalance as inpayGetBalance,
  getInpayAccount,
  getInpayEnabledCountries,
  getCountryName as inpayGetCountryName,
  isInpayConfigured,
  isInpayCountryEnabled,
  mapPayinStatus as mapInpayPayinStatus,
  mapPayoutStatus as mapInpayPayoutStatus,
  resolveBankCode as inpayResolveBankCode,
} from "./inpay";
import {
  ashtechTransactionMatches,
  collectPayment as ashtechCollect,
  getCountries as ashtechGetCountries,
  getTransaction as ashtechGetTransaction,
  isAshtechConfigured,
  mapAshtechStatus,
  AshtechApiError,
  filterAshtechCountryOperators,
  isAshtechOperatorActive,
  verifyAshtechWebhookSignature,
} from "./ashtechpay";
import { resolvePaymentWebhookBaseUrl } from "./payment-webhook-url";
import {
  createDrimPayPayoutExternalRef,
  createDrimPayReference,
  drimPayGetBalance,
  drimPayGetPayin,
  DRIMPAY_MAX_PAYIN_STATUS_CHECKS,
  drimPayGetPayout,
  drimPayInitiatePayin,
  drimPayInitiatePayout,
  drimPayOperatorsForCountry,
  getDrimPayWavePaymentUrl,
  getDrimPayOperatorSlug,
  getDrimPayWebhookSecret,
  isDrimPayConfigured,
  isDrimPayCountry,
  isDrimPayWebhookConfigured,
  mapDrimPayStatus,
  normalizeDrimPayPhone,
  unwrapDrimPayResponse,
  verifyDrimPayWebhookSignature,
  DrimPayApiError,
} from "./drimpay";
import {
  buildManualDepositNotification,
  formatTelegramValue,
  isTelegramConfigured,
  sendTelegramInpayError,
  sendTelegramMessage,
  sendTelegramPaymentError,
  sendTelegramSecurityAlert,
  sendTelegramDepositSupportReport,
} from "./telegram";
import { requestWithdrawal } from "./withdrawal-request";
import { validateManualDepositProof } from "./manual-deposit-validation";
import express from "express";

const blogImageUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    files: 2,
    fileSize: 2 * 1024 * 1024,
    fields: 1,
    fieldSize: 2100,
    parts: 3,
  },
  fileFilter: (_req, file, callback) => {
    if (["image/jpeg", "image/png", "image/webp"].includes(file.mimetype)) {
      callback(null, true);
      return;
    }
    callback(new Error("Utilisez une image JPEG, PNG ou WebP."));
  },
}).array("images", 2);

const depositSupportReportUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    files: 3,
    fileSize: 5 * 1024 * 1024,
    fields: 3,
    fieldSize: 2048,
    parts: 6,
  },
  fileFilter: (_req, file, callback) => {
    if (["image/jpeg", "image/png", "image/webp"].includes(file.mimetype)) {
      callback(null, true);
      return;
    }
    callback(new Error("Joignez uniquement des images JPEG, PNG ou WebP."));
  },
}).array("photos", 3);

function parseBlogImageFiles(req: Request, res: Response, next: NextFunction) {
  blogImageUpload(req, res, (error) => {
    if (!error) return next();
    if (error instanceof multer.MulterError) {
      const message = error.code === "LIMIT_FILE_SIZE"
        ? "Chaque capture doit faire moins de 2 Mo avant compression."
        : "Vous pouvez joindre deux captures maximum.";
      return res.status(error.code === "LIMIT_FILE_SIZE" ? 413 : 400).json({ message });
    }
    return res.status(400).json({
      message: error instanceof Error ? error.message : "Les captures n’ont pas pu être lues.",
    });
  });
}

function parseDepositSupportReportFiles(req: Request, res: Response, next: NextFunction) {
  depositSupportReportUpload(req, res, (error) => {
    if (!error) return next();
    if (error instanceof multer.MulterError) {
      const message = error.code === "LIMIT_FILE_SIZE"
        ? "Chaque image doit faire 5 Mo maximum."
        : "Joignez trois images maximum et renseignez les champs demandés.";
      return res.status(error.code === "LIMIT_FILE_SIZE" ? 413 : 400).json({ message });
    }
    return res.status(400).json({
      message: error instanceof Error ? error.message : "Les pièces jointes n’ont pas pu être lues.",
    });
  });
}

const securityRateLimiter = new MemoryWindowRateLimiter();
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_IP_LIMIT = 20;
const LOGIN_ACCOUNT_LIMIT = 10;
const AUTH_ENDPOINT_WINDOW_MS = 60 * 60 * 1000;
const AUTH_REGISTER_IP_LIMIT = 5;

function getClientKey(req: Request): string {
  // Express derives req.ip from the trusted proxy chain configured below.
  // Never read X-Forwarded-For directly: clients can forge that header.
  return req.ip || req.socket.remoteAddress || "unknown";
}

function getLoginRateLimitKeys(
  req: Request,
  userId?: number,
): { ipKey: string; accountKey: string | null; userKey: string | null } {
  const body = req.body && typeof req.body === "object"
    ? req.body as Record<string, unknown>
    : {};
  const country = typeof body.country === "string"
    ? body.country.trim().toUpperCase().slice(0, 3)
    : "";
  const rawPhone = typeof body.phone === "string" ? body.phone.slice(0, 32) : "";
  const digits = rawPhone.replace(/\D/g, "").slice(0, 15);
  if (!/^[A-Z]{2,3}$/.test(country) || digits.length < 8) {
    return {
      ipKey: `login:ip:${getClientKey(req)}`,
      accountKey: null,
      userKey: Number.isSafeInteger(userId) ? `login:user:${userId}` : null,
    };
  }

  const normalizedPhone = country === "BJ"
    ? normalizeBeninPhone(rawPhone) || digits
    : digits;
  const accountDigest = createHmac("sha256", sessionSecret as string)
    .update(`${country}:${normalizedPhone}`)
    .digest("hex");
  return {
    ipKey: `login:ip:${getClientKey(req)}`,
    accountKey: `login:account:${accountDigest}`,
    userKey: Number.isSafeInteger(userId) ? `login:user:${userId}` : null,
  };
}

function checkBruteForce(req: Request, res: Response, userId?: number): boolean {
  const { ipKey, accountKey, userKey } = getLoginRateLimitKeys(req, userId);
  const decisions = [
    securityRateLimiter.check(ipKey, LOGIN_IP_LIMIT, LOGIN_WINDOW_MS),
    ...(accountKey
      ? [securityRateLimiter.check(accountKey, LOGIN_ACCOUNT_LIMIT, LOGIN_WINDOW_MS)]
      : []),
    ...(userKey
      ? [securityRateLimiter.check(userKey, LOGIN_ACCOUNT_LIMIT, LOGIN_WINDOW_MS)]
      : []),
  ];
  const blocked = decisions.filter((decision) => !decision.allowed);
  if (blocked.length === 0) return false;

  const retryAfterMs = Math.max(...blocked.map((decision) => decision.retryAfterMs));
  res.setHeader("Retry-After", String(Math.max(1, Math.ceil(retryAfterMs / 1000))));
  res.setHeader("Cache-Control", "no-store");
  res.status(429).json({ message: "Trop de tentatives. Réessayez plus tard." });
  return true;
}

function recordFailedAttempt(req: Request, userId?: number): void {
  const { ipKey, accountKey, userKey } = getLoginRateLimitKeys(req, userId);
  const ipBefore = securityRateLimiter.check(ipKey, LOGIN_IP_LIMIT, LOGIN_WINDOW_MS);
  const accountBefore = accountKey
    ? securityRateLimiter.check(accountKey, LOGIN_ACCOUNT_LIMIT, LOGIN_WINDOW_MS)
    : null;
  const userBefore = userKey
    ? securityRateLimiter.check(userKey, LOGIN_ACCOUNT_LIMIT, LOGIN_WINDOW_MS)
    : null;

  securityRateLimiter.record(ipKey, LOGIN_WINDOW_MS);
  if (accountKey) securityRateLimiter.record(accountKey, LOGIN_WINDOW_MS);
  if (userKey) securityRateLimiter.record(userKey, LOGIN_WINDOW_MS);

  if (
    ipBefore.remaining === 1 ||
    accountBefore?.remaining === 1 ||
    userBefore?.remaining === 1
  ) {
    void sendTelegramSecurityAlert(
      getClientKey(req),
      "Le seuil de tentatives de connexion a été atteint. Réessayez dans 15 minutes.",
    ).catch((error) => console.error("[telegram] security notification failed:", error.message));
  }
}

function clearFailedAttempts(req: Request, userId?: number): void {
  const { accountKey, userKey } = getLoginRateLimitKeys(req, userId);
  if (accountKey) securityRateLimiter.clear(accountKey);
  if (userKey) securityRateLimiter.clear(userKey);
}

function consumeEndpointLimit(
  req: Request,
  res: Response,
  scope: string,
  limit: number,
  windowMs: number,
): boolean {
  const decision = securityRateLimiter.consume(
    `${scope}:${getClientKey(req)}`,
    limit,
    windowMs,
  );
  if (decision.allowed) return false;
  res.setHeader("Retry-After", String(Math.max(1, Math.ceil(decision.retryAfterMs / 1000))));
  res.setHeader("Cache-Control", "no-store");
  res.status(429).json({ message: "Trop de demandes. Réessayez plus tard." });
  return true;
}

function consumeUserLimit(
  req: Request,
  res: Response,
  scope: string,
  limit: number,
  windowMs: number,
): boolean {
  const userId = req.session.userId;
  if (!Number.isSafeInteger(userId) || !userId) return false;
  const decision = securityRateLimiter.consume(
    `${scope}:user:${userId}`,
    limit,
    windowMs,
  );
  if (decision.allowed) return false;
  res.setHeader("Retry-After", String(Math.max(1, Math.ceil(decision.retryAfterMs / 1000))));
  res.setHeader("Cache-Control", "no-store");
  res.status(429).json({ message: "Trop de demandes pour ce compte. Réessayez plus tard." });
  return true;
}

function toClientUser(user: User) {
  const { password: _password, adminPin: _adminPin, ...safeUser } = user;
  return safeUser;
}

const sessionAccountCache = new Map<number, { allowed: boolean; expiresAt: number }>();
const SESSION_ACCOUNT_CACHE_TTL_MS = 5_000;

async function isSessionAccountAllowed(userId: number): Promise<boolean> {
  const now = Date.now();
  const cached = sessionAccountCache.get(userId);
  if (cached && cached.expiresAt > now) return cached.allowed;

  const user = await storage.getUser(userId);
  const allowed = Boolean(user && !user.isBanned);
  if (sessionAccountCache.size > 10_000) {
    for (const [id, entry] of Array.from(sessionAccountCache.entries())) {
      if (entry.expiresAt <= now) sessionAccountCache.delete(id);
    }
    while (sessionAccountCache.size > 10_000) {
      const oldestId = sessionAccountCache.keys().next().value as number | undefined;
      if (oldestId === undefined) break;
      sessionAccountCache.delete(oldestId);
    }
  }
  sessionAccountCache.set(userId, { allowed, expiresAt: now + SESSION_ACCOUNT_CACHE_TTL_MS });
  return allowed;
}

function destroySession(req: Request, res: Response): void {
  req.session.destroy((error) => {
    if (error) console.error("[security] failed to destroy an invalid session");
  });
  res.clearCookie("connect.sid", {
    path: "/",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
  });
}

async function establishAuthenticatedSession(req: Request, userId: number): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    req.session.regenerate((error) => error ? reject(error) : resolve());
  });
  req.session.userId = userId;
  await new Promise<void>((resolve, reject) => {
    req.session.save((error) => error ? reject(error) : resolve());
  });
}

function apiRequestPath(req: Request): string {
  return (req.originalUrl.split("?")[0] || req.path).replace(/\/+$/, "") || "/";
}

function trustedOrigins(req: Request): Set<string> {
  const origins = new Set<string>();
  const addOrigin = (value: string | undefined, defaultProtocol = "https:") => {
    if (!value?.trim()) return;
    try {
      const candidate = value.includes("://") ? value : `${defaultProtocol}//${value}`;
      origins.add(new URL(candidate).origin);
    } catch {
      // Ignore malformed deployment configuration; it never becomes trusted.
    }
  };

  addOrigin(`${req.protocol}://${req.get("host")}`, req.protocol);
  addOrigin(process.env.PUBLIC_APP_URL);
  addOrigin(process.env.REPLIT_DEV_DOMAIN);
  for (const domain of (process.env.REPLIT_DOMAINS || "").split(",")) {
    addOrigin(domain.trim());
  }
  return origins;
}

function isTrustedBrowserOrigin(req: Request): boolean {
  const source = req.get("origin") || req.get("referer");
  if (!source) return false;
  try {
    return trustedOrigins(req).has(new URL(source).origin);
  } catch {
    return false;
  }
}

function signSendavaOtpTicket(otpToken: string, userId: number, depositId: number): string {
  return signSecurityPayload({
    purpose: "sendavapay-otp",
    otpToken,
    userId,
    depositId,
    expiresAt: Date.now() + 10 * 60 * 1000,
  }, sessionSecret as string);
}

function verifySendavaOtpTicket(value: unknown) {
  const payload = verifySecurityPayload<{
    purpose?: unknown;
    otpToken?: unknown;
    userId?: unknown;
    depositId?: unknown;
    expiresAt?: unknown;
  }>(value, sessionSecret as string);
  if (
    payload?.purpose !== "sendavapay-otp" ||
    typeof payload.otpToken !== "string" ||
    !payload.otpToken ||
    !Number.isSafeInteger(payload.userId) ||
    !Number.isSafeInteger(payload.depositId) ||
    typeof payload.expiresAt !== "number" ||
    payload.expiresAt <= Date.now()
  ) {
    return null;
  }
  return {
    otpToken: payload.otpToken,
    userId: payload.userId as number,
    depositId: payload.depositId as number,
  };
}

function createWestPayReturnState(depositId: number): string {
  return signSecurityPayload({
    purpose: "westpay-return",
    depositId,
    expiresAt: Date.now() + 3 * 60 * 60 * 1000,
  }, sessionSecret as string);
}

function readWestPayReturnState(value: unknown): number | null {
  const payload = verifySecurityPayload<{
    purpose?: unknown;
    depositId?: unknown;
    expiresAt?: unknown;
  }>(value, sessionSecret as string);
  if (
    payload?.purpose !== "westpay-return" ||
    !Number.isSafeInteger(payload.depositId) ||
    typeof payload.expiresAt !== "number" ||
    payload.expiresAt <= Date.now()
  ) {
    return null;
  }
  return payload.depositId as number;
}

function getPublicBaseUrl(req: Request): string {
  const configuredUrl = process.env.PUBLIC_APP_URL?.trim().replace(/\/+$/, "");
  if (configuredUrl) {
    const parsed = new URL(configuredUrl);
    if (process.env.NODE_ENV === "production" && parsed.protocol !== "https:") {
      throw new Error("PUBLIC_APP_URL must use HTTPS in production.");
    }
    return parsed.origin;
  }

  const devDomain = process.env.REPLIT_DEV_DOMAIN?.trim();
  if (devDomain) return `https://${devDomain}`;

  const productionDomain = (process.env.REPLIT_DOMAINS || "")
    .split(",")
    .map((domain) => domain.trim())
    .find(Boolean);
  if (productionDomain) return `https://${productionDomain}`;

  if (process.env.NODE_ENV === "production") {
    throw new Error("PUBLIC_APP_URL must be configured for production callbacks.");
  }
  const host = req.get("host");
  if (!host) throw new Error("Request host is unavailable.");
  return `${req.protocol}://${host}`;
}

function getPaymentWebhookBaseUrl(req: Request): string {
  return resolvePaymentWebhookBaseUrl({
    configuredUrl:
      process.env.ASHTECHPAY_WEBHOOK_BASE_URL || process.env.PUBLIC_APP_URL,
    fallbackUrl: getPublicBaseUrl(req),
    requestHost: req.get("host"),
    forwardedProto: String(req.headers["x-forwarded-proto"] || ""),
    requestProtocol: req.protocol,
    origin: req.get("origin"),
  });
}

function ppayProsCallbackPayload(req: Request): Record<string, unknown> {
  const combined = {
    ...(req.query as Record<string, unknown>),
    ...((req.body && typeof req.body === "object" ? req.body : {}) as Record<string, unknown>),
  };
  return Object.fromEntries(
    Object.entries(combined)
      .filter(([, value]) => typeof value === "string" || typeof value === "number")
      .map(([key, value]) => [key, String(value)]),
  );
}

function ppayProsCountryList(setting: string | undefined): string[] {
  return (setting || "")
    .split(",")
    .map((country) => country.trim().toUpperCase())
    .filter(Boolean);
}

function isPpayProsEnabled(
  kind: "Payin" | "Payout",
  country: string,
  settings: Record<string, string>,
): boolean {
  const normalizedCountry = country.trim().toUpperCase();
  const listKey = `ppaypros${kind}Countries`;
  const enabledCountries = ppayProsCountryList(settings[listKey]);
  if (Object.prototype.hasOwnProperty.call(settings, listKey)) {
    return enabledCountries.includes(normalizedCountry);
  }
  // Backward compatibility for the previous Benin-only toggles.
  return normalizedCountry === "BJ" && settings[`ppaypros${kind}Enabled`] === "true";
}

function getPpayProsWayCode(country: string, settings: Record<string, string>): string {
  const key = `ppayprosWayCode_${country.trim().toUpperCase()}`;
  return (settings[key] ?? getPpayProsDefaultWayCode(country)).trim();
}

function getPpayProsPayoutAccountCode(
  country: string,
  settings: Record<string, string>,
  paymentMethod = "",
): string {
  const key = `ppayprosPayoutAccountCode_${country.trim().toUpperCase()}`;
  return resolvePpayProsPayoutAccountCode(country, paymentMethod, settings[key] || "");
}

async function reconcilePpayProsPayout(
  withdrawal: Withdrawal,
  merchantOrderNo: string,
  stateValue: unknown,
  transferId?: string,
): Promise<Withdrawal | undefined> {
  if (withdrawal.omnipayReference !== merchantOrderNo) {
    throw new Error("Référence PPayPros différente de celle du retrait.");
  }
  if (withdrawal.status === "approved" || withdrawal.status === "rejected") return withdrawal;

  const state = Number(stateValue);
  if (state === 0 || state === 1) {
    return storage.setWithdrawalProcessing(withdrawal.id, {
      ...(transferId ? { omnipayId: transferId } : {}),
    }).then(async (updated) => updated ?? await storage.getWithdrawal(withdrawal.id));
  }
  if (state !== 2 && state !== 3 && state !== 4) {
    throw new Error("État de virement PPayPros inconnu.");
  }

  const terminalStatus = state === 2 ? "approved" : "rejected";
  const finalized = await storage.finalizeWithdrawal(
    withdrawal.id,
    terminalStatus,
    undefined,
    transferId ? { omnipayId: transferId } : {},
    "PPayPros",
  );
  if (!finalized) return await storage.getWithdrawal(withdrawal.id);
  return finalized;
}

async function reconcilePpayProsPayin(deposit: Deposit, stateValue: unknown): Promise<Deposit | undefined> {
  if (deposit.status === "approved" || deposit.status === "rejected") return deposit;
  const state = Number(stateValue);
  if (state === 2) {
    await creditApprovedDeposit(deposit);
    return await storage.getDeposit(deposit.id);
  }
  if ([3, 4, 5, 6].includes(state)) {
    await storage.rejectDeposit(deposit.id);
    return await storage.getDeposit(deposit.id);
  }
  if (state === 0 || state === 1 || state === 7) {
    return storage.setDepositNonterminalStatus(deposit.id, "processing");
  }
  throw new Error("État de paiement PPayPros inconnu.");
}

async function syncPpayProsPayinOrderId(deposit: Deposit, orderIdValue: unknown): Promise<Deposit> {
  if (typeof orderIdValue !== "string" && typeof orderIdValue !== "number") return deposit;
  const providerOrderId = String(orderIdValue).trim();
  if (!providerOrderId) return deposit;
  if (deposit.omnipayId && deposit.omnipayId !== providerOrderId) {
    throw new Error("PPayPros a renvoyé un numéro de commande différent de celui du dépôt.");
  }
  if (deposit.omnipayId === providerOrderId) return deposit;
  return storage.updateDeposit(deposit.id, { omnipayId: providerOrderId });
}

function getBlockedIps(value: string | undefined): string[] {
  try {
    const parsed = JSON.parse(value || "[]");
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

const BLOCKED_IP_CACHE_TTL_MS = 15_000;
let blockedIpsCache: { values: string[]; expiresAt: number } | null = null;

async function getCachedBlockedIps(): Promise<string[]> {
  const now = Date.now();
  if (blockedIpsCache && blockedIpsCache.expiresAt > now) {
    return blockedIpsCache.values;
  }

  const values = getBlockedIps((await storage.getSetting("blockedIps")) ?? undefined);
  blockedIpsCache = { values, expiresAt: now + BLOCKED_IP_CACHE_TTL_MS };
  return values;
}

function updateBlockedIpsCache(values: string[]) {
  blockedIpsCache = {
    values,
    expiresAt: Date.now() + BLOCKED_IP_CACHE_TTL_MS,
  };
}
// --- end brute-force protection ---

function parseDrimPayOperators(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((operator): operator is string => typeof operator === "string");
  }
  if (typeof value !== "string" || !value.trim()) return [];
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) {
      return parsed
        .map((operator) =>
          typeof operator === "string"
            ? operator
            : operator?.name || operator?.operator || operator?.code || "",
        )
        .filter((operator): operator is string => typeof operator === "string" && Boolean(operator.trim()));
    }
  } catch {
    // Older country records may contain comma-separated operator names.
  }
  return value.split(",").map((operator) => operator.trim()).filter(Boolean);
}

function isDrimPayCountryEnabled(
  settings: Record<string, string>,
  kind: "Payin" | "Payout",
  country: string,
) {
  const normalizedCountry = country.trim().toUpperCase();
  const enabled = settings[`drimpay${kind}Enabled`] === "true";
  const countries = (settings[`drimpay${kind}Countries`] || "")
    .split(",")
    .map((code) => code.trim().toUpperCase())
    .filter(Boolean);
  return enabled && countries.includes(normalizedCountry) && isDrimPayCountry(normalizedCountry);
}

function getRouteParam(value: string | string[]): string {
  return Array.isArray(value) ? value[0] ?? "" : value;
}

async function creditApprovedDeposit(
  deposit: { id: number; userId: number; amount: number },
  processedBy?: number,
  description?: string,
) {
  const approved = await storage.approveDepositAndCredit(deposit.id, processedBy, description);
  if (!approved) return;
  const user = await storage.getUser(approved.userId);
  if (!user) return;
  void sendTelegramMessage(
    [
      "✅ <b>Dépôt validé</b>",
      `Utilisateur : ${formatTelegramValue(user.fullName)}`,
      `Montant : <b>${formatTelegramValue(approved.amount)} XOF</b>`,
      `Référence : ${formatTelegramValue(approved.id)}`,
      `Pays : ${formatTelegramValue(user.country)}`,
    ].join("\n"),
  ).catch((error) => console.error("[telegram] deposit notification failed:", error.message));
}

async function reconcileDrimPayDeposit(
  deposit: Awaited<ReturnType<typeof storage.getDeposit>> & {},
  response: Record<string, any>,
) {
  const data = unwrapDrimPayResponse(response);
  if (data.amount !== undefined && Number(data.amount) !== deposit.amount) {
    throw new Error("Le montant confirmé par DrimPay ne correspond pas au dépôt.");
  }
  if (data.country_code && String(data.country_code).toUpperCase() !== deposit.country.toUpperCase()) {
    throw new Error("Le pays confirmé par DrimPay ne correspond pas au dépôt.");
  }
  if (data.order_id && deposit.drimpayOrderId && String(data.order_id) !== deposit.drimpayOrderId) {
    throw new Error("La référence de commande DrimPay ne correspond pas au dépôt.");
  }
  if (data.reference && deposit.drimpayReference && String(data.reference) !== deposit.drimpayReference) {
    throw new Error("La référence DrimPay ne correspond pas au dépôt.");
  }

  const status = mapDrimPayStatus(data.status);
  if (status === "approved") {
    await creditApprovedDeposit(deposit);
  } else if (status === "rejected") {
    await storage.rejectDeposit(deposit.id);
  } else if (deposit.status === "pending") {
    await storage.setDepositNonterminalStatus(deposit.id, "processing");
  }
  if (status === "approved" || status === "rejected") {
    await storage.clearDrimPayStatusCheckCount(deposit.id).catch(() => undefined);
  }
  return (await storage.getDeposit(deposit.id)) || deposit;
}

let drimPayStatusReconciliationRunning = false;

export async function reconcilePendingDrimPayDeposits() {
  if (drimPayStatusReconciliationRunning || !isDrimPayConfigured()) return;
  drimPayStatusReconciliationRunning = true;
  try {
    const pendingDeposits = await storage.getPendingDrimPayDeposits();
    for (const deposit of pendingDeposits) {
      if (!deposit.drimpayReference) continue;

      let attempt: number;
      try {
        attempt = await storage.incrementDrimPayStatusCheckCount(deposit.id);
      } catch (error: any) {
        console.error(`[drimpay] failed to record status check for deposit #${deposit.id}:`, error?.message || error);
        continue;
      }

      if (attempt > DRIMPAY_MAX_PAYIN_STATUS_CHECKS) {
        await storage.rejectDeposit(deposit.id);
        await storage.clearDrimPayStatusCheckCount(deposit.id).catch(() => undefined);
        continue;
      }

      try {
        const providerStatus = await drimPayGetPayin(deposit.drimpayReference);
        const updated = await reconcileDrimPayDeposit(deposit, providerStatus);
        if (updated.status === "approved" || updated.status === "rejected") continue;
        if (attempt === DRIMPAY_MAX_PAYIN_STATUS_CHECKS) {
          await storage.rejectDeposit(deposit.id);
          await storage.clearDrimPayStatusCheckCount(deposit.id).catch(() => undefined);
          console.info(`[drimpay] deposit #${deposit.id} marked failed after five status checks`);
        }
      } catch (error: any) {
        console.error(`[drimpay] automatic status check ${attempt}/${DRIMPAY_MAX_PAYIN_STATUS_CHECKS} failed for deposit #${deposit.id}:`, error?.message || error);
        if (attempt === DRIMPAY_MAX_PAYIN_STATUS_CHECKS) {
          await storage.rejectDeposit(deposit.id);
          await storage.clearDrimPayStatusCheckCount(deposit.id).catch(() => undefined);
          console.info(`[drimpay] deposit #${deposit.id} marked failed after five status checks`);
        }
      }
    }
  } catch (error: any) {
    console.error("[drimpay] automatic deposit reconciliation failed:", error?.message || error);
  } finally {
    drimPayStatusReconciliationRunning = false;
  }
}

async function reconcileDrimPayPayout(
  withdrawal: Withdrawal,
  response: Record<string, any>,
) {
  const data = unwrapDrimPayResponse(response);
  if (data.amount !== undefined && Number(data.amount) !== withdrawal.netAmount) {
    throw new Error("Le montant confirmé par DrimPay ne correspond pas au retrait.");
  }
  if (data.country_code && String(data.country_code).toUpperCase() !== withdrawal.country.toUpperCase()) {
    throw new Error("Le pays confirmé par DrimPay ne correspond pas au retrait.");
  }
  if (
    data.external_ref &&
    withdrawal.drimpayExternalRef &&
    String(data.external_ref) !== withdrawal.drimpayExternalRef
  ) {
    throw new Error("La référence externe DrimPay ne correspond pas au retrait.");
  }
  if (
    data.reference &&
    withdrawal.drimpayReference &&
    String(data.reference) !== withdrawal.drimpayReference
  ) {
    throw new Error("La référence DrimPay ne correspond pas au retrait.");
  }

  const status = mapDrimPayStatus(data.status);
  if (status === "approved" || status === "rejected") {
    await storage.finalizeWithdrawal(
      withdrawal.id,
      status,
      undefined,
      data.reference ? { drimpayReference: String(data.reference) } : {},
      "DrimPay",
    );
  } else if (withdrawal.status !== "approved" && withdrawal.status !== "rejected") {
    await storage.setWithdrawalProcessing(withdrawal.id, {
      ...(data.reference ? { drimpayReference: String(data.reference) } : {}),
    });
  }
  return (await storage.getWithdrawal(withdrawal.id)) || withdrawal;
}

declare module "express-session" {
  interface SessionData {
    userId: number;
  }
}

const PgSession = ConnectPgSimple(session);
const sessionDatabaseUrl = databaseUrl;
const sessionSecret = process.env.SESSION_SECRET;

if (!sessionDatabaseUrl) {
  throw new Error("DATABASE_URL is not configured for session storage.");
}
if (!sessionSecret) {
  throw new Error("SESSION_SECRET must be configured.");
}

const SENSITIVE_SETTING_KEYS = new Set([
  "sendavapayWebhookSecret",
  "omnipayCallbackKey",
  "westpayWebhookSecret",
  "ashtechWebhookSecret",
]);
const INPAY_COUNTRY_CODES = ["SN", "ML", "CI", "BF", "TG", "BJ", "GH", "CM", "CG", "KE", "TZ", "UG", "ZA"];
const INPAY_MERCHANT_SETTING_KEYS = new Set(
  INPAY_COUNTRY_CODES.map((country) => `inpayMerchantId_${country}`),
);
const PUBLIC_SETTING_KEYS = new Set([
  "supportLink", "supportType", "supportLabel",
  "support2Link", "support2Type", "support2Label",
  "channelLink", "channelType", "channelLabel",
  "groupLink", "groupType", "groupLabel", "noticeText", "popupButtonLabel",
  "supportEnabled", "support2Enabled", "channelEnabled", "groupEnabled",
  "signupBonus", "minDeposit", "minWithdrawal", "withdrawalFees",
  "maxWithdrawalsPerDay", "withdrawalStartHour", "withdrawalEndHour",
  "level1Commission", "level2Commission", "level3Commission",
  "sendavapayEnabled", "sendavapayChannelName",
  "westpayEnabled", "westpayChannelName", "westpayCountries",
  "ppayprosPayinEnabled", "ppayprosPayoutEnabled",
  "ppayprosPayinCountries", "ppayprosPayoutCountries",
  "ashtechEnabled", "ashtechChannelName", "ashtechCountries",
  "drimpayPayinEnabled", "drimpayPayoutEnabled",
  "drimpayPayinCountries", "drimpayPayoutCountries",
  "inpayEnabled", "inpayChannelName", "inpayCountries",
]);
const ADMIN_SETTING_KEYS = new Set([
  ...Array.from(PUBLIC_SETTING_KEYS),
  "sendavapayWebhookSecret", "omnipayCallbackKey",
  "westpayWebhookSecret",
  "ashtechWebhookSecret",
  ...Array.from(INPAY_MERCHANT_SETTING_KEYS),
  "ppayprosPayinCountries", "ppayprosPayoutCountries",
  ...PPAYPROS_COUNTRIES.flatMap(({ code }) => [
    `ppayprosWayCode_${code}`,
    `ppayprosPayoutAccountCode_${code}`,
  ]),
]);
const MASKED_SETTING_VALUE = "********";

function publicSettings(settings: Record<string, string>) {
  return Object.fromEntries(
    Object.entries(settings).filter(([key]) => PUBLIC_SETTING_KEYS.has(key)),
  );
}

function adminSettings(settings: Record<string, string>) {
  return Object.fromEntries(
    Object.entries(settings)
      .filter(([key]) => ADMIN_SETTING_KEYS.has(key))
      .map(([key, value]) => [
      key,
      SENSITIVE_SETTING_KEYS.has(key) && value ? MASKED_SETTING_VALUE : value,
      ]),
  );
}

function validatePhone(value: unknown, fieldName: string): string {
  const result = phoneNumberSchema.safeParse(value);
  if (!result.success) {
    throw new Error(`${fieldName} invalide`);
  }
  return result.data;
}

async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const userId = req.session.userId;
  if (!Number.isSafeInteger(userId) || !userId) {
    return res.status(401).json({ message: "Non authentifié" });
  }
  try {
    if (!await isSessionAccountAllowed(userId)) {
      destroySession(req, res);
      return res.status(401).json({ message: "Non authentifié" });
    }
    return next();
  } catch (error) {
    console.error("[security] session validation failed:", error instanceof Error ? error.message : "unknown");
    return res.status(503).json({ message: "Le service d’authentification est temporairement indisponible." });
  }
}

async function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.session.userId) {
    return res.status(401).json({ message: "Non authentifié" });
  }
  const user = await storage.getUser(req.session.userId);
  if (!user || user.isBanned) {
    destroySession(req, res);
    return res.status(401).json({ message: "Non authentifié" });
  }
  if (!user.isAdmin) {
    return res.status(403).json({ message: "Accès refusé" });
  }
  return next();
}

async function requireBanker(req: Request, res: Response, next: NextFunction) {
  if (!req.session.userId) {
    return res.status(401).json({ message: "Non authentifié" });
  }
  const user = await storage.getUser(req.session.userId);
  if (!user || user.isBanned) {
    destroySession(req, res);
    return res.status(401).json({ message: "Non authentifié" });
  }
  if (!user.isAdmin && !user.isBanker) {
    return res.status(403).json({ message: "Accès refusé" });
  }
  return next();
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  
  // Trust proxy for production HTTPS (Replit deployment)
  app.set("trust proxy", 1);

  app.use(
    session({
      store: new PgSession({
        pool,
        tableName: "session",
        createTableIfMissing: true,
        pruneSessionInterval: 60 * 60,
      }),
       secret: sessionSecret as string,
      resave: false,
      saveUninitialized: false,
      cookie: {
        secure: process.env.NODE_ENV === "production",
        httpOnly: true,
        maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
        sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
      },
    })
  );

  const bankClosedMessage = "La banque n'est pas ouverte pour le moment.";
  app.use((req, res, next) => {
    const path = req.path;
    const requestBody = req.body && typeof req.body === "object"
      ? req.body as Record<string, unknown>
      : {};
    const isRobotPaySource = requestBody.paymentSource === "robotpay" || req.query.source === "robotpay";
    const isRobotPayRequest =
      /^\/api\/deposit\/provider(?:\/|$)/.test(path) ||
      /^\/api\/drimpay\/(?:operators|payin)(?:\/|$)/.test(path) ||
      /^\/api\/deposits\/\d+\/drimpay-status$/.test(path) ||
      (isRobotPaySource && /^\/api\/(?:deposits|payment-numbers|ashtechpay|sendavapay)(?:\/|$)/.test(path));
    const isProviderWebhook = /^\/api\/webhooks\/(?:ppaypros|ashtechpay|drimpay|inpay|westpay|sendavapay)(?:\/|$)/.test(path);
    const isWithdrawalProviderRequest =
      /^\/api\/admin\/withdrawals\/\d+\/(?:ppaypros|drimpay|inpay)(?:\/status)?$/.test(path);
    const isPaymentRequest =
      /^\/api\/deposits(?:\/|$)/.test(path) ||
      /^\/api\/(?:payment-channels|payment-numbers|soleaspay\/services)(?:\/|$)/.test(path) ||
      /^\/api\/deposit\/provider(?:\/|$)/.test(path) ||
      /^\/api\/(?:drimpay|ashtechpay|sendavapay)(?:\/|$)/.test(path) ||
      isWithdrawalProviderRequest ||
      isProviderWebhook;
    if (!isPaymentRequest) return next();

    const pathLower = path.toLowerCase();
    const provider = pathLower.includes("ppaypros") || requestBody.usePpaypros === true
      ? "PPayPros"
      : pathLower.includes("ashtech") || pathLower.includes("ashtechpay")
        ? "AshTechPay"
        : pathLower.includes("drimpay")
          ? "DrimPay"
          : pathLower.includes("inpay")
            ? "InPay"
            : pathLower.includes("westpay") || requestBody.useWestpay === true
              ? "WestPay"
              : pathLower.includes("sendavapay")
                ? "SendavaPay"
                : pathLower.includes("soleaspay") || requestBody.useSoleaspay === true
                  ? "SoleasPay"
                  : isRobotPayRequest
                    ? "RobotPay"
                    : "Paiement";
    const recordIdFromPath = path.match(/\/(?:deposits|withdrawals)\/(\d+)(?:\/|$)/)?.[1];
    const operation = isProviderWebhook
      ? "Callback fournisseur"
      : path.includes("/withdrawals/")
        ? "Retrait automatique"
        : /(?:-status|\/verify)$/.test(path)
          ? "Vérification de transaction"
          : "Dépôt ou initiation";

    const parseResponseBody = (body: unknown): unknown => {
      if (typeof body !== "string") {
        if (Buffer.isBuffer(body)) {
          const text = body.toString("utf8");
          try { return JSON.parse(text); } catch { return text; }
        }
        return body;
      }
      try { return JSON.parse(body); } catch { return body; }
    };
    let responseBodySnapshot: unknown;
    const terminalStatuses = ["rejected", "failed", "failure", "expired", "cancelled", "canceled"];
    const originalJson = res.json.bind(res);
    res.json = ((body: unknown) => {
      responseBodySnapshot = body;
      const responseBody = body && typeof body === "object" && !Array.isArray(body)
        ? body as Record<string, unknown>
        : null;
      const responseStatus = String(responseBody?.status || "").trim().toLowerCase();
      const isOtpChallenge = responseBody?.error === "otp_required";
      const isFailureResponse = res.statusCode >= 400 || terminalStatuses.includes(responseStatus);
      // Keep the existing customer-facing RobotPay message while reporting
      // the provider response captured above to the configured Telegram group.
      return originalJson(isRobotPayRequest && responseBody && isFailureResponse && !isOtpChallenge
        ? { ...responseBody, message: bankClosedMessage }
        : body);
    }) as typeof res.json;

    const originalSend = res.send.bind(res);
    res.send = ((body: unknown) => {
      if (responseBodySnapshot === undefined) responseBodySnapshot = parseResponseBody(body);
      return originalSend(body as any);
    }) as typeof res.send;

    res.once("finish", () => {
      const responseBody = responseBodySnapshot && typeof responseBodySnapshot === "object"
        ? responseBodySnapshot as Record<string, unknown>
        : {};
      const nestedRequestData = requestBody.data && typeof requestBody.data === "object"
        ? requestBody.data as Record<string, unknown>
        : {};
      const providerEvent = String(requestBody.event || requestBody.type || "").trim().toLowerCase();
      const providerStatus = String(requestBody.status || nestedRequestData.status || "").trim().toLowerCase();
      const responseStatus = String(responseBody.status || "").trim().toLowerCase();
      const terminalWebhookFailure =
        isProviderWebhook &&
        (providerEvent.endsWith(".failed") ||
          providerEvent.endsWith(".failure") ||
          providerEvent.endsWith(".expired") ||
          terminalStatuses.includes(providerStatus));
      const terminalResponseFailure = terminalStatuses.includes(responseStatus);
      const otpChallenge = responseBody.error === "otp_required";
      if (otpChallenge || (!terminalWebhookFailure && res.statusCode < 400 && !terminalResponseFailure)) return;
      if (res.statusCode === 401 && !isProviderWebhook) return;

      const responseMessage = typeof responseBody.message === "string"
        ? responseBody.message
        : typeof responseBody.error === "string"
          ? responseBody.error
          : typeof responseBody.code === "string"
            ? responseBody.code
            : null;
      const providerErrorCode = responseBody.error_code ?? responseBody.errorCode ?? responseBody.code;
      const providerError = terminalWebhookFailure
        ? requestBody.message ?? requestBody.error ??
          `Événement ${providerEvent || "de paiement"} — statut ${providerStatus || "refusé"}`
        : responseMessage
          ? providerErrorCode && String(providerErrorCode) !== responseMessage
            ? `${String(providerErrorCode)} — ${responseMessage}`
            : responseMessage
          : terminalResponseFailure
            ? `Le fournisseur a refusé le paiement (statut : ${responseStatus})`
            : `HTTP ${res.statusCode}`;
      if (
        res.statusCode === 403 &&
        /origine de la requête refusée|accès bloqué|non authentifié/i.test(String(providerError))
      ) return;

      void sendTelegramPaymentError({
        provider,
        operation,
        path,
        method: req.method,
        status: res.statusCode,
        error: providerError,
        userId: req.session?.userId,
        amount: requestBody.amount,
        country: requestBody.country ?? requestBody.countryCode,
        operator: requestBody.operator ?? requestBody.operatorName ?? requestBody.paymentMethod,
        recordId: recordIdFromPath ?? requestBody.depositId ?? requestBody.withdrawalId,
        reference: requestBody.reference ?? requestBody.external_ref ?? requestBody.out_trade_no ?? requestBody.mchOrderNo,
      }).catch((notificationError) => {
        console.error("[telegram] payment error notification failed:", notificationError.message);
      });
    });
    next();
  });

  app.use(async (req, res, next) => {
    try {
      const blockedIps = await getCachedBlockedIps();
      if (blockedIps.includes(getClientKey(req))) {
        return res.status(403).json({ message: "Accès bloqué pour cette adresse IP" });
      }
      next();
    } catch (error) {
      console.error("[security] IP block check failed:", error);
      next();
    }
  });

  app.use("/api", (req, res, next) => {
    const path = apiRequestPath(req);
    const isWebhook = path.startsWith("/api/webhooks/");

    const isUnsafeMethod = ["POST", "PUT", "PATCH", "DELETE"].includes(req.method.toUpperCase());
    const changesStateOnGet =
      req.method.toUpperCase() === "GET" &&
      /^\/api\/deposits\/\d+\/(?:verify|drimpay-status|ashtechpay-status|sendavapay-status)$/.test(path);
    if (
      !isWebhook &&
      (isUnsafeMethod || changesStateOnGet) &&
      !isTrustedBrowserOrigin(req)
    ) {
      return res.status(403).json({ message: "Origine de la requête refusée." });
    }

    return next();
  });

  // Auth routes
  app.post("/api/auth/captcha/start", (req, res) => {
    if (consumeEndpointLimit(req, res, "captcha-start", 10, 60_000)) return;
    const requestedScope: unknown = req.body?.scope;
    if (requestedScope !== "register" && requestedScope !== "transaction_password") {
      return res.status(400).json({ message: "Type de vérification invalide" });
    }
    const scope = requestedScope;
    if (scope === "transaction_password" && !req.session.userId) {
      return res.status(401).json({ message: "Non authentifié" });
    }

    const sessionData = authCaptchaSession(req);
    const entries = sessionData.authCaptchas ?? (sessionData.authCaptchas = {});
    const current = entries[scope];
    const now = Date.now();
    if (current?.readyAt && current.readyAt > now) {
      return res.status(429).json({
        message: "Patientez avant de demander un nouveau code.",
        countdownSeconds: Math.ceil((current.readyAt - now) / 1000),
      });
    }

    entries[scope] = { readyAt: now + CAPTCHA_DELAY_SECONDS * 1000, challenge: null };
    res.setHeader("Cache-Control", "no-store");
    return res.json({ countdownSeconds: CAPTCHA_DELAY_SECONDS });
  });

  app.post("/api/auth/captcha", (req, res) => {
    if (consumeEndpointLimit(req, res, "captcha-generate", 10, 60_000)) return;
    const requestedScope: unknown = req.body?.scope;
    if (requestedScope !== "register" && requestedScope !== "transaction_password") {
      return res.status(400).json({ message: "Type de vérification invalide" });
    }
    const scope = requestedScope;
    if (scope === "transaction_password" && !req.session.userId) {
      return res.status(401).json({ message: "Non authentifié" });
    }

    const sessionData = authCaptchaSession(req);
    const entry = sessionData.authCaptchas?.[scope];
    if (!entry?.readyAt) {
      return res.status(400).json({ message: "Demandez d’abord un code de vérification." });
    }
    const now = Date.now();
    if (entry.readyAt > now) {
      return res.status(429).json({
        message: "Patientez avant de générer le code.",
        countdownSeconds: Math.ceil((entry.readyAt - now) / 1000),
      });
    }

    const generated = createAuthCaptcha(scope, now);
    sessionData.authCaptchas![scope] = { readyAt: null, challenge: generated.challenge };
    res.setHeader("Cache-Control", "no-store");
    return res.json({
      code: generated.code,
      expiresInSeconds: Math.floor(CAPTCHA_LIFETIME_MS / 1000),
    });
  });

  app.post("/api/auth/register", async (req, res) => {
    if (consumeEndpointLimit(req, res, "register", AUTH_REGISTER_IP_LIMIT, AUTH_ENDPOINT_WINDOW_MS)) return;
    try {
      const requestBody = req.body && typeof req.body === "object"
        ? req.body as Record<string, unknown>
        : {};
      const captcha = verifySessionCaptcha(req, "register", requestBody.captchaCode);
      if (captcha.status !== "valid") {
        const message = captcha.status === "expired" || captcha.status === "missing"
          ? "Générez un nouveau code de vérification."
          : captcha.status === "locked"
            ? "Trop d’essais. Générez un nouveau code."
            : "Code de vérification incorrect.";
        return res.status(captcha.status === "locked" ? 429 : 400).json({ message });
      }
      const country = typeof requestBody.country === "string"
        ? requestBody.country.trim().toUpperCase()
        : requestBody.country;
      const beninRegistration = country === "BJ";
      const normalizedPhone = beninRegistration
        ? normalizeBeninPhone(requestBody.phone)
        : requestBody.phone;
      if (beninRegistration && !normalizedPhone) {
        return res.status(400).json({
          message: "Numéro béninois invalide : saisissez 8 chiffres locaux ou 01 suivi de 8 chiffres.",
        });
      }
      const data = registerSchema.parse({ ...requestBody, country, phone: normalizedPhone });

      const phoneCandidates = new Set([data.phone]);
      if (data.country === "BJ") {
        const localDigits = data.phone.startsWith("01") ? data.phone.slice(2) : data.phone;
        for (const candidate of [
          localDigits,
          `229${data.phone}`,
          `+229${data.phone}`,
          `229${localDigits}`,
          `+229${localDigits}`,
        ]) {
          phoneCandidates.add(candidate);
        }
      }
      for (const candidate of Array.from(phoneCandidates)) {
        const existing = await storage.getUserByPhone(candidate, data.country);
        if (existing) {
          return res.status(400).json({ message: "Ce numéro est déjà utilisé" });
        }
      }

      let referredBy: string | undefined;
      if (data.invitationCode && data.invitationCode.trim()) {
        const cleanCode = data.invitationCode.trim().toUpperCase();
        const referrer = await storage.getUserByReferralCode(cleanCode);
        if (!referrer) {
          return res.status(400).json({ message: "Code d'invitation invalide" });
        }
        referredBy = cleanCode;
      }

      const user = await storage.createUser({
        fullName: data.fullName,
        phone: data.phone,
        country: data.country,
        password: data.password,
        referredBy,
      });

      await establishAuthenticatedSession(req, user.id);
      res.json({ user: toClientUser(user) });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.issues[0].message });
      }
      res.status(500).json({ message: "Erreur interne du serveur." });
    }
  });

  app.post("/api/auth/login", async (req, res) => {
    if (checkBruteForce(req, res)) return;
    try {
      const data = loginSchema.parse(req.body);
      const country = data.country.toUpperCase();
      const phoneCandidates = new Set([data.phone]);
      if (country === "BJ") {
        const normalizedPhone = normalizeBeninPhone(data.phone);
        if (normalizedPhone) {
          const localDigits = normalizedPhone.slice(2);
          for (const candidate of [
            normalizedPhone,
            localDigits,
            `229${normalizedPhone}`,
            `+229${normalizedPhone}`,
            `229${localDigits}`,
            `+229${localDigits}`,
          ]) {
            phoneCandidates.add(candidate);
          }
        }
      }

      let user;
      for (const phone of Array.from(phoneCandidates)) {
        user = await storage.getUserByPhone(phone, country);
        if (user) break;
      }

      // Administrators may select any country at login. Regular users must
      // still authenticate with the country saved on their account.
      if (!user) {
        for (const phone of Array.from(phoneCandidates)) {
          const adminCandidate = await storage.getUserByPhoneAnyCountry(phone);
          if (adminCandidate?.isAdmin) {
            user = adminCandidate;
            break;
          }
        }
      }

      if (!user) {
        recordFailedAttempt(req);
        return res.status(400).json({ message: "Identifiants incorrects" });
      }

      if (checkBruteForce(req, res, user.id)) return;
      const validPassword = await verifyPassword(data.password, user.password);
      if (!validPassword) {
        recordFailedAttempt(req, user.id);
        return res.status(400).json({ message: "Identifiants incorrects" });
      }

      if (user.isBanned) {
        return res.status(403).json({ message: "Compte suspendu" });
      }

      clearFailedAttempts(req, user.id);
      await establishAuthenticatedSession(req, user.id);
      if (user.isAdmin) {
        void sendTelegramMessage(
          [
            "🔐 <b>Connexion administrateur</b>",
            `Administrateur : ${formatTelegramValue(user.fullName)}`,
            `Pays : ${formatTelegramValue(user.country)}`,
            `Adresse IP : ${formatTelegramValue(getClientKey(req))}`,
          ].join("\n"),
        ).catch((error) => console.error("[telegram] admin login notification failed:", error.message));
      }
      res.json({ user: toClientUser(user) });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        recordFailedAttempt(req);
        return res.status(400).json({ message: error.issues[0].message });
      }
      res.status(500).json({ message: "Erreur interne du serveur." });
    }
  });

  app.get("/api/auth/me", async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Non authentifié" });
    }
    const user = await storage.getUser(req.session.userId);
    if (!user || user.isBanned) {
      destroySession(req, res);
      return res.status(401).json({ message: "Non authentifié" });
    }
    res.json({ user: toClientUser(user) });
  });

  app.get("/api/auth/transaction-password/status", requireAuth, async (req, res) => {
    try {
      const hash = await storage.getTransactionPasswordHash(req.session.userId!);
      res.setHeader("Cache-Control", "no-store");
      return res.json({ hasPassword: Boolean(hash) });
    } catch {
      return res.status(500).json({ message: "Impossible de vérifier le mot de passe de retrait." });
    }
  });

  app.post("/api/auth/transaction-password", requireAuth, async (req, res) => {
    const parsed = transactionPasswordSetupSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.issues[0]?.message || "Données invalides." });
    }

    try {
      const userId = req.session.userId!;
      const user = await storage.getUser(userId);
      if (!user) return res.status(401).json({ message: "Non authentifié" });
      if (await storage.getTransactionPasswordHash(userId)) {
        return res.status(409).json({ message: "Un mot de passe de retrait est déjà défini." });
      }
      if (await verifyPassword(parsed.data.password, user.password)) {
        return res.status(400).json({
          message: "Choisissez un mot de passe de retrait différent de votre mot de passe de connexion.",
        });
      }

      const captcha = verifySessionCaptcha(req, "transaction_password", parsed.data.captchaCode);
      if (captcha.status !== "valid") {
        const message = captcha.status === "expired" || captcha.status === "missing"
          ? "Générez un nouveau code de vérification."
          : captcha.status === "locked"
            ? "Trop d’essais. Générez un nouveau code."
            : "Code de vérification incorrect.";
        return res.status(captcha.status === "locked" ? 429 : 400).json({ message });
      }

      const passwordHash = await hashPassword(parsed.data.password);
      const saved = await storage.setTransactionPasswordIfMissing(userId, passwordHash);
      if (!saved) return res.status(409).json({ message: "Un mot de passe de retrait est déjà défini." });
      return res.json({ success: true });
    } catch (error: any) {
      return res.status(500).json({ message: "Impossible d’enregistrer le mot de passe." });
    }
  });

  app.patch("/api/user/profile", requireAuth, async (req, res) => {
    const profileSchema = z.object({
      fullName: z
        .string()
        .trim()
        .min(2, "Le nom doit contenir au moins 2 caractères")
        .max(100, "Le nom ne peut pas dépasser 100 caractères"),
    });
    const parsed = profileSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.issues[0]?.message || "Profil invalide" });
    }

    try {
      const user = await storage.updateUser(req.session.userId!, {
        fullName: parsed.data.fullName,
      });
      return res.json({ user: toClientUser(user) });
    } catch {
      return res.status(500).json({ message: "Impossible de mettre à jour le profil" });
    }
  });

  app.post("/api/auth/logout", (req, res) => {
    req.session.destroy(() => {
      res.clearCookie("connect.sid", {
        path: "/",
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
      });
      res.json({ success: true });
    });
  });

  app.post("/api/change-password", requireAuth, async (req, res) => {
    if (consumeUserLimit(req, res, "change-password", 5, AUTH_ENDPOINT_WINDOW_MS)) return;
    try {
      const { currentPassword, newPassword } = req.body ?? {};
      
      if (typeof currentPassword !== "string" || !currentPassword) {
        return res.status(400).json({ message: "Veuillez remplir tous les champs" });
      }

      const user = await storage.getUser(req.session.userId!);
      if (!user) {
        return res.status(404).json({ message: "Utilisateur non trouve" });
      }

      const result = await changeUserPassword(
        currentPassword,
        newPassword,
        user.password,
        (password) => storage.updateUser(user.id, { password }),
      );
      if (result === "invalid_new_password") {
        return res.status(400).json({ message: "Le nouveau mot de passe doit contenir entre 6 et 128 caractères." });
      }
      if (result === "incorrect_current_password") {
        return res.status(400).json({ message: "Mot de passe actuel incorrect" });
      }

      res.json({ success: true, message: "Mot de passe modifie avec succes" });
    } catch (error: any) {
      res.status(500).json({ message: "Erreur interne du serveur." });
    }
  });

  // Products
  app.get("/api/products", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser(req.session.userId!);
      if (!user) return res.status(401).json({ message: "Non authentifié" });

      const products = (await storage.getProducts())
        .filter(product => isProductAvailableForCountry(product, user.country));
      const userProductsList = await storage.getUserProducts(req.session.userId!);
      const allUserProductsList = await storage.getAllUserProducts(req.session.userId!);
      const stockCounts = await storage.getProductStockCounts(products.map((product) => product.id));
      const activityPurchases = allUserProductsList.map(({ userProduct, product }) => ({
        productType: userProduct.purchaseProductType ?? product.productType,
        launchDate: userProduct.purchaseLaunchDate ?? product.launchDate,
        launchTime: userProduct.purchaseLaunchTime ?? product.launchTime,
        assignedByAdmin: userProduct.assignedByAdmin,
      }));
      const activeWellnessProduct = hasActiveWellnessProduct(allUserProductsList.map(({ userProduct, product }) => ({
        productType: userProduct.purchaseProductType ?? product.productType,
        isActive: userProduct.isActive,
        isRevoked: userProduct.isRevoked,
        daysRemaining: userProduct.daysRemaining,
      })));
      
      const productCounts = new Map<number, number>();
      userProductsList.forEach(up => {
        if (up.isActive) {
          productCounts.set(up.productId, (productCounts.get(up.productId) || 0) + 1);
        }
      });
      
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const canClaimFree = !user?.lastFreeProductClaim || 
        new Date(user.lastFreeProductClaim) < today;

      const productsWithOwnership = products.map(p => ({
        ...p,
        dailyEarnings: p.productType === "wellness"
          ? getWellnessDailyEarnings(
            p.price + p.totalReturn,
            p.cycleDays,
          )
          : p.dailyEarnings,
        isOwned: productCounts.has(p.id),
        ownedCount: productCounts.get(p.id) || 0,
        canClaimFree: p.isFree && canClaimFree,
        stockCount: stockCounts[p.id] || 0,
        canPurchaseThisLaunch: p.productType !== "activity"
          || !hasPurchasedActivityLaunch(p.launchDate, p.launchTime, activityPurchases),
        canPurchaseWellness: p.productType !== "wellness" || !activeWellnessProduct,
      }));

      res.json(productsWithOwnership);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/products/:id/purchase", requireAuth, async (req, res) => {
    if (consumeUserLimit(req, res, "product-purchase", 15, AUTH_ENDPOINT_WINDOW_MS)) return;
    try {
      const productId = parseInt(getRouteParam(req.params.id));
      const product = await storage.getProduct(productId);
      
      if (!product) {
        return res.status(404).json({ message: "Produit non trouvé" });
      }
      if (!product.isActive) {
        return res.status(409).json({ message: "Ce produit n’est plus disponible." });
      }

      const user = await storage.getUser(req.session.userId!);
      if (!user) return res.status(401).json({ message: "Non authentifié" });
      if (!isProductAvailableForCountry(product, user.country)) {
        return res.status(409).json({ message: "Ce produit d’activité n’est pas encore disponible." });
      }
      
      if (product.isFree) {
        return res.status(400).json({ message: "Utilisez /claim-free pour ce produit" });
      }

      const quantity = req.body?.quantity ?? 1;
      if (!isValidProductPurchaseQuantity(quantity, product.productType)) {
        const message = product.productType === "activity"
          && typeof quantity === "number"
          && quantity > 1
          ? "Un seul produit d’activité peut être acheté par lancement."
          : product.productType === "wellness"
            && typeof quantity === "number"
            && quantity > 1
            ? "Un seul produit Bien-être peut être acheté à la fois."
          : `La quantité doit être comprise entre 1 et ${MAX_PRODUCT_PURCHASE_QUANTITY}.`;
        return res.status(400).json({
          message,
        });
      }

      const userProduct = await storage.purchaseProduct(
        req.session.userId!,
        productId,
        false,
        quantity,
      );
      res.json(userProduct);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.post("/api/products/:id/claim-free", requireAuth, async (req, res) => {
    try {
      const productId = parseInt(getRouteParam(req.params.id));
      const product = await storage.getProduct(productId);
      
      if (!product || !product.isFree) {
        return res.status(400).json({ message: "Produit non valide" });
      }
      if (!product.isActive) {
        return res.status(409).json({ message: "Ce produit n’est plus disponible." });
      }

      const user = await storage.getUser(req.session.userId!);
      if (!user) {
        return res.status(401).json({ message: "Non authentifié" });
      }
      if (!isProductAvailableForCountry(product, user.country)) {
        return res.status(409).json({ message: "Ce produit d’activité n’est pas encore disponible." });
      }

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      if (user.lastFreeProductClaim && new Date(user.lastFreeProductClaim) >= today) {
        return res.status(400).json({ message: "Déjà réclamé aujourd'hui" });
      }

      const claimed = await storage.claimFreeProductReward(user.id, product.dailyEarnings);
      if (!claimed) return res.status(409).json({ message: "Déjà réclamé aujourd'hui" });

      res.json({ success: true });
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  // Get user's purchased products
  app.get("/api/user/vip-levels", requireAuth, async (req, res) => {
    try {
      const totalQualifyingCredits = await storage.getUserVipQualifyingTotal(req.session.userId!);
      const summary = calculateVipLevels(totalQualifyingCredits);
      res.setHeader("Cache-Control", "no-store");
      return res.json(summary);
    } catch (error: any) {
      console.error("[vip-levels] Unable to calculate user VIP levels:", error.message);
      return res.status(500).json({ message: "Impossible de calculer vos niveaux VIP." });
    }
  });

  app.get("/api/user/products", requireAuth, async (req, res) => {
    try {
      const userProductsList = await storage.getAllUserProducts(req.session.userId!);
      
      const formattedProducts = userProductsList
        .filter(up => !up.userProduct.isRevoked)
        .map(up => {
        const productType = up.userProduct.purchaseProductType ?? up.product.productType;
        const cycleDays = up.userProduct.purchaseCycleDays ?? up.product.cycleDays;
        const totalProfit = up.userProduct.purchaseTotalReturn ?? up.product.totalReturn;
        const purchasePrice = up.userProduct.purchasePrice ?? up.product.price;
        const totalReturn = productType === "wellness"
          ? getWellnessCardTotalRevenue(purchasePrice, totalProfit)
          : totalProfit;
        const configuredDailyEarnings = up.userProduct.purchaseDailyEarnings ?? up.product.dailyEarnings;
        return ({
        id: up.userProduct.id,
        productId: up.userProduct.productId,
        purchasedAt: up.userProduct.purchaseDate,
        daysRemaining: up.userProduct.daysRemaining,
        totalEarned: up.userProduct.totalEarned,
        payoutMode: up.userProduct.payoutMode,
        prepaidEarnings: up.userProduct.purchasePrepaidEarnings ?? (
          up.userProduct.payoutMode === "daily" ? up.userProduct.totalEarned : 0
        ),
        totalReturn,
        status: up.userProduct.isActive ? 'active' : 'completed',
        productType,
        product: {
          ...up.product,
          name: up.userProduct.purchaseProductName ?? up.product.name,
          price: purchasePrice,
          dailyEarnings: productType === "wellness"
            ? getWellnessDailyEarnings(totalReturn, cycleDays)
            : configuredDailyEarnings,
          cycleDays,
          totalReturn,
          imageUrl: up.userProduct.purchaseImageUrl ?? up.product.imageUrl,
          productType: up.userProduct.purchaseProductType ?? up.product.productType,
        },
        });
      });
      
      res.json(formattedProducts);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Product earnings are credited automatically according to the product category.
  app.post("/api/user/collect-earnings", requireAuth, async (req, res) => {
    return res.json({
      success: true,
      collected: 0,
      productsCollected: 0,
      message: "Les gains Bien-être sont crédités automatiquement toutes les 24 heures ; les gains stables et d’activité sont versés à l’échéance.",
    });
  });

  // Payment Channels
  app.get("/api/payment-channels", requireAuth, async (req, res) => {
    try {
      const [channels, settings] = await Promise.all([
        storage.getPaymentChannels(),
        storage.getSettings(),
      ]);

      const soleaspayEnabled = settings.soleaspayEnabled === "true";
      const soleaspayChannelName = settings.soleaspayChannelName || "Westpay";
      const sendavapayEnabled = settings.sendavapayEnabled === "true";
      const sendavapayChannelName = settings.sendavapayChannelName || "SendavaPay";
      // Build virtual gateway channels when enabled in settings
      const virtualChannels: any[] = [];
      if (sendavapayEnabled) {
        virtualChannels.push({
          id: -2,
          name: sendavapayChannelName,
          redirectUrl: "",
          isApi: true,
          isActive: true,
          gateway: "sendavapay",
        });
      }
      if (soleaspayEnabled) {
        virtualChannels.push({
          id: -1,
          name: soleaspayChannelName,
          redirectUrl: "",
          isApi: true,
          isActive: true,
          gateway: "soleaspay",
        });
      }
      const westpayEnabled = settings.westpayEnabled === "true";
      const westpayChannelName = settings.westpayChannelName || "WestPay";
      if (westpayEnabled) {
        virtualChannels.push({
          id: -3,
          name: westpayChannelName,
          redirectUrl: "",
          isApi: true,
          isActive: true,
          gateway: "westpay",
        });
      }
      const inpayEnabled = settings.inpayEnabled === "true";
      const inpayChannelName = settings.inpayChannelName || "InPay";
      if (inpayEnabled) {
        virtualChannels.push({
          id: -4,
          name: inpayChannelName,
          redirectUrl: "",
          isApi: true,
          isActive: true,
          gateway: "inpay",
        });
      }

      // Manual channels created by admin (no gateway auto-processing)
      const manualChannels = channels.map((ch) => ({ ...ch, gateway: null }));

      res.json([...virtualChannels, ...manualChannels]);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Get Soleaspay supported services
  app.get("/api/soleaspay/services", requireAuth, async (req, res) => {
    try {
      const settings = await storage.getSettings();
      const soleaspayEnabled = settings.soleaspayEnabled !== "false";
      const soleaspayCountries = settings.soleaspayCountries ? settings.soleaspayCountries.split(",").filter(Boolean) : [];
      res.json({ 
        enabled: soleaspayEnabled,
        services: SOLEASPAY_SERVICE_MAP,
        enabledCountries: soleaspayCountries,
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Staking Products (public)
  app.get("/api/staking/products", requireAuth, async (req, res) => {
    try {
      const all = await storage.getActiveStakingProducts();
      res.json(all);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/staking/purchase/:id", requireAuth, async (req, res) => {
    try {
      const id = parseInt(getRouteParam(req.params.id));
      const staking = await storage.purchaseStaking(req.session.userId!, id);
      res.json(staking);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.get("/api/staking/my", requireAuth, async (req, res) => {
    try {
      const stakings = await storage.getUserStakings(req.session.userId!);
      res.json(stakings);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Admin Staking
  app.get("/api/admin/staking/products", requireAdmin, async (req, res) => {
    try {
      const all = await storage.getStakingProducts();
      res.json(all);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/admin/staking/products", requireAdmin, async (req, res) => {
    try {
      const { name, description, price, returnAmount, lockDays, launchDate, imageUrl, isActive } = req.body;
      if (!name || !price || !returnAmount || !lockDays) {
        return res.status(400).json({ message: "Champs requis : nom, prix, retour, durée" });
      }
      const sp = await storage.createStakingProduct({
        name, description: description || null,
        price: parseInt(price),
        returnAmount: parseInt(returnAmount),
        lockDays: parseInt(lockDays),
        launchDate: launchDate ? new Date(launchDate) : null,
        imageUrl: imageUrl || null,
        isActive: isActive !== false,
        createdBy: req.session.userId,
      });
      res.json(sp);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.put("/api/admin/staking/products/:id", requireAdmin, async (req, res) => {
    try {
      const id = parseInt(getRouteParam(req.params.id));
      const { name, description, price, returnAmount, lockDays, launchDate, imageUrl, isActive } = req.body;
      const sp = await storage.updateStakingProduct(id, {
        name, description,
        price: price !== undefined ? parseInt(price) : undefined,
        returnAmount: returnAmount !== undefined ? parseInt(returnAmount) : undefined,
        lockDays: lockDays !== undefined ? parseInt(lockDays) : undefined,
        launchDate: launchDate ? new Date(launchDate) : (launchDate === null ? null : undefined),
        imageUrl, isActive,
      });
      res.json(sp);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.delete("/api/admin/staking/products/:id", requireAdmin, async (req, res) => {
    try {
      await storage.deleteStakingProduct(parseInt(getRouteParam(req.params.id)));
      res.json({ success: true });
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.get("/api/admin/staking/stakings", requireAdmin, async (req, res) => {
    try {
      const all = await storage.getAllUserStakings();
      res.json(all);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Payment Numbers (public — filtered by country)
  app.get("/api/payment-numbers", requireAuth, async (req, res) => {
    try {
      const country = typeof req.query.country === "string" ? req.query.country.trim().toUpperCase() : "";
      if (country) {
        const nums = await storage.getPaymentNumbersByCountry(country);
        return res.json(nums);
      }
      const nums = await storage.getPaymentNumbers();
      res.json(nums.filter(n => n.isActive));
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Admin Payment Numbers CRUD
  app.get("/api/admin/payment-numbers", requireAdmin, async (req, res) => {
    try {
      const nums = await storage.getPaymentNumbers();
      res.json(nums);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/admin/payment-numbers/statistics", requireAdmin, async (_req, res) => {
    try {
      res.json(await storage.getAdminPaymentNumberStatistics());
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/admin/payment-numbers", requireAdmin, async (req, res) => {
    try {
      const { ownerName, phone, paymentLink, ussdCode, operatorName, country, logoUrl, isActive } = req.body;
      const normalizedLink = typeof paymentLink === "string" ? paymentLink.trim() : "";
      if (!ownerName || !operatorName || !country || (!phone && !normalizedLink)) {
        return res.status(400).json({ message: "Renseignez un numéro ou un lien de paiement" });
      }
      let normalizedPhone: string | null = null;
      if (!normalizedLink) {
        normalizedPhone = validatePhone(phone, "Numéro");
      } else {
        const parsedUrl = new URL(normalizedLink);
        if (!["http:", "https:"].includes(parsedUrl.protocol)) {
          throw new Error("Le lien de paiement doit commencer par http:// ou https://");
        }
      }
      const num = await storage.createPaymentNumber({
        ownerName: String(ownerName).trim().slice(0, 100),
        phone: normalizedPhone,
        paymentLink: normalizedLink || null,
        ussdCode: typeof ussdCode === "string" ? (ussdCode.trim().slice(0, 120) || null) : null,
        operatorName: String(operatorName).trim().slice(0, 60),
        country: String(country).trim().toUpperCase(),
        logoUrl: logoUrl || null,
        isActive: isActive !== false,
        createdBy: req.session.userId,
      });
      res.json(num);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.put("/api/admin/payment-numbers/:id", requireAdmin, async (req, res) => {
    try {
      const id = parseInt(getRouteParam(req.params.id));
      const { ownerName, phone, paymentLink, ussdCode, operatorName, country, logoUrl, isActive } = req.body;
      const normalizedLink = typeof paymentLink === "string" ? paymentLink.trim() : "";
      let normalizedPhone: string | null | undefined;
      if (normalizedLink) {
        const parsedUrl = new URL(normalizedLink);
        if (!["http:", "https:"].includes(parsedUrl.protocol)) {
          throw new Error("Le lien de paiement doit commencer par http:// ou https://");
        }
        normalizedPhone = null;
      } else if (phone !== undefined) {
        normalizedPhone = phone ? validatePhone(phone, "Numéro") : null;
      }
      const num = await storage.updatePaymentNumber(id, {
        ownerName: ownerName === undefined ? undefined : String(ownerName).trim().slice(0, 100),
        phone: normalizedPhone,
        paymentLink: paymentLink === undefined ? undefined : (normalizedLink || null),
        ussdCode: ussdCode === undefined ? undefined : (typeof ussdCode === "string" ? (ussdCode.trim().slice(0, 120) || null) : null),
        operatorName: operatorName === undefined ? undefined : String(operatorName).trim().slice(0, 60),
        country: country === undefined ? undefined : String(country).trim().toUpperCase(),
        logoUrl, isActive,
      });
      res.json(num);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.delete("/api/admin/payment-numbers/:id", requireAdmin, async (req, res) => {
    try {
      await storage.deletePaymentNumber(parseInt(getRouteParam(req.params.id)));
      res.json({ success: true });
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  // Deposits
  app.post("/api/deposits", requireAuth, async (req, res) => {
    if (consumeUserLimit(req, res, "deposit-create", 10, AUTH_ENDPOINT_WINDOW_MS)) return;
    try {
      const { amount, accountName, accountNumber, paymentMethod, country, paymentChannelId, useSoleaspay, useWestpay, usePpaypros, useInpay, inpayPhone, otpCode,
        paymentNumberId, channelName, screenshot, paymentMessage, reference, paymentSource } = req.body;
      const user = await storage.getUser(req.session.userId!);
      
      if (!user) {
        return res.status(401).json({ message: "Non authentifie" });
      }

      const settings = await storage.getSettings();
      const minDeposit = parseInt(settings.minDeposit || "3500");
       const requestedAmount = typeof amount === "number" ? amount : Number(amount);
       if (!Number.isFinite(requestedAmount) || requestedAmount <= 0) {
        return res.status(400).json({ message: "Montant invalide" });
       }
       if (requestedAmount < minDeposit) {
        return res.status(400).json({ message: `Montant minimum: ${minDeposit.toLocaleString()} FCFA` });
      }
       if (
         useInpay === true &&
         (!Number.isInteger(requestedAmount) || requestedAmount % 5 !== 0)
       ) {
         return res.status(400).json({
           message: "Le montant InPay doit être un nombre entier multiple de 5 (ex. 300, 305 ou 310 FCFA)",
           inpay: true,
         });
       }

       const parsedDeposit = depositSchema.safeParse({
          amount: requestedAmount,
         accountName, accountNumber, paymentMethod, country,
         paymentChannelId: paymentChannelId === undefined ? undefined : Number(paymentChannelId),
       });
       if (!parsedDeposit.success) {
         return res.status(400).json({ message: parsedDeposit.error.issues[0]?.message || "Données invalides" });
       }
        if (reference !== undefined && reference !== null && typeof reference !== "string") {
          return res.status(400).json({ message: "Référence de paiement invalide" });
        }
        if (paymentMessage !== undefined && paymentMessage !== null && typeof paymentMessage !== "string") {
          return res.status(400).json({ message: "Message de paiement invalide" });
        }
        const normalizedReference = typeof reference === "string" ? reference.trim() : "";
        const normalizedPaymentMessage = typeof paymentMessage === "string" ? paymentMessage.trim() : "";
        if (normalizedReference.length > 120 || normalizedPaymentMessage.length > 2000) {
          return res.status(400).json({ message: "La référence est limitée à 120 caractères et le message à 2 000 caractères." });
        }
       if (screenshot !== undefined && screenshot !== null) {
         if (
           typeof screenshot !== "string" ||
           screenshot.length > 7_000_000 ||
           !/^data:image\/(?:jpeg|png|webp|gif);base64,[A-Za-z0-9+/=]+$/.test(screenshot)
         ) {
           return res.status(400).json({ message: "Capture invalide ou trop volumineuse (7 Mo maximum)" });
         }
       }
       const normalizedDeposit = parsedDeposit.data;
       const hasManualPaymentNumber = paymentNumberId !== undefined && paymentNumberId !== null;
       let selectedPaymentNumber: Awaited<ReturnType<typeof storage.getPaymentNumber>> | undefined;
        let manualPaymentCurrency = "XOF";
        let manualPaymentCountryLabel = normalizedDeposit.country;
       if (hasManualPaymentNumber) {
         const parsedPaymentNumberId = Number(paymentNumberId);
         if (!Number.isInteger(parsedPaymentNumberId) || parsedPaymentNumberId <= 0) {
           return res.status(400).json({ message: "Numéro de paiement invalide" });
         }
         selectedPaymentNumber = await storage.getPaymentNumber(parsedPaymentNumberId);
         if (
           !selectedPaymentNumber ||
           !selectedPaymentNumber.isActive ||
           selectedPaymentNumber.country.toUpperCase() !== normalizedDeposit.country.toUpperCase()
         ) {
           return res.status(400).json({ message: "Ce numéro de paiement n'est plus disponible pour ce pays" });
         }
          const proofValidation = validateManualDepositProof(
            paymentSource,
            normalizedReference,
            normalizedPaymentMessage,
            screenshot,
          );
          if (!proofValidation.valid) {
            return res.status(400).json({ message: proofValidation.message });
         }
          if (!isTelegramConfigured()) {
            return res.status(503).json({
              message: "Les notifications Telegram de l’administration ne sont pas configurées. Aucun dépôt n’a été créé.",
            });
          }
          const configuredCountry = (await storage.getCountries()).find(
            (item) => item.code.toUpperCase() === normalizedDeposit.country.toUpperCase(),
          );
          manualPaymentCurrency = configuredCountry?.currency || "XOF";
          manualPaymentCountryLabel = configuredCountry
            ? `${configuredCountry.name} (${configuredCountry.code})`
            : normalizedDeposit.country;
       }

      const soleaspayEnabled = settings.soleaspayEnabled !== "false";
      const soleaspayCountries = settings.soleaspayCountries ? settings.soleaspayCountries.split(",").filter(Boolean) : [];
      const orderId = `JOLLIBEE-${Date.now()}-${user.id}`;
      
      // Only use Soleaspay when user explicitly chose the Soleaspay channel (Westpay)
      if (useSoleaspay && soleaspayEnabled) {
         if (!isSoleaspaySupported(normalizedDeposit.country, normalizedDeposit.paymentMethod)) {
          return res.status(400).json({
            message: `L'opérateur "${normalizedDeposit.paymentMethod}" n'est pas supporté par ce canal pour le pays "${normalizedDeposit.country}". Veuillez choisir un autre canal.`,
            soleaspay: true,
          });
        }
        try {
          const paymentResult = await initiatePayment(
            normalizedDeposit.accountNumber,
            normalizedDeposit.amount,
            normalizedDeposit.country,
            normalizedDeposit.paymentMethod,
            orderId,
            normalizedDeposit.accountName,
            `user${user.id}@intel.com`
          );

          if (paymentResult.success && paymentResult.data) {
            const deposit = await storage.createDeposit({
              userId: req.session.userId!,
             amount: normalizedDeposit.amount,
             accountName: normalizedDeposit.accountName,
             accountNumber: normalizedDeposit.accountNumber,
             country: normalizedDeposit.country,
             paymentMethod: normalizedDeposit.paymentMethod,
               paymentChannelId: normalizedDeposit.paymentChannelId && normalizedDeposit.paymentChannelId > 0 ? normalizedDeposit.paymentChannelId : null,
              status: "processing",
              soleaspayReference: paymentResult.data.reference,
              soleaspayOrderId: orderId,
            });

            return res.json({ 
              deposit,
              soleaspay: true,
              reference: paymentResult.data.reference,
              status: paymentResult.status,
              message: paymentResult.message
            });
          } else {
            return res.status(400).json({ 
              message: paymentResult.message || "Erreur Soleaspay",
              soleaspay: true
            });
          }
        } catch (soleaspayError: any) {
          console.error("[soleaspay] Payment error:", soleaspayError);
          return res.status(400).json({ 
            message: soleaspayError.message || "Erreur de paiement Soleaspay",
            soleaspay: true
          });
        }
      }

      // ── WestPay: redirect-based hosted-payment flow ─────────────────────────
      const westpayEnabledDeposit = settings.westpayEnabled === "true";
      if (useWestpay && westpayEnabledDeposit) {
        try {
          if (!process.env.WESTPAY_MERCHANT_SLUG) {
            return res.status(400).json({ message: "WestPay non configuré : la variable WESTPAY_MERCHANT_SLUG doit être définie sur le serveur", westpay: true });
          }
          const baseUrl = getPublicBaseUrl(req);
          // Create deposit to get an ID, then build the redirect URL
          const deposit = await storage.createDeposit({
            userId: req.session.userId!,
            amount: normalizedDeposit.amount,
            accountName: normalizedDeposit.accountName || user.fullName,
            accountNumber: normalizedDeposit.accountNumber || user.phone,
            country: normalizedDeposit.country,
            paymentMethod: "WestPay",
            paymentChannelId: normalizedDeposit.paymentChannelId && normalizedDeposit.paymentChannelId > 0 ? normalizedDeposit.paymentChannelId : null,
             status: "pending",
          });
          const returnState = createWestPayReturnState(deposit.id);
          const callbackUrl = `${baseUrl}/api/westpay/callback?state=${encodeURIComponent(returnState)}`;
          const westpayUrl = westpayBuildUrl({
            amount: normalizedDeposit.amount,
            countryCode: normalizedDeposit.country,
            redirectUrl: callbackUrl,
          });
          return res.json({ deposit, westpayUrl, westpay: true });
        } catch (westpayError: any) {
          console.error("[westpay] deposit error:", westpayError);
          return res.status(400).json({ message: westpayError.message || "Erreur WestPay", westpay: true });
        }
      }

      // ── PPayPros: country-specific hosted checkout ──────────────────────────
      if (usePpaypros === true) {
        const countryCode = normalizedDeposit.country.trim().toUpperCase();
        if (!isPpayProsEnabled("Payin", countryCode, settings)) {
          return res.status(403).json({ message: `Le dépôt PPayPros est désactivé pour ${countryCode}.`, ppaypros: true });
        }
        const wayCode = getPpayProsWayCode(countryCode, settings);
        if (!wayCode) {
          return res.status(400).json({
            message: `Le code opérateur PPayPros n'est pas configuré pour ${countryCode}.`,
            ppaypros: true,
          });
        }
        const accountCountry = user.country.trim().toUpperCase();
        const registrationMessage = getPpayProsCountryRegistrationMessage(countryCode);
        if (registrationMessage && accountCountry !== countryCode) {
          return res.status(400).json({
            message: registrationMessage,
            ppaypros: true,
            countryRegistrationRequired: true,
          });
        }
        let ppayProsDepositId: number | null = null;
        try {
          getPpayProsCredentials(countryCode);
          const customerPhone = formatPpayProsPhone(accountCountry, user.phone);
          const deposit = await storage.createDeposit({
            userId: user.id,
            amount: normalizedDeposit.amount,
            accountName: normalizedDeposit.accountName || user.fullName,
            accountNumber: customerPhone,
            country: countryCode,
            paymentMethod: "PPayPros",
            paymentChannelId: normalizedDeposit.paymentChannelId && normalizedDeposit.paymentChannelId > 0
              ? normalizedDeposit.paymentChannelId
              : null,
            status: "pending",
          });
          ppayProsDepositId = deposit.id;
          const merchantOrderNo = createPpayProsMerchantOrderNo("payin", deposit.id);
          await storage.updateDeposit(deposit.id, { omnipayReference: merchantOrderNo });
          const baseUrl = getPublicBaseUrl(req);
          const payment = await createPpayProsPayin({
            country: countryCode,
            wayCode,
            merchantOrderNo,
            amountXof: normalizedDeposit.amount,
            customerName: normalizedDeposit.accountName || user.fullName,
            customerPhone,
            customerPhoneCountry: accountCountry,
            customerEmail: `user${user.id}@tonnew.app`,
            notifyUrl: `${baseUrl}/api/webhooks/ppaypros/payin`,
            returnUrl: `${baseUrl}/api/ppaypros/return?depositId=${deposit.id}`,
          });
          if (payment.mchOrderNo && String(payment.mchOrderNo) !== merchantOrderNo) {
            await storage.rejectDeposit(deposit.id);
            return res.status(502).json({
              message: "PPayPros a renvoyé une référence de dépôt différente.",
              ppaypros: true,
            });
          }
          const payData = typeof payment.payData === "string" ? payment.payData : "";
          if (payment.payDataType !== "payUrl" || !payData) {
            await storage.rejectDeposit(deposit.id);
            return res.status(502).json({
              message: "PPayPros n'a pas renvoyé de lien de paiement pour ce dépôt.",
              ppaypros: true,
            });
          }
          let checkoutUrl: URL;
          try {
            checkoutUrl = new URL(payData);
          } catch {
            await storage.rejectDeposit(deposit.id);
            return res.status(502).json({ message: "PPayPros a renvoyé un lien de paiement invalide.", ppaypros: true });
          }
          if (checkoutUrl.protocol !== "https:") {
            await storage.rejectDeposit(deposit.id);
            return res.status(502).json({ message: "PPayPros a renvoyé un lien non sécurisé.", ppaypros: true });
          }
          await storage.updateDeposit(deposit.id, {
            omnipayId: payment.payOrderId ? String(payment.payOrderId) : null,
          });
          return res.json({ deposit, ppayprosUrl: checkoutUrl.toString(), ppaypros: true });
        } catch (ppayProsError: any) {
          if (ppayProsError instanceof PpayProsApiError && ppayProsError.providerRejected) {
            // A provider-declared rejection is definitive; transport errors remain pending
            // so a late notification can still be reconciled safely.
            if (ppayProsDepositId !== null) {
              await storage.rejectDeposit(ppayProsDepositId);
            }
          }
          console.error("[ppaypros] payin error:", ppayProsError.message);
          return res.status(400).json({
            message: ppayProsError.message || "Erreur PPayPros",
            ppaypros: true,
          });
        }
      }

      // ── InPay: redirect-based hosted-payment flow ───────────────────────────
      const inpayEnabledDeposit = settings.inpayEnabled === "true";
      if (useInpay && inpayEnabledDeposit) {
        const normalizedCountry = normalizedDeposit.country.trim().toUpperCase();
        if (!isInpayCountryEnabled(normalizedCountry, settings)) {
          return res.status(400).json({ message: "InPay n'est pas activé pour ce pays", inpay: true });
        }
        if (!isInpayConfigured(normalizedCountry, settings)) {
          return res.status(400).json({
            message: `InPay n'est pas configuré pour ${normalizedCountry} : URL API, merchant ID ou clé API manquant`,
            inpay: true,
          });
        }
        const inpayPhoneValue = typeof inpayPhone === "string" && inpayPhone.trim()
          ? inpayPhone.trim()
          : normalizedDeposit.accountNumber || user.phone;
        const parsedInpayPhone = phoneNumberSchema.safeParse(inpayPhoneValue);
        if (!parsedInpayPhone.success) {
          return res.status(400).json({
            message: "Le numéro du compte est invalide",
            inpay: true,
          });
        }
        const inpayCustomerMobile = parsedInpayPhone.data;

        const inpayDeposit = await storage.createDeposit({
          userId: req.session.userId!,
          amount: normalizedDeposit.amount,
          accountName: normalizedDeposit.accountName || user.fullName,
          accountNumber: inpayCustomerMobile,
          country: normalizedCountry,
          paymentMethod: "InPay",
          paymentChannelId: normalizedDeposit.paymentChannelId && normalizedDeposit.paymentChannelId > 0 ? normalizedDeposit.paymentChannelId : null,
           status: "processing",
        });
        const outTradeNo = inpayCreateOutTradeNo("PAYIN", inpayDeposit.id, user.id);
        const account = getInpayAccount(normalizedCountry, settings);
        try {
          const result = await inpayCreatePayin({
            amount: normalizedDeposit.amount,
            country: normalizedCountry,
            merchantId: account.merchantId,
            apiKey: account.apiKey,
            customerName: normalizedDeposit.accountName || user.fullName,
            customerMobile: inpayCustomerMobile,
            customerEmail: `user${user.id}@tonnew.app`,
            notificationUrl: `${getPublicBaseUrl(req)}/api/webhooks/inpay`,
            outTradeNo,
          });
          const deposit = await storage.setDepositNonterminalStatus(inpayDeposit.id, "processing", {
            inpayOutTradeNo: outTradeNo,
            inpayOrderNumber: result.orderNumber,
          });
          if (!deposit) throw new Error("Le dépôt InPay a déjà été traité.");
          return res.json({ deposit, inpayUrl: result.url, inpay: true });
        } catch (inpayError: any) {
          await storage.rejectDeposit(inpayDeposit.id);
          console.error("[inpay] payin error:", inpayError);
          return res.status(400).json({ message: inpayError.message || "Erreur InPay", inpay: true });
        }
      }

      const deposit = await storage.createDeposit({
        userId: req.session.userId!,
         amount: normalizedDeposit.amount,
         accountName: normalizedDeposit.accountName,
         accountNumber: normalizedDeposit.accountNumber,
         country: normalizedDeposit.country,
         paymentMethod: selectedPaymentNumber?.operatorName || normalizedDeposit.paymentMethod,
         paymentChannelId: normalizedDeposit.paymentChannelId && normalizedDeposit.paymentChannelId > 0 ? normalizedDeposit.paymentChannelId : null,
         paymentNumberId: selectedPaymentNumber?.id || null,
         channelName: selectedPaymentNumber
           ? `${selectedPaymentNumber.operatorName} - ${selectedPaymentNumber.paymentLink ? "Lien de paiement" : selectedPaymentNumber.phone}`
           : channelName || null,
        screenshot: screenshot || null,
         paymentMessage: normalizedPaymentMessage || null,
         reference: normalizedReference || null,
         status: "pending",
      });

       let telegramNotificationSent: boolean | undefined;
       if (selectedPaymentNumber) {
         const paymentDestination = selectedPaymentNumber.paymentLink || selectedPaymentNumber.phone || "";
         try {
           await sendTelegramMessage(buildManualDepositNotification({
             depositId: deposit.id,
             userId: user.id,
             userName: user.fullName,
             userPhone: user.phone,
             payerPhone: normalizedDeposit.accountNumber,
             amount: normalizedDeposit.amount,
             currency: manualPaymentCurrency,
             country: manualPaymentCountryLabel,
             operator: selectedPaymentNumber.operatorName,
             paymentType: selectedPaymentNumber.paymentLink ? "lien" : "numéro",
             paymentDestination,
             recipientName: selectedPaymentNumber.ownerName,
             paymentNumberId: selectedPaymentNumber.id,
             reference: normalizedReference || null,
             paymentMessage: normalizedPaymentMessage || null,
             createdAt: deposit.createdAt,
           }));
           telegramNotificationSent = true;
         } catch (notificationError: any) {
           telegramNotificationSent = false;
           console.error("[telegram] manual deposit notification failed:", notificationError.message);
         }
       }

       res.json({
         deposit,
         soleaspay: false,
         ...(selectedPaymentNumber ? { telegramNotificationSent } : {}),
       });
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  // Verify payment status (Soleaspay)
  app.get("/api/deposits/:id/verify", requireAuth, async (req, res) => {
    try {
      const depositId = parseInt(getRouteParam(req.params.id));
      const deposit = await storage.getDeposit(depositId);
      
      if (!deposit) {
        return res.status(404).json({ message: "Depot non trouve" });
      }

      if (deposit.userId !== req.session.userId) {
        return res.status(403).json({ message: "Acces refuse" });
      }

      if (deposit.status === "approved") {
        return res.json({ status: deposit.status });
      }

      if (deposit.soleaspayReference && deposit.soleaspayOrderId) {
        try {
          const verifyResult = await verifyPayment(deposit.soleaspayOrderId, deposit.soleaspayReference);
          const newStatus = mapSoleaspayStatus(verifyResult.status);

          if (newStatus !== "pending" && newStatus !== deposit.status) {
            if (newStatus === "approved") {
              await creditApprovedDeposit(deposit, undefined, `Dépôt #${deposit.id} approuvé`);
            } else if (newStatus === "rejected") {
              await storage.rejectDeposit(deposit.id);
            } else {
              await storage.setDepositNonterminalStatus(deposit.id, newStatus);
            }
          }

          return res.json({ 
            status: newStatus,
            soleaspay: true,
            soleaspayStatus: verifyResult.status,
            message: verifyResult.message
          });
        } catch (verifyError: any) {
          console.error("[soleaspay] Verify error:", verifyError);
          return res.json({ 
            status: deposit.status,
            soleaspay: true,
            error: "Erreur de verification"
          });
        }
      }

      return res.json({ status: deposit.status });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post(
    "/api/support/deposit-not-received",
    requireAuth,
    parseDepositSupportReportFiles,
    async (req, res) => {
      try {
        if (!isTelegramConfigured()) {
          return res.status(503).json({
            message: "Le bot ou le groupe administrateur n’est pas configuré sur le serveur.",
          });
        }

        const userId = req.session.userId!;
        const user = await storage.getUser(userId);
        if (!user) return res.status(404).json({ message: "Compte utilisateur introuvable." });

        const depositId = Number(req.body?.depositId);
        const payerName = String(req.body?.payerName || "").trim();
        const description = String(req.body?.description || "").trim();
        if (!Number.isSafeInteger(depositId) || depositId <= 0) {
          return res.status(400).json({ message: "Sélectionnez un ordre de dépôt valide." });
        }
        if (payerName.length < 2 || payerName.length > 80) {
          return res.status(400).json({ message: "Le nom du payeur doit contenir entre 2 et 80 caractères." });
        }
        if (description.length < 8 || description.length > 500) {
          return res.status(400).json({ message: "La description doit contenir entre 8 et 500 caractères." });
        }

        const deposits = await storage.getUserDeposits(userId);
        const deposit = deposits.find((item) => item.id === depositId);
        if (!deposit) {
          return res.status(404).json({ message: "Cet ordre de dépôt n’appartient pas à votre compte." });
        }

        const files = Array.isArray(req.files) ? req.files : [];
        const photos: Array<{ buffer: Buffer; mimetype: string }> = [];
        for (const file of files) {
          try {
            const metadata = await sharp(file.buffer, { limitInputPixels: 16_000_000 }).metadata();
            if (!["jpeg", "png", "webp"].includes(metadata.format || "")) {
              return res.status(400).json({ message: "Utilisez uniquement des images JPEG, PNG ou WebP." });
            }
            photos.push({ buffer: file.buffer, mimetype: `image/${metadata.format}` });
          } catch {
            return res.status(400).json({ message: "Une image jointe est illisible ou endommagée." });
          }
        }

        const attachmentsDelivered = await sendTelegramDepositSupportReport(
          {
            userId: user.id,
            referralCode: user.referralCode,
            userName: user.fullName,
            userPhone: user.phone,
            deposit: {
              id: deposit.id,
              amount: deposit.amount,
              status: deposit.status,
              paymentMethod: deposit.paymentMethod,
              channelName: deposit.channelName,
              country: deposit.country,
              reference: deposit.reference,
              createdAt: deposit.createdAt,
            },
            payerName,
            description,
          },
          photos,
        );

        return res.json({
          ok: true,
          message: attachmentsDelivered
            ? "Votre demande a été envoyée à l’équipe de vérification."
            : "Votre demande a été envoyée, mais les images n’ont pas pu être transmises. Contactez le service client.",
          attachmentsDelivered,
        });
      } catch (error) {
        console.error("[support] deposit-not-received report failed:", error);
        return res.status(502).json({
          message: error instanceof Error
            ? "Le bot n’a pas pu transmettre votre demande. Réessayez plus tard ou contactez le service client."
            : "Le signalement n’a pas pu être transmis.",
        });
      }
    },
  );

  app.get("/api/deposits/history", requireAuth, async (req, res) => {
    try {
      const deposits = await storage.getUserDeposits(req.session.userId!);
      res.json(deposits);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/drimpay/operators/:country", requireAuth, async (req, res) => {
    try {
      const country = getRouteParam(req.params.country).trim().toUpperCase();
      if (!isDrimPayConfigured() || !isDrimPayWebhookConfigured()) {
        return res.status(503).json({ message: "DrimPay n'est pas configuré sur le serveur" });
      }
      const settings = await storage.getSettings();
      if (!isDrimPayCountryEnabled(settings, "Payin", country)) {
        return res.status(403).json({ message: "DrimPay n'est pas activé pour ce pays" });
      }
      const countryRecord = (await storage.getActiveCountries()).find(
        (item) => item.code.toUpperCase() === country,
      );
      if (!countryRecord) return res.status(404).json({ message: "Pays indisponible" });

      const operators = drimPayOperatorsForCountry(
        country,
        parseDrimPayOperators(countryRecord.operators),
      ).map((operator) => ({ ...operator, provider: "drimpay" as const }));
      res.json({ country, operators });
    } catch (error: any) {
      res.status(500).json({ message: error.message || "Impossible de charger les opérateurs DrimPay" });
    }
  });

  app.post("/api/drimpay/payin", requireAuth, async (req, res) => {
    let depositId: number | undefined;
    try {
      const user = await storage.getUser(req.session.userId!);
      if (!user) return res.status(401).json({ message: "Non authentifié" });
      if (!isDrimPayConfigured() || !isDrimPayWebhookConfigured()) {
        return res.status(503).json({ message: "DrimPay n'est pas configuré sur le serveur" });
      }

      const settings = await storage.getSettings();
      const country = String(req.body?.country || "").trim().toUpperCase();
      if (!isDrimPayCountryEnabled(settings, "Payin", country)) {
        return res.status(403).json({ message: "Les dépôts DrimPay ne sont pas activés pour ce pays" });
      }

      const countryRecord = (await storage.getActiveCountries()).find(
        (item) => item.code.toUpperCase() === country,
      );
      if (!countryRecord) return res.status(400).json({ message: "Pays indisponible" });
      const configuredOperators = parseDrimPayOperators(countryRecord.operators);
      const operators = drimPayOperatorsForCountry(country, configuredOperators);
      const requestedOperator = String(req.body?.operator || req.body?.operatorName || "").trim();
      const operatorSlug = getDrimPayOperatorSlug(country, requestedOperator);
      const operator = operators.find((item) => item.id === operatorSlug);
      if (!operator) return res.status(400).json({ message: "Opérateur non disponible pour DrimPay dans ce pays" });

      const amount = Number(req.body?.amount);
      const minDeposit = Number.parseInt(settings.minDeposit || "3500", 10);
      if (!Number.isSafeInteger(amount) || amount <= 0) {
        return res.status(400).json({ message: "Montant invalide" });
      }
      if (amount < minDeposit) {
        return res.status(400).json({ message: `Montant minimum: ${minDeposit.toLocaleString()} FCFA` });
      }
      const phone = normalizeDrimPayPhone(String(req.body?.phone || ""), countryRecord.phonePrefix);
      const baseUrl = getPaymentWebhookBaseUrl(req);
      if (!baseUrl.startsWith("https://")) {
        return res.status(400).json({ message: "DrimPay exige une URL webhook publique en HTTPS" });
      }

      const deposit = await storage.createDeposit({
        userId: user.id,
        amount,
        accountName: user.fullName,
        accountNumber: phone,
        country,
        paymentMethod: operator.name,
        status: "processing",
      });
      depositId = deposit.id;
      const orderId = createDrimPayReference("PAYIN", deposit.id);
      await storage.updateDeposit(deposit.id, { drimpayOrderId: orderId });

      const initiated = unwrapDrimPayResponse(await drimPayInitiatePayin({
        amount,
        currency: countryRecord.currency,
        country_code: country,
        operator: operator.id,
        phone,
        order_id: orderId,
        webhook_url: `${baseUrl}/api/webhooks/drimpay`,
        description: `Dépôt RobotPay #${deposit.id}`,
        expires_in_minutes: 5,
      }));
      const reference = typeof initiated.reference === "string" ? initiated.reference.trim() : "";
      if (!reference) {
        throw new Error("DrimPay n'a pas retourné de référence de transaction.");
      }
      await storage.updateDeposit(deposit.id, { drimpayReference: reference });
      const updated = await reconcileDrimPayDeposit(
        { ...deposit, drimpayOrderId: orderId, drimpayReference: reference },
        initiated,
      );
      const paymentUrl = getDrimPayWavePaymentUrl(country, operator.id, initiated.payment_url);
      const paymentLinkUnavailable = operator.id === "wave" && !paymentUrl;
      return res.status(202).json({
        depositId: deposit.id,
        reference,
        status: updated.status,
        paymentUrl: paymentUrl || null,
        paymentLinkUnavailable,
        message: paymentLinkUnavailable
          ? "Votre paiement est en cours de traitement. Veuillez patienter."
          : "",
      });
    } catch (error: any) {
      if (depositId && error instanceof DrimPayApiError && error.status >= 400 && error.status < 500) {
        await storage.rejectDeposit(depositId).catch(() => undefined);
      }
      console.error("[drimpay] payin error:", error?.message || error);
      return res.status(error instanceof DrimPayApiError && error.status >= 400 && error.status < 500 ? 400 : 502)
        .json({ message: error.message || "Erreur DrimPay" });
    }
  });

  app.get("/api/deposits/:id/drimpay-status", requireAuth, async (req, res) => {
    try {
      const deposit = await storage.getDeposit(Number.parseInt(getRouteParam(req.params.id), 10));
      if (!deposit || !deposit.drimpayOrderId) {
        return res.status(404).json({ message: "Dépôt DrimPay introuvable" });
      }
      if (deposit.userId !== req.session.userId) return res.status(403).json({ message: "Accès refusé" });
      return res.json({ status: deposit.status });
    } catch (error: any) {
      console.error("[drimpay] payin status error:", error?.message || error);
      return res.status(502).json({ message: error.message || "Impossible de vérifier le dépôt DrimPay" });
    }
  });

  // ── AshtechPay Direct API ───────────────────────────────────────────────────
  app.get("/api/ashtechpay/countries", requireAuth, async (_req, res) => {
    try {
      if (!isAshtechConfigured()) {
        return res.status(503).json({ message: "AshtechPay non configuré" });
      }
      res.json(filterAshtechCountryOperators(await ashtechGetCountries()));
    } catch (error: any) {
      console.error("[ashtechpay] countries error:", error);
      res.status(502).json({ message: error.message || "Impossible de charger les pays AshtechPay" });
    }
  });

  app.post("/api/ashtechpay/collect", requireAuth, async (req, res) => {
    try {
      const { amount, country, operator, phone, otp, depositId, reference: requestedReference } = req.body;
      const user = await storage.getUser(req.session.userId!);
      if (!user) return res.status(401).json({ message: "Non authentifié" });

      const settings = await storage.getSettings();
      if (settings.ashtechEnabled !== "true") {
        return res.status(400).json({ message: "AshtechPay non activé" });
      }
      const numericAmount = Number(amount);
      const minDeposit = parseInt(settings.minDeposit || "3000");
      if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
        return res.status(400).json({ message: "Montant invalide" });
      }
      const existingDeposit = depositId ? await storage.getDeposit(Number(depositId)) : undefined;
      if (existingDeposit && existingDeposit.userId !== user.id) {
        return res.status(403).json({ message: "Accès refusé" });
      }
      if (existingDeposit?.status === "approved") {
        return res.status(409).json({ message: "Ce dépôt est déjà confirmé" });
      }
      if (existingDeposit?.status === "rejected") {
        return res.status(409).json({ message: "Ce dépôt a déjà été refusé" });
      }
      if (numericAmount < minDeposit) {
        return res.status(400).json({ message: `Montant minimum: ${minDeposit.toLocaleString()} FCFA` });
      }
      if (!country || !operator || !phone) {
        return res.status(400).json({ message: "Pays, opérateur et numéro requis" });
      }

      const ashtechCountries = await ashtechGetCountries();
      const countryCode = String(country).trim().toUpperCase();
      const catalogCountry = ashtechCountries.find(
        (entry) => entry.code.toUpperCase() === countryCode,
      );
      if (!catalogCountry) {
        return res.status(400).json({ message: "Pays non pris en charge par AshtechPay" });
      }

      const requestedOperator = String(operator).trim();
      const operatorIsActive = isAshtechOperatorActive(catalogCountry, requestedOperator);
      if (!operatorIsActive) {
        return res.status(400).json({ message: "Opérateur non disponible pour ce pays" });
      }

      const generatedReference = `paget-studio-${Date.now()}-${user.id}`;
      const requestedAshtechReference = typeof requestedReference === "string"
        ? requestedReference.trim()
        : "";
      // AshtechPay requires the exact reference returned by an
      // `otp_required` response on the retry request. Preserve the reference
      // already stored on a deposit before generating a new one.
      const reference = existingDeposit?.ashtechReference?.trim()
        || requestedAshtechReference
        || generatedReference;
      const notifyBaseUrl = getPaymentWebhookBaseUrl(req);
      if (!/^https:\/\//i.test(notifyBaseUrl)) {
        return res.status(400).json({
          message: "AshtechPay exige une URL webhook publique en HTTPS",
        });
      }
      const result = await ashtechCollect({
        amount: numericAmount,
        currency: catalogCountry.currency,
        phone: String(phone).trim(),
        operator: requestedOperator,
        countryCode,
        reference,
        notifyUrl: `${notifyBaseUrl}/api/webhooks/ashtechpay`,
        ...(otp ? { otp: String(otp).trim() } : {}),
      });
      if (!ashtechTransactionMatches(result, {
        amount: numericAmount,
        countryCode,
        reference,
      })) {
        throw new Error("La réponse AshtechPay ne correspond pas à la demande de dépôt.");
      }

      const mappedStatus = mapAshtechStatus(result.status);
      let deposit;
      if (existingDeposit) {
        if (mappedStatus === "rejected") {
          await storage.rejectDeposit(existingDeposit.id);
          deposit = await storage.getDeposit(existingDeposit.id);
        } else {
          deposit = await storage.setDepositNonterminalStatus(
            existingDeposit.id,
            mappedStatus === "approved" ? "processing" : mappedStatus,
            {
              ashtechTransactionId: result.transaction_id || existingDeposit.ashtechTransactionId,
              ashtechReference: reference,
            },
          );
        }
        if (!deposit) throw new Error("Ce dépôt AshtechPay a déjà été traité.");
      } else {
        deposit = await storage.createDeposit({
            userId: user.id,
            amount: numericAmount,
            accountName: user.fullName,
            accountNumber: String(phone).trim(),
            country: String(country).trim().toUpperCase(),
            paymentMethod: String(operator).trim(),
            status: mappedStatus === "approved" ? "processing" : mappedStatus,
            ashtechTransactionId: result.transaction_id,
            ashtechReference: reference,
          });
      }

      if (mappedStatus === "approved") {
        await creditApprovedDeposit(deposit);
      }

      res.status(202).json({
        depositId: deposit.id,
        transactionId: result.transaction_id,
        reference,
        status: mappedStatus,
        requiresOtp: Boolean(result.ussd_code || result.message?.toLowerCase().includes("otp")),
        ussdCode: result.ussd_code || null,
        waveUrl: result.wave_url || null,
        flow: result.flow || null,
        message: result.message || null,
      });
    } catch (error: any) {
      if (error instanceof AshtechApiError && error.status === 400 && error.data?.error === "otp_required") {
        const {
          amount: requestedAmount,
          country: requestCountry,
          operator: requestOperator,
          phone: requestPhone,
           depositId: requestDepositId,
        } = req.body;
        const otpUser = await storage.getUser(req.session.userId!);
        if (!otpUser) return res.status(401).json({ message: "Non authentifié" });
        const otpAmount = Number(requestedAmount);
        const otpExistingDeposit = requestDepositId
          ? await storage.getDeposit(Number(requestDepositId))
          : undefined;
        if (otpExistingDeposit && otpExistingDeposit.userId !== otpUser.id) {
          return res.status(403).json({ message: "Accès refusé" });
        }
        const otpReference = String(error.data.reference || "").trim();
        if (!otpReference) {
          return res.status(400).json({ message: error.message || "Référence OTP AshtechPay manquante" });
        }

        const otpUssdCode = typeof error.data.ussd_code === "string"
          ? error.data.ussd_code
          : null;
        const otpDeposit = otpExistingDeposit
          ? await storage.setDepositNonterminalStatus(
              otpExistingDeposit.id,
              "pending",
              { ashtechReference: otpReference },
            )
          : await storage.createDeposit({
              userId: otpUser.id,
              amount: otpAmount,
              accountName: otpUser.fullName,
              accountNumber: String(requestPhone).trim(),
              country: String(requestCountry).trim().toUpperCase(),
              paymentMethod: String(requestOperator).trim(),
              status: "pending",
              ashtechReference: otpReference,
            });
        if (!otpDeposit) {
          return res.status(409).json({ message: "Ce dépôt AshtechPay a déjà été traité." });
        }

        return res.status(400).json({
          error: "otp_required",
          message: error.message,
          depositId: otpDeposit.id,
          reference: otpReference,
          requiresOtp: true,
          ussdCode: otpUssdCode,
        });
      }
      const message = error.message || "Erreur AshtechPay";
      console.error("[ashtechpay] collect error:", message);
      res.status(400).json({ message });
    }
  });

  app.get("/api/deposits/:id/ashtechpay-status", requireAuth, async (req, res) => {
    try {
      const deposit = await storage.getDeposit(parseInt(getRouteParam(req.params.id)));
      if (!deposit) return res.status(404).json({ message: "Dépôt non trouvé" });
      if (deposit.userId !== req.session.userId) return res.status(403).json({ message: "Accès refusé" });
      if (deposit.status === "approved") {
        return res.json({ status: deposit.status });
      }
      if (!deposit.ashtechTransactionId) return res.json({ status: deposit.status });

      const result = await ashtechGetTransaction(deposit.ashtechTransactionId);
      if (!ashtechTransactionMatches(result, {
        amount: Number(deposit.amount),
        countryCode: deposit.country,
        reference: deposit.ashtechReference,
        transactionId: deposit.ashtechTransactionId,
      })) {
        return res.status(502).json({ message: "La transaction AshtechPay ne correspond pas à ce dépôt." });
      }
      const newStatus = mapAshtechStatus(result.status);
      if (newStatus !== "pending" && newStatus !== deposit.status) {
        if (newStatus === "approved") {
          await creditApprovedDeposit(deposit, undefined, `Dépôt #${deposit.id} approuvé`);
        } else if (newStatus === "rejected") {
          await storage.rejectDeposit(deposit.id);
        } else {
          await storage.setDepositNonterminalStatus(deposit.id, newStatus);
        }
      }
      const finalDeposit = await storage.getDeposit(deposit.id);
      res.json({ status: finalDeposit?.status || newStatus, rawStatus: result.status });
    } catch (error: any) {
      console.error("[ashtechpay] status error:", error);
      res.status(502).json({ message: error.message || "Erreur de vérification AshtechPay" });
    }
  });

  // ── SendavaPay routes ──────────────────────────────────────────────────────

  // Proxy: operators for a given country (public SendavaPay endpoint)
  app.get("/api/sendavapay/operators/:country", requireAuth, async (req, res) => {
    try {
      const svCountry = toSendavapayCountry(getRouteParam(req.params.country));
      const r = await fetch(
        `https://sendavapay.com/api/sdk/v1/operators/${svCountry}`
      );
      const data = await r.json();
      res.json(data);
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  // Create payment (server-side, stores deposit record)
  app.post("/api/sendavapay/create", requireAuth, async (req, res) => {
    if (consumeUserLimit(req, res, "sendavapay-create", 10, AUTH_ENDPOINT_WINDOW_MS)) return;
    try {
      const { amount, country, operatorId, operatorName, payerPhone } = req.body;
      const user = await storage.getUser(req.session.userId!);
      if (!user) return res.status(401).json({ message: "Non authentifié" });

      const settings = await storage.getSettings();
      if (settings.sendavapayEnabled !== "true") {
        return res.status(400).json({ message: "SendavaPay non activé" });
      }
      const minDeposit = parseInt(settings.minDeposit || "3000");
      const numericAmount = Number(amount);
      if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
        return res.status(400).json({ message: "Montant invalide" });
      }
      if (numericAmount < minDeposit) {
        return res.status(400).json({ message: `Montant minimum: ${minDeposit.toLocaleString()} FCFA` });
      }
      if (!payerPhone || !payerPhone.trim()) {
        return res.status(400).json({ message: "Le numéro Mobile Money est requis" });
      }

      const svCountry = toSendavapayCountry(country);
      const currency = sendavapayGetCurrency(country);
      const externalRef = `DEP-${Date.now()}-${user.id}`;
      // Only use the number explicitly entered for this deposit; never reuse the profile phone.
      const customerPhone = sendavapayFormatPhone(payerPhone.trim(), country);
      const devDomain = process.env.REPLIT_DEV_DOMAIN;
      const baseUrl = devDomain ? `https://${devDomain}` : "https://sybotx.replit.app";
      const webhookUrl = `${baseUrl}/api/webhooks/sendavapay`;

      const result = await sendavapayCreate({
         amount: numericAmount,
        currency,
        description: `Dépôt #${externalRef}`,
        customerName: user.fullName,
        customerPhone,
        customerEmail: `user${user.id}@sybotx.app`,
        payerCountry: svCountry,
        webhookUrl,
        externalReference: externalRef,
      });

      if (!result.success || !result.data) {
        return res.status(400).json({
          message: result.error || "Erreur SendavaPay",
        });
      }

      const deposit = await storage.createDeposit({
        userId: user.id,
        amount,
        accountName: user.fullName,
        accountNumber: customerPhone,
        country,
        paymentMethod: operatorName || "SendavaPay",
        status: "processing",
        sendavapayReference: result.data.reference,
        sendavapayToken: result.data.paymentToken,
      });

      res.json({
        depositId: deposit.id,
        paymentToken: result.data.paymentToken,
        reference: result.data.reference,
        expiresAt: result.data.expiresAt,
      });
    } catch (error: any) {
      console.error("[sendavapay] create error:", error);
      res.status(500).json({ message: error.message || "Erreur serveur" });
    }
  });

  // Initiate payment (proxy, calls CORS endpoint on behalf of authenticated user)
  app.post("/api/sendavapay/initiate", requireAuth, async (req, res) => {
    if (consumeUserLimit(req, res, "sendavapay-initiate", 10, 10 * 60 * 1000)) return;
    try {
      const user = await storage.getUser(req.session.userId!);
      if (!user) return res.status(401).json({ message: "Non authentifié" });
      const depositId = Number(req.body?.depositId);
      const operatorId = typeof req.body?.operatorId === "string"
        ? req.body.operatorId.trim()
        : "";
      if (!Number.isSafeInteger(depositId) || depositId <= 0) {
        return res.status(400).json({ message: "Dépôt invalide." });
      }
      if (!operatorId || operatorId.length > 64) {
        return res.status(400).json({ message: "Opérateur invalide." });
      }
      const deposit = await storage.getDeposit(depositId);
      if (!deposit || deposit.userId !== user.id || !deposit.sendavapayToken) {
        return res.status(404).json({ message: "Dépôt SendavaPay introuvable." });
      }
      if (deposit.status === "approved" || deposit.status === "rejected") {
        return res.status(409).json({ message: "Ce dépôt est déjà terminé." });
      }

      const svCountry = toSendavapayCountry(deposit.country);
      const customerPhone = sendavapayFormatPhone(deposit.accountNumber, deposit.country);

      const result = await sendavapayInitiate({
        paymentToken: deposit.sendavapayToken,
        payerName: user.fullName,
        payerPhone: customerPhone,
        payerCountry: svCountry,
        operatorId,
      });

      await storage.setDepositNonterminalStatus(deposit.id, "processing");
      const response = typeof result.otpToken === "string" && result.otpToken
        ? { ...result, otpToken: signSendavaOtpTicket(result.otpToken, user.id, deposit.id) }
        : result;

      res.json(response);
    } catch (error: any) {
      console.error("[sendavapay] initiate error:", error);
      res.status(500).json({ message: error.message || "Erreur serveur" });
    }
  });

  // Submit OTP — CLIENT (CORS) endpoint, no SDK key
  app.post("/api/sendavapay/submit-otp", requireAuth, async (req, res) => {
    if (consumeUserLimit(req, res, "sendavapay-otp", 10, 10 * 60 * 1000)) return;
    try {
      const ticket = verifySendavaOtpTicket(req.body?.otpToken);
      const otp = typeof req.body?.otp === "string" ? req.body.otp.trim() : "";
      if (!ticket || ticket.userId !== req.session.userId) {
        return res.status(403).json({ message: "Autorisation de paiement invalide ou expirée." });
      }
      if (!/^\d{4,12}$/.test(otp)) {
        return res.status(400).json({ message: "otpToken et otp requis" });
      }
      const deposit = await storage.getDeposit(ticket.depositId);
      if (
        !deposit ||
        deposit.userId !== req.session.userId ||
        !deposit.sendavapayToken ||
        deposit.status === "approved" ||
        deposit.status === "rejected"
      ) {
        return res.status(404).json({ message: "Dépôt SendavaPay introuvable ou terminé." });
      }
      const result = await sendavapaySubmitOtp({ otpToken: ticket.otpToken, otp });
      res.json(result);
    } catch (error: any) {
      console.error("[sendavapay] submit-otp error:", error);
      res.status(500).json({ message: error.message || "Erreur serveur" });
    }
  });

  // Retry a failed payment — CLIENT (CORS) endpoint, no SDK key
  app.post("/api/sendavapay/retry", requireAuth, async (req, res) => {
    if (consumeUserLimit(req, res, "sendavapay-retry", 5, AUTH_ENDPOINT_WINDOW_MS)) return;
    try {
      const depositId = Number(req.body?.depositId);
      if (!Number.isSafeInteger(depositId) || depositId <= 0) {
        return res.status(400).json({ message: "Dépôt invalide." });
      }
      const deposit = await storage.getDeposit(depositId);
      if (!deposit || deposit.userId !== req.session.userId || !deposit.sendavapayToken) {
        return res.status(404).json({ message: "Dépôt SendavaPay introuvable." });
      }
      if (deposit.status === "approved" || deposit.status === "rejected") {
        return res.status(409).json({ message: "Ce dépôt ne peut plus être relancé." });
      }
      const result = await sendavapayRetry(deposit.sendavapayToken);
      if (result.success) {
        await storage.setDepositNonterminalStatus(deposit.id, "processing");
      }
      res.json(result);
    } catch (error: any) {
      console.error("[sendavapay] retry error:", error);
      res.status(500).json({ message: error.message || "Erreur serveur" });
    }
  });

  // Poll payment status using GET /payment-status/:reference (lighter than verify-payment)
  app.get("/api/deposits/:id/sendavapay-status", requireAuth, async (req, res) => {
    try {
      const depositId = parseInt(getRouteParam(req.params.id));
      const deposit = await storage.getDeposit(depositId);
      if (!deposit) return res.status(404).json({ message: "Dépôt non trouvé" });
      if (deposit.userId !== req.session.userId) return res.status(403).json({ message: "Accès refusé" });

      if (deposit.status === "approved" || deposit.status === "rejected") {
        return res.json({ status: deposit.status });
      }

      if (!deposit.sendavapayReference) {
        return res.json({ status: deposit.status });
      }

      // Use lightweight GET payment-status endpoint for polling
      const statusRes = await fetch(
        `${process.env.SENDAVAPAY_API_BASE || "https://sendavapay.com/api/sdk/v1"}/payment-status/${deposit.sendavapayReference}`,
        { headers: { Authorization: `Bearer ${process.env.SENDAVAPAY_API_KEY || ""}` } }
      );
      const statusData = await statusRes.json() as { success: boolean; data?: { status: string } };

      if (!statusData.success || !statusData.data) {
        return res.json({ status: deposit.status });
      }

      const newStatus = mapSendavapayStatus(statusData.data.status);
      if (newStatus !== "pending" && newStatus !== deposit.status) {
        if (newStatus === "approved") {
          await creditApprovedDeposit(deposit);
        } else if (newStatus === "rejected") {
          await storage.rejectDeposit(depositId);
        } else {
          await storage.setDepositNonterminalStatus(depositId, newStatus);
        }
      }

      res.json({ status: newStatus || deposit.status, rawStatus: statusData.data.status });
    } catch (error: any) {
      console.error("[sendavapay] status check error:", error);
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/webhooks/drimpay", async (req, res) => {
    try {
      if (!isDrimPayWebhookConfigured()) {
        return res.status(503).json({ message: "Webhook DrimPay non configuré" });
      }
      const rawBody = (req as any).rawBody as Buffer | undefined;
      const signature = String(req.headers["x-drimpay-signature"] || "");
      const timestamp = String(req.headers["x-drimpay-timestamp"] || "");
      const secret = getDrimPayWebhookSecret();
      if (!verifyDrimPayWebhookSignature(rawBody, signature, secret, timestamp || undefined)) {
        return res.status(401).json({ message: "Signature DrimPay invalide" });
      }

      const rawPayload = req.body && typeof req.body === "object"
        ? req.body as Record<string, any>
        : {};
      const payload = unwrapDrimPayResponse(rawPayload);
      const event = String(
        payload.event || req.headers["x-drimpay-event"] || "",
      ).trim().toLowerCase();
      const callbackStatus = String(payload.status || event.split(".")[1] || "").trim().toLowerCase();
      if (!event.startsWith("payin.") && !event.startsWith("payout.")) {
        return res.status(400).json({ message: "Événement DrimPay inconnu" });
      }

      if (event.startsWith("payout.")) {
        const providerReference = String(payload.reference || "").trim();
        const externalReference = String(payload.external_ref || payload.order_id || "").trim();
        if (!providerReference && !externalReference) {
          return res.status(400).json({ message: "Référence de retrait DrimPay manquante" });
        }
        const withdrawal = (
          providerReference
            ? await storage.getWithdrawalByDrimPayReference(providerReference)
            : undefined
        ) || await storage.getWithdrawalByDrimPayReference(externalReference);
        if (!withdrawal) return res.status(200).json({ received: true });
        await reconcileDrimPayPayout(withdrawal, { ...payload, status: callbackStatus });
        return res.status(200).json({ received: true });
      }

      const providerReference = String(payload.reference || "").trim();
      const orderId = String(payload.order_id || payload.external_ref || "").trim();
      if (!providerReference && !orderId) {
        return res.status(400).json({ message: "Référence de dépôt DrimPay manquante" });
      }
      const deposit = (
        providerReference
          ? await storage.getDepositByDrimPayReference(providerReference)
          : undefined
      ) || (
        orderId
          ? await storage.getDepositByDrimPayOrderId(orderId)
          : undefined
      );
      if (!deposit) return res.status(200).json({ received: true });
      await reconcileDrimPayDeposit(deposit, { ...payload, status: callbackStatus });
      return res.status(200).json({ received: true });
    } catch (error: any) {
      console.error("[drimpay webhook] processing error:", error?.message || error);
      return res.status(400).json({ message: error.message || "Webhook DrimPay invalide" });
    }
  });

  // AshtechPay Direct API webhook (HMAC-SHA256 verified).
  app.post("/api/webhooks/ashtechpay", async (req, res) => {
    try {
      if (!isAshtechConfigured()) {
        return res.status(503).json({ message: "AshtechPay non configuré" });
      }

      const settings = await storage.getSettings();
      const webhookSecret =
        process.env.ASHTECHPAY_WEBHOOK_SECRET ||
        process.env.ASHTECH_WEBHOOK_SECRET ||
        settings.ashtechWebhookSecret ||
        "";
      if (!webhookSecret) {
        console.error("[ashtechpay webhook] Webhook secret non configuré");
        return res.status(503).json({ message: "Webhook AshtechPay non configuré" });
      }

      const rawBody = (req as any).rawBody as Buffer | undefined;
      const timestamp = String(req.headers["x-ashtech-timestamp"] || "");
      const signature = String(req.headers["x-ashtech-signature"] || "");
      const timestampSeconds = Number(timestamp);
      const timestampIsFresh =
        Number.isFinite(timestampSeconds) &&
        Math.abs(Math.floor(Date.now() / 1000) - timestampSeconds) <= 5 * 60;
      if (
        !rawBody ||
        !timestampIsFresh ||
        !verifyAshtechWebhookSignature(rawBody, timestamp, signature, webhookSecret)
      ) {
        console.warn("[ashtechpay webhook] Signature invalide ou horodatage expiré");
        return res.status(401).json({ message: "Signature invalide" });
      }

      const payload = req.body || {};
      const reference = String(payload.reference || payload.data?.reference || "").trim();
      const transactionId = String(
        payload.transaction_id || payload.transactionId || payload.data?.transaction_id || payload.data?.transactionId || "",
      ).trim();
      const event = String(payload.event || "").toLowerCase();
      const rawStatus = String(payload.status || payload.data?.status || "").toLowerCase();

      // Acknowledge only after authenticating the delivery. Financial
      // fulfillment is committed atomically with the status transition.
      res.status(200).json({ received: true });

      let deposit = transactionId
        ? await storage.getDepositByAshtechTransactionId(transactionId)
        : undefined;
      if (!deposit && reference) {
        deposit = await storage.getDepositByAshtechReference(reference);
      }
      if (!deposit || deposit.status === "approved" || deposit.status === "rejected") return;

      if (event === "payment.failed" || ["failed", "expired", "cancelled", "canceled", "rejected"].includes(rawStatus)) {
        await storage.rejectDeposit(deposit.id);
        return;
      }

      if (!deposit.ashtechTransactionId) return;
      const verified = await ashtechGetTransaction(deposit.ashtechTransactionId);
      if (!ashtechTransactionMatches(verified, {
        amount: Number(deposit.amount),
        countryCode: deposit.country,
        reference: deposit.ashtechReference,
        transactionId: deposit.ashtechTransactionId,
      })) {
        console.warn(`[ashtechpay webhook] Transaction mismatch for deposit #${deposit.id}`);
        return;
      }
      const verifiedStatus = mapAshtechStatus(verified.status);
      if (verifiedStatus === "approved") {
        await creditApprovedDeposit(deposit, undefined, `Dépôt #${deposit.id} approuvé`);
      } else if (verifiedStatus === "rejected") {
        await storage.rejectDeposit(deposit.id);
      }
    } catch (error: any) {
      console.error("[ashtechpay webhook] verification error:", error);
      // The delivery was authenticated and already acknowledged. Reconciliation
      // will retry the provider status check independently.
    }
  });

  app.post(
    "/api/webhooks/sendavapay",
    async (req, res) => {
      try {
        const settings = await storage.getSettings();
        // Prefer the deployment secret; keep the admin setting as a
        // backwards-compatible fallback for existing installations.
        const secret = process.env.SENDAVAPAY_WEBHOOK_SECRET || settings.sendavapayWebhookSecret || "";
        if (!secret) {
          console.error("[sendavapay webhook] Webhook secret not configured");
          return res.status(503).json({ message: "Webhook secret non configuré" });
        }
        const sig = req.headers["x-sendavapay-signature"] as string || "";
        // req.rawBody is captured by the global express.json verify callback
        const rawBuf = (req as any).rawBody as Buffer | undefined;
        if (!rawBuf || !sendavapayVerifySignature(rawBuf, sig, secret)) {
          console.warn("[sendavapay webhook] Invalid signature");
          return res.status(401).json({ message: "Invalid signature" });
        }

        const payload = req.body;
        const { event, reference, status } = payload;

        if (!reference) return res.json({ received: true });

        // Find deposit by sendavapay reference
        const deposit = await storage.getDepositBySendavapayReference(reference);
        if (!deposit) {
          console.warn(`[sendavapay webhook] No deposit found for reference ${reference}`);
          return res.json({ received: true });
        }
        const reportedAmount = payload.amount ?? payload.total_fee ?? payload.data?.amount;
        if (
          reportedAmount !== undefined &&
          (
            !Number.isFinite(Number(reportedAmount)) ||
            Math.abs(Number(reportedAmount) - Number(deposit.amount)) > 0.01
          )
        ) {
          return res.status(400).json({ message: "Le montant du callback ne correspond pas au dépôt." });
        }

        if (deposit.status === "approved" || deposit.status === "rejected") {
          return res.json({ received: true }); // already processed
        }

        if (event === "payment.completed" || status === "completed") {
          await creditApprovedDeposit(deposit);
        } else if (event === "payment.failed" || event === "payment.expired" || status === "failed" || status === "cancelled") {
          await storage.rejectDeposit(deposit.id);
        }

        res.json({ received: true });
      } catch (error: any) {
        console.error("[sendavapay webhook] error:", error);
        res.status(500).json({ message: error.message });
      }
    }
  );

  // ── WestPay: payment callback (redirect after user pays on WestPay page) ────
  app.get("/api/westpay/callback", async (req, res) => {
    try {
      const baseUrl = getPublicBaseUrl(req);
      const depositId = readWestPayReturnState(req.query.state);
      if (!depositId) return res.redirect(`${baseUrl}/deposit?wp_status=error`);
      const deposit = await storage.getDeposit(depositId);
      if (!deposit || deposit.paymentMethod !== "WestPay") {
        return res.redirect(`${baseUrl}/deposit?wp_status=error`);
      }
      const ref = typeof req.query.ref === "string" ? req.query.ref.trim() : "";
      if (
        ref.length > 0 &&
        ref.length <= 200 &&
        !deposit.westpayReference &&
        (deposit.status === "pending" || deposit.status === "processing")
      ) {
        // The signed state binds this redirect to the deposit created for it.
        // Only the signed webhook can approve the deposit.
        await storage.updateDeposit(deposit.id, { westpayReference: ref });
      }
      const wpStatus = req.query.status === "success" ? "success" : "pending";
      res.redirect(`${baseUrl}/deposit?wp_status=${wpStatus}&wp_depositId=${deposit.id}`);
    } catch (err: any) {
      console.error("[westpay callback] error:", err instanceof Error ? err.name : "Error");
      const fallbackBaseUrl = process.env.PUBLIC_APP_URL?.trim().replace(/\/+$/, "");
      if (fallbackBaseUrl) {
        return res.redirect(`${fallbackBaseUrl}/deposit?wp_status=error`);
      }
      return res.status(400).send("Callback invalide.");
    }
  });

  // ── WestPay webhook (HMAC-SHA256 via X-RobotPay-Signature) ──────────────────
  app.post(
    "/api/webhooks/westpay",
    async (req, res) => {
      try {
        const settings = await storage.getSettings();
        const secret = process.env.WESTPAY_WEBHOOK_SECRET || settings.westpayWebhookSecret || "";
        if (!secret) {
          console.error("[westpay webhook] Webhook secret not configured");
          return res.status(503).json({ message: "Webhook secret non configuré" });
        }
        const sig = (req.headers["x-robotpay-signature"] as string) || "";
        // req.rawBody is captured by the global express.json verify callback
        const rawBuf = (req as any).rawBody as Buffer | undefined;
        if (!rawBuf || !westpayVerifySignature(rawBuf, sig, secret)) {
          console.warn("[westpay webhook] Signature invalide");
          return res.status(401).json({ message: "Signature invalide" });
        }
        const payload = req.body;
        const { event, txId, status } = payload;
        const transactionReference =
          txId || payload.transactionId || payload.reference || payload.ref;
        if (!transactionReference) return res.json({ received: true });
        const deposit = await storage.getDepositByWestpayReference(transactionReference);
        if (!deposit) {
          console.warn(`[westpay webhook] Aucun dépôt pour référence: ${transactionReference}`);
          return res.json({ received: true });
        }
        const reportedAmount = payload.amount ?? payload.total_fee ?? payload.data?.amount;
        if (
          reportedAmount !== undefined &&
          (
            !Number.isFinite(Number(reportedAmount)) ||
            Math.abs(Number(reportedAmount) - Number(deposit.amount)) > 0.01
          )
        ) {
          return res.status(400).json({ message: "Le montant du callback ne correspond pas au dépôt." });
        }
        if (deposit.status === "approved" || deposit.status === "rejected") {
          return res.json({ received: true });
        }
        if (event === "payment.confirmed" || status === "confirmed") {
          await creditApprovedDeposit(deposit);
        } else if (
          event === "payment.failed" ||
          event === "payment.expired" ||
          status === "failed" ||
          status === "expired" ||
          status === "cancelled"
        ) {
          await storage.rejectDeposit(deposit.id);
        }
        res.json({ received: true });
      } catch (err: any) {
        console.error("[westpay webhook] error:", err);
        res.status(500).json({ message: err.message });
      }
    }
  );

  // PPayPros returns the customer to the app, but only the signed notify callback
  // can approve a deposit.
  app.get("/api/ppaypros/return", (req, res) => {
    const depositId = Number(req.query.depositId);
    const suffix = Number.isSafeInteger(depositId) && depositId > 0
      ? `&ppaypros_depositId=${depositId}`
      : "";
    res.redirect(`${getPublicBaseUrl(req)}/deposit?ppaypros_status=returned${suffix}`);
  });

  app.post("/api/webhooks/ppaypros/payin", async (req, res) => {
    try {
      const payload = ppayProsCallbackPayload(req);
      const merchantOrderNo = String(payload.mchOrderNo || "");
      const depositId = parsePpayProsMerchantOrderNo("payin", merchantOrderNo);
      if (!depositId) return res.status(400).type("text/plain").send("invalid order");

      const deposit = await storage.getDeposit(depositId);
      if (
        !deposit ||
        deposit.paymentMethod !== "PPayPros" ||
        deposit.omnipayReference !== merchantOrderNo
      ) {
        return res.status(404).type("text/plain").send("deposit not found");
      }
      const credentials = getPpayProsCredentials(deposit.country);
      if (
        payload.mchNo !== credentials.merchantNo ||
        payload.appId !== credentials.appId ||
        !verifyPpayProsSignature(payload, payload.sign, credentials.privateKey)
      ) {
        return res.status(401).type("text/plain").send("invalid signature");
      }
      if (Number(payload.amount) !== toPpayProsAmount(deposit.amount)) {
        return res.status(400).type("text/plain").send("amount mismatch");
      }
      const syncedDeposit = await syncPpayProsPayinOrderId(deposit, payload.payOrderId);
      await reconcilePpayProsPayin(syncedDeposit, payload.state);
      return res.type("text/plain").send("success");
    } catch (error: any) {
      console.error("[ppaypros] payin callback error:", error.message);
      return res.status(500).type("text/plain").send("failed");
    }
  });

  app.post("/api/webhooks/ppaypros/payout", async (req, res) => {
    try {
      const payload = ppayProsCallbackPayload(req);
      const merchantOrderNo = String(payload.mchOrderNo || "");
      const withdrawalId = parsePpayProsMerchantOrderNo("payout", merchantOrderNo);
      if (!withdrawalId) return res.status(400).type("text/plain").send("invalid order");
      const withdrawal = await storage.getWithdrawal(withdrawalId);
      if (
        !withdrawal ||
        withdrawal.omnipayReference !== merchantOrderNo
      ) {
        return res.status(404).type("text/plain").send("withdrawal not found");
      }
      const credentials = getPpayProsCredentials(withdrawal.country);
      if (
        payload.mchNo !== credentials.merchantNo ||
        payload.appId !== credentials.appId ||
        !verifyPpayProsSignature(payload, payload.sign, credentials.privateKey)
      ) {
        return res.status(401).type("text/plain").send("invalid signature");
      }
      if (Number(payload.amount) !== toPpayProsAmount(withdrawal.netAmount)) {
        return res.status(400).type("text/plain").send("amount mismatch");
      }

      await reconcilePpayProsPayout(
        withdrawal,
        merchantOrderNo,
        payload.state,
        payload.transferId ? String(payload.transferId) : undefined,
      );
      return res.type("text/plain").send("success");
    } catch (error: any) {
      console.error("[ppaypros] payout callback error:", error.message);
      return res.status(500).type("text/plain").send("failed");
    }
  });

  // ── InPay webhooks (POST application/x-www-form-urlencoded, MD5 signature) ──
  app.post("/api/webhooks/inpay", async (req, res) => {
    try {
      const settings = await storage.getSettings();
      const payload = (req.body || {}) as Record<string, unknown>;
      const account = inpayFindVerifiedAccount(payload, settings);
      if (!account) {
        console.warn("[inpay webhook] Signature invalide ou merchant inconnu");
        return res.status(401).send("fail");
      }

      const outTradeNo = String(payload.out_trade_no || "");
      if (!outTradeNo) return res.send("success");

      // Both callback formats can contain order_number. Use our own reference
      // prefix first so a payin callback can never be mistaken for a payout.
      const callbackType = String(payload.type || payload.trade_type || "").toLowerCase();
      const callbackStatus = String(payload.status || "").toLowerCase();
      const isPayout =
        outTradeNo.startsWith("PAYOUT-") ||
        callbackType.includes("payout") ||
        callbackStatus.startsWith("payout");
      if (isPayout) {
        const withdrawal = await storage.getWithdrawalByInpayOutTradeNo(outTradeNo);
        if (!withdrawal) return res.send("success");
        const countryAccount = inpayFindVerifiedAccount(payload, settings, withdrawal.country);
        if (!countryAccount) return res.status(401).send("fail");
        const callbackCountry = String(payload.country_prefix || "").trim();
        if (callbackCountry && callbackCountry !== countryAccount.countryPrefix) {
          return res.status(400).send("country mismatch");
        }
        const reportedAmount = payload.total_fee ?? payload.amount ?? payload.money;
        if (
          reportedAmount !== undefined &&
          (
            !Number.isFinite(Number(reportedAmount)) ||
            Math.round(Number(reportedAmount)) !== Math.round(Number(withdrawal.netAmount))
          )
        ) {
          return res.status(400).send("amount mismatch");
        }

        const status = mapInpayPayoutStatus(payload.status || payload.trade_status || payload.result);
        if (status === "approved") {
          await storage.finalizeWithdrawal(withdrawal.id, "approved");
        } else if (status === "rejected" || String(payload.is_reverse) === "2") {
          await storage.finalizeWithdrawal(withdrawal.id, "rejected", undefined, {}, "InPay");
        }
        return res.send("success");
      }

      const deposit = await storage.getDepositByInpayOutTradeNo(outTradeNo);
      if (!deposit) return res.send("success");
      const countryAccount = inpayFindVerifiedAccount(payload, settings, deposit.country);
      if (!countryAccount) return res.status(401).send("fail");
      const callbackCountry = String(payload.country_prefix || "").trim();
      if (callbackCountry && callbackCountry !== countryAccount.countryPrefix) {
        return res.status(400).send("country mismatch");
      }
      const reportedAmount = payload.total_fee ?? payload.amount ?? payload.money;
      if (
        reportedAmount !== undefined &&
        (
          !Number.isFinite(Number(reportedAmount)) ||
          Math.abs(Number(reportedAmount) - Number(deposit.amount)) > 0.01
        )
      ) {
        return res.status(400).send("amount mismatch");
      }

      const status = mapInpayPayinStatus(payload.status || payload.trade_status || payload.result);
      if (status === "approved") {
        await creditApprovedDeposit(deposit);
      } else if (status === "rejected") {
        await storage.rejectDeposit(deposit.id);
      }
      return res.send("success");
    } catch (error: any) {
      console.error("[inpay webhook] error:", error);
      return res.status(500).send("fail");
    }
  });

  // Withdrawals
  app.post("/api/withdrawal-fee/prepare", (_req, res) => {
    res.status(410).json({ message: "Le prépaiement des retraits n'est plus disponible." });
  });

  app.post("/api/withdrawals", requireAuth, async (req, res) => {
    if (consumeUserLimit(req, res, "withdrawal-create", 5, AUTH_ENDPOINT_WINDOW_MS)) return;
    try {
      const transactionPassword = typeof req.body?.transactionPassword === "string"
        ? req.body.transactionPassword
        : "";
      const transactionPasswordHash = await storage.getTransactionPasswordHash(req.session.userId!);
      if (!transactionPasswordHash) {
        return res.status(409).json({
          code: "TRANSACTION_PASSWORD_REQUIRED",
          message: "Définissez votre mot de passe de retrait avant d’effectuer un retrait.",
        });
      }
      if (!transactionPassword) {
        return res.status(400).json({ message: "Saisissez votre mot de passe de retrait." });
      }
      if (!await verifyPassword(transactionPassword, transactionPasswordHash)) {
        return res.status(401).json({ message: "Mot de passe de retrait incorrect." });
      }

      const result = await requestWithdrawal(
        req.session.userId!,
        req.body?.amount,
        storage,
        req.body?.walletId,
      );

      void sendTelegramMessage(
        [
          "💸 <b>Retrait lancé</b>",
          `Utilisateur : ${formatTelegramValue(result.user.fullName)}`,
          `Montant : <b>${formatTelegramValue(result.amount)} XOF</b>`,
          `Net après frais : ${formatTelegramValue(result.netAmount)} XOF`,
          `Méthode : ${formatTelegramValue(result.wallet.paymentMethod)}`,
          `Pays : ${formatTelegramValue(result.wallet.country)}`,
          `ID retrait : ${formatTelegramValue(result.withdrawal.id)}`,
        ].join("\n"),
      ).catch((error) => console.error("[telegram] withdrawal notification failed:", error.message));

      res.json(result.withdrawal);
    } catch (error: any) {
      res.status(error.statusCode || 400).json({ message: error.message });
    }
  });

  app.get("/api/withdrawals/history", requireAuth, async (req, res) => {
    try {
      const withdrawals = await storage.getUserWithdrawals(req.session.userId!);
      res.json(withdrawals);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Wallets
  app.get("/api/wallets", requireAuth, async (req, res) => {
    try {
      const wallets = await storage.getWallets(req.session.userId!);
      res.json(wallets);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/wallets", requireAuth, async (req, res) => {
    try {
      const parsedWallet = walletSchema.safeParse(req.body);
      if (!parsedWallet.success) {
        return res.status(400).json({ message: parsedWallet.error.issues[0]?.message || "Données invalides" });
      }
      const wallet = await storage.createWallet({
        userId: req.session.userId!,
        ...parsedWallet.data,
      }, {
        userId: req.session.userId!,
        role: "user",
      });
      res.json(wallet);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.delete("/api/wallets/:id", requireAuth, async (req, res) => {
    try {
      const walletId = Number.parseInt(getRouteParam(req.params.id), 10);
      if (!Number.isSafeInteger(walletId) || walletId <= 0) {
        return res.status(400).json({ message: "Compte de retrait invalide." });
      }
      const deleted = await storage.deleteWallet(req.session.userId!, walletId, {
        userId: req.session.userId!,
        role: "user",
      });
      if (!deleted) return res.status(404).json({ message: "Compte de retrait introuvable." });
      res.json({ success: true });
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.patch("/api/wallets/:id/default", requireAuth, async (req, res) => {
    try {
      await storage.setDefaultWallet(req.session.userId!, parseInt(getRouteParam(req.params.id)), {
        userId: req.session.userId!,
        role: "user",
      });
      res.json({ success: true });
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  // Team
  app.get("/api/team/stats", requireAuth, async (req, res) => {
    try {
      const stats = await storage.getTeamStats(req.session.userId!);
      res.json(stats);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/team/details", requireAuth, async (req, res) => {
    try {
      const team = await storage.getDetailedTeam(req.session.userId!, true);
      res.json(team);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Blog
  app.get("/api/blog/posts", requireAuth, async (_req, res) => {
    try {
      const posts = await storage.getBlogPosts();
      res.json(posts.map(({ imageKeys, ...post }) => ({
        ...post,
        images: imageKeys.map((_, index) => `/api/blog/posts/${post.id}/images/${index}`),
      })));
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/blog/eligibility", requireAuth, async (req, res) => {
    try {
      const status = await storage.getBlogPostingEligibility(req.session.userId!);
      if (!status.userFound) return res.status(404).json({ message: "Compte introuvable." });
      const eligible = status.hasSuccessfulWithdrawal && !status.submittedToday;
      res.json({
        eligible,
        hasSuccessfulWithdrawal: status.hasSuccessfulWithdrawal,
        submittedToday: status.submittedToday,
        message: eligible
          ? null
          : !status.hasSuccessfulWithdrawal
            ? BLOG_WITHDRAWAL_REQUIRED_MESSAGE
            : BLOG_DAILY_LIMIT_MESSAGE,
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/blog/posts/:id/images/:imageIndex", requireAuth, async (req, res) => {
    const postId = Number(req.params.id);
    const imageIndex = Number(req.params.imageIndex);
    if (
      !Number.isInteger(postId)
      || postId <= 0
      || !Number.isInteger(imageIndex)
      || imageIndex < 0
      || imageIndex > 1
    ) {
      return res.status(400).json({ message: "Image invalide." });
    }

    try {
      const objectName = await storage.getBlogPostImageKey(postId, imageIndex);
      if (!objectName) return res.status(404).json({ message: "Image introuvable." });
      const image = await downloadBlogImage(objectName);
      if (!image) return res.status(404).json({ message: "Image introuvable." });
      res.setHeader("Content-Type", "image/webp");
      res.setHeader("Content-Length", image.length);
      res.setHeader("Cache-Control", "private, max-age=3600");
      res.setHeader("X-Content-Type-Options", "nosniff");
      return res.send(image);
    } catch (error) {
      if (error instanceof BlogImageStorageError) {
        return res.status(503).json({ message: error.message });
      }
      return res.status(500).json({ message: "L’image n’a pas pu être chargée." });
    }
  });

  app.post("/api/blog/posts", requireAuth, parseBlogImageFiles, async (req, res) => {
    const files = Array.isArray(req.files) ? req.files : [];
    const parsed = blogPostSchema.safeParse({ content: req.body?.content });
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.issues[0]?.message ?? "Contenu invalide." });
    }
    if (files.length < 1) {
      return res.status(400).json({ message: BLOG_IMAGE_REQUIRED_MESSAGE });
    }

    const userId = req.session.userId!;
    const imageObjectNames = files.map(() => `blog/${userId}/${randomUUID()}.webp`);
    const imageKeys: string[] = [];
    try {
      const eligibility = await storage.getBlogPostingEligibility(userId);
      if (!eligibility.userFound) {
        return res.status(404).json({ message: "Compte introuvable." });
      }
      if (!eligibility.hasSuccessfulWithdrawal) {
        return res.status(403).json({ message: BLOG_WITHDRAWAL_REQUIRED_MESSAGE });
      }
      if (eligibility.submittedToday) {
        return res.status(409).json({ message: BLOG_DAILY_LIMIT_MESSAGE });
      }

      const uploads = await Promise.allSettled(
        files.map((file, index) => uploadBlogImage(imageObjectNames[index], file.buffer)),
      );
      for (const upload of uploads) {
        if (upload.status === "fulfilled") imageKeys.push(upload.value);
      }
      const failedUpload = uploads.find((result) => result.status === "rejected");
      if (failedUpload?.status === "rejected") {
        throw failedUpload.reason;
      }

      const submission = await storage.submitBlogPost(userId, parsed.data.content, imageKeys);
      if (submission.status !== "created") {
        await deleteBlogImages(imageKeys);
        if (submission.status === "withdrawal_required") {
          return res.status(403).json({ message: BLOG_WITHDRAWAL_REQUIRED_MESSAGE });
        }
        if (submission.status === "daily_limit") {
          return res.status(409).json({ message: BLOG_DAILY_LIMIT_MESSAGE });
        }
        return res.status(404).json({ message: "Compte introuvable." });
      }

      return res.status(201).json({
        id: submission.post.id,
        content: submission.post.content,
        createdAt: submission.post.createdAt,
        images: submission.post.imageKeys.map((_, index) => `/api/blog/posts/${submission.post.id}/images/${index}`),
      });
    } catch (error: any) {
      await deleteBlogImages(imageKeys);
      if (error instanceof BlogImageValidationError) {
        return res.status(400).json({ message: error.message });
      }
      if (error instanceof BlogImageStorageError) {
        return res.status(503).json({ message: error.message });
      }
      console.error("[blog] Publication reservation failed.");
      res.status(500).json({ message: "La publication n’a pas pu être envoyée." });
    }

  });

  app.get("/api/admin/blog/submissions", requireAdmin, async (_req, res) => {
    try {
      const submissions = await storage.getAdminBlogSubmissions();
      res.json(submissions.map(({ imageKeys, ...submission }) => ({
        ...submission,
        images: imageKeys.map((_, index) =>
          `/api/admin/blog/submissions/${submission.id}/images/${index}`,
        ),
      })));
    } catch {
      res.status(500).json({ message: "Les soumissions Blog n’ont pas pu être chargées." });
    }
  });

  app.get("/api/admin/blog/submissions/:id/images/:imageIndex", requireAdmin, async (req, res) => {
    const postId = Number(req.params.id);
    const imageIndex = Number(req.params.imageIndex);
    if (
      !Number.isInteger(postId)
      || postId <= 0
      || !Number.isInteger(imageIndex)
      || imageIndex < 0
      || imageIndex > 1
    ) {
      return res.status(400).json({ message: "Image invalide." });
    }

    try {
      const objectName = await storage.getBlogPostImageKey(postId, imageIndex, true);
      if (!objectName) return res.status(404).json({ message: "Capture introuvable." });
      const image = req.query.variant === "thumb"
        ? await downloadBlogImagePreview(objectName)
        : await downloadBlogImage(objectName);
      if (!image) return res.status(404).json({ message: "Capture introuvable." });
      res.setHeader("Content-Type", "image/webp");
      res.setHeader("Content-Length", image.length);
      res.setHeader("Cache-Control", "private, max-age=300");
      res.setHeader("X-Content-Type-Options", "nosniff");
      return res.send(image);
    } catch (error) {
      if (error instanceof BlogImageStorageError) {
        return res.status(503).json({ message: error.message });
      }
      if (error instanceof BlogImageValidationError) {
        return res.status(422).json({ message: error.message });
      }
      return res.status(500).json({ message: "La capture n’a pas pu être chargée." });
    }
  });

  app.post("/api/admin/blog/submissions/:id/approve", requireAdmin, async (req, res) => {
    const postId = Number(req.params.id);
    if (!Number.isInteger(postId) || postId <= 0) {
      return res.status(400).json({ message: "Soumission invalide." });
    }
    const parsed = blogApprovalSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.issues[0]?.message ?? "Récompense invalide." });
    }

    try {
      const result = await storage.approveBlogPost(
        postId,
        req.session.userId!,
        parsed.data.rewardAmount,
      );
      if (result.status === "not_found") {
        return res.status(404).json({ message: "Soumission introuvable." });
      }
      if (result.status === "already_reviewed") {
        return res.status(409).json({ message: "Cette soumission a déjà été traitée." });
      }
      if (result.status === "user_not_found") {
        return res.status(404).json({ message: "Compte utilisateur introuvable." });
      }
      return res.json({
        message: "Soumission approuvée et récompense créditée au solde de retrait.",
        rewardAmount: result.rewardAmount,
        withdrawalBalance: result.withdrawalBalance,
      });
    } catch {
      return res.status(500).json({ message: "La soumission n’a pas pu être approuvée." });
    }
  });

  // Tasks
  app.get("/api/tasks", requireAuth, async (req, res) => {
    try {
      const tasks = await storage.getTasksWithStatus(req.session.userId!);
      res.json(tasks);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/tasks/:id/claim", requireAuth, async (req, res) => {
    try {
      await storage.claimTask(req.session.userId!, parseInt(getRouteParam(req.params.id)));
      res.json({ success: true });
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.get("/api/fortune-wheel/status", requireAuth, async (req, res) => {
    try {
      const status = await storage.getFortuneWheelStatus(req.session.userId!);
      if (!status.userFound) {
        return res.status(404).json({ message: "Utilisateur non trouvé." });
      }
      return res.json({ availableSpins: status.availableSpins });
    } catch (error: any) {
      return res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/daily-checkin/status", requireAuth, async (req, res) => {
    try {
      const status = await storage.getDailyCheckinStatus(req.session.userId!);
      if (!status) {
        return res.status(404).json({ message: "Utilisateur non trouvé." });
      }
      return res.json(status);
    } catch (error: any) {
      return res.status(500).json({
        message: error.message || "Impossible de charger la récompense quotidienne.",
      });
    }
  });

  app.post("/api/daily-checkin/claim", requireAuth, async (req, res) => {
    try {
      const outcome = await storage.claimDailyCheckinBonus(req.session.userId!);
      if (outcome.status === "claimed") {
        return res.json({
          success: true,
          amount: outcome.amount,
          withdrawalBalance: outcome.withdrawalBalance,
          streakDays: outcome.streakDays,
          totalCapturedProfit: outcome.totalCapturedProfit,
          nextClaimAt: outcome.nextClaimAt,
        });
      }
      if (outcome.status === "not_found") {
        return res.status(404).json({ message: "Utilisateur non trouvé." });
      }
      if (outcome.status === "product_required") {
        return res.status(403).json({
          message: "Vous devez posséder un produit stable actif pour recevoir ce bonus.",
        });
      }
      if (outcome.status === "cooldown") {
        return res.status(429).json({
          message: "Vous pourrez réclamer le prochain bonus après 24 heures.",
          nextClaimAt: outcome.nextClaimAt,
        });
      }
      return res.status(409).json({
        message: "Le bonus de connexion d’aujourd’hui a déjà été réclamé.",
        nextClaimAt: outcome.nextClaimAt,
      });
    } catch (error: any) {
      return res.status(500).json({
        message: error.message || "Impossible de créditer le bonus de connexion.",
      });
    }
  });

  // The server consumes a spin, selects the prize, and credits the withdrawal wallet atomically.
  app.post("/api/fortune-wheel/spin", requireAuth, async (req, res) => {
    try {
      const outcome = selectFortuneWheelOutcome(
        randomInt(100),
        randomInt(100),
        randomInt(FORTUNE_WHEEL_PRIZES.length),
      );
      const amount = outcome.won ? FORTUNE_WHEEL_PRIZES[outcome.prizeIndex] : null;
      const spin = await storage.spinFortuneWheel(req.session.userId!, amount);

      if (!spin.userFound) {
        return res.status(404).json({ message: "Utilisateur non trouvé." });
      }
      if (!spin.claimed) {
        return res.status(400).json({
          message: "Vous n'avez pas de tour gratuit disponible.",
          canSpin: false,
          availableSpins: 0,
        });
      }

      if (!outcome.won) {
        return res.json({
          success: true,
          won: false,
          amount: null,
          prizeIndex: null,
          lossBoundaryIndex: outcome.lossBoundaryIndex,
          availableSpins: spin.availableSpins,
          message: "Désolé, vous n'avez rien gagné cette fois-ci.",
        });
      }

      return res.json({
        success: true,
        won: true,
        amount,
        prizeIndex: outcome.prizeIndex,
        lossBoundaryIndex: null,
        availableSpins: spin.availableSpins,
        message: `Votre gain de ${amount} FCFA a été crédité sur votre solde de retrait.`,
      });
    } catch (error: any) {
      return res.status(500).json({ message: error.message });
    }
  });

  // Transactions
  app.get("/api/transactions", requireAuth, async (req, res) => {
    try {
      const transactions = await storage.getUserTransactions(req.session.userId!);
      res.json(transactions);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Settings
  app.get("/api/settings", async (req, res) => {
    try {
      const settings = await storage.getSettings();
      const configuredPayinCountries = PPAYPROS_COUNTRIES
        .filter(({ code }) =>
          isPpayProsPhoneFormatSupported(code) &&
          isPpayProsEnabled("Payin", code, settings) &&
          !!getPpayProsWayCode(code, settings) &&
          getPpayProsCredentialStatus(code).configured,
        )
        .map(({ code }) => code);
      const configuredPayoutCountries = PPAYPROS_COUNTRIES
        .filter(({ code }) =>
          isPpayProsPhoneFormatSupported(code) &&
          isPpayProsEnabled("Payout", code, settings) &&
          getPpayProsCredentialStatus(code).configured,
        )
        .map(({ code }) => code);
      res.json({
        ...publicSettings(settings),
        ppayprosPayinCountries: configuredPayinCountries.join(","),
        ppayprosPayoutCountries: configuredPayoutCountries.join(","),
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/settings/links", async (req, res) => {
    try {
      const settings = await storage.getSettings();
      res.json({
        supportLink: settings.supportLink || "https://t.me/intelappgroup",
        support2Link: settings.support2Link || "https://t.me/intelappgroup",
        channelLink: settings.channelLink || "https://t.me/intelappgroup",
        groupLink: settings.groupLink || "https://t.me/intelappgroup",
        supportType: settings.supportType || "telegram",
        support2Type: settings.support2Type || "telegram",
        channelType: settings.channelType || "telegram",
        groupType: settings.groupType || "telegram",
        supportEnabled: settings.supportEnabled !== "false",
        support2Enabled: settings.support2Enabled !== "false",
        channelEnabled: settings.channelEnabled !== "false",
        groupEnabled: settings.groupEnabled !== "false",
        supportLabel: settings.supportLabel || "Service client",
        support2Label: settings.support2Label || "Service client 2",
        channelLabel: settings.channelLabel || "Chaîne officielle",
        groupLabel: settings.groupLabel || "Groupe de discussion",
        withdrawalStartHour: settings.withdrawalStartHour || "9",
        withdrawalEndHour: settings.withdrawalEndHour || "17",
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/settings/withdrawal", requireAuth, async (req, res) => {
    try {
      const settings = await storage.getSettings();
      res.json({
        withdrawalFees: parseFloat(settings.withdrawalFees || "18"),
        withdrawalStartHour: parseInt(settings.withdrawalStartHour || "9"),
        withdrawalEndHour: parseInt(settings.withdrawalEndHour || "17"),
        maxWithdrawalsPerDay: parseInt(settings.maxWithdrawalsPerDay || "1"),
        minWithdrawal: parseInt(settings.minWithdrawal || "1000"),
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Admin routes
  app.get("/api/admin/stats", requireAdmin, async (req, res) => {
    try {
      const startDate = req.query.startDate ? new Date(req.query.startDate as string) : undefined;
      const endDate = req.query.endDate ? new Date(req.query.endDate as string) : undefined;
      const stats = await storage.getStats(startDate, endDate, true);
      res.json(stats);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/admin/deposits", requireAdmin, async (req, res) => {
    try {
      const status = req.query.status as string || "pending";
      const deposits = await storage.getDeposits(status === "pending" ? "pending" : undefined);
      const filtered = status === "all" ? deposits : deposits.filter(d => d.status === status);
      res.json(filtered);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/admin/deposits/:id/ppaypros/status", requireAdmin, async (req, res) => {
    try {
      const deposit = await storage.getDeposit(Number.parseInt(getRouteParam(req.params.id), 10));
      if (
        !deposit ||
        deposit.paymentMethod !== "PPayPros" ||
        !deposit.omnipayReference ||
        parsePpayProsMerchantOrderNo("payin", deposit.omnipayReference) !== deposit.id
      ) {
        return res.status(404).json({ message: "Dépôt PPayPros introuvable" });
      }
      if (
        (deposit.status === "approved" || deposit.status === "rejected") &&
        deposit.omnipayId
      ) {
        return res.json({
          status: deposit.status,
          providerStatus: deposit.status,
          payOrderId: deposit.omnipayId,
        });
      }

      const result = await queryPpayProsPayin({
        country: deposit.country,
        merchantOrderNo: deposit.omnipayReference,
        payOrderId: deposit.omnipayId,
      });
      if (result.mchOrderNo && String(result.mchOrderNo) !== deposit.omnipayReference) {
        return res.status(502).json({ message: "PPayPros a renvoyé une autre référence de dépôt." });
      }
      if (
        result.amount !== undefined &&
        Number(result.amount) !== toPpayProsAmount(deposit.amount)
      ) {
        return res.status(502).json({ message: "Le montant retourné par PPayPros ne correspond pas au dépôt." });
      }
      const syncedDeposit = await syncPpayProsPayinOrderId(deposit, result.payOrderId);
      const providerState = result.state ?? result.orderState;
      const updated = await reconcilePpayProsPayin(syncedDeposit, providerState);
      return res.json({
        status: updated?.status || deposit.status,
        providerStatus: String(providerState ?? "pending"),
        payOrderId: updated?.omnipayId || syncedDeposit.omnipayId || null,
      });
    } catch (error: any) {
      console.error("[ppaypros] admin payin status error:", error.message);
      return res.status(502).json({ message: error.message || "Impossible de vérifier le dépôt PPayPros." });
    }
  });

  app.post("/api/admin/deposits/:id/drimpay/status", requireAdmin, async (req, res) => {
    try {
      const deposit = await storage.getDeposit(Number.parseInt(getRouteParam(req.params.id), 10));
      if (!deposit || !deposit.drimpayOrderId) {
        return res.status(404).json({ message: "Dépôt DrimPay introuvable" });
      }
      if (deposit.status === "approved") {
        return res.json({ status: deposit.status });
      }
      if (!deposit.drimpayReference || !isDrimPayConfigured()) {
        return res.status(400).json({ message: "Référence ou configuration DrimPay manquante" });
      }
      const providerStatus = await drimPayGetPayin(deposit.drimpayReference);
      const normalizedProviderStatus = mapDrimPayStatus(unwrapDrimPayResponse(providerStatus).status);
      const updated = await reconcileDrimPayDeposit(deposit, providerStatus);
      return res.json({ status: updated.status, providerStatus: normalizedProviderStatus });
    } catch (error: any) {
      console.error("[drimpay] admin payin status error:", error?.message || error);
      return res.status(502).json({ message: error.message || "Impossible de vérifier le dépôt DrimPay" });
    }
  });

  app.get("/api/admin/deposits/soleaspay-stats", requireAdmin, async (req, res) => {
    try {
      const allDeposits = await storage.getDeposits();
      const soleaspayDeposits = allDeposits.filter((d: any) => d.soleaspayReference || d.soleaspayOrderId);

      const approvedSoleaspay = soleaspayDeposits.filter((d: any) => d.status === "approved");
      const totalAll = approvedSoleaspay.reduce((sum: number, d: any) => sum + Number(d.amount), 0);
      const countAll = approvedSoleaspay.length;

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const approvedToday = approvedSoleaspay.filter((d: any) => new Date(d.createdAt) >= today);
      const totalToday = approvedToday.reduce((sum: number, d: any) => sum + Number(d.amount), 0);
      const countToday = approvedToday.length;

      const pendingSoleaspay = soleaspayDeposits.filter((d: any) => d.status === "pending" || d.status === "processing");
      const totalPending = pendingSoleaspay.reduce((sum: number, d: any) => sum + Number(d.amount), 0);
      const countPending = pendingSoleaspay.length;

      res.json({
        totalAll,
        countAll,
        totalToday,
        countToday,
        totalPending,
        countPending,
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/admin/deposits/:id/approve", requireAdmin, async (req, res) => {
    try {
      const deposit = await storage.approveDepositAndCredit(
        parseInt(getRouteParam(req.params.id)),
        req.session.userId!,
        "Dépôt validé",
      );
      if (!deposit) return res.status(409).json({ message: "Ce dépôt a déjà été traité." });
      if (deposit.drimpayOrderId) {
        await storage.clearDrimPayStatusCheckCount(deposit.id).catch(() => undefined);
      }

      res.json(deposit);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.post("/api/admin/deposits/:id/reject", requireAdmin, async (req, res) => {
    try {
      const { ban } = req.body;
      const deposit = await storage.rejectDeposit(
        parseInt(getRouteParam(req.params.id)),
        req.session.userId!,
        true,
      );
      if (!deposit) return res.status(409).json({ message: "Ce dépôt a déjà été traité." });
      if (deposit.drimpayOrderId) {
        await storage.clearDrimPayStatusCheckCount(deposit.id).catch(() => undefined);
      }

      if (ban) {
        await storage.updateUser(deposit.userId, { isBanned: true });
        await storage.logAdminAction(req.session.userId!, "ban_user", deposit.userId, `Utilisateur banni pour fraude`);
      }

      res.json(deposit);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.post("/api/admin/verify-pin", requireAuth, async (req, res) => {
    if (consumeUserLimit(req, res, "admin-pin", 5, LOGIN_WINDOW_MS)) return;
    try {
      const pin = typeof req.body?.pin === "string" ? req.body.pin : "";
      const user = await storage.getUser(req.session.userId!);
      
      if (!user?.isAdmin) {
        return res.status(403).json({ message: "Acces refuse" });
      }
      
      // If password is not required for this admin, auto-verify
      if (user.isAdminPasswordRequired === false) {
        return res.json({ success: true });
      }

      if (!user.adminPin) {
        return res.status(400).json({ message: "Code PIN non configure" });
      }
      if (pin.trim().length < 4 || pin.trim().length > 8) {
        return res.status(400).json({ message: "Code PIN invalide." });
      }

      const isHashedPin = /^\$2[aby]\$/.test(user.adminPin);
      const pinIsValid = isHashedPin
        ? await verifyPassword(pin, user.adminPin)
        : timingSafeEqual(
            createHmac("sha256", sessionSecret as string).update(pin).digest(),
            createHmac("sha256", sessionSecret as string).update(user.adminPin).digest(),
          );
      if (!pinIsValid) {
        return res.status(401).json({ message: "Code PIN incorrect" });
      }
      if (!isHashedPin) {
        await storage.updateUser(user.id, { adminPin: await hashPassword(pin) });
      }
      res.json({ success: true });
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.get("/api/admin/withdrawals", requireAdmin, async (req, res) => {
    try {
      const status = req.query.status as string || "pending";
      const withdrawals = await storage.getWithdrawals(status === "pending" ? "pending" : undefined);
      const filtered = status === "all" ? withdrawals : withdrawals.filter(w => w.status === status);
      res.json(filtered);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/admin/withdrawals/:id/approve", requireAdmin, async (req, res) => {
    try {
      const withdrawalId = parseInt(getRouteParam(req.params.id));
      const withdrawalData = await storage.getWithdrawal(withdrawalId);
      if (!withdrawalData) return res.status(404).json({ message: "Retrait non trouvé" });
      const withdrawal = await storage.finalizeWithdrawal(
        withdrawalId,
        "approved",
        req.session.userId!,
        {},
        undefined,
        ["pending"],
      );
      if (!withdrawal) return res.status(409).json({ message: "Ce retrait a déjà été traité." });
      res.json(withdrawal);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.post("/api/admin/withdrawals/:id/reject", requireAdmin, async (req, res) => {
    try {
      const withdrawalId = parseInt(getRouteParam(req.params.id));
      const existing = await storage.getWithdrawal(withdrawalId);
      if (!existing) return res.status(404).json({ message: "Retrait non trouvé" });
      const withdrawal = await storage.finalizeWithdrawal(
        withdrawalId,
        "rejected",
        req.session.userId!,
        {},
        "Admin",
        ["pending"],
      );
      if (!withdrawal) return res.status(409).json({ message: "Ce retrait a déjà été traité." });
      res.json(withdrawal);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.post("/api/admin/withdrawals/:id/inpay", requireAdmin, async (req, res) => {
    let claimedOutTradeNo: string | undefined;
    try {
      const withdrawalId = parseInt(getRouteParam(req.params.id));
      const withdrawal = await storage.getWithdrawal(withdrawalId);
      if (!withdrawal) return res.status(404).json({ message: "Retrait non trouvé" });
      if (withdrawal.status !== "pending") {
        return res.status(409).json({ message: "Ce retrait a déjà été traité ou envoyé" });
      }

      const settings = await storage.getSettings();
      const country = withdrawal.country.trim().toUpperCase();
      if (!isInpayCountryEnabled(country, settings) || !isInpayConfigured(country, settings)) {
        return res.status(400).json({ message: `InPay n'est pas configuré pour ${country}` });
      }
      const account = getInpayAccount(country, settings);
      const bankCode = inpayResolveBankCode(country, withdrawal.paymentMethod);
      const outTradeNo = inpayCreateOutTradeNo("PAYOUT", withdrawal.id, withdrawal.userId);
      const claimed = await storage.claimInpayWithdrawal(withdrawal.id, outTradeNo);
      if (!claimed) return res.status(409).json({ message: "Ce retrait a déjà été traité ou envoyé" });
      claimedOutTradeNo = outTradeNo;
      const result = await inpayCreatePayout({
        amount: withdrawal.netAmount,
        country,
        merchantId: account.merchantId,
        apiKey: account.apiKey,
        customerName: withdrawal.accountName,
        customerMobile: withdrawal.accountNumber,
        customerEmail: `user${withdrawal.userId}@tonnew.app`,
        bankCode,
        accountNumber: withdrawal.accountNumber,
        notificationUrl: `${getPublicBaseUrl(req)}/api/webhooks/inpay`,
        outTradeNo,
      });
      const updated = await storage.updateWithdrawal(withdrawal.id, {
        inpayOrderNumber: result.orderNumber || null,
      });
      await storage.logAdminAction(
        req.session.userId!,
        "send_withdrawal_to_inpay",
        withdrawal.userId,
        `Retrait ${withdrawal.id} envoyé à InPay (${country})`,
      );
      res.json(updated);
    } catch (error: any) {
      if (claimedOutTradeNo && error instanceof InpayRequestError && error.providerRejected) {
        await storage.releaseInpayWithdrawal(
          Number.parseInt(getRouteParam(req.params.id), 10),
          claimedOutTradeNo,
        ).catch(() => undefined);
      }
      console.error("[inpay] payout error:", error);
      res.status(400).json({ message: error.message || "Erreur d'envoi InPay" });
    }
  });

  app.post("/api/admin/withdrawals/:id/drimpay", requireAdmin, async (req, res) => {
    const withdrawalId = Number.parseInt(getRouteParam(req.params.id), 10);
    let externalRef: string | undefined;
    try {
      const withdrawal = await storage.getWithdrawal(withdrawalId);
      if (!withdrawal) return res.status(404).json({ message: "Retrait non trouvé" });
      if (withdrawal.status !== "pending") {
        return res.status(409).json({ message: "Ce retrait a déjà été traité ou envoyé." });
      }
      if (!isDrimPayConfigured() || !isDrimPayWebhookConfigured()) {
        return res.status(503).json({ message: "DrimPay n'est pas configuré sur le serveur" });
      }

      const settings = await storage.getSettings();
      const country = withdrawal.country.trim().toUpperCase();
      if (!isDrimPayCountryEnabled(settings, "Payout", country)) {
        return res.status(403).json({ message: `Les retraits DrimPay ne sont pas activés pour ${country}` });
      }
      const countryRecord = (await storage.getActiveCountries()).find(
        (item) => item.code.toUpperCase() === country,
      );
      if (!countryRecord) return res.status(400).json({ message: "Pays indisponible" });

      const operators = drimPayOperatorsForCountry(
        country,
        parseDrimPayOperators(countryRecord.operators),
      );
      const operatorSlug = getDrimPayOperatorSlug(country, withdrawal.paymentMethod);
      const operator = operators.find((item) => item.id === operatorSlug);
      if (!operator) {
        return res.status(400).json({ message: "Opérateur de retrait non disponible dans DrimPay" });
      }
      const phone = normalizeDrimPayPhone(withdrawal.accountNumber, countryRecord.phonePrefix);
      const baseUrl = getPublicBaseUrl(req);
      if (!baseUrl.startsWith("https://")) {
        return res.status(400).json({ message: "DrimPay exige une URL webhook publique en HTTPS" });
      }

      externalRef = createDrimPayPayoutExternalRef(withdrawal.id);
      const claimed = await storage.claimDrimPayWithdrawal(withdrawal.id, externalRef);
      if (!claimed) return res.status(409).json({ message: "Ce retrait est déjà en cours de traitement." });

      const initiated = unwrapDrimPayResponse(await drimPayInitiatePayout({
        amount: withdrawal.netAmount,
        currency: countryRecord.currency,
        country_code: country,
        operator: operator.id,
        phone,
        external_ref: externalRef,
        webhook_url: `${baseUrl}/api/webhooks/drimpay`,
        description: `Retrait RobotPay #${withdrawal.id}`,
      }));
      if (initiated.external_ref && String(initiated.external_ref) !== externalRef) {
        throw new Error("DrimPay a retourné une référence externe différente.");
      }
      const providerReference = typeof initiated.reference === "string"
        ? initiated.reference.trim()
        : "";
      if (providerReference) {
        await storage.updateWithdrawal(withdrawal.id, { drimpayReference: providerReference });
      }
      const current = await storage.getWithdrawal(withdrawal.id);
      if (!current) throw new Error("Retrait introuvable après l'envoi DrimPay.");
      const updated = await reconcileDrimPayPayout(current, initiated);
      await storage.logAdminAction(
        req.session.userId!,
        "send_withdrawal_to_drimpay",
        withdrawal.userId,
        `Retrait ${withdrawal.id} envoyé à DrimPay (${country})`,
      );
      return res.json(updated);
    } catch (error: any) {
      if (
        externalRef &&
        error instanceof DrimPayApiError &&
        error.status >= 400 &&
        error.status < 500
      ) {
        await storage.releaseDrimPayWithdrawal(withdrawalId, externalRef).catch(() => undefined);
      }
      console.error("[drimpay] payout error:", error?.message || error);
      return res.status(error instanceof DrimPayApiError && error.status >= 400 && error.status < 500 ? 400 : 502)
        .json({
          message: error.message || "Erreur d'envoi DrimPay",
          statusCheckRequired: Boolean(externalRef) && !(error instanceof DrimPayApiError && error.status >= 400 && error.status < 500),
        });
    }
  });

  app.post("/api/admin/withdrawals/:id/drimpay/status", requireAdmin, async (req, res) => {
    try {
      const withdrawal = await storage.getWithdrawal(Number.parseInt(getRouteParam(req.params.id), 10));
      if (!withdrawal) return res.status(404).json({ message: "Retrait non trouvé" });
      if (!withdrawal.drimpayExternalRef && !withdrawal.drimpayReference) {
        return res.status(400).json({ message: "Ce retrait ne possède pas de référence DrimPay." });
      }
      if (!isDrimPayConfigured()) {
        return res.status(503).json({ message: "DrimPay n'est pas configuré sur le serveur" });
      }
      if (withdrawal.status === "approved" || withdrawal.status === "rejected") {
        return res.json(withdrawal);
      }
      const reference = withdrawal.drimpayReference || withdrawal.drimpayExternalRef!;
      const providerStatus = await drimPayGetPayout(reference);
      const updated = await reconcileDrimPayPayout(withdrawal, providerStatus);
      return res.json(updated);
    } catch (error: any) {
      console.error("[drimpay] payout status error:", error?.message || error);
      return res.status(502).json({ message: error.message || "Impossible de vérifier le retrait DrimPay." });
    }
  });

  app.post("/api/admin/withdrawals/:id/ppaypros", requireAdmin, async (req, res) => {
    const withdrawalId = parseInt(getRouteParam(req.params.id), 10);
    try {
      const withdrawal = await storage.getWithdrawal(withdrawalId);
      if (!withdrawal) return res.status(404).json({ message: "Retrait non trouvé" });
      if (withdrawal.status !== "pending") {
        return res.status(409).json({ message: "Ce retrait a déjà été traité ou envoyé." });
      }
      const settings = await storage.getSettings();
      const countryCode = withdrawal.country.trim().toUpperCase();
      if (!isPpayProsEnabled("Payout", countryCode, settings)) {
        return res.status(403).json({ message: `Les retraits PPayPros sont désactivés pour ${countryCode}.` });
      }

      // Validate configuration and the registered country phone before claiming.
      getPpayProsCredentials(countryCode);
      const accountPhone = formatPpayProsPhone(countryCode, withdrawal.accountNumber);
      toPpayProsAmount(withdrawal.netAmount);
      const payoutAccountCode = getPpayProsPayoutAccountCode(
        countryCode,
        settings,
        withdrawal.paymentMethod,
      );
      if (!payoutAccountCode) {
        return res.status(400).json({
          message: countryCode === "CM"
            ? "Le portefeuille doit être MTN ou Orange pour un retrait PPayPros au Cameroun."
            : `Le code de retrait PPayPros n'est pas configuré pour ${countryCode}.`,
        });
      }
      const merchantOrderNo = createPpayProsMerchantOrderNo("payout", withdrawal.id);
      const claimed = await storage.claimPpayProsWithdrawal(withdrawal.id, merchantOrderNo);
      if (!claimed) {
        return res.status(409).json({ message: "Ce retrait est déjà en cours de traitement." });
      }

      try {
        const result = await createPpayProsPayout({
          country: countryCode,
          merchantOrderNo,
          amountXof: withdrawal.netAmount,
          accountName: withdrawal.accountName,
          accountNumber: accountPhone,
          accountPhone,
          accountEmail: `user${withdrawal.userId}@tonnew.app`,
          accountCode: payoutAccountCode,
          notifyUrl: `${getPublicBaseUrl(req)}/api/webhooks/ppaypros/payout`,
        });
        if (result.mchOrderNo && String(result.mchOrderNo) !== merchantOrderNo) {
          throw new Error("PPayPros a renvoyé une référence de retrait différente.");
        }

        const transferId = result.transferId ? String(result.transferId) : undefined;
        if (transferId) {
          await storage.updateWithdrawal(withdrawal.id, { omnipayId: transferId });
        }
        let updated = await storage.getWithdrawal(withdrawal.id);
        if (updated && result.state !== undefined && result.state !== null) {
          updated = await reconcilePpayProsPayout(updated, merchantOrderNo, result.state, transferId) || updated;
        }
        await storage.logAdminAction(
          req.session.userId!,
          "send_withdrawal_to_ppaypros",
          withdrawal.userId,
          `Retrait ${withdrawal.id} envoyé à PPayPros (${countryCode})`,
        );
        return res.json(updated);
      } catch (error: any) {
        if (error instanceof PpayProsApiError && error.providerRejected) {
          await storage.releasePpayProsWithdrawal(withdrawal.id, merchantOrderNo);
        }
        console.error("[ppaypros] payout error:", error.message);
        return res.status(502).json({
          message: error.message || "Erreur d'envoi PPayPros",
          statusCheckRequired: !(error instanceof PpayProsApiError && error.providerRejected),
        });
      }
    } catch (error: any) {
      console.error("[ppaypros] payout setup error:", error.message);
      return res.status(400).json({ message: error.message || "Erreur de configuration PPayPros" });
    }
  });

  app.post("/api/admin/withdrawals/:id/ppaypros/status", requireAdmin, async (req, res) => {
    const withdrawalId = parseInt(getRouteParam(req.params.id), 10);
    try {
      const withdrawal = await storage.getWithdrawal(withdrawalId);
      if (!withdrawal) return res.status(404).json({ message: "Retrait non trouvé" });
      const merchantOrderNo = createPpayProsMerchantOrderNo("payout", withdrawal.id);
      if (
        withdrawal.omnipayReference !== merchantOrderNo
      ) {
        return res.status(400).json({ message: "Ce retrait ne possède pas de référence PPayPros." });
      }
      if (withdrawal.status === "approved" || withdrawal.status === "rejected") {
        return res.json(withdrawal);
      }

      const result = await queryPpayProsPayout({
        country: withdrawal.country,
        merchantOrderNo,
        transferId: withdrawal.omnipayId,
      });
      if (result.mchOrderNo && String(result.mchOrderNo) !== merchantOrderNo) {
        return res.status(502).json({ message: "PPayPros a renvoyé une autre référence de retrait." });
      }
      if (
        result.amount !== undefined &&
        Number(result.amount) !== toPpayProsAmount(withdrawal.netAmount)
      ) {
        return res.status(502).json({ message: "Le montant retourné par PPayPros ne correspond pas au retrait." });
      }
      const updated = await reconcilePpayProsPayout(
        withdrawal,
        merchantOrderNo,
        result.state,
        result.transferId ? String(result.transferId) : undefined,
      );
      return res.json(updated);
    } catch (error: any) {
      console.error("[ppaypros] payout status error:", error.message);
      return res.status(502).json({ message: error.message || "Impossible de vérifier le statut PPayPros." });
    }
  });

  app.get("/api/admin/users", requireAdmin, async (req, res) => {
    try {
      const search = typeof req.query.search === "string" ? req.query.search.trim().slice(0, 100) : "";
      const page = Math.max(1, Number.parseInt(String(req.query.page || "1"), 10) || 1);
      const limit = Math.min(100, Math.max(1, Number.parseInt(String(req.query.limit || "50"), 10) || 50));
      const offset = (page - 1) * limit;
      
      const { users: allUsers, total } = await storage.getAllUsers(search, limit, offset);
      const usersWithTeam = await Promise.all(allUsers.map(async (user) => {
        const teamStats = await storage.getTeamStatsSimple(user.id);
        return { ...toClientUser(user), ...teamStats, referrerName: null };
      }));
      res.json({ users: usersWithTeam, total, page, limit, totalPages: Math.ceil(total / limit) });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/admin/users/:id/withdrawal-wallet", requireAdmin, async (req, res) => {
    try {
      const userId = Number(getRouteParam(req.params.id));
      if (!Number.isSafeInteger(userId) || userId <= 0) {
        return res.status(400).json({ message: "Utilisateur invalide" });
      }
      const user = await storage.getUser(userId);
      if (!user) return res.status(404).json({ message: "Utilisateur introuvable" });

      const wallets = await storage.getWallets(userId);
      const primaryWallet = wallets.find((wallet) => wallet.isDefault) ?? wallets[0] ?? null;
      return res.json(primaryWallet);
    } catch (error: any) {
      return res.status(500).json({ message: error.message || "Impossible de charger le compte de retrait" });
    }
  });

  app.get("/api/admin/users/:id/withdrawal-wallet/history", requireAdmin, async (req, res) => {
    try {
      const userId = Number(getRouteParam(req.params.id));
      if (!Number.isSafeInteger(userId) || userId <= 0) {
        return res.status(400).json({ message: "Utilisateur invalide" });
      }
      const user = await storage.getUser(userId);
      if (!user) return res.status(404).json({ message: "Utilisateur introuvable" });
      return res.json(await storage.getWithdrawalWalletAuditHistory(userId));
    } catch (error: any) {
      return res.status(500).json({ message: error.message || "Impossible de charger l’historique du compte de retrait" });
    }
  });

  app.put("/api/admin/users/:id/withdrawal-wallet", requireAdmin, async (req, res) => {
    try {
      const userId = Number(getRouteParam(req.params.id));
      if (!Number.isSafeInteger(userId) || userId <= 0) {
        return res.status(400).json({ message: "Utilisateur invalide" });
      }
      const user = await storage.getUser(userId);
      if (!user) return res.status(404).json({ message: "Utilisateur introuvable" });

      const parsedWallet = walletSchema.safeParse(req.body);
      if (!parsedWallet.success) {
        return res.status(400).json({
          message: parsedWallet.error.issues[0]?.message || "Données du compte invalides",
        });
      }

      const data = parsedWallet.data;
      const profileCountry = user.country.trim().toUpperCase();
      if (data.country.trim().toUpperCase() !== profileCountry) {
        return res.status(400).json({ message: "Le pays du portefeuille doit correspondre au pays du compte utilisateur." });
      }

      const country = (await storage.getCountries()).find(
        (configuredCountry) => configuredCountry.code.trim().toUpperCase() === profileCountry,
      );
      if (!country) {
        return res.status(400).json({ message: "Le pays de cet utilisateur n'est pas configuré par l'administration." });
      }

      let configuredOperators: unknown = [];
      try {
        configuredOperators = JSON.parse(country.operators);
      } catch {
        configuredOperators = [];
      }
      if (
        !Array.isArray(configuredOperators) ||
        !configuredOperators.includes(data.paymentMethod)
      ) {
        return res.status(400).json({ message: "Le moyen de paiement n'est pas configuré pour ce pays." });
      }

      const wallet = await storage.createWallet({ userId, ...data }, {
        userId: req.session.userId!,
        role: "admin",
      });
      await storage.logAdminAction(
        req.session.userId!,
        "update_withdrawal_wallet",
        userId,
        "Compte de retrait mis à jour par l'administration",
      );
      return res.json(wallet);
    } catch (error: any) {
      return res.status(400).json({ message: error.message || "Impossible de mettre à jour le compte de retrait" });
    }
  });

  app.get("/api/admin/users/:id/team", requireAdmin, async (req, res) => {
    try {
      const userId = parseInt(getRouteParam(req.params.id));
      const team = await storage.getDetailedTeam(userId);
      res.json(team);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/admin/users/:id/fortune-wheel-spins", requireAdmin, async (req, res) => {
    try {
      const userId = Number(getRouteParam(req.params.id));
      const count = Number(req.body?.count);
      if (!Number.isSafeInteger(userId) || userId <= 0) {
        return res.status(400).json({ message: "Utilisateur invalide." });
      }
      if (!Number.isSafeInteger(count) || count < 1 || count > 1000) {
        return res.status(400).json({ message: "Le nombre de tours doit être compris entre 1 et 1 000." });
      }

      const availableSpins = await storage.grantFortuneWheelSpins(userId, count);
      if (availableSpins === undefined) {
        return res.status(404).json({ message: "Utilisateur introuvable." });
      }

      await storage.logAdminAction(
        req.session.userId!,
        "grant_fortune_wheel_spins",
        userId,
        `${count} tour(s) gratuit(s) attribué(s). Nouveau total : ${availableSpins}.`,
      );
      return res.json({ success: true, availableSpins });
    } catch (error: any) {
      return res.status(400).json({ message: error.message || "Impossible d'attribuer les tours gratuits." });
    }
  });

  app.post("/api/admin/users/:id/:action", requireAdmin, async (req, res) => {
    try {
      const userId = parseInt(getRouteParam(req.params.id));
      const action = getRouteParam(req.params.action);
      const { value } = req.body;
      const adminUser = await storage.getUser(req.session.userId!);

      switch (action) {
        case "balances": {
          const depositBalance = Number(value?.depositBalance);
          const withdrawalBalance = Number(value?.withdrawalBalance);
          if (
            !Number.isFinite(depositBalance) || depositBalance < 0 ||
            !Number.isFinite(withdrawalBalance) || withdrawalBalance < 0
          ) {
            return res.status(400).json({ message: "Saisissez deux soldes valides, positifs ou nuls." });
          }
          await storage.setBalances(userId, depositBalance, withdrawalBalance, req.session.userId!);
          break;
        }
        case "password": {
          const targetUser = await storage.getUser(userId);
          if (!targetUser) return res.status(404).json({ message: "Utilisateur introuvable" });
          const saved = await resetUserPassword(
            value,
            (password) => storage.updateUser(userId, { password }),
          );
          if (!saved) {
            return res.status(400).json({ message: "Le mot de passe doit contenir entre 6 et 128 caractères." });
          }
          await storage.logAdminAction(req.session.userId!, "reset_password", userId, `Mot de passe réinitialisé`);
          break;
        }
        case "reset-transaction-password": {
          const targetUser = await storage.getUser(userId);
          if (!targetUser) return res.status(404).json({ message: "Utilisateur introuvable" });
          await storage.clearTransactionPassword(userId);
          await storage.logAdminAction(
            req.session.userId!,
            "reset_transaction_password",
            userId,
            "Mot de passe de retrait réinitialisé",
          );
          break;
        }
        case "toggle-ban":
          const user1 = await storage.getUser(userId);
          await storage.updateUser(userId, { isBanned: !user1?.isBanned });
          await storage.logAdminAction(req.session.userId!, "toggle_ban", userId, `Statut banni: ${!user1?.isBanned}`);
          break;
        case "toggle-withdrawal":
          const user2 = await storage.getUser(userId);
          await storage.updateUser(userId, { isWithdrawalBlocked: !user2?.isWithdrawalBlocked });
          await storage.logAdminAction(req.session.userId!, "toggle_withdrawal", userId, `Retrait bloqué: ${!user2?.isWithdrawalBlocked}`);
          break;
        case "toggle-promoter":
          const user3 = await storage.getUser(userId);
          await storage.updateUser(userId, { isPromoter: !user3?.isPromoter, promoterSetBy: req.session.userId });
          await storage.logAdminAction(req.session.userId!, "toggle_promoter", userId, `Promoteur: ${!user3?.isPromoter}`);
          break;
        case "toggle-must-invite":
          const user4 = await storage.getUser(userId);
          await storage.updateUser(userId, { mustInviteToWithdraw: !user4?.mustInviteToWithdraw });
          await storage.logAdminAction(req.session.userId!, "toggle_must_invite", userId, `Doit inviter: ${!user4?.mustInviteToWithdraw}`);
          break;
        case "toggle-admin":
          if (!adminUser?.isSuperAdmin) {
            return res.status(403).json({ message: "Action réservée au super admin" });
          }
          const user5 = await storage.getUser(userId);
          const newAdminStatus = !user5?.isAdmin;
          const requestedPin = typeof value === "string" ? value.trim() : "";
          if (newAdminStatus && (requestedPin.length < 4 || requestedPin.length > 8)) {
            return res.status(400).json({ message: "Le code PIN doit contenir 4 à 8 caractères." });
          }
          await storage.updateUser(userId, { 
            isAdmin: newAdminStatus,
            adminSetBy: req.session.userId,
            adminSetAt: new Date(),
            adminPin: newAdminStatus && requestedPin ? await hashPassword(requestedPin) : null,
          });
          await storage.logAdminAction(req.session.userId!, "toggle_admin", userId, `Admin: ${newAdminStatus}`);
          break;
        case "update-admin-pin":
          if (!adminUser?.isSuperAdmin) {
            return res.status(403).json({ message: "Action réservée au super admin" });
          }
          if (typeof value !== "string" || value.trim().length < 4 || value.trim().length > 8) {
            return res.status(400).json({ message: "Le code PIN doit contenir 4 à 8 caractères." });
          }
          await storage.updateUser(userId, { adminPin: await hashPassword(value.trim()) });
          await storage.logAdminAction(req.session.userId!, "update_admin_pin", userId, `PIN admin mis à jour`);
          break;
        case "toggle-password-required":
          if (!adminUser?.isSuperAdmin) {
            return res.status(403).json({ message: "Action réservée au super admin" });
          }
          await storage.updateUser(userId, { isAdminPasswordRequired: value });
          await storage.logAdminAction(req.session.userId!, "toggle_password_required", userId, `Mot de passe admin requis: ${value}`);
          break;
        case "assign-product":
          await storage.purchaseProduct(userId, value, true);
          await storage.logAdminAction(req.session.userId!, "assign_product", userId, `Produit ${value} attribué`);
          break;
        case "revoke-product":
          await storage.removeUserProduct(userId, value);
          await storage.logAdminAction(req.session.userId!, "revoke_product", userId, `Produit ${value} révoqué`);
          break;
        case "toggle-super-admin":
          if (!adminUser?.isSuperAdmin) {
            return res.status(403).json({ message: "Action réservée au super admin" });
          }
          const userSA = await storage.getUser(userId);
          const newSuperAdminStatus = !userSA?.isSuperAdmin;
          await storage.updateUser(userId, {
            isSuperAdmin: newSuperAdminStatus,
            isAdmin: newSuperAdminStatus ? true : userSA?.isAdmin,
          });
          await storage.logAdminAction(req.session.userId!, "toggle_super_admin", userId, `Super Admin: ${newSuperAdminStatus}`);
          break;
        case "toggle-banker":
          if (!adminUser?.isSuperAdmin && !adminUser?.isAdmin) {
            return res.status(403).json({ message: "Action réservée aux admins" });
          }
          const userBanker = await storage.getUser(userId);
          const newBankerStatus = !userBanker?.isBanker;
          await storage.updateUser(userId, { 
            isBanker: newBankerStatus,
            bankerSetBy: newBankerStatus ? req.session.userId : null,
          });
          await storage.logAdminAction(req.session.userId!, "toggle_banker", userId, `Bankier: ${newBankerStatus}`);
          break;
        default:
          return res.status(400).json({ message: "Action invalide" });
      }

      res.json({ success: true });
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.get("/api/admin/products/all", requireAdmin, async (req, res) => {
    try {
      const allProducts = await storage.getAllProducts();
      const stockCounts = await storage.getProductStockCounts(allProducts.map((product) => product.id));
      res.json(allProducts.map((product) => ({
        ...product,
        stockCount: stockCounts[product.id] || 0,
      })));
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/admin/users/:id/products", requireAdmin, async (req, res) => {
    try {
      const userId = parseInt(getRouteParam(req.params.id));
      const userProductsList = await storage.getAllUserProducts(userId);
      res.json(userProductsList.map(up => {
        const productType = up.userProduct.purchaseProductType ?? up.product.productType;
        const cycleDays = up.userProduct.purchaseCycleDays ?? up.product.cycleDays;
        const totalProfit = up.userProduct.purchaseTotalReturn ?? up.product.totalReturn;
        const productPrice = up.userProduct.purchasePrice ?? up.product.price;
        const dailyEarnings = up.userProduct.purchaseDailyEarnings ?? up.product.dailyEarnings;
        return {
          id: up.userProduct.id,
          productId: up.userProduct.productId,
          productName: up.userProduct.purchaseProductName ?? up.product.name,
          productPrice,
          dailyEarnings: productType === "wellness"
            ? getWellnessDailyEarnings(
              getWellnessCardTotalRevenue(productPrice, totalProfit),
              cycleDays,
            )
            : dailyEarnings,
          payoutMode: up.userProduct.payoutMode,
          isActive: up.userProduct.isActive,
          isRevoked: up.userProduct.isRevoked,
          purchaseDate: up.userProduct.purchaseDate,
          daysClaimed: cycleDays - up.userProduct.daysRemaining,
          totalCycle: cycleDays,
        };
      }));
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/admin/products", requireAdmin, async (req, res) => {
    try {
      const { price, dailyEarnings, cycleDays } = req.body;
      const priceInt = Number(price);
      const dailyInt = Number(dailyEarnings);
      const cycleInt = Number(cycleDays);
      if (!Number.isSafeInteger(priceInt) || priceInt <= 0
        || !Number.isSafeInteger(dailyInt) || dailyInt <= 0
        || !isValidWellnessCycleDays(cycleInt)
        || dailyInt * cycleInt > 2_147_483_647) {
        return res.status(400).json({ message: "Champs requis manquants" });
      }
      const name = formatStableProductName(
        getNextStableProductVipLevel(await storage.getAllProducts()),
      );
      const product = await storage.createProduct({
        name,
        price: priceInt,
        dailyEarnings: dailyInt,
        cycleDays: cycleInt,
        totalReturn: dailyInt * cycleInt,
        imageUrl: PRODUCT_IMAGE_URL,
        productType: "stable",
        launchDate: null,
        launchTime: null,
        isFree: false,
        isActive: true,
        sortOrder: 0,
      });
      await storage.logAdminAction(req.session.userId!, "create_product", null, `Produit ${product.name} créé`);
      res.json(product);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.post("/api/admin/products/wellness", requireAdmin, async (req, res) => {
    try {
      const { price, dailyEarnings, totalReturn, cycleDays } = req.body ?? {};
      const priceInt = Number(price);
      const cycleInt = Number(cycleDays);
      const totalProfitInt = totalReturn === undefined
        ? Number(dailyEarnings) * cycleInt
        : Number(totalReturn);
      const dailyInt = getWellnessDailyEarnings(priceInt + totalProfitInt, cycleInt);
      const submittedImage = typeof req.body?.imageUrl === "string" ? req.body.imageUrl.trim() : "";
      const imageUrl = submittedImage || WELLNESS_PRODUCT_IMAGE_URL;

      if (!Number.isSafeInteger(priceInt) || priceInt <= 0
        || !Number.isSafeInteger(totalProfitInt) || totalProfitInt <= 0
        || !Number.isSafeInteger(dailyInt) || dailyInt <= 0
        || !Number.isSafeInteger(cycleInt) || cycleInt <= 0
        || totalProfitInt > 2_147_483_647) {
        return res.status(400).json({
          message: "Le prix, le bénéfice total et la durée doivent être valides. Le bénéfice doit permettre un gain positif par jour.",
        });
      }
      if (submittedImage && !isAllowedWellnessImageUrl(submittedImage)) {
        return res.status(400).json({
          message: "L’image doit être une adresse HTTPS ou un chemin d’image du site.",
        });
      }

      const product = await storage.createProduct({
        name: formatWellnessProductName(getNextWellnessProductNumber(await storage.getAllProducts())),
        price: priceInt,
        dailyEarnings: dailyInt,
        cycleDays: cycleInt,
        totalReturn: totalProfitInt,
        imageUrl,
        productType: "wellness",
        launchDate: null,
        launchTime: null,
        stockLimit: null,
        isFree: false,
        isActive: true,
        sortOrder: 0,
      });
      await storage.logAdminAction(
        req.session.userId!,
        "create_wellness_product",
        null,
        `Produit Bien-être ${product.name} créé`,
      );
      res.json(product);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.post("/api/admin/products/bulk-activity", requireAdmin, async (req, res) => {
    try {
      const { launchDate, launchTime, products: submittedProducts } = req.body ?? {};
      if (!isValidLaunchSchedule(launchDate, launchTime)) {
        return res.status(400).json({ message: "La date et l’heure de lancement sont obligatoires et doivent être valides." });
      }
      if (!Array.isArray(submittedProducts) || submittedProducts.length < 1 || submittedProducts.length > 50) {
        return res.status(400).json({ message: "Le lot doit contenir entre 1 et 50 produits." });
      }

      const rows: Partial<Product>[] = [];
      let activitySequence = getNextActivityProductNumber(await storage.getAllProducts());
      for (const row of submittedProducts) {
        const price = Number(row?.price);
        const fixedProfit = Number(row?.fixedProfit);
        const cycleDays = Number(row?.cycleDays);
        const stockLimitInput = row?.stockLimit;
        const stockLimit = stockLimitInput == null || stockLimitInput === ""
          ? null
          : Number(stockLimitInput);
        if (!Number.isSafeInteger(price) || price <= 0
          || !Number.isSafeInteger(fixedProfit) || fixedProfit <= 0
          || !Number.isSafeInteger(cycleDays) || cycleDays <= 0
          || (stockLimit !== null && (!Number.isSafeInteger(stockLimit) || stockLimit <= 0 || stockLimit > 2_147_483_647))
          || getActivityTotalPayout(price, fixedProfit) <= 0) {
          return res.status(400).json({ message: "Chaque produit doit avoir un prix, un bénéfice fixe et une durée valides. La limite de places doit être un entier positif." });
        }

        rows.push({
          name: formatActivityProductName(activitySequence++),
          price,
          dailyEarnings: getActivityDailyProfitEstimate(fixedProfit, cycleDays),
          cycleDays,
          totalReturn: getActivityTotalPayout(price, fixedProfit),
          imageUrl: PRODUCT_IMAGE_URL,
          productType: "activity",
          launchDate,
          launchTime,
          stockLimit,
          isFree: false,
          isActive: true,
          sortOrder: 0,
        });
      }

      const createdProducts = await storage.createProducts(rows);
      await storage.logAdminAction(
        req.session.userId!,
        "create_activity_products",
        null,
        `${createdProducts.length} produit(s) d’activité créé(s), lancement GMT prévu le ${launchDate} à ${launchTime}`,
      );
      res.json(createdProducts);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.patch("/api/admin/products/:id", requireAdmin, async (req, res) => {
    try {
      const id = parseInt(getRouteParam(req.params.id));
      const existing = await storage.getProduct(id);
      if (!existing) return res.status(404).json({ message: "Produit non trouvé" });

      const body = req.body ?? {};
      const update: Partial<Product> = {};
      if (body.name !== undefined) {
        if (existing.productType === "activity") {
          if (typeof body.name !== "string" || body.name.trim() !== existing.name) {
            return res.status(400).json({ message: "Le nom des produits d’activité est attribué automatiquement." });
          }
        } else if (existing.productType === "wellness") {
          if (typeof body.name !== "string" || body.name.trim() !== existing.name) {
            return res.status(400).json({ message: "Le nom des produits Bien-être est attribué automatiquement." });
          }
        } else if (typeof body.name !== "string" || body.name.trim() !== existing.name) {
          return res.status(400).json({ message: "Le nom des produits stables est attribué automatiquement." });
        }
      }
      if (existing.productType === "wellness") {
        if (body.price !== undefined) {
          const price = Number(body.price);
          if (!Number.isSafeInteger(price) || price <= 0) {
            return res.status(400).json({ message: "Le prix doit être un nombre entier positif." });
          }
          update.price = price;
        }

        const nextCycleDays = body.cycleDays === undefined
          ? existing.cycleDays
          : Number(body.cycleDays);
        if (!Number.isSafeInteger(nextCycleDays) || nextCycleDays <= 0) {
          return res.status(400).json({ message: "La durée doit être un nombre entier positif." });
        }

        if (body.cycleDays !== undefined) update.cycleDays = nextCycleDays;
        if (
          body.price !== undefined
          || body.totalReturn !== undefined
          || body.dailyEarnings !== undefined
          || body.cycleDays !== undefined
        ) {
          const totalProfit = body.totalReturn !== undefined
            ? Number(body.totalReturn)
            : body.dailyEarnings !== undefined
              ? Number(body.dailyEarnings) * nextCycleDays
              : existing.totalReturn;
          const nextPrice = update.price ?? existing.price;
          const dailyEarnings = getWellnessDailyEarnings(
            nextPrice + totalProfit,
            nextCycleDays,
          );
          if (
            !Number.isSafeInteger(totalProfit)
            || totalProfit <= 0
            || totalProfit > 2_147_483_647
            || dailyEarnings <= 0
          ) {
            return res.status(400).json({
              message: "Le bénéfice total doit permettre un gain journalier positif pour cette durée.",
            });
          }
          update.totalReturn = totalProfit;
          update.dailyEarnings = dailyEarnings;
        }
      } else if (existing.productType === "activity") {
        const nextPrice = body.price === undefined ? existing.price : Number(body.price);
        const nextCycleDays = body.cycleDays === undefined ? existing.cycleDays : Number(body.cycleDays);
        if (!Number.isSafeInteger(nextPrice) || nextPrice <= 0
          || !Number.isSafeInteger(nextCycleDays) || nextCycleDays <= 0) {
          return res.status(400).json({ message: "Le prix et la durée doivent être des nombres entiers positifs." });
        }
        const existingFixedProfit = Math.max(0, existing.totalReturn - existing.price);
        const fixedProfit = body.profit === undefined ? existingFixedProfit : Number(body.profit);
        const totalPayout = getActivityTotalPayout(nextPrice, fixedProfit);
        if (!Number.isSafeInteger(fixedProfit) || fixedProfit <= 0 || totalPayout <= 0) {
          return res.status(400).json({ message: "Le bénéfice fixe doit être un entier positif." });
        }
        if (body.price !== undefined) update.price = nextPrice;
        if (body.cycleDays !== undefined) update.cycleDays = nextCycleDays;
        update.dailyEarnings = getActivityDailyProfitEstimate(fixedProfit, nextCycleDays);
        update.totalReturn = totalPayout;
      } else {
        for (const field of ["price", "dailyEarnings", "cycleDays"] as const) {
          if (body[field] === undefined) continue;
          const value = Number(body[field]);
          if (!Number.isSafeInteger(value) || value <= 0) {
            return res.status(400).json({ message: "Le prix, le gain journalier et la durée doivent être des nombres entiers positifs." });
          }
          update[field] = value;
        }
      }
      if (body.imageUrl !== undefined) {
        if (existing.productType === "wellness") {
          const imageUrl = typeof body.imageUrl === "string" ? body.imageUrl.trim() : "";
          if (!imageUrl || !isAllowedWellnessImageUrl(imageUrl)) {
            return res.status(400).json({ message: "L’image doit être une adresse HTTPS ou un chemin d’image du site." });
          }
          update.imageUrl = imageUrl;
        } else if (body.imageUrl !== PRODUCT_IMAGE_URL) {
          return res.status(400).json({ message: "Tous les produits utilisent l’image officielle du catalogue." });
        } else {
          update.imageUrl = PRODUCT_IMAGE_URL;
        }
      }
      if (body.stockLimit !== undefined) {
        if (existing.productType !== "activity") {
          return res.status(400).json({ message: "La limite de places s’applique uniquement aux produits d’activité." });
        }
        if (body.stockLimit === null || body.stockLimit === "") {
          update.stockLimit = null;
        } else {
          const stockLimit = Number(body.stockLimit);
          if (!Number.isSafeInteger(stockLimit) || stockLimit <= 0 || stockLimit > 2_147_483_647) {
            return res.status(400).json({ message: "La limite de places doit être un entier positif." });
          }
          update.stockLimit = stockLimit;
        }
      }
      if (body.isActive !== undefined) {
        if (typeof body.isActive !== "boolean") return res.status(400).json({ message: "État du produit invalide." });
        update.isActive = body.isActive;
      }
      if (body.launchDate !== undefined || body.launchTime !== undefined) {
        if (existing.productType !== "activity") {
          return res.status(400).json({ message: "Seuls les produits d’activité ont une date de lancement." });
        }
        const launchDate = body.launchDate ?? existing.launchDate;
        const launchTime = body.launchTime ?? existing.launchTime;
        if (!isValidLaunchSchedule(launchDate, launchTime)) {
          return res.status(400).json({ message: "La date et l’heure de lancement sont invalides." });
        }
        update.launchDate = launchDate;
        update.launchTime = launchTime;
      }
      if (existing.productType === "stable") {
        const nextDailyEarnings = update.dailyEarnings ?? existing.dailyEarnings;
        const nextCycleDays = update.cycleDays ?? existing.cycleDays;
        if (nextDailyEarnings * nextCycleDays > 2_147_483_647) {
          return res.status(400).json({ message: "Le gain total dépasse la limite autorisée." });
        }
        if (update.dailyEarnings !== undefined || update.cycleDays !== undefined) {
          update.totalReturn = nextDailyEarnings * nextCycleDays;
        }
      }

      const product = await storage.updateProduct(id, update);
      await storage.logAdminAction(req.session.userId!, "update_product", null, `Produit ${product.id} modifié`);
      res.json(product);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.delete("/api/admin/products/:id", requireAdmin, async (req, res) => {
    try {
      const id = parseInt(getRouteParam(req.params.id));
      const result = await storage.deleteProduct(id);
      await storage.logAdminAction(
        req.session.userId!,
        "delete_product",
        null,
        result.archived
          ? `Produit ${id} retiré du catalogue, historique conservé`
          : `Produit ${id} supprimé`,
      );
      res.json({ success: true, ...result });
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.get("/api/admin/channels", requireAdmin, async (req, res) => {
    try {
      const channels = await storage.getPaymentChannels();
      res.json(channels);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/admin/channels", requireAdmin, async (req, res) => {
    try {
      const channel = await storage.createPaymentChannel({
        ...req.body,
        modifiedBy: req.session.userId,
      });
      await storage.logAdminAction(req.session.userId!, "create_channel", null, `Canal ${channel.name} créé`);
      res.json(channel);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.patch("/api/admin/channels/:id", requireAdmin, async (req, res) => {
    try {
      const channel = await storage.updatePaymentChannel(parseInt(getRouteParam(req.params.id)), {
        ...req.body,
        modifiedBy: req.session.userId,
      });
      await storage.logAdminAction(req.session.userId!, "update_channel", null, `Canal ${channel.name} modifié`);
      res.json(channel);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.delete("/api/admin/channels/:id", requireAdmin, async (req, res) => {
    try {
      await storage.deletePaymentChannel(parseInt(getRouteParam(req.params.id)));
      await storage.logAdminAction(req.session.userId!, "delete_channel", null, `Canal supprimé`);
      res.json({ success: true });
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.get("/api/admin/settings", requireAdmin, async (req, res) => {
    try {
      const settings = await storage.getSettings();
      res.json(adminSettings(settings));
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/admin/ppaypros/configuration", requireAdmin, async (_req, res) => {
    try {
      const settings = await storage.getSettings();
      return res.json({
        countries: PPAYPROS_COUNTRIES.map(({ code, name }) => ({
          code,
          name,
          phoneFormatSupported: isPpayProsPhoneFormatSupported(code),
          credentials: getPpayProsCredentialStatus(code),
          wayCode: getPpayProsWayCode(code, settings),
          payinEnabled: isPpayProsEnabled("Payin", code, settings),
          payoutEnabled: isPpayProsEnabled("Payout", code, settings),
          payoutAccountCode: getPpayProsPayoutAccountCode(code, settings),
        })),
      });
    } catch (error: any) {
      return res.status(500).json({ message: error.message || "Impossible de lire la configuration PPayPros." });
    }
  });

  app.get("/api/admin/ppaypros/balance/:country", requireAdmin, async (req, res) => {
    const country = getRouteParam(req.params.country).trim().toUpperCase();
    if (!PPAYPROS_COUNTRIES.some((entry) => entry.code === country)) {
      return res.status(400).json({ message: "Pays non pris en charge dans la configuration PPayPros." });
    }
    try {
      const balance = await getPpayProsBalance(country);
      return res.json({
        country,
        collectionBalance: balance.balance ?? null,
        payoutBalance: balance.payoutBalance ?? null,
        frozenBalance: balance.agentBalance ?? null,
        unit: "unité mineure PPayPros",
      });
    } catch (error: any) {
      console.error(`[ppaypros] ${country} balance error:`, error.message);
      return res.status(502).json({ message: error.message || `Impossible de consulter le solde PPayPros (${country}).` });
    }
  });

  app.get("/api/admin/drimpay/balance/:country", requireAdmin, async (req, res) => {
    const country = getRouteParam(req.params.country).trim().toUpperCase();
    try {
      if (!isDrimPayConfigured()) {
        return res.status(503).json({ message: "DrimPay n'est pas configuré sur le serveur" });
      }
      if (!isDrimPayCountry(country)) {
        return res.status(400).json({ message: "Pays non pris en charge par DrimPay" });
      }
      const result = unwrapDrimPayResponse(await drimPayGetBalance(country));
      if (result.balance === undefined || result.balance === null) {
        return res.status(502).json({ message: "DrimPay n'a pas retourné le solde du portefeuille." });
      }
      return res.json({
        country,
        balance: result.balance,
        currency: result.currency || "",
        active: result.active === true,
      });
    } catch (error: any) {
      console.error("[drimpay] balance error:", error?.message || error);
      return res.status(502).json({ message: error.message || "Impossible de consulter le solde DrimPay" });
    }
  });

  app.get("/api/admin/inpay/balance/:country", requireAdmin, async (req, res) => {
    const country = String(req.params.country).trim().toUpperCase();
    try {
      const settings = await storage.getSettings();
      if (!isInpayConfigured(country, settings)) {
        return res.status(400).json({ message: `InPay n'est pas configuré pour ${country}` });
      }
      const account = getInpayAccount(country, settings);
      const balance = await inpayGetBalance({
        merchantId: account.merchantId,
        apiKey: account.apiKey,
      });
      res.json({ country, name: inpayGetCountryName(country), balance });
    } catch (error: any) {
      void sendTelegramInpayError({
        operation: "Consultation du solde",
        error,
        country,
      }).catch((notificationError) => {
        console.error("[telegram] InPay balance error notification failed:", notificationError.message);
      });
      console.error("[inpay] balance error:", error);
      res.status(502).json({ message: error.message || "Impossible de consulter le solde InPay" });
    }
  });

  app.get("/api/admin/blocked-ips", requireAdmin, async (_req, res) => {
    try {
      res.json(await getCachedBlockedIps());
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/admin/blocked-ips", requireAdmin, async (req, res) => {
    try {
      const ip = String(req.body?.ip || "").trim();
      const net = await import("net");
      if (!net.isIP(ip)) return res.status(400).json({ message: "Adresse IP invalide" });
      const blockedIps = [...await getCachedBlockedIps()];
      if (!blockedIps.includes(ip)) {
        blockedIps.push(ip);
        await storage.setSetting("blockedIps", JSON.stringify(blockedIps), req.session.userId);
        updateBlockedIpsCache(blockedIps);
      }
      await storage.logAdminAction(req.session.userId!, "block_ip", null, `Adresse IP bloquée: ${ip}`);
      res.json({ success: true, ip });
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.delete("/api/admin/blocked-ips/:ip", requireAdmin, async (req, res) => {
    try {
      const ip = decodeURIComponent(getRouteParam(req.params.ip));
      const blockedIps = await getCachedBlockedIps();
      const nextIps = blockedIps.filter((value) => value !== ip);
      await storage.setSetting("blockedIps", JSON.stringify(nextIps), req.session.userId);
      updateBlockedIpsCache(nextIps);
      await storage.logAdminAction(req.session.userId!, "unblock_ip", null, `Adresse IP débloquée: ${ip}`);
      res.json({ success: true, ip });
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.post("/api/admin/settings", requireAdmin, async (req, res) => {
    try {
      const entries = Object.entries(req.body);
      for (const [key, value] of entries) {
        if (!ADMIN_SETTING_KEYS.has(key)) continue;
        if (SENSITIVE_SETTING_KEYS.has(key) && (value === "" || value === MASKED_SETTING_VALUE)) continue;
        await storage.setSetting(key, value as string, req.session.userId);
      }
      await storage.logAdminAction(req.session.userId!, "update_settings", null, `Paramètres modifiés`);
      res.json({ success: true });
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  // Reset stats route (Super Admin only)
  app.post("/api/admin/reset-stats", requireAdmin, async (req, res) => {
    try {
      const adminUser = await storage.getUser(req.session.userId!);
      if (!adminUser?.isSuperAdmin) {
        return res.status(403).json({ message: "Action réservée au super admin" });
      }

      await storage.resetStats();
      await storage.logAdminAction(req.session.userId!, "reset_stats", null, "Réinitialisation des statistiques de la plateforme");
      res.json({ success: true, message: "Statistiques réinitialisées" });
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  // Gift Codes Routes
  app.get("/api/admin/gift-codes", requireAdmin, async (req, res) => {
    try {
      const codes = await storage.getAllGiftCodes();
      res.json(codes);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  const createGiftCodeSchema = z.object({
    code: z.string().min(1, "Le code est requis"),
    amount: z.number().positive("Le montant doit etre positif").or(z.string().transform(Number)),
    maxUses: z.number().int().positive("Le nombre d'utilisations doit etre positif"),
    expiresAt: z.string().refine((val) => !isNaN(Date.parse(val)), "Date d'expiration invalide"),
  });

  app.post("/api/admin/gift-codes", requireAdmin, async (req, res) => {
    try {
      const parseResult = createGiftCodeSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({ message: parseResult.error.issues[0]?.message || "Donnees invalides" });
      }

      const { code, amount, maxUses, expiresAt } = parseResult.data;

      const existingCode = await storage.getGiftCodeByCode(code);
      if (existingCode) {
        return res.status(400).json({ message: "Ce code existe deja" });
      }

      const giftCode = await storage.createGiftCode({
        code,
        amount: amount.toString(),
        maxUses,
        expiresAt: new Date(expiresAt),
        createdBy: req.session.userId!,
      });

      await storage.logAdminAction(req.session.userId!, "create_gift_code", null, `Code cadeau cree: ${code} - ${amount} FCFA`);
      res.json(giftCode);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.delete("/api/admin/gift-codes/:id", requireAdmin, async (req, res) => {
    try {
      const id = parseInt(getRouteParam(req.params.id));
      await storage.deleteGiftCode(id);
      await storage.logAdminAction(req.session.userId!, "delete_gift_code", null, `Code cadeau supprimé: #${id}`);
      res.json({ success: true });
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  const claimGiftCodeSchema = z.object({
    code: z.string().min(1, "Le code est requis"),
  });

  app.post("/api/gift-codes/claim", requireAuth, async (req, res) => {
    try {
      const parseResult = claimGiftCodeSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({ message: parseResult.error.issues[0]?.message || "Le code est requis" });
      }

      const code = parseResult.data.code.trim().toUpperCase();
      const userId = req.session.userId!;

      const giftCode = await storage.getGiftCodeByCode(code);
      if (!giftCode) {
        return res.status(404).json({ message: "Code invalide" });
      }

      if (!giftCode.isActive) {
        return res.status(400).json({ message: "Ce code n'est plus actif" });
      }

      if (new Date() > new Date(giftCode.expiresAt)) {
        return res.status(400).json({ message: "Ce code a expiré" });
      }

      if (giftCode.currentUses >= giftCode.maxUses) {
        return res.status(400).json({ message: "Ce code a atteint sa limite d'utilisation" });
      }

      const hasClaimed = await storage.hasUserClaimedGiftCode(userId, giftCode.id);
      if (hasClaimed) {
        return res.status(400).json({ message: "Vous avez déjà utilisé ce code" });
      }

      await storage.claimGiftCode(userId, giftCode.id, parseFloat(giftCode.amount));
      
      res.json({ 
        success: true, 
        message: `Félicitations! Vous avez reçu ${parseFloat(giftCode.amount).toLocaleString()} FCFA`,
        amount: parseFloat(giftCode.amount)
      });
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  // Countries routes (public)
  app.get("/api/countries", async (req, res) => {
    try {
      const activeCountries = await storage.getActiveCountries();
      res.json(activeCountries);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/deposit/provider/:country", requireAuth, async (req, res) => {
    try {
      const country = getRouteParam(req.params.country).toUpperCase();
      const active = await storage.getActiveCountries();
      if (!active.some(c => c.code.toUpperCase() === country)) {
        return res.status(404).json({ message: "Pays indisponible" });
      }
      const settings = await storage.getSettings();
      const enabledCodes = (value: string | undefined) =>
        (value || "").split(",").map(code => code.trim().toUpperCase()).filter(Boolean);
      const ashtechCountries = enabledCodes(settings.ashtechCountries);
      const providers: Array<{ provider: "ashtech" | "sendavapay" | "drimpay"; name: string }> = [];
      if (settings.ashtechEnabled === "true" && ashtechCountries.includes(country)) {
        providers.push({ provider: "ashtech", name: settings.ashtechChannelName || "AshtechPay" });
      }
      if (settings.sendavapayEnabled === "true") {
        providers.push({ provider: "sendavapay", name: settings.sendavapayChannelName || "SendavaPay" });
      }
      if (
        isDrimPayConfigured() &&
        isDrimPayWebhookConfigured() &&
        isDrimPayCountryEnabled(settings, "Payin", country)
      ) {
        providers.push({ provider: "drimpay", name: "DrimPay" });
      }
      if (providers.length > 0) {
        return res.json({ ...providers[0], providers });
      }
      return res.status(503).json({ message: "Aucun canal de paiement disponible", provider: "sendavapay", name: "SendavaPay" });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Admin country routes
  app.get("/api/admin/countries", requireAdmin, async (req, res) => {
    try {
      const allCountries = await storage.getCountries();
      res.json(allCountries);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/admin/countries", requireAdmin, async (req, res) => {
    try {
      const { code, name, currency, phonePrefix, operators, isActive } = req.body;
      if (!code || !name || !currency || !phonePrefix) {
        return res.status(400).json({ message: "Code, nom, devise et indicatif sont requis" });
      }
      const country = await storage.createCountry({
        code: code.toUpperCase(),
        name,
        currency,
        phonePrefix,
        operators: operators || "[]",
        isActive: isActive !== undefined ? isActive : true,
      });
      res.json(country);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.put("/api/admin/countries/:id", requireAdmin, async (req, res) => {
    try {
      const id = parseInt(getRouteParam(req.params.id));
      const { code, name, currency, phonePrefix, operators, isActive } = req.body;
      const updateData: any = {};
      if (name !== undefined) updateData.name = name;
      if (currency !== undefined) updateData.currency = currency;
      if (phonePrefix !== undefined) updateData.phonePrefix = phonePrefix;
      if (operators !== undefined) updateData.operators = operators;
      if (isActive !== undefined) updateData.isActive = isActive;
      const country = await storage.updateCountry(id, updateData);
      res.json(country);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.delete("/api/admin/countries/:id", requireAdmin, async (req, res) => {
    try {
      const id = parseInt(getRouteParam(req.params.id));
      await storage.deleteCountry(id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  // ==================== BANKER ROUTES ====================
  // Accessible to both admins and bankers

  app.get("/api/banker/deposits", requireBanker, async (req, res) => {
    try {
      const deposits = await storage.getDeposits();
      res.json(deposits);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/banker/withdrawals", requireBanker, async (req, res) => {
    try {
      const withdrawals = await storage.getWithdrawals();
      res.json(withdrawals);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/banker/deposits/:id/approve", requireBanker, async (req, res) => {
    try {
      const deposit = await storage.approveDepositAndCredit(
        parseInt(getRouteParam(req.params.id)),
        req.session.userId!,
        "Dépôt validé par bankier",
      );
      if (!deposit) return res.status(409).json({ message: "Ce dépôt a déjà été traité." });
      res.json(deposit);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.post("/api/banker/deposits/:id/reject", requireBanker, async (req, res) => {
    try {
      const deposit = await storage.rejectDeposit(
        parseInt(getRouteParam(req.params.id)),
        req.session.userId!,
        true,
      );
      if (!deposit) return res.status(409).json({ message: "Ce dépôt a déjà été traité." });
      res.json(deposit);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.post("/api/banker/withdrawals/:id/approve", requireBanker, async (req, res) => {
    try {
      const withdrawalId = parseInt(getRouteParam(req.params.id));
      const existing = await storage.getWithdrawal(withdrawalId);
      if (!existing) return res.status(404).json({ message: "Retrait non trouvé" });
      const withdrawal = await storage.finalizeWithdrawal(
        withdrawalId,
        "approved",
        req.session.userId!,
        {},
        undefined,
        ["pending"],
      );
      if (!withdrawal) return res.status(409).json({ message: "Ce retrait a déjà été traité." });
      res.json(withdrawal);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.post("/api/banker/withdrawals/:id/reject", requireBanker, async (req, res) => {
    try {
      const withdrawal = await storage.finalizeWithdrawal(
        parseInt(getRouteParam(req.params.id)),
        "rejected",
        req.session.userId!,
        {},
        "Banker",
        ["pending"],
      );
      if (!withdrawal) return res.status(409).json({ message: "Ce retrait a déjà été traité." });
      res.json(withdrawal);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  return httpServer;
}
