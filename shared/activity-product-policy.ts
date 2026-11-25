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

export function getActivityProfit(totalPayout: number, purchasePrice: number): number {
  if (
    !Number.isSafeInteger(totalPayout)
    || totalPayout <= 0
    || !Number.isSafeInteger(purchasePrice)
    || purchasePrice <= 0
    || totalPayout <= purchasePrice
  ) {
    return 0;
  }

  return totalPayout - purchasePrice;
}

export function getActivityDailyProfit(
  totalPayout: number,
  purchasePrice: number,
  cycleDays: number,
): number {
  const totalProfit = getActivityProfit(totalPayout, purchasePrice);
  if (!Number.isSafeInteger(cycleDays) || cycleDays <= 0 || totalProfit <= 0) return 0;
  return totalProfit / cycleDays;
}

export function getActivityProductRank(name: string): number | null {
  const match = name.match(/\bVIP\s*(\d+)\b/i);
  if (!match) return null;

  const rank = Number(match[1]);
  return Number.isSafeInteger(rank) && rank > 0 ? rank : null;
}

export function compareActivityProductOrder(
  left: { id: number; name: string; price: number },
  right: { id: number; name: string; price: number },
): number {
  const leftRank = getActivityProductRank(left.name) ?? Number.MAX_SAFE_INTEGER;
  const rightRank = getActivityProductRank(right.name) ?? Number.MAX_SAFE_INTEGER;
  return leftRank - rightRank || left.price - right.price || left.id - right.id;
}
