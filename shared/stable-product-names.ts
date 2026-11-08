export const FIRST_STABLE_PRODUCT_VIP_LEVEL = 1;

type StableProductNameSource = {
  name: string;
  productType: string;
};

export function formatStableProductName(vipLevel: number): string {
  if (!Number.isSafeInteger(vipLevel) || vipLevel < FIRST_STABLE_PRODUCT_VIP_LEVEL) {
    throw new RangeError("Le niveau VIP du produit stable est invalide.");
  }
  return `Buy to become VIP${vipLevel}`;
}

export function getNextStableProductVipLevel(products: readonly StableProductNameSource[]): number {
  const stableProducts = products.filter((product) => product.productType === "stable");
  const largestExistingVipLevel = stableProducts.reduce((largest, product) => {
    const match = product.name.trim().match(/^Buy to become VIP(\d+)$/i);
    return match ? Math.max(largest, Number(match[1])) : largest;
  }, FIRST_STABLE_PRODUCT_VIP_LEVEL - 1);

  return Math.max(
    FIRST_STABLE_PRODUCT_VIP_LEVEL + stableProducts.length,
    largestExistingVipLevel + 1,
  );
}
