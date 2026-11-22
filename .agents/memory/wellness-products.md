---
name: Bien-être product rules
description: Eligibility, duration, purchasing limit, earnings, and administration for Bien-être offers.
---

Bien-être products appear as a permanent category beside stable and activity offers. The eight current offers mirror the stable prices, start at 2 days, and yield 35% of purchase price as total cycle profit. These are database records, not a hardcoded catalog. Administrators can edit price, total cycle profit, image, and any positive whole-number duration; the amount distributed daily is calculated from purchase price plus profit divided by cycle days. The daily credits together pay the full revenue total; no separate principal payout is due at maturity. Names follow “Diwali Gift”, then “VIP1 welfare”, “VIP2 welfare”, and so on.

Buying a Bien-être offer requires a prior paid stable-product purchase, and its price cannot exceed the highest single stable price the user has paid. Free or administrator-assigned stable positions do not qualify. A user may have only one active Bien-être position; its earnings are credited to the withdrawal balance every 24 hours, and the user can buy another after the position matures.

Do not automatically recreate offers on startup: later deactivation or deletion must not cause an offer to return.

**Why:** the user specified eight offers matching the stable price tiers, a 35% profit over an initial 2-day period, then clarified that Admin may set any duration and product offers must not be hardcoded. The user later clarified that daily credits must distribute purchase price plus profit across the cycle, with no separate purchase-price payment at maturity.

**How to apply:** enforce eligibility, price ceiling, and one-active-position on the server. Keep the Bien-être category visible even when it has no offers, store offers as database records, permit any positive whole-day cycle subject to supported amount limits, preserve purchased terms/image snapshots, distribute the full purchase-price-plus-profit total evenly as whole-FCFA daily credits and spread any indivisible remainder across daily payouts rather than issuing a maturity lump, and keep stable-only benefits restricted to stable positions.
