export function calculateMaturityPayout(totalReturn: number, prepaidEarnings: number): number {
  const safeTotalReturn = Number.isFinite(totalReturn) ? Math.max(0, totalReturn) : 0;
  const safePrepaidEarnings = Number.isFinite(prepaidEarnings) ? Math.max(0, prepaidEarnings) : 0;
  return Math.max(0, safeTotalReturn - safePrepaidEarnings);
}

export function getProductPayoutMode(productType: string): "daily" | "maturity" {
  return productType === "wellness" ? "daily" : "maturity";
}

export function calculateWellnessDailyPayout(
  totalCycleRevenue: number,
  cycleDays: number,
  daysAlreadyCompleted: number,
  daysToAccrue: number,
  alreadyPaid: number,
): number {
  if (
    !Number.isSafeInteger(totalCycleRevenue)
    || totalCycleRevenue <= 0
    || !Number.isSafeInteger(cycleDays)
    || cycleDays <= 0
  ) {
    return 0;
  }

  const completed = Number.isSafeInteger(daysAlreadyCompleted)
    ? Math.min(cycleDays, Math.max(0, daysAlreadyCompleted))
    : 0;
  const cycles = Number.isSafeInteger(daysToAccrue)
    ? Math.max(0, daysToAccrue)
    : 0;
  if (cycles === 0 || completed >= cycleDays) return 0;

  const firstDay = completed + 1;
  const lastDay = Math.min(cycleDays, completed + cycles);
  const scheduledDays = lastDay - firstDay + 1;
  const baseAmount = Math.floor(totalCycleRevenue / cycleDays);
  const remainder = totalCycleRevenue % cycleDays;
  const remainderDays = Math.max(0, Math.min(lastDay, remainder) - firstDay + 1);
  const scheduledAmount = scheduledDays * baseAmount + remainderDays;
  const safeAlreadyPaid = Number.isFinite(alreadyPaid) ? Math.max(0, alreadyPaid) : 0;
  const remainingRevenue = Math.max(0, totalCycleRevenue - safeAlreadyPaid);

  return Math.min(remainingRevenue, scheduledAmount);
}

export function calculateDailyPayoutCatchUp(
  accruedEarnings: number,
  alreadyPaid: number,
): number {
  const safeAccrued = Number.isFinite(accruedEarnings) ? Math.max(0, accruedEarnings) : 0;
  const safePaid = Number.isFinite(alreadyPaid) ? Math.max(0, alreadyPaid) : 0;
  return Math.max(0, safeAccrued - safePaid);
}
