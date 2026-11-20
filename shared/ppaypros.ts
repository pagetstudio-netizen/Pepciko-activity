export const PPAYPROS_COUNTRIES = [
  { code: "BJ", name: "Bénin", wayCode: "850", callingCode: "229", payoutAccountCode: "Bank" },
  { code: "TG", name: "Togo", wayCode: "710", callingCode: "228", payoutAccountCode: "Bank" },
  { code: "CI", name: "Côte d’Ivoire", wayCode: "837", callingCode: "225", payoutAccountCode: "Bank" },
  { code: "CM", name: "Cameroun", wayCode: "890", callingCode: "237", payoutAccountCode: "ORANGE/MTN" },
  { code: "BF", name: "Burkina Faso", wayCode: "", callingCode: "226", payoutAccountCode: "" },
] as const;

export type PpayProsCountryCode = (typeof PPAYPROS_COUNTRIES)[number]["code"];

const PPayProsSameCountryDepositLabels: Record<string, string> = {
  BJ: "au Bénin",
  TG: "au Togo",
  CI: "en Côte d’Ivoire",
  CM: "au Cameroun",
};

export function getPpayProsCountryRegistrationMessage(countryCode: string): string | null {
  const label = PPayProsSameCountryDepositLabels[countryCode.trim().toUpperCase()];
  if (!label) return null;
  return `Pour effectuer un dépôt ${label}, vous devez avoir un compte enregistré ${label}.`;
}
