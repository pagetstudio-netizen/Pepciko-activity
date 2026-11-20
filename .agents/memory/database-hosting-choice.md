---
name: Database hosting choice
description: The user chose Supabase as the active database and specified which development data may be copied.
---

Supabase is the application's active database. When preparing it from the Replit development database, preserve the existing session table and copy only the catalogs and configuration the user asked to keep: countries, products, tasks, payment channels/numbers, and platform settings. Do not copy test users, balances, positions, deposits, withdrawals, commissions, transaction histories, or other user activity.

Keep the Replit development database unchanged as a rollback/source copy unless the user separately asks to erase it. Never use the legacy Supabase migration script that truncates destination tables. Require an empty Supabase target for the curated bootstrap and verify copied row counts.

**Why:** The user wants the active platform moved to Supabase with products, countries, operators, and Admin settings retained, while test accounts and their records are reset.

**How to apply:** Treat the selected Supabase database as the live app target. For a fresh setup, create the schema without dropping `session`, copy only the approved catalog/config tables, provision the Admin through Secrets, and leave the Replit source untouched unless separately authorized.
