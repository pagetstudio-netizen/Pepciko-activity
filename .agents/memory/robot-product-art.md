---
name: Robot product artwork
description: Product image source and assignment rules for stable and activity products.
---

Use the user's supplied PepsiCo/Poppi image for stable and activity products. Use the supplied PepsiCo/Mirinda image as the Bien-être default; administrators may override it. Preserve each selected image in cards, details, and the purchase snapshot.

On homepage product cards, display the matching `Robot-N` alias instead of the configured product name. Derive it from an existing `Robot-N` name first, or from the same product-ID mapping used for the fallback image. Keep this homepage artwork alias separate from the canonical catalog product names.

The homepage may continue to show the established Robot-N display-name aliases, but those aliases must not change the shared PepsiCo/Poppi product image.

**Why:** The user specified PepsiCo/Poppi artwork for the main product catalog, later supplied a distinct PepsiCo/Mirinda image for Bien-être, and allowed administrators to customize Bien-être images. The existing homepage Robot-N display-name convention is separate from product artwork.

**How to apply:** Keep PepsiCo/Poppi as the stable/activity artwork and PepsiCo/Mirinda as the Bien-être fallback. Allow the Admin to set an HTTPS image URL or site-relative image path for Bien-être products.
