---
name: VIP level rules
description: VIP status uses approved deposits, selected earned credits, and a fixed FCFA conversion.
---

Calculate VIP status from approved deposits plus positive referral commissions, invitation-task rewards, daily check-in rewards, and wheel prizes. Record each net increase to a user's balances by an Admin as an approved deposit, without crediting the balance twice or generating a referral commission for the Admin credit. Do not include signup/gift bonuses, product earnings, blog rewards, or other credit types unless the user changes this scope. Preserve the confirmed intermediate VIP2–VIP4 thresholds and fixed INR-to-FCFA conversion; do not switch to a live rate or infer a different mapping. Reusing an available badge image for more than one VIP level is acceptable when a level-specific asset is missing.

On the Compte tab, show the remaining FCFA needed to reach the next VIP level and its progress bar.

**Why:** The user explicitly expanded VIP qualification beyond deposits to include specified earned credits, requested Admin balance credits be recorded as deposits, and confirmed those credits must not generate referral payouts. The screenshots omit some VIP thresholds and badge files, so the user approved the intermediate mapping, fixed conversion, and reuse of supplied badge images.

**How to apply:** Sum approved deposit records and only the named positive transaction types; exclude deposit transactions from that second sum to avoid double-counting approved deposits. For Admin balance edits, create an approved-deposit record only for a positive net balance increase, in the same transaction as the balance update. Keep thresholds in FCFA, recompute the level and progress from the full qualifying total, and reuse the nearest supplied badge where needed.
