---
name: frontend-state
description: Semantic guardrails for client-side state libraries (Zustand, Redux Toolkit, MobX, Jotai, Pinia, TanStack/SWR) on server-vs-client state boundaries and reactivity pitfalls.
appliesTo: ["**/store/**", "**/stores/**", "**/*.store.*", "**/*.slice.*"]
stacks: ["frontend-state", "frontend"]
source: original
---

# Frontend State Management

## Hard Constraints (MUST NOT)

- MUST NOT store server-fetched data (API responses, remote records) in a client-state store (Zustand/Redux/Pinia) managed by hand with `useEffect` plus manual loading/error flags — use a server-state library (TanStack Query, SWR, Pinia Colada) that owns caching, retries, and staleness for you.
- MUST NOT subscribe a component to an entire Zustand store (`useStore((s) => s)` or no selector) when it only reads one field — that re-renders the component on every unrelated state change; select the specific slice instead.
- MUST NOT destructure a Pinia store directly (`const { count } = useStore()`) — plain destructuring reads a snapshot and loses reactivity; use `storeToRefs(store)` for state/getters, and destructure actions separately.
- MUST NOT mutate Redux Toolkit state outside a `createSlice` reducer (e.g. mutating an object returned from `useSelector`) — Immer's draft-mutation safety only applies inside the reducer function it wraps.
- MUST NOT put highly localized, single-component UI state (an input's draft value, a modal's open flag) into a global store — colocate it with local component state unless another component genuinely needs it.
- MUST NOT read and write the same piece of state from two different global stores (e.g. mirroring TanStack Query data into Zustand) — pick one owner per piece of state to avoid drift between the copies.

## Ecosystem Idioms & Conventions

- Split a large store into slices (Zustand's slices pattern, RTK's `createSlice` per domain) composed into one root store, rather than one flat object.
- Normalize collection state (entities keyed by id) with `createEntityAdapter` (RTK) or an equivalent map shape instead of nested arrays needing linear scans.
- Configure server-state libraries' `staleTime`/cache duration deliberately per query instead of relying on the default for data that rarely changes.
- Persist only the minimal slice a store actually needs across reloads (e.g. `partialize` in Zustand's `persist` middleware) rather than the whole store.
- Prefer computed/derived values (Zustand selectors, RTK selectors, Pinia getters) over duplicating derived state into the store itself.
