---
name: ios-swiftui
description: Semantic SwiftUI guardrails for state ownership, view purity, and structured concurrency.
appliesTo: ["**/*.swift"]
stacks: ["ios-swiftui"]
source: original
---

# SwiftUI

## Hard Constraints (MUST NOT)

- MUST NOT mutate a view's `@State` from outside its owning view — pass a `@Binding` instead of reaching in.
- MUST NOT perform network or database calls directly inside a `body` computed property — `body` must stay a pure, side-effect-free description of UI.
- MUST NOT use `@State` for data that must survive beyond the view's lifetime or be shared across views — use `@StateObject`/`@ObservedObject`/`@EnvironmentObject` with an owning model instead.
- MUST NOT initialize a `@StateObject`'s underlying object inline in a way that recreates it on every body evaluation — construct it once, not per render.
- MUST NOT block the main thread with synchronous heavy work triggered from a view; use structured concurrency (`async`/`await`, `Task`) off the main actor.

## Ecosystem Idioms & Conventions

- Prefer small, composed views (extracted subviews) over one large `body` with deeply nested modifiers.
- Model view state with value types and drive UI from a single source of truth (`ObservableObject`) rather than scattered flags.
- Use `Task`/structured concurrency for async work instead of completion-handler callback pyramids.
- Prefer a custom `ViewModifier` for reusable styling instead of duplicating chains of modifiers across views.
- Keep navigation state in a model (`NavigationPath`/coordinator) rather than scattering `@State` booleans that gate presentation everywhere.
