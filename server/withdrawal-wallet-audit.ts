import type { WithdrawalWallet } from "../shared/schema";

export type WithdrawalWalletAuditAction =
  | "created"
  | "updated"
  | "deleted"
  | "default_changed";

export type WithdrawalWalletAuditActor = {
  userId: number;
  role: "user" | "admin";
};

type WalletSnapshot = Pick<
  WithdrawalWallet,
  "accountName" | "accountNumber" | "paymentMethod" | "country"
>;

export function createWithdrawalWalletAuditRecord(params: {
  targetUserId: number;
  walletId: number | null;
  actor: WithdrawalWalletAuditActor;
  action: WithdrawalWalletAuditAction;
  before?: WalletSnapshot | null;
  after?: WalletSnapshot | null;
}) {
  const { targetUserId, walletId, actor, action, before, after } = params;

  return {
    userId: targetUserId,
    walletId,
    actorUserId: actor.userId,
    actorRole: actor.role,
    action,
    oldAccountName: before?.accountName ?? null,
    oldAccountNumber: before?.accountNumber ?? null,
    oldPaymentMethod: before?.paymentMethod ?? null,
    oldCountry: before?.country ?? null,
    newAccountName: after?.accountName ?? null,
    newAccountNumber: after?.accountNumber ?? null,
    newPaymentMethod: after?.paymentMethod ?? null,
    newCountry: after?.country ?? null,
  } as const;
}

export function areWithdrawalWalletDetailsEqual(
  left: WalletSnapshot,
  right: WalletSnapshot,
): boolean {
  return left.accountName === right.accountName
    && left.accountNumber === right.accountNumber
    && left.paymentMethod === right.paymentMethod
    && left.country === right.country;
}
