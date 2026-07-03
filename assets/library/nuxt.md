---
name: nuxt
description: Architectural guardrails for Nuxt's SSR/hydration boundary, runtime config, and Nitro server layer.
appliesTo: ["**/*.vue", "**/nuxt.config.*"]
stacks: ["nuxt", "frontend"]
source: original
---

# Nuxt

## Hard Constraints (MUST NOT)

- MUST NOT read server-only `runtimeConfig` values from client-side code — only `runtimeConfig.public` may reach the browser.
- MUST NOT perform data fetching with a raw `fetch`/`axios` call in `setup()` when `useFetch`/`useAsyncData` exists — bypasses SSR de-duplication and hydration matching.
- MUST NOT mutate the value returned by `useState` outside its intended reactive update pattern — causes SSR/client hydration mismatches.
- MUST NOT put database or filesystem access in components or pages — restrict it to the `server/` directory (Nitro handlers).
- MUST NOT reference `window`/`document` on the initial render path without a client-only guard, since that code also runs during SSR.
- MUST NOT store cross-request/cross-user state in module-level mutable variables on the server — the Nitro/Node process is long-lived and leaks data between users; use request-scoped state (`useState`, event context) instead.

## Ecosystem Idioms & Conventions

- Use the `server/` directory (Nitro) for backend logic instead of standing up a separate API project.
- Prefer auto-imported composables (`useFetch`, `useAsyncData`) over manual fetch-plus-ref wiring.
- Share state across components with `useState` (SSR-safe) instead of a module-level singleton.
- Prefer file-based routing conventions over manually configured route tables.
- Wrap heavy client-only widgets in `<ClientOnly>` instead of forcing SSR on them.
