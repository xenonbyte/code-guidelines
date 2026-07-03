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
- MUST NOT create or own an `@ObservedObject` inside a view — it has no storage ownership and gets reconstructed on redraw; use `@StateObject` for objects the view creates (inline initialization is correct there), and reserve `@ObservedObject` only for objects owned by and passed in from a parent.
- MUST NOT block the main thread with synchronous heavy work triggered from a view; use structured concurrency (`async`/`await`, `Task`) off the main actor.
- MUST NOT bind into an `@Observable` model through `@ObservedObject`/`@StateObject` framing — use `@Bindable` for two-way bindings to Observation-macro types.
- MUST NOT use a non-stable or index-based `id` in `ForEach` over mutable/reorderable data — rows must be `Identifiable` or keyed by a stable unique id.
- MUST NOT launch view-scoped async work with a manual `Task {}` in `onAppear` — use `.task`/`.task(id:)` so SwiftUI cancels it on disappear or identity change.

## Ecosystem Idioms & Conventions

- Prefer small, composed views (extracted subviews) over one large `body` with deeply nested modifiers.
- Model view state with value types and drive UI from a single source of truth (`ObservableObject`) rather than scattered flags.
- Use `Task`/structured concurrency for async work instead of completion-handler callback pyramids.
- Prefer a custom `ViewModifier` for reusable styling instead of duplicating chains of modifiers across views.
- Keep navigation state in a model (`NavigationPath`/coordinator) rather than scattering `@State` booleans that gate presentation everywhere.
