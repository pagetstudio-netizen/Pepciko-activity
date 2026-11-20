---
name: Vite package firewall
description: Replit's package firewall behavior and compatible Vite upgrade path for this project.
---

Replit's package firewall blocks Vite 7.3.7 even though the dependency scanner lists it as a fix. Vite 8 is the latest major, but it requires a newer esbuild peer range than the project's current Drizzle toolchain accepts. Vite 7.3.8 installs and builds successfully here.

**Why:** The package firewall and dependency metadata can disagree, and forcing an incompatible major risks breaking the build.

**How to apply:** Prefer the newest installable Vite 7 patch unless esbuild and the Drizzle toolchain are upgraded together. Never bypass the package firewall.
