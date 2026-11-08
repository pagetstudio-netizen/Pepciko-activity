---
name: Balance separation
description: Accounting policy for non-withdrawable deposit funds and withdrawable user earnings.
---

The deposit balance is non-withdrawable. Move the full legacy balance into the deposit balance when introducing the split. Deposits, signup rewards, gift-code claims, and ordinary bonuses go to the deposit balance. The user's fixed daily login check-in reward is an exception and goes to the withdrawal balance. Stable and activity product purchases are paid from the deposit balance.

The withdrawal balance receives stable and activity earnings at maturity, referral commissions, invitation-task rewards, and the daily login check-in reward. Wheel prizes go to the non-withdrawable deposit balance. Withdrawal requests may use only the withdrawal balance; rejected withdrawals return funds to it. Administrators can adjust the two balances independently.

**Why:** The user specified these wallet boundaries and later explicitly required the daily login check-in reward to be credited to the withdrawal balance.

**How to apply:** Route every credit, debit, refund, and purchase to its designated wallet. Treat daily login check-in as the named exception; never use the aggregate compatibility balance to authorize a purchase or withdrawal.
