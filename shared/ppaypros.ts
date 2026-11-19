export const PPAYPROS_COUNTRIES = [
  { code: "BJ", name: "Bénin", wayCode: "850", callingCode: "229", payoutAccountCode: "Bank" },
  { code: "TG", name: "Togo", wayCode: "710", callingCode: "228", payoutAccountCode: "" },
  { code: "CI", name: "Côte d’Ivoire", wayCode: "837", callingCode: "225", payoutAccountCode: "" },
  { code: "CM", name: "Cameroun", wayCode: "890", callingCode: "237", payoutAccountCode: "" },
  { code: "BF", name: "Burkina Faso", wayCode: "", callingCode: "226", payoutAccountCode: "" },
] as const;

export type PpayProsCountryCode = (typeof PPAYPROS_COUNTRIES)[number]["code"];
