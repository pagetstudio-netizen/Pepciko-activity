export interface TeamProductPurchaseRecord {
  userId: number;
  purchasePrice: number | string | null;
  currentProductPrice: number | string;
  isFree: boolean;
  assignedByAdmin: boolean;
  isActive: boolean;
}

export interface TeamProductPurchaseSummary {
  totalInvested: number;
  hasPurchasedProduct: boolean;
  hasActivePurchasedProduct: boolean;
}

export function summarizeTeamProductPurchases(
  purchases: TeamProductPurchaseRecord[],
): Map<number, TeamProductPurchaseSummary> {
  const summaries = new Map<number, TeamProductPurchaseSummary>();

  for (const purchase of purchases) {
    const amount = Number(purchase.purchasePrice ?? purchase.currentProductPrice);
    if (
      purchase.assignedByAdmin
      || purchase.isFree
      || !Number.isFinite(amount)
      || amount <= 0
    ) {
      continue;
    }

    const summary = summaries.get(purchase.userId) ?? {
      totalInvested: 0,
      hasPurchasedProduct: false,
      hasActivePurchasedProduct: false,
    };
    summary.totalInvested += amount;
    summary.hasPurchasedProduct = true;
    summary.hasActivePurchasedProduct ||= purchase.isActive;
    summaries.set(purchase.userId, summary);
  }

  return summaries;
}
