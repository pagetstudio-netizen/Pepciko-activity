import assert from "node:assert/strict";
import test from "node:test";
import { buildRobotPayErrorNotification } from "./telegram";

test("payment error notifications identify providers and hide credentials", () => {
  const message = buildRobotPayErrorNotification({
    provider: "DrimPay",
    operation: "Dépôt ou initiation",
    path: "/api/drimpay/payin",
    method: "POST",
    status: 502,
    userId: 42,
    amount: 3000,
    country: "TG",
    operator: "Moov Africa Togo",
    error: "Request failed: Bearer abc.def and dp_live_sk_123456",
  });

  assert.match(message, /Erreur réelle/);
  assert.match(message, /Erreur de paiement — DrimPay/);
  assert.match(message, /Request failed/);
  assert.match(message, /Utilisateur ID : <code>42<\/code>/);
  assert.doesNotMatch(message, /abc\.def|dp_live_sk_123456/);
});

test("payment error notifications redact OTP and phone data but preserve provider detail", () => {
  const message = buildRobotPayErrorNotification({
    provider: "AshTechPay",
    path: "/api/ashtechpay/collect",
    method: "POST",
    status: 400,
    error: "OTP=735104 rejected for phone +22670123456: invalid account balance",
  });

  assert.match(message, /invalid account balance/);
  assert.doesNotMatch(message, /735104|\+22670123456/);
  assert.match(message, /OTP=\[masqué\]/i);
  assert.match(message, /phone=\[numéro masqué\]/i);
});
