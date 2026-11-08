---
name: Signup CAPTCHA and withdrawal password
description: The registration and withdrawal-security rules the user specified for authentication.
---

Signup uses a visual in-app CAPTCHA generated after a five-second countdown. It is not a real OTP and must not be presented as SMS or phone verification.

New users are directed to create a withdrawal password after registration, and cannot reach the dashboard until it is set. Do not add UI copy that calls this step mandatory. Withdrawal requests must verify that separate password; it must differ from the login password.

Admins can reset a user's withdrawal password by clearing its stored hash; the user then creates a new one through the existing setup flow. Never set or reveal a plaintext withdrawal password from the admin UI.

**Why:** the user clarified that the generated code is CAPTCHA-like rather than a real OTP, asked for a separate password to protect withdrawals, specified the post-registration setup gate and its wording, and requested admin reset capability.

**How to apply:** Preserve these distinctions in authentication UI, API behavior, and future recovery or verification work. For admin resets, clear the hash and let the user re-enter through the CAPTCHA-protected setup endpoint. Require password setup before protected member pages, while avoiding copy that labels the setup mandatory. Do not describe the CAPTCHA as phone verification.
