---
name: astro
description: Architectural guardrails for Astro's islands architecture, hydration directives, and server/client boundary.
appliesTo: ["**/*.astro"]
stacks: ["astro", "frontend"]
source: original
---

# Astro

## Hard Constraints (MUST NOT)

- MUST NOT ship client-side JavaScript for a component with no interactivity — omit the `client:*` directive and let it render as static HTML.
- MUST NOT leak server-only secrets (API keys, tokens read in frontmatter) into a `client:*` hydrated island or the rendered HTML output.
- MUST NOT fetch data inside a `client:*` island when it can be fetched once in the component frontmatter at build/request time.
- MUST NOT share mutable state across independent islands via global `window` variables — islands are isolated by design.
- MUST NOT default every interactive island to `client:load` — pick the narrowest hydration directive (`client:idle`/`client:visible`) the interaction actually needs.

## Ecosystem Idioms & Conventions

- Prefer `.astro` components for static/structural content; reach for a UI framework component only where real interactivity is needed.
- Keep frontmatter (server-side) logic separate from the templated markup below the fence.
- Use content collections for structured content instead of ad hoc file parsing.
- Favor the islands architecture: isolate interactive widgets rather than hydrating whole pages.
- Colocate an island's framework-specific styles with the island component itself.
