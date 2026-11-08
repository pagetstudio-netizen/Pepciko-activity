---
name: Empty-state illustration
description: Use the user-supplied illustration for genuine empty results while preserving loading, error, and payment-progress states.
---

Use the latest user-supplied illustration for genuine no-data and no-results states across customer pages, Admin, Banker, the standard deposit flow, and RobotPay’s empty-operator list. Preserve each state’s existing message and helper text.

Center the image, size it slightly larger than before, and use reduced opacity consistently wherever the shared illustration appears.

On the daily connection rewards history page, omit the empty-state illustration and show “Aucune récompense de connexion pour le moment.” as text only.

On `/orders`, use the dedicated no-orders artwork inside the reference card with no caption, and show it only when the purchased-product list is genuinely empty.

**Why:** On 2026-10-08, the user supplied a new empty-state illustration and asked to show it on all pages with no content, replacing the previously selected artwork; they later asked for consistent centered, larger, less prominent presentation. On 2026-11-08, they supplied a separate reference and illustration for the empty Orders page, with no message text.

**How to apply:** Use the shared empty-state component whenever a data/result list is empty, except on the daily connection rewards history page, which uses text only, and `/orders`, which uses its dedicated no-orders artwork. Do not show empty-state art during loading, API errors, disabled states, or payment progress; do not change RobotPay colors or layout.