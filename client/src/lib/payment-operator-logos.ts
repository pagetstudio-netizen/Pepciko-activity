const OPERATOR_LOGOS: Array<{ matches: string[]; src: string }> = [
  { matches: ["togocel"], src: "/operators/togocel.png" },
  { matches: ["tmoney", "tmixx", "mixx"], src: "/operators/mixx-tg.png" },
  { matches: ["moov"], src: "/operators/moov-africa.png" },
  { matches: ["mtn"], src: "/operators/mtn-mobile-money.png" },
  { matches: ["orange"], src: "/operators/orange-money-mark.png" },
  { matches: ["wave"], src: "/operators/wave-logo.png" },
  { matches: ["airtel"], src: "/operators/airtel.png" },
];

export function getPaymentOperatorLogo(name: string | null | undefined): string | null {
  const normalized = String(name || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

  if (!normalized) return null;
  return OPERATOR_LOGOS.find(({ matches }) => matches.some((match) => normalized.includes(match)))?.src ?? null;
}
