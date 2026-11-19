export function calculateNetAdminBalanceCredit(
  previousDepositBalance: number,
  previousWithdrawalBalance: number,
  nextDepositBalance: number,
  nextWithdrawalBalance: number,
): number {
  const netIncrease = Number((
    nextDepositBalance
    + nextWithdrawalBalance
    - previousDepositBalance
    - previousWithdrawalBalance
  ).toFixed(2));

  if (netIncrease <= 0) return 0;
  if (!Number.isSafeInteger(netIncrease)) {
    throw new Error("Un crédit Admin doit être un montant entier en FCFA pour être enregistré comme dépôt approuvé.");
  }
  return netIncrease;
}
