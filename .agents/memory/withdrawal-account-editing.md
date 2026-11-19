---
name: Withdrawal account editing
description: Product rule for the user's withdrawal bank account and available operators
---

Users should maintain one editable primary mobile-money withdrawal account rather than adding multiple accounts. The account uses an Admin-configured operator, holder name, and mobile number; do not add bank/IFSC fields. Country and operator catalogs are Admin-managed database records, not hard-coded or seeded changes. Admins can edit or delete those records; deactivate a country to hide it from public selectors while preserving history. Keep the transaction password on the withdrawal flow, not the account form. Preserve existing account data and allow the user to modify it. Admins may edit that user's account on their behalf, using an operator configured for the user's country.

The withdrawal screen follows the supplied mobile reference: if no account is associated, show the fixed bottom reminder and its bind-account artwork; include a shortcut to recent withdrawal history. Keep these labels in French and amounts in FCFA.

**Why:** The user chose the mobile-money account model and specified a single editable primary withdrawal account, then requested the fixed no-account reminder, recent-withdrawal page, and country/operator records that can be changed without code or seed edits.

**How to apply:** Keep the account entry focused on editing the primary mobile-money account, create one only when none exists, and preserve existing records rather than deleting them. Restrict Admin edits to the selected user's account and the configured operator for that user's country. Source country lists and operators from Admin-managed records; do not add country/operator updates to source constants or seed data. Keep the withdrawal reminder fixed and non-scrollable, link its call to action to operator setup, and leave fee/limit policy under the existing Admin-configured settings.
