export const INVITATION_TASK_KEY_PREFIX = "invite_level1_";

export const INVITATION_TASK_DEFAULTS = [
  { taskKey: "invite_level1_3", requiredInvites: 3, reward: 500 },
  { taskKey: "invite_level1_5", requiredInvites: 5, reward: 1200 },
  { taskKey: "invite_level1_10", requiredInvites: 10, reward: 3500 },
  { taskKey: "invite_level1_30", requiredInvites: 30, reward: 14000 },
  { taskKey: "invite_level1_100", requiredInvites: 100, reward: 30000 },
].map((tier, index) => ({
  ...tier,
  name: tier.taskKey,
  description: `Inviter ${tier.requiredInvites} personnes à investir`,
  sortOrder: 101 + index,
  isActive: true,
}));

export function calculateInvitationRewardTopUp(previouslyCredited: number, targetReward: number): number {
  if (!Number.isFinite(previouslyCredited) || !Number.isFinite(targetReward)) return 0;
  return Math.max(0, targetReward - previouslyCredited);
}

export interface ReferralProductPurchase {
  userId: number;
  purchaseProductType: string | null;
  productType: string;
  purchasePrice: number | string | null;
  productPrice: number | string;
  isFree: boolean;
  assignedByAdmin: boolean;
}

export function countQualifiedDirectReferrals(
  referrals: Array<{ id: number; hasDeposited: boolean }>,
  approvedDepositUserIds: number[],
  productPurchases: ReferralProductPurchase[],
): number {
  const depositedIds = new Set([
    ...referrals.filter(referral => referral.hasDeposited).map(referral => referral.id),
    ...approvedDepositUserIds,
  ]);
  const purchasedIds = new Set(
    productPurchases
      .filter(purchase => {
        const productType = purchase.purchaseProductType ?? purchase.productType;
        const price = Number(purchase.purchasePrice ?? purchase.productPrice);
        return productType === "stable"
          && !purchase.isFree
          && !purchase.assignedByAdmin
          && Number.isFinite(price)
          && price > 0;
      })
      .map(purchase => purchase.userId),
  );

  return new Set(
    referrals
      .filter(referral => depositedIds.has(referral.id) && purchasedIds.has(referral.id))
      .map(referral => referral.id),
  ).size;
}
