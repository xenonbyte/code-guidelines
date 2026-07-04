---
name: tailwind
description: Guardrails for using Tailwind's utility system consistently with the design token scale instead of ad hoc overrides.
appliesTo: ["**/*.css", "**/*.html", "**/*.tsx"]
stacks: ["tailwind", "frontend"]
source: original
---

# Tailwind CSS

## Hard Constraints (MUST NOT)

- MUST NOT build class names by string-concatenating dynamic fragments (e.g. `` `text-${color}-500` ``) — the compiler needs complete, static class strings to detect usage.
- MUST NOT reach for arbitrary-value utilities as a substitute for an existing design-token entry (spacing/color/breakpoint) — undermines the shared scale.
- MUST NOT use the `!` important modifier (e.g. `text-red-500!` in v4's trailing syntax) as a routine way to fight specificity instead of fixing the underlying conflict.
- MUST NOT duplicate the same long utility combination across many components instead of extracting a shared component or `@apply` class.
- MUST NOT ship an interactive element styled only with utility classes but no visible focus state.

## Ecosystem Idioms & Conventions

- Compose utilities directly in markup for one-off styling; extract with `@apply` or a component only for genuinely repeated patterns.
- Use the configured theme scale (spacing, color, breakpoints) over arbitrary values so the design stays consistent.
- Group variants logically in class order (base → hover/focus → responsive) for readability.
- Reach for semantic HTML elements first, then layer utility classes for presentation on top.
- Treat the Tailwind config as the single source of truth for design tokens rather than hard-coding values in components.
