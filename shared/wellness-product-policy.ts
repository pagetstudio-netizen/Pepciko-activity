export function isValidWellnessCycleDays(value: unknown): value is number {
  return typeof value === "number"
    && Number.isSafeInteger(value)
    && value > 0;
}

export function getWellnessCardTotalRevenue(purchasePrice: number, totalProfit: number): number {
  return purchasePrice + totalProfit;
}
