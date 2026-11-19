---
name: PPayPros country setup
description: Country-specific PPayPros documentation, credentials, phone formats, and live-payment checks.
---

PPayPros payins must use the authenticated user's account phone; do not ask for a separate phone on the deposit page. For Benin registration, accept eight local digits or `01` plus eight digits and normalize to `01` plus eight digits. Normalize legacy eight-digit Benin account phones at payment time, but do not reinterpret a phone belonging to another country.

If PPayPros returns “Signature verification failed” after the phone passes validation, stop changing phone formatting and verify that the merchant number, app ID, signing key, and documented signing method all belong together. Never log or request the credential values in chat.

PPayPros' portal documents MD5 over non-empty parameters sorted by ASCII key, followed by `&key=<private key>`, then uppercase hex. Saving a regenerated merchant private key invalidates the previous one. Its published sample signature is internally inconsistent, so trust the written formula over that sample hash.

After reporting that the PPayPros credentials had been updated, the user confirmed the integration worked after the application was restarted.

The published payin way codes are Benin 850, Togo 710, Côte d’Ivoire 837, and Cameroon 890. The consulted documentation does not list Burkina Faso's payin code or phone format. It describes payout as `BANK_CARD`, with `Bank` for Benin and `ORANGE` / `MTN` account codes for Cameroon; it does not establish mobile-wallet payout support for every requested country.

Do not enable real PPayPros payin or payout until the merchant confirms the XOF/XAF amount scale and the exact mobile-wallet payout mode/account code for each country. Keep merchant credentials in per-country Replit Secrets, not in app settings or the database.

**Why:** The user requested one source of truth for registered payment phones and separate credentials by country. The PPayPros documentation defines some country codes, but leaves Burkina Faso's route and XOF/XAF payout compatibility unresolved; a wrong amount scale or beneficiary code could mischarge or misroute funds. The merchant portal invalidates the old key when a regenerated key is saved, and its sample signature conflicts with its written algorithm.

**How to apply:** Use the authenticated profile phone for each payin and normalize only the selected country's format. For signature rejections, verify a coherent merchant/app/key set and use the documented algorithm without logging values. Keep real flows off until a small payin and a payout to an approved wallet are confirmed with the merchant. After rotating a key, update that country's Secret and restart the app.