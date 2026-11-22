import crypto from "node:crypto";

const ASHTECHPAY_API_BASE =
  process.env.ASHTECHPAY_API_BASE ||
  process.env.ASHTECH_API_BASE ||
  "https://www.ashtechpay.com";

export interface AshtechCountry {
  code: string;
  name: string;
  currency: string;
  operators: Array<string | { code?: string; id?: string; name?: string }>;
}

function ashtechOperatorValues(operator: AshtechCountry["operators"][number]): string[] {
  if (typeof operator === "string") return [operator];
  return [operator.code, operator.id, operator.name].filter(
    (value): value is string => typeof value === "string" && value.trim().length > 0,
  );
}

function isExcludedBurkinaOperator(countryCode: string, operator: AshtechCountry["operators"][number]): boolean {
  if (countryCode.trim().toUpperCase() !== "BF") return false;
  return ashtechOperatorValues(operator).some((value) =>
    value.toLowerCase().replace(/[^a-z0-9]/g, "").includes("ligdicash"),
  );
}

export function filterAshtechCountryOperators(countries: AshtechCountry[]): AshtechCountry[] {
  return countries.map((country) => ({
    ...country,
    operators: country.operators.filter(
      (operator) => !isExcludedBurkinaOperator(country.code, operator),
    ),
  }));
}

export function isAshtechOperatorActive(
  country: AshtechCountry,
  requestedOperator: string,
): boolean {
  if (country.operators.some((operator) => isExcludedBurkinaOperator(country.code, operator))) {
    // Reject the excluded operator even if a client submits it directly rather
    // than selecting from the filtered catalogue.
    if (requestedOperator.toLowerCase().replace(/[^a-z0-9]/g, "").includes("ligdicash")) {
      return false;
    }
  }
  const requested = requestedOperator.trim().toLowerCase();
  return country.operators.some((operator) =>
    !isExcludedBurkinaOperator(country.code, operator)
    && ashtechOperatorValues(operator).some((value) => value.trim().toLowerCase() === requested),
  );
}

export interface AshtechCollectParams {
  amount: number;
  currency: string;
  phone: string;
  operator: string;
  countryCode: string;
  reference: string;
  notifyUrl: string;
  otp?: string;
}

export interface AshtechCollectResponse {
  transaction_id: string;
  reference: string;
  status: string;
  amount: number;
  credited_amount?: number;
  fee_amount?: number;
  currency: string;
  operator?: string;
  phone?: string;
  country_code?: string;
  wave_url?: string;
  ussd_code?: string | null;
  message?: string;
  flow?: string;
}

export function ashtechTransactionMatches(
  transaction: AshtechCollectResponse,
  expected: {
    amount: number;
    countryCode: string;
    reference?: string | null;
    transactionId?: string | null;
    currency?: string;
  },
): boolean {
  if (!Number.isFinite(Number(transaction.amount)) || Number(transaction.amount) !== Number(expected.amount)) {
    return false;
  }
  if (
    transaction.country_code &&
    transaction.country_code.trim().toUpperCase() !== expected.countryCode.trim().toUpperCase()
  ) {
    return false;
  }
  if (transaction.reference && expected.reference && transaction.reference !== expected.reference) {
    return false;
  }
  if (
    transaction.transaction_id &&
    expected.transactionId &&
    transaction.transaction_id !== expected.transactionId
  ) {
    return false;
  }
  if (
    expected.currency &&
    transaction.currency &&
    transaction.currency.trim().toUpperCase() !== expected.currency.trim().toUpperCase()
  ) {
    return false;
  }
  return true;
}

export class AshtechApiError extends Error {
  status: number;
  data: Record<string, any>;

  constructor(status: number, data: Record<string, any>) {
    super(data?.message || data?.error || `AshtechPay HTTP ${status}`);
    this.name = "AshtechApiError";
    this.status = status;
    this.data = data;
  }
}

function getApiKey() {
  const key = process.env.ASHTECH_API_KEY || process.env.ASHTECHPAY_API_KEY;
  if (!key) {
    throw new Error("AshtechPay non configuré : ASHTECH_API_KEY est manquante");
  }
  return key;
}

function getAshtechProfileUserId() {
  const userId = process.env.ASHTECHPAY_USER_ID?.trim();
  if (!userId) {
    throw new Error("AshtechPay non configuré : ASHTECHPAY_USER_ID est manquant");
  }
  return userId;
}

async function ashtechRequest(path: string, init: RequestInit = {}) {
  const response = await fetch(`${ASHTECHPAY_API_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${getApiKey()}`,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new AshtechApiError(response.status, data);
  }
  return data;
}

export async function getCountries(): Promise<AshtechCountry[]> {
  const data = await ashtechRequest("/v1/countries");
  return Array.isArray(data) ? data : data.countries || [];
}

export async function collectPayment(params: AshtechCollectParams): Promise<AshtechCollectResponse> {
  const userId = getAshtechProfileUserId();
  return ashtechRequest("/v1/collect", {
    method: "POST",
    body: JSON.stringify({
      user_id: userId,
      amount: params.amount,
      currency: params.currency,
      phone: params.phone,
      operator: params.operator,
      country_code: params.countryCode,
      reference: params.reference,
      notify_url: params.notifyUrl,
      ...(params.otp ? { otp: params.otp } : {}),
    }),
  });
}

export async function getTransaction(transactionId: string): Promise<AshtechCollectResponse> {
  const userId = getAshtechProfileUserId();
  const query = new URLSearchParams({ user_id: userId });
  return ashtechRequest(`/v1/transaction/${encodeURIComponent(transactionId)}?${query.toString()}`);
}

export function mapAshtechStatus(status: string | undefined): "pending" | "approved" | "rejected" {
  const normalized = String(status || "").toLowerCase();
  if (["success", "completed", "confirmed", "approved"].includes(normalized)) return "approved";
  if (["failed", "expired", "cancelled", "canceled", "rejected"].includes(normalized)) return "rejected";
  return "pending";
}

export function isAshtechConfigured() {
  return Boolean(process.env.ASHTECH_API_KEY || process.env.ASHTECHPAY_API_KEY);
}

export function verifyAshtechWebhookSignature(
  rawBody: string | Buffer,
  timestamp: string,
  signature: string,
  secret: string,
) {
  if (!rawBody || !timestamp || !signature || !secret) return false;
  const receivedHex = signature.replace(/^sha256=/i, "").trim();
  if (!/^[a-f0-9]{64}$/i.test(receivedHex)) return false;

  const expectedHex = crypto
    .createHmac("sha256", secret)
    .update(`${timestamp}.${rawBody}`)
    .digest("hex");

  return crypto.timingSafeEqual(
    Buffer.from(receivedHex, "hex"),
    Buffer.from(expectedHex, "hex"),
  );
}
