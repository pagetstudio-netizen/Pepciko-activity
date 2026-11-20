import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import {
  createPpayProsPayin,
  createPpayProsPayout,
  createPpayProsSignature,
  formatPpayProsPhone,
  getPpayProsCredentialStatus,
  getPpayProsCredentials,
  getPpayProsDefaultWayCode,
  getPpayProsCountryRegistrationMessage,
  getPpayProsBalance,
  queryPpayProsPayout,
  resolvePpayProsPayoutAccountCode,
  toPpayProsAmount,
} from "./ppaypros";
import {
  normalizeBeninPhone,
  normalizePpayProsPhone,
} from "@shared/phone";

const savedSecrets = new Map<string, string | undefined>();
const testSecretNames = [
  "PPAYPROS_MCH_NO_TG",
  "PPAYPROS_APP_ID_TG",
  "PPAYPROS_PRIVATE_KEY_TG",
  "PPAYPROS_MCH_NO_CI",
  "PPAYPROS_APP_ID_CI",
  "PPAYPROS_PRIVATE_KEY_CI",
  "PPAYPROS_MCH_NO_CM",
  "PPAYPROS_APP_ID_CM",
  "PPAYPROS_PRIVATE_KEY_CM",
  "PPAYPROS_MCH_NO_BJ",
  "PPAYPROS_APP_ID_BJ",
  "PPAYPROS_PRIVATE_KEY_BJ",
  "PPAYPROS_MCH_NO",
  "PPAYPROS_APP_ID",
  "PPAYPROS_PRIVATE_KEY",
];

before(() => {
  for (const name of testSecretNames) {
    savedSecrets.set(name, process.env[name]);
    delete process.env[name];
  }
});

after(() => {
  for (const [name, value] of savedSecrets) {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
});

test("normalizes only the registered country's documented PPayPros phone format", () => {
  assert.equal(normalizePpayProsPhone("TG", "+228 90 12 34 56"), "90123456");
  assert.equal(normalizePpayProsPhone("TG", "22890123456"), "90123456");
  assert.equal(normalizePpayProsPhone("CI", "+225 01 23 45 67 89"), "0123456789");
  assert.equal(normalizePpayProsPhone("CM", "+237 6 70 12 34 56"), "670123456");
  assert.equal(normalizePpayProsPhone("CM", "0670123456"), "0670123456");
  assert.equal(normalizePpayProsPhone("BF", "70123456"), null);
  assert.equal(formatPpayProsPhone("TG", "90123456"), "90123456");
  assert.equal(formatPpayProsPhone("CI", "+225 01 23 45 67 89"), "0123456789");
  assert.equal(formatPpayProsPhone("CM", "+237 6 70 12 34 56"), "670123456");
  assert.equal(normalizeBeninPhone("22912345"), "0122912345");
  assert.equal(normalizeBeninPhone("+229 01 99 35 67 39"), "0199356739");
});

test("explains country-specific registration requirements for PPayPros deposits", () => {
  assert.equal(
    getPpayProsCountryRegistrationMessage("BJ"),
    "Pour effectuer un dépôt au Bénin, vous devez avoir un compte enregistré au Bénin.",
  );
  assert.equal(
    getPpayProsCountryRegistrationMessage("cm"),
    "Pour effectuer un dépôt au Cameroun, vous devez avoir un compte enregistré au Cameroun.",
  );
  assert.equal(
    getPpayProsCountryRegistrationMessage("TG"),
    "Pour effectuer un dépôt au Togo, vous devez avoir un compte enregistré au Togo.",
  );
  assert.equal(
    getPpayProsCountryRegistrationMessage("CI"),
    "Pour effectuer un dépôt en Côte d’Ivoire, vous devez avoir un compte enregistré en Côte d’Ivoire.",
  );
  assert.equal(getPpayProsCountryRegistrationMessage("BF"), null);
});

test("loads isolated country credentials and preserves legacy Benin secrets", () => {
  process.env.PPAYPROS_MCH_NO_TG = "merchant-tg-test";
  process.env.PPAYPROS_APP_ID_TG = "app-tg-test";
  process.env.PPAYPROS_PRIVATE_KEY_TG = "private-tg-test";
  assert.deepEqual(getPpayProsCredentials("TG"), {
    merchantNo: "merchant-tg-test",
    appId: "app-tg-test",
    privateKey: "private-tg-test",
  });
  assert.equal(getPpayProsCredentialStatus("TG").configured, true);

  process.env.PPAYPROS_MCH_NO_BJ = "merchant-bj-partial";
  assert.equal(getPpayProsCredentialStatus("BJ").configured, false);
  assert.throws(() => getPpayProsCredentials("BJ"), /PPAYPROS_APP_ID_BJ/);

  delete process.env.PPAYPROS_MCH_NO_BJ;
  process.env.PPAYPROS_MCH_NO = "legacy-merchant";
  process.env.PPAYPROS_APP_ID = "legacy-app";
  process.env.PPAYPROS_PRIVATE_KEY = "legacy-private";
  assert.equal(getPpayProsCredentialStatus("BJ").usesLegacyBeninSecrets, true);
  assert.equal(getPpayProsCredentials("BJ").merchantNo, "legacy-merchant");
});

test("uses the selected country's payin code, phone, amount units, and credentials", async () => {
  process.env.PPAYPROS_MCH_NO_TG = "merchant-tg-test";
  process.env.PPAYPROS_APP_ID_TG = "app-tg-test";
  process.env.PPAYPROS_PRIVATE_KEY_TG = "private-tg-test";
  assert.equal(getPpayProsDefaultWayCode("TG"), "710");
  assert.equal(getPpayProsDefaultWayCode("BF"), "");
  assert.equal(toPpayProsAmount(3000), 300000);

  const originalFetch = globalThis.fetch;
  let requestUrl = "";
  let requestBody: Record<string, unknown> = {};
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    requestUrl = String(input);
    requestBody = JSON.parse(String(init?.body || "{}"));
    return new Response(JSON.stringify({
      code: 0,
      data: {
        mchOrderNo: "PPIN-42",
        payOrderId: "provider-order-42",
        payDataType: "payUrl",
        payData: "https://checkout.example.test/pay",
      },
    }), { status: 200, headers: { "Content-Type": "application/json" } });
  }) as typeof fetch;

  try {
    const result = await createPpayProsPayin({
      country: "TG",
      wayCode: "710",
      merchantOrderNo: "PPIN-42",
      amountXof: 3000,
      customerName: "Test User",
      customerPhone: "+228 90 12 34 56",
      customerEmail: "test@example.test",
      notifyUrl: "https://app.example.test/api/webhooks/ppaypros/payin",
      returnUrl: "https://app.example.test/deposit",
    });
    assert.equal(requestUrl, "https://pay.ppaypros.com/api/pay/pay");
    assert.equal(requestBody.mchNo, "merchant-tg-test");
    assert.equal(requestBody.appId, "app-tg-test");
    assert.equal(requestBody.amount, 300000);
    assert.equal(requestBody.customerPhone, "90123456");
    assert.equal(requestBody.wayCode, "710");
    const { sign, ...unsigned } = requestBody;
    assert.equal(sign, createPpayProsSignature(unsigned, "private-tg-test"));
    assert.equal(result.payOrderId, "provider-order-42");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("sends Côte d'Ivoire and Cameroon payins with their own phone formats", async () => {
  const cases = [
    {
      country: "CI",
      merchantNo: "merchant-ci-test",
      appId: "app-ci-test",
      privateKey: "private-ci-test",
      phone: "+225 01 23 45 67 89",
      expectedPhone: "0123456789",
      wayCode: "837",
    },
    {
      country: "CM",
      merchantNo: "merchant-cm-test",
      appId: "app-cm-test",
      privateKey: "private-cm-test",
      phone: "+237 6 70 12 34 56",
      expectedPhone: "670123456",
      wayCode: "890",
    },
  ];
  const originalFetch = globalThis.fetch;
  const requests: Array<{ url: string; body: Record<string, unknown> }> = [];
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    requests.push({
      url: String(input),
      body: JSON.parse(String(init?.body || "{}")) as Record<string, unknown>,
    });
    return new Response(JSON.stringify({
      code: 0,
      data: { mchOrderNo: "PPIN-43", payDataType: "payUrl", payData: "https://checkout.example.test/pay" },
    }), { status: 200, headers: { "Content-Type": "application/json" } });
  }) as typeof fetch;
  try {
    for (const [index, testCase] of cases.entries()) {
      process.env[`PPAYPROS_MCH_NO_${testCase.country}`] = testCase.merchantNo;
      process.env[`PPAYPROS_APP_ID_${testCase.country}`] = testCase.appId;
      process.env[`PPAYPROS_PRIVATE_KEY_${testCase.country}`] = testCase.privateKey;
      assert.equal(getPpayProsDefaultWayCode(testCase.country), testCase.wayCode);
      await createPpayProsPayin({
        country: testCase.country,
        wayCode: testCase.wayCode,
        merchantOrderNo: `PPIN-${43 + index}`,
        amountXof: 3000,
        customerName: "Test User",
        customerPhone: testCase.phone,
        customerEmail: "test@example.test",
        notifyUrl: "https://app.example.test/api/webhooks/ppaypros/payin",
        returnUrl: "https://app.example.test/deposit",
      });
    }

    for (const [index, testCase] of cases.entries()) {
      assert.equal(requests[index].url, "https://pay.ppaypros.com/api/pay/pay");
      assert.equal(requests[index].body.mchNo, testCase.merchantNo);
      assert.equal(requests[index].body.appId, testCase.appId);
      assert.equal(requests[index].body.customerPhone, testCase.expectedPhone);
      assert.equal(requests[index].body.wayCode, testCase.wayCode);
      if (testCase.country === "CI") {
        assert.equal(requests[index].body.extParam, testCase.expectedPhone);
      } else {
        assert.equal("extParam" in requests[index].body, false);
      }
    }
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("opens a selected-country checkout using the account phone format", async () => {
  process.env.PPAYPROS_MCH_NO_CM = "merchant-cm-test";
  process.env.PPAYPROS_APP_ID_CM = "app-cm-test";
  process.env.PPAYPROS_PRIVATE_KEY_CM = "private-cm-test";
  const originalFetch = globalThis.fetch;
  let requestBody: Record<string, unknown> = {};
  globalThis.fetch = (async (_input: string | URL | Request, init?: RequestInit) => {
    requestBody = JSON.parse(String(init?.body || "{}")) as Record<string, unknown>;
    return new Response(JSON.stringify({
      code: 0,
      data: { mchOrderNo: "PPIN-50", payDataType: "payUrl", payData: "https://checkout.example.test/pay" },
    }), { status: 200, headers: { "Content-Type": "application/json" } });
  }) as typeof fetch;

  try {
    await createPpayProsPayin({
      country: "CM",
      wayCode: "890",
      merchantOrderNo: "PPIN-50",
      amountXof: 3000,
      customerName: "Test User",
      customerPhone: "+228 90 12 34 56",
      customerPhoneCountry: "TG",
      customerEmail: "test@example.test",
      notifyUrl: "https://app.example.test/api/webhooks/ppaypros/payin",
      returnUrl: "https://app.example.test/deposit",
    });

    assert.equal(requestBody.mchNo, "merchant-cm-test");
    assert.equal(requestBody.wayCode, "890");
    assert.equal(requestBody.customerPhone, "90123456");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("queries country-specific provider balance with signed credentials", async () => {
  process.env.PPAYPROS_MCH_NO_TG = "merchant-tg-test";
  process.env.PPAYPROS_APP_ID_TG = "app-tg-test";
  process.env.PPAYPROS_PRIVATE_KEY_TG = "private-tg-test";
  const originalFetch = globalThis.fetch;
  let requestUrl = "";
  let requestBody: Record<string, unknown> = {};
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    requestUrl = String(input);
    requestBody = JSON.parse(String(init?.body || "{}"));
    return new Response(JSON.stringify({
      code: 0,
      data: { balance: 12500, payoutBalance: 8400, agentBalance: 50 },
    }), { status: 200, headers: { "Content-Type": "application/json" } });
  }) as typeof fetch;
  try {
    const balance = await getPpayProsBalance("TG");
    assert.equal(requestUrl, "https://pay.ppaypros.com/api/payout/balance");
    assert.equal(requestBody.mchNo, "merchant-tg-test");
    assert.equal(requestBody.appId, "app-tg-test");
    assert.equal(balance.balance, 12500);
    assert.equal(balance.payoutBalance, 8400);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("formats Togo and Côte d'Ivoire payout accounts using the selected country", async () => {
  const cases = [
    {
      country: "TG",
      merchantNo: "merchant-tg-test",
      appId: "app-tg-test",
      privateKey: "private-tg-test",
      accountNumber: "+228 90 12 34 56",
      accountPhone: "22890123456",
      expectedPhone: "90123456",
    },
    {
      country: "CI",
      merchantNo: "merchant-ci-test",
      appId: "app-ci-test",
      privateKey: "private-ci-test",
      accountNumber: "+225 01 23 45 67 89",
      accountPhone: "0123456789",
      expectedPhone: "0123456789",
    },
  ];
  const originalFetch = globalThis.fetch;
  const requests: Array<{ body: Record<string, unknown> }> = [];
  globalThis.fetch = (async (_input: string | URL | Request, init?: RequestInit) => {
    requests.push({ body: JSON.parse(String(init?.body || "{}")) as Record<string, unknown> });
    return new Response(JSON.stringify({
      code: 0,
      data: { mchOrderNo: "PPOUT-22", state: 1 },
    }), { status: 200, headers: { "Content-Type": "application/json" } });
  }) as typeof fetch;
  try {
    for (const testCase of cases) {
      process.env[`PPAYPROS_MCH_NO_${testCase.country}`] = testCase.merchantNo;
      process.env[`PPAYPROS_APP_ID_${testCase.country}`] = testCase.appId;
      process.env[`PPAYPROS_PRIVATE_KEY_${testCase.country}`] = testCase.privateKey;
      await createPpayProsPayout({
        country: testCase.country,
        merchantOrderNo: "PPOUT-22",
        amountXof: 2500,
        accountName: "Test User",
        accountNumber: testCase.accountNumber,
        accountPhone: testCase.accountPhone,
        accountEmail: "test@example.test",
        accountCode: "TEST-OPERATOR",
        notifyUrl: "https://app.example.test/api/webhooks/ppaypros/payout",
      });
    }

    for (const [index, testCase] of cases.entries()) {
      assert.equal(requests[index].body.mchNo, testCase.merchantNo);
      assert.equal(requests[index].body.appId, testCase.appId);
      assert.equal(requests[index].body.accountNo, testCase.expectedPhone);
      assert.equal(requests[index].body.accountPhone, testCase.expectedPhone);
    }
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("resolves documented PPayPros payout account codes by country and saved wallet operator", () => {
  assert.equal(resolvePpayProsPayoutAccountCode("TG", "Togocel"), "Bank");
  assert.equal(resolvePpayProsPayoutAccountCode("CI", "Wave Côte d'Ivoire"), "Bank");
  assert.equal(resolvePpayProsPayoutAccountCode("CM", "MTN Cameroun", "ORANGE/MTN"), "MTN");
  assert.equal(resolvePpayProsPayoutAccountCode("CM", "Orange Cameroun", "ORANGE/MTN"), "ORANGE");
  assert.equal(resolvePpayProsPayoutAccountCode("CM", "Moov Cameroun", "ORANGE/MTN"), "");
});

test("sends and checks payouts with the selected country and wallet code", async () => {
  process.env.PPAYPROS_MCH_NO_CM = "merchant-cm-test";
  process.env.PPAYPROS_APP_ID_CM = "app-cm-test";
  process.env.PPAYPROS_PRIVATE_KEY_CM = "private-cm-test";
  const originalFetch = globalThis.fetch;
  const requests: Array<{ url: string; body: Record<string, unknown> }> = [];
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    const body = JSON.parse(String(init?.body || "{}")) as Record<string, unknown>;
    requests.push({ url, body });
    return new Response(JSON.stringify({
      code: 0,
      data: url.endsWith("/api/payout/pay")
        ? { mchOrderNo: "PPOUT-21", transferId: "transfer-21", state: 1 }
        : { mchOrderNo: "PPOUT-21", transferId: "transfer-21", state: 2 },
    }), { status: 200, headers: { "Content-Type": "application/json" } });
  }) as typeof fetch;
  try {
    const payout = await createPpayProsPayout({
      country: "CM",
      merchantOrderNo: "PPOUT-21",
      amountXof: 2500,
      accountName: "Test User",
      accountNumber: "0670123456",
      accountPhone: "+237 6 70 12 34 56",
      accountEmail: "test@example.test",
      accountCode: "MTN",
      notifyUrl: "https://app.example.test/api/webhooks/ppaypros/payout",
    });
    assert.equal(payout.state, 1);
    assert.equal(requests[0].url, "https://pay.ppaypros.com/api/payout/pay");
    assert.equal(requests[0].body.mchNo, "merchant-cm-test");
    assert.equal(requests[0].body.amount, 250000);
    assert.equal(requests[0].body.entryType, "BANK_CARD");
    assert.equal(requests[0].body.accountNo, "0670123456");
    assert.equal(requests[0].body.accountPhone, "670123456");
    assert.equal(requests[0].body.accountCode, "MTN");

    const status = await queryPpayProsPayout({
      country: "CM",
      merchantOrderNo: "PPOUT-21",
      transferId: "transfer-21",
    });
    assert.equal(status.state, 2);
    assert.equal(requests[1].url, "https://pay.ppaypros.com/api/payout/query");
    assert.equal(requests[1].body.transferId, "transfer-21");
  } finally {
    globalThis.fetch = originalFetch;
  }
});
