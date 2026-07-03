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

## Ecosystem Idioms & Conventions

- Prefer value types (`struct`, `enum`) over `class` unless reference semantics or identity are required.
- Model state machines and closed variants with `enum` plus associated values.
- Use `guard` for early-exit precondition checks to keep the happy path unindented.
- Prefer Swift Concurrency (`async`/`await`, actors) over completion-handler callback chains for new code.
- Keep protocols small and focused rather than large monolithic protocols.
