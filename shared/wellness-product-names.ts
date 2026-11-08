type NamedProduct = {
  name: string;
  productType: string;
};

export function formatWellnessProductName(sequence: number): string {
  if (!Number.isSafeInteger(sequence) || sequence < 1) {
    throw new RangeError("Le numéro du produit Bien-être est invalide.");
  }

  return sequence === 1 ? "Diwali Gift" : `VIP${sequence - 1} welfare`;
}

export function getNextWellnessProductNumber(products: NamedProduct[]): number {
  const wellnessProducts = products.filter((product) => product.productType === "wellness");
  const largestNamedSequence = wellnessProducts.reduce((largest, product) => {
    if (product.name === "Diwali Gift") return Math.max(largest, 1);
    const match = /^VIP(\d+) welfare$/i.exec(product.name.trim());
    const vipLevel = Number(match?.[1]);
    return Number.isSafeInteger(vipLevel) && vipLevel > 0
      ? Math.max(largest, vipLevel + 1)
      : largest;
  }, 0);

  return Math.max(wellnessProducts.length + 1, largestNamedSequence + 1);
}
