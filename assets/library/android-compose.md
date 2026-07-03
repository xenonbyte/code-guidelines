---
name: android-compose
description: Semantic Jetpack Compose guardrails for recomposition scope, state hoisting, and side-effect placement.
appliesTo: ["**/*.kt"]
stacks: ["android-compose"]
source: original
---

# Jetpack Compose

## Hard Constraints (MUST NOT)

- MUST NOT read or write mutable state directly inside a `@Composable` function body without `remember`/`State` — recomposition will lose or duplicate it.
- MUST NOT perform side effects (network calls, logging, navigation) directly in a `@Composable` body — use `LaunchedEffect`/`SideEffect`/`DisposableEffect` scoped to the composition lifecycle.
- MUST NOT hoist all state to the top of the tree by default — unnecessarily wide state ownership causes unrelated recompositions.
- MUST NOT block the main thread with synchronous I/O or heavy computation inside a composable or its recomposition path.
- MUST NOT drive a `LazyColumn`/`LazyRow` from a list without a stable `key`, breaking item identity across recompositions.

## Ecosystem Idioms & Conventions

- Practice state hoisting: keep composables stateless where possible, passing state and lambdas down from a single owner.
- Use `remember`/`rememberSaveable` to survive recomposition and configuration changes respectively.
- Prefer `LazyColumn`/`LazyRow` with stable keys over manually iterating and emitting large item lists.
- Keep composables small and named for what they render; extract `@Preview` functions for isolated iteration.
- Route side effects through a `ViewModel` exposing `State`/`Flow` rather than triggering them from the UI layer directly.
