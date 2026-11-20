---
name: Rate-limit scope
description: Why security throttles are process-local and what is required for multi-instance enforcement.
---

The current API, login, and sensitive-action throttles are stored in process memory. IP and account buckets are checked independently for login; user-scoped buckets also protect state-changing payment, product, withdrawal, password, and Admin PIN actions.

**Why:** There is no shared rate-limit service configured. Writing each request to the application database would add load to the same database the controls are meant to protect.

**How to apply:** Treat the limits as per-instance protection. Before relying on them across Replit Autoscale instances, move the buckets to a shared low-latency store and verify the IP/account keys remain independently enforced.
