---
name: Imported database setup
description: Fresh imported projects may have only Replit's session table before the checked-in application schema is applied.
---

When setting up an imported app that uses Drizzle and connect-pg-simple, preserve the existing `session` table and treat application tables as new, even if Drizzle presents an ambiguous rename prompt.

**Why:** Drizzle can misidentify a pre-existing session table as a rename candidate for the first application table during an interactive schema push.

**How to apply:** Inspect `information_schema` first. If Drizzle proposes dropping the existing session table, model its current `sid`, `sess`, `expire`, primary key, and expiry index in the schema before pushing; never use a broad force push or accept a drop/rename prompt.