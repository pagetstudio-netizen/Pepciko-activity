export function isValidWellnessCycleDays(value: unknown): value is number {
  return typeof value === "number"
    && Number.isSafeInteger(value)
    && value > 0;
}

export function getWellnessCardTotalRevenue(purchasePrice: number, totalProfit: number): number {
  return purchasePrice + totalProfit;
}

export function getWellnessDailyEarnings(totalCycleRevenue: number, cycleDays: number): number {
  if (
    !Number.isSafeInteger(totalCycleRevenue)
    || totalCycleRevenue <= 0
    || !Number.isSafeInteger(cycleDays)
    || cycleDays <= 0
  ) {
    return 0;
  }

  return Math.floor(totalCycleRevenue / cycleDays);
}
