import assert from "node:assert/strict";
import test from "node:test";
import {
  ashtechTransactionMatches,
  collectPayment,
  filterAshtechCountryOperators,
  getTransaction,
  isAshtechOperatorActive,
} from "./ashtechpay";

const collectParams = {
  amount: 1000,
  currency: "XOF",
  phone: "90000000",
  operator: "Moov Money",
  countryCode: "TG",
  reference: "test-reference",
  notifyUrl: "https://example.test/api/webhooks/ashtechpay",
};

async function withAshtechTestConfig(profileUserId: string | undefined, run: () => Promise<void>) {
  const originalFetch = globalThis.fetch;
  const originalApiKey = process.env.ASHTECH_API_KEY;
  const originalLegacyApiKey = process.env.ASHTECHPAY_API_KEY;
  const originalProfileUserId = process.env.ASHTECHPAY_USER_ID;

  try {
    process.env.ASHTECH_API_KEY = "unit-test-api-key";
    delete process.env.ASHTECHPAY_API_KEY;
    if (profileUserId === undefined) delete process.env.ASHTECHPAY_USER_ID;
    else process.env.ASHTECHPAY_USER_ID = profileUserId;
    await run();
  } finally {
    globalThis.fetch = originalFetch;
    if (originalApiKey === undefined) delete process.env.ASHTECH_API_KEY;
    else process.env.ASHTECH_API_KEY = originalApiKey;
    if (originalLegacyApiKey === undefined) delete process.env.ASHTECHPAY_API_KEY;
    else process.env.ASHTECHPAY_API_KEY = originalLegacyApiKey;
    if (originalProfileUserId === undefined) delete process.env.ASHTECHPAY_USER_ID;
    else process.env.ASHTECHPAY_USER_ID = originalProfileUserId;
  }
}

function ashtechResponse() {
  return new Response(JSON.stringify({
    transaction_id: "test-transaction",
    reference: "test-reference",
    status: "pending",
    amount: 1000,
    currency: "XOF",
  }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

test("AshtechPay rejects provider transactions that do not match the deposit", () => {
  const transaction = {
    transaction_id: "test-transaction",
    reference: "test-reference",
    status: "success",
    amount: 1000,
    currency: "XOF",
    country_code: "TG",
  };
  const expected = {
    amount: 1000,
    countryCode: "TG",
    reference: "test-reference",
    transactionId: "test-transaction",
    currency: "XOF",
  };

  assert.equal(ashtechTransactionMatches(transaction, expected), true);
  assert.equal(ashtechTransactionMatches({ ...transaction, amount: 999 }, expected), false);
  assert.equal(ashtechTransactionMatches({ ...transaction, country_code: "CI" }, expected), false);
  assert.equal(ashtechTransactionMatches({ ...transaction, reference: "another" }, expected), false);
});

test("AshtechPay hides Burkina Faso LigdiCash while keeping Orange and Moov", () => {
  const countries = filterAshtechCountryOperators([{
    code: "BF",
    name: "Burkina Faso",
    currency: "XOF",
    operators: ["Orange Money", "Moov Money", "Wallet LigdiCash"],
  }]);

  assert.deepEqual(countries[0].operators, ["Orange Money", "Moov Money"]);
  assert.equal(isAshtechOperatorActive(countries[0], "Orange Money"), true);
  assert.equal(isAshtechOperatorActive(countries[0], "Moov Money"), true);
  assert.equal(isAshtechOperatorActive(countries[0], "Wallet LigdiCash"), false);
});

test("AshtechPay excludes LigdiCash only for Burkina Faso", () => {
  const [country] = filterAshtechCountryOperators([{
    code: "CI",
    name: "Côte d’Ivoire",
    currency: "XOF",
    operators: ["Wallet LigdiCash"],
  }]);

  assert.deepEqual(country.operators, ["Wallet LigdiCash"]);
  assert.equal(isAshtechOperatorActive(country, "Wallet LigdiCash"), true);
});

test("AshtechPay collect sends the configured API-key owner's user ID", async () => {
  let requestBody: Record<string, unknown> | undefined;
  await withAshtechTestConfig("merchant-profile-42", async () => {
    globalThis.fetch = async (input, init) => {
      assert.equal(String(input), "https://www.ashtechpay.com/v1/collect");
      requestBody = JSON.parse(String(init?.body)) as Record<string, unknown>;
      return ashtechResponse();
    };

    await collectPayment(collectParams);
    assert.equal(requestBody?.user_id, "merchant-profile-42");
  });
});

test("AshtechPay transaction status includes the configured profile user ID", async () => {
  let requestUrl: URL | undefined;
  await withAshtechTestConfig("merchant-profile-42", async () => {
    globalThis.fetch = async (input) => {
      requestUrl = new URL(String(input));
      return ashtechResponse();
    };

    await getTransaction("test-transaction");
    assert.equal(requestUrl?.pathname, "/v1/transaction/test-transaction");
    assert.equal(requestUrl?.searchParams.get("user_id"), "merchant-profile-42");
  });
});

test("AshtechPay refuses collect and status requests when the profile user ID is missing", async () => {
  await withAshtechTestConfig(undefined, async () => {
    let fetchCalled = false;
    globalThis.fetch = async () => {
      fetchCalled = true;
      return ashtechResponse();
    };

    await assert.rejects(collectPayment(collectParams), /ASHTECHPAY_USER_ID/);
    await assert.rejects(getTransaction("test-transaction"), /ASHTECHPAY_USER_ID/);
    assert.equal(fetchCalled, false);
  });
});
