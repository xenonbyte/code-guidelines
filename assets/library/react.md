---
name: react
description: Semantic React guardrails for state ownership, rendering purity, and hook discipline beyond what ESLint's React rules enforce mechanically.
appliesTo: ["**/*.jsx", "**/*.tsx"]
stacks: ["react", "frontend"]
source: original
---

# React

## Hard Constraints (MUST NOT)

- MUST NOT mutate state directly (arrays/objects) instead of going through a state setter — always produce a new reference.
- MUST NOT derive a value in `useEffect` when it can be computed directly during render from existing props/state.
- MUST NOT use array index as `key` for lists that can reorder, insert, or delete items.
- MUST NOT call hooks conditionally or inside loops — hook call order must stay identical across renders.
- MUST NOT store server-only secrets, API keys, or tokens in component state or props that reach the client bundle.

## Ecosystem Idioms & Conventions

- Colocate state with the component that owns it; lift state up only when sibling components need to share it.
- Prefer composition (children, render props, slots) over deeply nested conditional rendering trees.
- Extract data-fetching and side-effect logic into custom hooks rather than repeating `useEffect` boilerplate.
- Reach for `useMemo`/`useCallback` after measuring a real cost, not as a default habit on every value.
- Prefer controlled components for form inputs whose value drives application logic.
