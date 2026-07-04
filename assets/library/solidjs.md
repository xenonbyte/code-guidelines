---
name: solidjs
description: Semantic SolidJS guardrails for signal reactivity, control-flow components, and props access beyond compiler-enforced JSX syntax.
appliesTo: ["**/*.tsx", "**/*.jsx"]
stacks: ["solidjs", "frontend"]
source: original
---

# SolidJS

## Hard Constraints (MUST NOT)

- MUST NOT destructure props at the top of a component (`const { name } = props`) — this reads the value once and breaks reactivity; access `props.name` directly or wrap it in a function (`const name = () => props.name`).
- MUST NOT use `Array.prototype.map` to render a reactive list — it re-creates every DOM node on each change; use `<For>` for keyed, minimal-diff list rendering.
- MUST NOT use a ternary or `&&` for conditional rendering of a signal-derived condition — each re-evaluation recreates the JSX subtree; use `<Show when={...}>` to update only the truthiness boundary.
- MUST NOT call a signal accessor (`count()`) outside a tracking scope (JSX, `createEffect`, `createMemo`) expecting it to stay reactive — reads outside a computation are one-shot snapshots.
- MUST NOT mutate a `createStore` object's nested fields directly (`store.user.name = 'x'`) — use the store's setter (`setStore('user', 'name', 'x')`) so fine-grained tracking sees the change.
- MUST NOT perform a side effect (fetch, subscription, timer) directly in the component body — use `createEffect` or `onMount` so it runs once per reactive scope, not on every re-invocation.

## Ecosystem Idioms & Conventions

- Reach for `createMemo` to cache an expensive derived computation, not to force re-renders.
- Prefer `<Switch>`/`<Match>` over nested `<Show>` chains when branching on more than two conditions.
- Keep `createSignal`/`createStore` colocated with the component or module that owns the state; pass accessors, not raw values, down to children.
- Clean up subscriptions/timers registered in `onMount` via `onCleanup`, not a manually tracked unmount flag.
- Use `createResource` for async data fetching instead of hand-rolled `createSignal` + `createEffect` combinations.
