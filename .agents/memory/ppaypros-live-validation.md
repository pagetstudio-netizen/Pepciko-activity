---
name: PPayPros country setup
description: Country-specific PPayPros documentation, credentials, phone formats, and live-payment checks.
---

PPayPros payins must use the authenticated user's account phone; do not ask for a separate phone on the deposit page. For Benin registration, accept eight local digits or `01` plus eight digits and normalize to `01` plus eight digits. Normalize legacy eight-digit Benin account phones at payment time, but do not reinterpret a phone belonging to another country.

If PPayPros returns “Signature verification failed” after the phone passes validation, stop changing phone formatting and verify that the merchant number, app ID, signing key, and documented signing method all belong together. Never log or request the credential values in chat.

PPayPros' portal documents MD5 over non-empty parameters sorted by ASCII key, followed by `&key=<private key>`, then uppercase hex. Saving a regenerated merchant private key invalidates the previous one. Its published sample signature is internally inconsistent, so trust the written formula over that sample hash.

After reporting that the PPayPros credentials had been updated, the user confirmed the integration worked after the application was restarted.

The published payin way codes are Benin 850, Togo 710, Côte d’Ivoire 837, and Cameroon 890. The consulted documentation does not list Burkina Faso's payin code or phone format. It describes payout as `BANK_CARD`, with `Bank` for Benin and `ORANGE` / `MTN` account codes for Cameroon; it does not establish mobile-wallet payout support for every requested country.

The user directed that PPayPros be the only active API payment provider in development, without hardcoding the selection or placing it in the seed. Keep RobotPay and manually configured payment routes unchanged. Current activation covers payins for BJ, TG, CI, and CM; payouts remain enabled only for BJ until other payout codes are configured. Do not propagate these settings to production without an explicit request.

**Why:** The user requested per-country credentials and explicitly chose the active provider as persistent runtime configuration, not a code or seed default. The documentation does not establish every country's payout wallet codes, so enabling unsupported payout paths could misroute funds. RobotPay is a separate manual route and must not be changed by provider toggles.

**How to apply:** Use the authenticated profile phone for each payin and normalize only the selected country's format. For signature rejections, verify a coherent merchant/app/key set and use the documented algorithm without logging values. Store credentials in per-country Replit Secrets, never app settings or the database. After rotating a key, update that country's Secret and restart the app.