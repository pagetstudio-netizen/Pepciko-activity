---
name: Floating quick-action icon contrast
description: The provided floating shortcut icons use transparent glyph cutouts, so their button background controls visibility.
---

The Telegram, service, and order PNGs draw pink circles while leaving their symbol shapes transparent. Keep a contrasting background (white for the current pink-circle/white-symbol appearance) behind the images; a matching pink/red button background hides the cutouts.

Use these supplied PNG assets for every floating quick-action button; do not substitute Lucide glyphs on page-specific floating toolbars.

**Why:** The user saw only solid red circles, and inspection confirmed the logo pixels were transparent while the shared button background was nearly the same pink.

**How to apply:** When using these assets, set the backing button to white or another contrasting color. Check page-specific button style overrides as well as the shared floating-tools stylesheet.
