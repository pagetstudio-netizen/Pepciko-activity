---
name: Toast notification appearance
description: User-specified global toast style and copy feedback behavior.
---

All routes, including RobotPay, use the supplied toast reference: a compact, centered, translucent charcoal popup with centered white text and no exclamation icon. Copy confirmations use the one-line title “Copie réussie”; errors and authentication feedback may include a concise description. Keep the popup about 170–220 px wide and limit it to a one-line title and at most three visible description lines. Keep visible time at or below 2.6 seconds, including the exit animation.

**Why:** The user requested one toast appearance across all routes and a maximum visible duration of 2.6 seconds.

**How to apply:** Route all toast notifications through the shared Toaster. Use the same dark surface for success and destructive messages, a short spring-like entrance and brief exit animation, reduced-motion support, and a shared 2.4-second open timer to allow the 200 ms exit while staying within the 2.6-second limit. Clamp custom durations and enforce the same deadline even if a toast is hovered. All clipboard actions should use the common helper so successful copies and failures produce this toast consistently.