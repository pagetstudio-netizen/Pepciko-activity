---
name: Product payout policy
description: The agreed earnings policy for purchased stable, activity, and wellness products.
---

Stable and activity products accrue the configured daily amount for calculation, but pay gains only once at the end of the product period. Activity cards calculate the display-only daily amount as the full return (purchase price plus profit) divided by cycle days, then show daily amount × cycle as “Revenu total”; actual activity earnings are still paid only at maturity. Wellness products credit daily earnings to the withdrawal balance automatically after each 24-hour cycle, including the final cycle; their total return is the full-cycle profit. On investment cards, stable and activity products show “Gains quotidiens”; wellness products show “Gains journaliers” and display purchase price plus full-cycle profit as “Revenu total”. Already-accrued but unpaid earnings on active wellness positions are credited once when transitioning them to daily payouts; prior credited earnings remain counted toward the total. Free daily check-in bonuses are separate from product earnings.

**Why:** the user specified that wellness gains must be credited every 24 hours to the withdrawal balance, while stable and activity products retain their existing maturity payouts. The user also specified that activity cards should calculate daily earnings and total cycle profit like stable-product cards.

**How to apply:** process wellness daily credits atomically and idempotently, track amounts already paid, and settle any remaining configured profit on its final daily cycle. Keep stable and activity payout timing unchanged; on maturity, credit only their unpaid remainder and create at most one final earning transaction. Do not add a manual claim path.
