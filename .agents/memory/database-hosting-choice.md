---
name: Database hosting choice
description: The user selected Supabase as the application's primary database and authorized migrating development data.
---

Supabase (`SUPABASE_DATABASE_URL`) remains the intended external datastore. For this new import, on 2026-11-05 the user explicitly chose to initialize the empty Replit development database instead of reconnecting Supabase. Use the existing `DATABASE_URL` fallback for this import; do not assume it contains prior users or transactions. Supabase and production data have not been changed during this setup.

Never use the legacy Supabase migration script that truncates destination tables. The safe development transfer checks that destination tables are empty, copies without overwriting, and verifies row counts. Supabase currently contains the complete development copy; source development contains only the administrator and shared configuration.

**Why:** The user previously selected Supabase, but explicitly authorized a fresh Replit development database when the Supabase secret was absent from this import.

**How to apply:** Preserve Supabase preference when its secret is configured, and use Replit for this import's development environment until the user requests reconnection. Treat any production migration as a separate task; do not replace Supabase with development data or delete production records without explicit scope and verification.
