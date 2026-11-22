---
name: Plesk GitHub deployment
description: Production deployment uses a committed dist build and a Node.js startup file relative to the application root.
---

For this project, Plesk must pull the versioned `dist` directory from GitHub; the production server starts `dist/index.cjs` and serves static files from `dist/public`.

**Why:** Plesk does not automatically see the Replit workspace build, and a missing or incorrect document root causes either “startup file not found” or a 403 response.

**How to apply:** Keep `dist` tracked for Plesk pulls, use `/dist/public` as the document root relative to the application root, use `dist/index.cjs` as the startup file, and provide `SUPABASE_DATABASE_URL` (or `DATABASE_URL`) plus `SESSION_SECRET` as server environment variables.

Replit Object Storage's SDK depends on Replit's internal runtime authentication and is unavailable from Plesk. Blog images on Plesk must use a persistent local directory outside `dist`; `BLOG_IMAGE_STORAGE_DIR` can select that writable location.

**Why:** The external Plesk host cannot authenticate to Replit Object Storage, so Replit-hosted image keys cannot be loaded there.

**How to apply:** Keep image data on Plesk's persistent disk, serve it only through authenticated routes, and never put uploaded images in the built `dist` directory or Git.