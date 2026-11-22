export function isValidWellnessCycleDays(value: unknown): value is number {
  return typeof value === "number"
    && Number.isSafeInteger(value)
    && value > 0;
}

export function getWellnessCardTotalRevenue(purchasePrice: number, totalProfit: number): number {
  return purchasePrice + totalProfit;
}

export function getWellnessDailyEarnings(totalCycleProfit: number, cycleDays: number): number {
  if (
    !Number.isSafeInteger(totalCycleProfit)
    || totalCycleProfit <= 0
    || !Number.isSafeInteger(cycleDays)
    || cycleDays <= 0
  ) {
    return 0;
  }

  return Math.floor(totalCycleProfit / cycleDays);
}
