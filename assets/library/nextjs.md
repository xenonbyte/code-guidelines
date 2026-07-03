---
name: nextjs
description: Architectural guardrails for the Next.js App Router boundary between Server and Client Components, secrets, and data fetching.
appliesTo: ["**/app/**/*.tsx", "**/pages/**/*.tsx", "app/**/route.ts", "**/next.config.*"]
stacks: ["nextjs", "frontend"]
source: original
---

# Next.js

## Hard Constraints (MUST NOT)

- MUST NOT leak server-only secrets (API keys, database credentials) into a Client Component or any module bundled for the browser.
- MUST NOT access a database or the filesystem directly from a Client Component — keep that in Server Components, Route Handlers, or Server Actions.
- MUST NOT trust client-submitted input inside a Server Action without re-validating and re-authorizing it server-side.
- MUST NOT fetch data with a client-side `useEffect` when the same data can be fetched in a Server Component before the first render.
- MUST NOT block the entire route's response on one slow subtree when it can be streamed independently with `Suspense`.
- MUST await `params`, `searchParams`, `cookies()`, and `headers()` before reading their values — in the App Router these are Promises.
- MUST NOT pass `{ ssr: false }` to `next/dynamic` inside a Server Component — it is unsupported and errors; move the client-only piece into its own `"use client"` component instead.
- MUST NOT call your own Route Handler from a Server Component via `fetch('/api/...')` to reuse logic — extract the shared logic into a plain module and call it directly.

## Ecosystem Idioms & Conventions

- Default to Server Components; add `"use client"` only where interactivity or browser-only APIs are actually required.
- Colocate route behavior in App Router segment files (`layout`/`page`/`loading`/`error`) instead of one shared monolith.
- Use Route Handlers or Server Actions for mutations instead of standing up a separate internal API layer.
- Prefer `next/image` and `next/font` for optimized asset delivery over raw `<img>` tags and external font links.
- Make caching and revalidation explicit (tags, `revalidate`) rather than relying on implicit default behavior.
