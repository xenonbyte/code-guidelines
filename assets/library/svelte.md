---
name: svelte
description: Semantic Svelte guardrails for reactivity, prop ownership, and store discipline beyond compiler-enforced syntax.
appliesTo: ["**/*.svelte"]
stacks: ["svelte", "frontend"]
source: original
---

# Svelte

## Hard Constraints (MUST NOT)

- MUST NOT mutate a prop inside the child component that receives it — props flow one way from the parent.
- MUST NOT rely on a nested object/array mutation to trigger reactivity without reassigning the reference — Svelte's reactivity is assignment-based.
- MUST NOT mix a non-idempotent side effect (network call, logging) into a reactive `$:` statement that also recomputes a derived UI value — separate derivation from effects.
- MUST NOT access `document`/`window` in module-level or component-init code without a browser guard, since that code also runs during SSR.
- MUST NOT mutate a store's internal value object directly — go through `set`/`update`.

## Ecosystem Idioms & Conventions

- Prefer derived stores or reactive declarations for computed values instead of recomputing the same thing in multiple places.
- Keep component-local state local; promote it to a store only once multiple components need it.
- Use slots and props for composition instead of duplicating markup across similar components.
- Prefer actions (`use:`) for reusable DOM behavior instead of copy-pasted lifecycle code.
- Keep `.svelte` files focused on markup and binding; move non-trivial logic into plain `.ts` modules.
