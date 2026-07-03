---
name: rust
description: Semantic correctness guardrails for Rust beyond what clippy/rustfmt enforce mechanically.
appliesTo: ["**/*.rs"]
stacks: ["rust"]
source: original
---

# Rust

## Hard Constraints (MUST NOT)

- MUST NOT use `.unwrap()`/`.expect()` on `Result`/`Option` in library or production code paths where failure is a real possibility; propagate with `?` or handle it explicitly.
- MUST NOT use `unsafe` to bypass the borrow checker without a documented invariant proving soundness.
- MUST NOT clone data purely to sidestep a borrow-checker error without first considering a reference/lifetime redesign.
- MUST NOT let a fallible call's `Result` drop silently unused.
- MUST NOT implement `Drop` with logic that can panic.
- MUST NOT manually `impl Send`/`Sync` for a type unless the thread-safety invariant is documented and audited; rely on compiler auto-derivation instead.
- MUST NOT implement `Deref`/`DerefMut` on a type that is not a smart pointer; it causes surprising implicit coercions.

## Ecosystem Idioms & Conventions

- Model invalid states as unrepresentable using enums and the type system rather than runtime checks.
- Prefer `impl Trait`/generics over trait objects when dynamic dispatch is not required.
- Use a dedicated error enum (e.g. via `thiserror`) for library errors; reserve broad error types for application boundaries.
- Prefer iterators and combinators (`map`, `filter`, `collect`) over manual index loops.
- Keep `unsafe` blocks minimal and isolated behind a safe public API with documented invariants.
