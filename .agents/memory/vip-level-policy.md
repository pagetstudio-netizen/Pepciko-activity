---
name: VIP level rules
description: VIP status uses cumulative approved deposits and a fixed FCFA conversion.
---

Calculate VIP status from the user's cumulative approved deposits, as confirmed by the user. The user approved the intermediate VIP2–VIP4 thresholds proposed from the reference pattern and selected a fixed INR-to-FCFA conversion rate; preserve these confirmed business rules rather than switching to a live rate or inferring a different mapping. Reusing an available badge image for more than one VIP level is acceptable when a level-specific asset is missing.

On the Compte tab, show the remaining FCFA needed to reach the next VIP level and its progress bar.

**Why:** The screenshots omit some VIP thresholds and badge files, so the user explicitly approved the proposed intermediate mapping, fixed conversion, and reuse of supplied badge images. The user also asked for the missing next-level progress text on the account card.

**How to apply:** Use only approved deposits in the cumulative total. Keep all thresholds in FCFA in the app, compute the remaining amount from the next threshold, and recompute from current totals so each newly approved deposit updates the level and progress. Reuse the nearest supplied badge where needed.
