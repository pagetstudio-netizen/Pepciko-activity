---
name: Authentication viewport
description: Persistent layout and field-icon requirements for login and registration.
---

The login and registration pages must stay fixed to the viewport without page scrolling. The white information panel must extend to the bottom edge of the viewport rather than ending beneath the form. Keep the supplied phone icon on the phone field, lock icon on both password fields, and account icon on the invitation-code field. Keep the selected phone-country prefix visibly rendered: the base auth redesign hides it, so the screenshot/auth override must explicitly restore its display with sufficient specificity.

The dark switch ribbon should meet the white form panel without a visible background gap, show only a thin tip at the left, and have a slightly rounded right corner. Keep its login/register label compact and fully visible above the panel overlap. Keep the bottom login/register switch text dark in hover, focus, and press states.

**Why:** The user compared the result with the original login and registration screenshots, corrected the ribbon-to-panel join, noted that the switch label was clipped and too large, reported that interaction feedback made the bottom switch text disappear on white, and asked the white panel to reach the screen bottom.

**How to apply:** When changing login or registration layouts, fit the controls within the viewport at mobile sizes instead of enabling page-level scrolling, extend the white panel through the viewport bottom, retain the user-provided field-icon assignments, verify the country prefix after selecting another country, keep the switch label small and above the overlapping white panel without changing the ribbon/panel join, and preserve readable dark text for all bottom-switch interaction states.
