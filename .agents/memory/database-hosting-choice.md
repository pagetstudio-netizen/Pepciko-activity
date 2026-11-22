---
name: Database hosting choice
description: The user chose Supabase as the active database and specified which development data may be copied.
---

Supabase is the application's production data target, confirmed by the user. Replit's managed PostgreSQL remains a separate development database. Plesk has its own environment, so verify its `SUPABASE_DATABASE_URL` points to the same intended production database before operating there.

For a new Supabase setup, preserve its existing session table and copy only the catalogs and configuration the user approved: countries, products, tasks, payment channels/numbers, and platform settings. Do not copy test users, balances, positions, deposits, withdrawals, commissions, transaction histories, or other user activity unless the user explicitly asks. Keep the Replit development database separate.

**Why:** The user confirmed Supabase as the production data target and clarified that it is already connected to the project; Replit's built-in database is only development.

**How to apply:** Use the connected Supabase database for authorized production data operations. Check the deployment environment separately before Plesk work; never assume Replit and Plesk share environment variables.
