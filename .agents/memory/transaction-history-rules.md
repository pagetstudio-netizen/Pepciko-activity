---
name: Transaction history rules
description: User-facing transaction history requirements and the shared order number used by admins.
---

User histories must never show payment-provider names. Deposits must never show fees; withdrawal fees may be shown. Each history record uses a `deqmsll` order number that administrators can search for the corresponding transaction.

History back buttons should return to the page that opened them: account history tiles return to Compte, while the recent-withdrawals shortcut returns to Retrait.

Deposit and withdrawal histories share the same transaction-card layout, while showing only the fields valid for each type. Keep deposit cards fee-free and show withdrawal fees.

**Why:** The user reported that history back buttons were sending account users to deposit/withdrawal forms instead of where they came from, then requested a shared transaction-card design matching the supplied reference.

**How to apply:** Pass the source page when opening each history and use it for the back action, with a sensible deposit/withdrawal fallback for direct visits. Keep provider identifiers in operational/admin details only, use the same deterministic order-number format in user and admin views, and show fees only for withdrawals. Reuse one transaction-card presentation across deposit and withdrawal pages.