---
name: Invitation reward increases
description: Policy for changes to referral-task reward amounts and existing claimants.
---

When an invitation-task reward increases, previously paid users receive only the positive difference between the new reward and the amount actually credited. Never credit twice or claw back users whose previous payment is already equal to or above the new reward.

**Why:** The user explicitly approved retroactive difference credits when raising the 10-, 30-, and 100-invite rewards.

**How to apply:** Base the adjustment on the original reward transaction when available, update the withdrawal and compatibility balances together, record a task-reward transaction, and make the migration idempotent.
