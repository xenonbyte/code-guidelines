---
name: angular
description: Semantic Angular guardrails for dependency injection, subscription lifecycle, and change detection discipline.
appliesTo: ["**/*.component.ts", "**/*.module.ts"]
stacks: ["angular", "frontend"]
source: original
---

# Angular

## Hard Constraints (MUST NOT)

- MUST NOT mutate an `@Input()`-bound object or array inside the receiving component — it is owned by the parent.
- MUST NOT subscribe to an `Observable` without unsubscribing (or using the `async` pipe / `takeUntil`) — leaks subscriptions across component lifecycles.
- MUST NOT put non-trivial business logic in a template expression — move it into the component class or a service.
- MUST NOT instantiate a service with `new` instead of Angular's dependency injection — bypasses singleton scoping and testability.
- MUST NOT call HTTP APIs directly from a component — route them through an injectable service.

## Ecosystem Idioms & Conventions

- Prefer the `async` pipe over manual `subscribe`/`unsubscribe` calls inside components.
- Use `OnPush` change detection for presentational components to bound unnecessary re-renders.
- Extract shared state and logic into injectable services instead of duplicating it across components.
- Prefer reactive forms over template-driven forms for anything beyond a trivial input.
- Compose async flows with RxJS operators (`switchMap`, `debounceTime`) instead of nested subscriptions.
