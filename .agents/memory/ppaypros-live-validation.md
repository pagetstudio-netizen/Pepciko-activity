---
name: PPayPros country setup
description: Country-specific PPayPros documentation, credentials, phone formats, and live-payment checks.
---

PPayPros payins may target a country different from the signup country; use the selected country for credentials and way code, and keep signup phone validation unchanged. Live testing showed that a Togo-format account phone targeting Cameroon is rejected (state 3, no checkout URL), while a Cameroon-format customer phone opened the checkout. The hosted PPayPros page collects the actual payer number, but the API still needs a customer phone matching the selected market to create that page. Never fabricate a number.

If PPayPros returns “Signature verification failed” after the phone passes validation, stop changing phone formatting and verify that the merchant number, app ID, signing key, and documented signing method all belong together. Never log or request the credential values in chat.

PPayPros' portal documents MD5 over non-empty parameters sorted by ASCII key, followed by `&key=<private key>`, then uppercase hex. Saving a regenerated merchant private key invalidates the previous one. Its published sample signature is internally inconsistent, so trust the written formula over that sample hash.

After reporting that the PPayPros credentials had been updated, the user confirmed the integration worked after the application was restarted.

The published payin way codes are Benin 850, Togo 710, Côte d’Ivoire 837, and Cameroon 890. The consulted documentation does not list Burkina Faso's payin code or phone format. Payout uses `BANK_CARD`; `accountCode` is `Bank` when there is no specific bank code, while Cameroon requires the saved wallet operator code `ORANGE` or `MTN`. For Togo and Côte d’Ivoire, use the documented generic `Bank` fallback.

The user directed that PPayPros be the only active API payment provider in development, without hardcoding the selection or placing it in the seed. Keep RobotPay and manually configured payment routes unchanged. Current development activation covers payins and payouts for BJ, TG, CI, and CM; Cameroon payout codes must be selected from the saved operator, while TG and CI use `Bank`. Do not propagate these settings to production without an explicit request.

**Why:** The user requested per-country credentials and explicitly chose the active provider as persistent runtime configuration, not a code or seed default. The user clarified that deposit country may differ from signup country and the hosted PPayPros page collects the actual payer number; live testing then showed the API also validates the checkout's customer phone against the selected market. Registration validation remains independent. PPayPros documents a generic payout fallback and specific Cameroon wallet codes; using the saved Cameroon operator avoids routing to the wrong wallet. RobotPay is a separate manual route and must not be changed by provider toggles.

**How to apply:** For payins, route by the selected payment country's configured credentials and way code. Before redirecting, the customer phone sent to the provider must match that market's format; if the signup phone does not, collect a target-market number or find a documented PPayPros checkout flow that does not require one. Do not fabricate numbers or weaken signup validation. For payouts, use `entryType=BANK_CARD`, use `Bank` for TG/CI, and derive Cameroon `accountCode` as `MTN` or `ORANGE` from the saved wallet operator. For signature rejections, verify a coherent merchant/app/key set and use the documented algorithm without logging values. Store credentials in per-country Replit Secrets, never app settings or the database. After rotating a key, update that country's Secret and restart the app.