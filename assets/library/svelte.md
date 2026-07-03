---
name: svelte
description: Semantic Svelte guardrails for reactivity, prop ownership, and store discipline beyond compiler-enforced syntax.
appliesTo: ["**/*.svelte"]
stacks: ["svelte", "frontend"]
source: original
---

# Svelte

## Hard Constraints (MUST NOT)

- MUST NOT mutate a prop inside the child component that receives it — props (`$props()`, or legacy `export let`) flow one way from the parent.
- MUST NOT rely on a nested object/array mutation to trigger reactivity in legacy (non-rune) state without reassigning the reference; `$state()` is a deep reactive proxy and does track in-place mutation, but plain `let`/store values do not.
- MUST NOT mix a non-idempotent side effect (network call, logging) into a derived computation (`$derived`, `$derived.by()`, or a legacy reactive `$:` statement) — keep derivation pure and put effects in `$effect`.
- MUST NOT use `$effect` to synchronize or derive state that could instead be computed with `$derived`/`$derived.by()` — effects are for side effects, not for producing values.
- MUST NOT read and write the same state inside an `$effect` without wrapping the read (or write) in `untrack()` — an untracked self-referential read/write causes an infinite effect loop.
- MUST NOT rely on reactive dependencies still being tracked after an `await` inside `$effect`/`$derived.by()` — only reads before the first await are tracked, so reads after it won't trigger reruns.
- MUST NOT access `document`/`window` in module-level or component-init code without a browser guard, since that code also runs during SSR.
- MUST NOT mutate a store's internal value object directly — go through `set`/`update`.

## Ecosystem Idioms & Conventions

- Prefer `$derived`/`$derived.by()` (or derived stores/reactive `$:` declarations in legacy code) for computed values instead of recomputing the same thing in multiple places.
- Keep component-local state local (`$state()`); promote it to a store only once multiple components need it.
- Use slots (or snippets) and props for composition instead of duplicating markup across similar components.
- Prefer actions (`use:`) for reusable DOM behavior instead of copy-pasted lifecycle code.
- Keep `.svelte` files focused on markup and binding; move non-trivial logic into plain `.ts` modules.
