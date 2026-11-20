export function calculateMaturityPayout(totalReturn: number, prepaidEarnings: number): number {
  const safeTotalReturn = Number.isFinite(totalReturn) ? Math.max(0, totalReturn) : 0;
  const safePrepaidEarnings = Number.isFinite(prepaidEarnings) ? Math.max(0, prepaidEarnings) : 0;
  return Math.max(0, safeTotalReturn - safePrepaidEarnings);
}

export function getProductPayoutMode(productType: string): "daily" | "maturity" {
  return productType === "wellness" ? "daily" : "maturity";
}

export function calculateDailyProductPayout(
  totalReturn: number,
  prepaidEarnings: number,
  dailyEarnings: number,
  cyclesToAccrue: number,
  completesCycle: boolean,
): number {
  const remainingReturn = calculateMaturityPayout(totalReturn, prepaidEarnings);
  if (remainingReturn <= 0) return 0;
  if (completesCycle) return remainingReturn;

  const safeDailyEarnings = Number.isFinite(dailyEarnings) ? Math.max(0, dailyEarnings) : 0;
  const safeCycles = Number.isSafeInteger(cyclesToAccrue) ? Math.max(0, cyclesToAccrue) : 0;
  return Math.min(remainingReturn, safeDailyEarnings * safeCycles);
}

export function calculateDailyPayoutCatchUp(
  accruedEarnings: number,
  alreadyPaid: number,
): number {
  const safeAccrued = Number.isFinite(accruedEarnings) ? Math.max(0, accruedEarnings) : 0;
  const safePaid = Number.isFinite(alreadyPaid) ? Math.max(0, alreadyPaid) : 0;
  return Math.max(0, safeAccrued - safePaid);
}
