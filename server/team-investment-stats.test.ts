import test from "node:test";
import assert from "node:assert/strict";
import { summarizeTeamProductPurchases } from "./team-investment-stats";

test("team investment stats exclude admin assignments and free products", () => {
  const summaries = summarizeTeamProductPurchases([
    {
      userId: 1,
      purchasePrice: 3000,
      currentProductPrice: 4000,
      isFree: false,
      assignedByAdmin: false,
      isActive: true,
    },
    {
      userId: 1,
      purchasePrice: 5000,
      currentProductPrice: 5000,
      isFree: false,
      assignedByAdmin: true,
      isActive: true,
    },
    {
      userId: 2,
      purchasePrice: 2500,
      currentProductPrice: 2500,
      isFree: true,
      assignedByAdmin: false,
      isActive: true,
    },
  ]);

  assert.deepEqual(summaries.get(1), {
    totalInvested: 3000,
    hasPurchasedProduct: true,
    hasActivePurchasedProduct: true,
  });
  assert.equal(summaries.has(2), false);
});

test("an admin-assigned product alone does not show as purchased or active", () => {
  const summaries = summarizeTeamProductPurchases([
    {
      userId: 7,
      purchasePrice: 10000,
      currentProductPrice: 10000,
      isFree: false,
      assignedByAdmin: true,
      isActive: true,
    },
  ]);

  assert.equal(summaries.has(7), false);
});
