import assert from "node:assert/strict";
import test from "node:test";
import { createInpaySignature, findVerifiedAccount } from "./inpay";

test("InPay callbacks must verify with the transaction's country credentials", () => {
  const previousTgKey = process.env.INPAY_API_KEY_TG;
  const previousCiKey = process.env.INPAY_API_KEY_CI;
  try {
    process.env.INPAY_API_KEY_TG = "test-togo-key";
    process.env.INPAY_API_KEY_CI = "test-ivory-coast-key";

    const settings = {
      inpayMerchantId_TG: "merchant-tg",
      inpayMerchantId_CI: "merchant-ci",
    };
    const payload = {
      merchantid: "merchant-ci",
      out_trade_no: "PAYIN-17-22",
      status: "payin_success",
    };
    const signedPayload = {
      ...payload,
      sign: createInpaySignature(payload, "test-ivory-coast-key"),
    };

    assert.equal(findVerifiedAccount(signedPayload, settings, "CI")?.country, "CI");
    assert.equal(findVerifiedAccount(signedPayload, settings, "TG"), undefined);
  } finally {
    if (previousTgKey === undefined) delete process.env.INPAY_API_KEY_TG;
    else process.env.INPAY_API_KEY_TG = previousTgKey;
    if (previousCiKey === undefined) delete process.env.INPAY_API_KEY_CI;
    else process.env.INPAY_API_KEY_CI = previousCiKey;
  }
});
