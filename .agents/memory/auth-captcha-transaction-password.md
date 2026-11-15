---
name: Signup CAPTCHA and withdrawal password
description: The registration and withdrawal-security rules the user specified for authentication.
---

Signup and withdrawal-password setup generate a six-character code after a five-second countdown and display it directly in the read-only input. It is not an image CAPTCHA, SMS OTP, or phone verification; because the code is returned to the browser, this is not an effective anti-bot challenge.

New users are directed to create a withdrawal password after registration, and cannot reach the dashboard until it is set. Do not add UI copy that calls this step mandatory. Withdrawal requests must verify that separate password; it must differ from the login password.

Admins can reset a user's withdrawal password by clearing its stored hash; the user then creates a new one through the existing setup flow. Never set or reveal a plaintext withdrawal password from the admin UI.

**Why:** the user asked for the generated code to appear directly in the field instead of an image, clarified that it is not an SMS OTP, asked for a separate password to protect withdrawals, specified the post-registration setup gate and its wording, and requested admin reset capability.

**How to apply:** Preserve these distinctions in authentication UI, API behavior, and future recovery or verification work. For admin resets, clear the hash and let the user re-enter through the CAPTCHA-protected setup endpoint. Require password setup before protected member pages, while avoiding copy that labels the setup mandatory. Do not describe the CAPTCHA as phone verification.
