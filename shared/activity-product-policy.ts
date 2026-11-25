export function getActivityTotalPayout(price: number, fixedProfit: number): number {
  if (
    !Number.isSafeInteger(price)
    || price <= 0
    || !Number.isSafeInteger(fixedProfit)
    || fixedProfit <= 0
    || price + fixedProfit > 2_147_483_647
  ) {
    return 0;
  }

  return price + fixedProfit;
}

export function getActivityDailyProfitEstimate(fixedProfit: number, cycleDays: number): number {
  if (
    !Number.isSafeInteger(fixedProfit)
    || fixedProfit <= 0
    || !Number.isSafeInteger(cycleDays)
    || cycleDays <= 0
  ) {
    return 0;
  }

  return Math.max(1, Math.floor(fixedProfit / cycleDays));
}
