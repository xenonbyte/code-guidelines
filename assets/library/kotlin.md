---
name: kotlin
description: Semantic correctness guardrails for Kotlin beyond what ktlint/detekt enforce mechanically.
appliesTo: ["**/*.kt", "**/*.kts"]
stacks: ["kotlin"]
source: original
---

# Kotlin

## Hard Constraints (MUST NOT)

- MUST NOT use the not-null assertion operator (`!!`) as a routine way to silence nullability errors; handle null explicitly.
- MUST NOT launch a coroutine with `GlobalScope` from application/business logic; scope coroutines to a lifecycle-aware or structured-concurrency scope.
- MUST NOT mutate a `var` property shared across coroutines or threads without synchronization.
- MUST NOT launch a coroutine with an exception handler that silently absorbs failures.
- MUST NOT expose mutable collection types (`MutableList`, `MutableMap`) from a public API when a read-only view suffices.
- MUST NOT let a Java platform type (`T!`) flow into Kotlin unannotated; assign an explicit nullable or non-null type at the interop boundary.
- MUST NOT manage a `Closeable` with manual try/finally; use `use { }` so it closes even on exception.

## Ecosystem Idioms & Conventions

- Model nullability explicitly; prefer safe calls (`?.`) and the Elvis operator (`?:`) over defensive `if` chains.
- Prefer data classes for value-holder types to get `equals`/`hashCode`/`copy` for free.
- Use sealed classes/interfaces to model closed sets of states, checked exhaustively with `when`.
- Prefer structured concurrency (`coroutineScope`, lifecycle-scoped builders) over manually managed threads.
- Favor extension functions for utility behavior over static helper classes.
