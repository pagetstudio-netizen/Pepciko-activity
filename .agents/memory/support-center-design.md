---
name: Support center design
description: The user's canonical visual and copy reference for help and deposit-report pages.
---

The latest user reference supersedes earlier pink mockups: the support center and unreceived-deposit form should match the pale-gray mobile screenshots, including their wording, card layout, FAQ, form fields, floating shortcuts, and upload buttons. Keep the French copy and FCFA amounts.

Use the provided Telegram, support, and recharge icons. The yellow screenshot/recording graphic is also a button that opens the photo picker. Keep the official Telegram channel configured and functional; live customer support opens the Tawk.to chat only on `/service`, and hide the Tawk widget on other routes. Do not affect the app's separate conversation widget. Preserve the administrator's support-link settings for a possible rollback, and keep deposit reports routed through the existing authenticated Telegram bot/group flow. Visual alignment must not change report validation or server-side handling.

**Why:** The user clarified that the latest supplied screenshots replace the earlier pink concept and are the exact target for the live pages.

**How to apply:** Compare both `/service` and `/service/deposit-not-received` against the newest supplied references before changing them. Keep Tawk visibility synchronized with the app route, leaving it visible on `/service` and hidden elsewhere. Leave browser chrome and the app's separate conversation widget untouched; preserve the functional deposit-report flow.
