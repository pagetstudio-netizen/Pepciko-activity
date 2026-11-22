import assert from "node:assert/strict";
import test from "node:test";
import {
  areWithdrawalWalletDetailsEqual,
  createWithdrawalWalletAuditRecord,
} from "./withdrawal-wallet-audit.ts";

const previous = {
  accountName: "Titulaire",
  accountNumber: "90000000",
  paymentMethod: "Togocel",
  country: "TG",
};

test("wallet audit records retain before/after snapshots and actor", () => {
  const record = createWithdrawalWalletAuditRecord({
    targetUserId: 7,
    walletId: 3,
    actor: { userId: 7, role: "user" },
    action: "updated",
    before: previous,
    after: { ...previous, accountNumber: "91000000" },
  });

  assert.equal(record.userId, 7);
  assert.equal(record.actorRole, "user");
  assert.equal(record.oldAccountNumber, "90000000");
  assert.equal(record.newAccountNumber, "91000000");
  assert.equal(record.oldPaymentMethod, "Togocel");
  assert.equal(record.newPaymentMethod, "Togocel");
});

test("wallet details comparison ignores no actual changes", () => {
  assert.equal(areWithdrawalWalletDetailsEqual(previous, { ...previous }), true);
  assert.equal(
    areWithdrawalWalletDetailsEqual(previous, { ...previous, accountNumber: "91000000" }),
    false,
  );
});

test("wallet creation audit has no old account snapshot", () => {
  const record = createWithdrawalWalletAuditRecord({
    targetUserId: 7,
    walletId: 3,
    actor: { userId: 7, role: "user" },
    action: "created",
    after: previous,
  });

  assert.equal(record.oldAccountNumber, null);
  assert.equal(record.newAccountNumber, previous.accountNumber);
});
