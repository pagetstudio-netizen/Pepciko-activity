import assert from "node:assert/strict";
import test from "node:test";
import { calculateNetAdminBalanceCredit } from "./admin-balance-credit";

test("admin balance increases are counted by the net account increase", () => {
  assert.equal(calculateNetAdminBalanceCredit(1000, 500, 3000, 1000), 2500);
});

test("moving funds between wallets does not create an approved deposit", () => {
  assert.equal(calculateNetAdminBalanceCredit(1000, 500, 0, 1500), 0);
});

test("admin balance reductions do not create an approved deposit", () => {
  assert.equal(calculateNetAdminBalanceCredit(1000, 500, 700, 500), 0);
});

test("fractional net credits are rejected because deposits use whole FCFA", () => {
  assert.throws(
    () => calculateNetAdminBalanceCredit(1000, 0, 1000.5, 0),
    /montant entier en FCFA/,
  );
});
