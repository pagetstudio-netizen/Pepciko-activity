---
name: PPayPros country setup
description: Country-specific PPayPros documentation, credentials, phone formats, and live-payment checks.
---

PPayPros payins use the authenticated user's account phone as checkout metadata; the hosted PPayPros page collects the actual payer number. On the deposit page, the user may select a payment country different from the signup country: use the selected country for its credentials and way code, and normalize the account phone using the signup country's format. Keep signup phone validation country-specific and do not add a separate payer-number field.

If PPayPros returns “Signature verification failed” after the phone passes validation, stop changing phone formatting and verify that the merchant number, app ID, signing key, and documented signing method all belong together. Never log or request the credential values in chat.

PPayPros' portal documents MD5 over non-empty parameters sorted by ASCII key, followed by `&key=<private key>`, then uppercase hex. Saving a regenerated merchant private key invalidates the previous one. Its published sample signature is internally inconsistent, so trust the written formula over that sample hash.

After reporting that the PPayPros credentials had been updated, the user confirmed the integration worked after the application was restarted.

The published payin way codes are Benin 850, Togo 710, Côte d’Ivoire 837, and Cameroon 890. The consulted documentation does not list Burkina Faso's payin code or phone format. Payout uses `BANK_CARD`; `accountCode` is `Bank` when there is no specific bank code, while Cameroon requires the saved wallet operator code `ORANGE` or `MTN`. For Togo and Côte d’Ivoire, use the documented generic `Bank` fallback.

The user directed that PPayPros be the only active API payment provider in development, without hardcoding the selection or placing it in the seed. Keep RobotPay and manually configured payment routes unchanged. Current development activation covers payins and payouts for BJ, TG, CI, and CM; Cameroon payout codes must be selected from the saved operator, while TG and CI use `Bank`. Do not propagate these settings to production without an explicit request.

**Why:** The user requested per-country credentials and explicitly chose the active provider as persistent runtime configuration, not a code or seed default. The user clarified that deposit country may differ from signup country because the hosted PPayPros page collects the actual payer number; registration validation remains independent. PPayPros documents a generic payout fallback and specific Cameroon wallet codes; using the saved Cameroon operator avoids routing to the wrong wallet. RobotPay is a separate manual route and must not be changed by provider toggles.

**How to apply:** For payins, route by the selected payment country's configured credentials and way code; send the account phone normalized for its signup country as checkout metadata, leaving actual payer-number entry to the hosted checkout. Do not weaken signup phone validation. For payouts, use `entryType=BANK_CARD`, use `Bank` for TG/CI, and derive Cameroon `accountCode` as `MTN` or `ORANGE` from the saved wallet operator. For signature rejections, verify a coherent merchant/app/key set and use the documented algorithm without logging values. Store credentials in per-country Replit Secrets, never app settings or the database. After rotating a key, update that country's Secret and restart the app.