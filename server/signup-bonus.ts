export function resolveSignupBonus(value: unknown): number {
  const amount = typeof value === "number" || typeof value === "string"
    ? Number(value)
    : Number.NaN;
  return Number.isSafeInteger(amount) && amount >= 0 ? amount : 0;
}
