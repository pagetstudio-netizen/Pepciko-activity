/**
 * Returns the canonical Benin national mobile number used by PPayPros.
 * Accepts eight local digits, the national 01 + eight-digit form, or either
 * form with Benin's 229 country code.
 */
export function normalizeBeninPhone(value: unknown): string | null {
  if (typeof value !== "string" && typeof value !== "number") return null;

  const raw = String(value).trim();
  let digits = String(value).replace(/\D/g, "");
  if (raw.startsWith("00") && digits.startsWith("00229")) {
    digits = digits.slice(5);
  } else if (raw.startsWith("+") && digits.startsWith("229")) {
    digits = digits.slice(3);
  } else if (digits.startsWith("229") && [11, 13].includes(digits.length)) {
    const afterCountryCode = digits.slice(3);
    if (/^\d{8}$/.test(afterCountryCode) || /^01\d{8}$/.test(afterCountryCode)) {
      digits = afterCountryCode;
    }
  }

  if (/^\d{8}$/.test(digits)) return `01${digits}`;
  if (/^01\d{8}$/.test(digits)) return digits;
  return null;
}

const PPAYPROS_COUNTRY_PHONE_RULES: Record<
  string,
  { callingCode: string; valid: (digits: string) => boolean; message: string }
> = {
  TG: {
    callingCode: "228",
    valid: (digits) => /^\d{8}$/.test(digits),
    message: "Le numéro togolais doit contenir 8 chiffres.",
  },
  CI: {
    callingCode: "225",
    valid: (digits) => /^0\d{9}$/.test(digits),
    message: "Le numéro ivoirien doit commencer par 0 et contenir 10 chiffres.",
  },
  CM: {
    callingCode: "237",
    valid: (digits) => /^(?:[1-9]\d{8}|0\d{9})$/.test(digits),
    message: "Le numéro camerounais doit contenir 9 chiffres (sans 0 initial) ou 10 chiffres (avec 0 initial).",
  },
};

/**
 * Normalizes the registered account phone for PPayPros without guessing
 * another country's format. Benin keeps its existing 01 + 8 digit rule.
 */
export function normalizePpayProsPhone(country: string, value: unknown): string | null {
  const code = country.trim().toUpperCase();
  if (code === "BJ") return normalizeBeninPhone(value);
  const rule = PPAYPROS_COUNTRY_PHONE_RULES[code];
  if (!rule || (typeof value !== "string" && typeof value !== "number")) return null;

  const raw = String(value).trim();
  let digits = raw.replace(/\D/g, "");
  const explicitInternationalPrefix = raw.startsWith("+") || raw.startsWith("00");
  if (raw.startsWith("00")) digits = digits.slice(2);

  const localLengthIsValid = rule.valid(digits);
  if (!localLengthIsValid && digits.startsWith(rule.callingCode)) {
    const withoutCountryCode = digits.slice(rule.callingCode.length);
    if (rule.valid(withoutCountryCode) || explicitInternationalPrefix) {
      digits = withoutCountryCode;
    }
  }

  return rule.valid(digits) ? digits : null;
}

export function getPpayProsPhoneError(country: string): string {
  const code = country.trim().toUpperCase();
  if (code === "BJ") {
    return "Le numéro béninois doit contenir 8 chiffres locaux ou commencer par 01 et contenir 10 chiffres.";
  }
  return PPAYPROS_COUNTRY_PHONE_RULES[code]?.message || `Le format de numéro PPayPros pour ${code || "ce pays"} n'est pas configuré.`;
}

export function isPpayProsPhoneFormatSupported(country: string): boolean {
  const code = country.trim().toUpperCase();
  return code === "BJ" || Object.prototype.hasOwnProperty.call(PPAYPROS_COUNTRY_PHONE_RULES, code);
}