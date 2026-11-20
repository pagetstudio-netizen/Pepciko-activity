---
name: Product payout policy
description: The agreed earnings policy for purchased stable, activity, and wellness products.
---

Stable and activity products accrue the configured daily amount for calculation, but pay gains only once at the end of the product period. Wellness products credit daily earnings to the withdrawal balance automatically after each 24-hour cycle, including the final cycle; their total return is the full-cycle profit. On investment cards, stable products show their daily amount under “Gains quotidiens”; wellness products show “Gains journaliers” and display purchase price plus full-cycle profit as “Revenu total”; activity products show the full-period return under “Gains à l’échéance”. Already-accrued but unpaid earnings on active wellness positions are credited once when transitioning them to daily payouts; prior credited earnings remain counted toward the total. Free daily check-in bonuses are separate from product earnings.

**Why:** the user specified that wellness gains must be credited every 24 hours to the withdrawal balance, while stable and activity products retain their existing maturity payouts.

**How to apply:** process wellness daily credits atomically and idempotently, track amounts already paid, and settle any remaining configured profit on its final daily cycle. Keep stable and activity payout timing unchanged; on maturity, credit only their unpaid remainder and create at most one final earning transaction. Do not add a manual claim path.
