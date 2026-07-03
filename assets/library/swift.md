---
name: swift
description: Semantic correctness guardrails for Swift beyond what SwiftLint enforces mechanically.
appliesTo: ["**/*.swift"]
stacks: ["swift"]
source: original
---

# Swift

## Hard Constraints (MUST NOT)

- MUST NOT force-unwrap optionals (`!`) or force-try (`try!`) outside contexts where failure is provably impossible and documented as such.
- MUST NOT capture `self` strongly in a long-lived closure (stored callback, async task) without considering `[weak self]` to avoid retain cycles.
- MUST NOT discard an error from a `throws` function with `try?` when the failure needs to be surfaced.
- MUST NOT mutate shared mutable state from multiple concurrency domains without actor isolation or synchronization.
- MUST NOT use implicitly unwrapped optionals (`Type!`) for properties whose nil-ness is a normal, expected state.
- MUST NOT pass a non-`Sendable` value across an actor/task isolation boundary; make the type `Sendable`, use a `sending` parameter, or isolate the whole function.
- MUST NOT force `Sendable` conformance onto a type that only ever touches actor-owned or UI state; isolate the code (e.g. `@MainActor`) instead.

## Ecosystem Idioms & Conventions

- Prefer value types (`struct`, `enum`) over `class` unless reference semantics or identity are required.
- Model state machines and closed variants with `enum` plus associated values.
- Use `guard` for early-exit precondition checks to keep the happy path unindented.
- Prefer Swift Concurrency (`async`/`await`, actors) over completion-handler callback chains for new code.
- Keep protocols small and focused rather than large monolithic protocols.
