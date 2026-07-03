---
name: vue
description: Semantic Vue guardrails for reactivity, prop ownership, and composition beyond what the Vue ESLint plugin enforces mechanically.
appliesTo: ["**/*.vue"]
stacks: ["vue", "frontend"]
source: original
---

# Vue

## Hard Constraints (MUST NOT)

- MUST NOT mutate a prop inside the receiving component — props are owned by the parent; emit an event or use `v-model` instead.
- MUST NOT use array index as `:key` for list items that can reorder.
- MUST NOT hold a derived value in `ref`/`reactive` state when a `computed()` would keep it in sync automatically — manual copies go stale.
- MUST NOT reach into another component's internal state through `$refs` to bypass its props/emit contract, beyond calling exposed imperative methods.
- MUST NOT create module-level mutable singletons that bypass the reactivity system for cross-component shared state — use a store.

## Ecosystem Idioms & Conventions

- Prefer the Composition API (`<script setup>`) for new components for easier logic extraction and reuse.
- Extract shared reactive logic into composables rather than mixins.
- Use `computed()` for derived data instead of watchers that manually assign the result.
- Use `provide`/`inject` sparingly and typed; it is not a substitute for a well-defined props contract.
- Keep templates declarative; move branching and formatting logic into computed properties or methods.
