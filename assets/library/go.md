---
name: go
description: Semantic correctness guardrails for Go beyond what golangci-lint enforces mechanically.
appliesTo: ["**/*.go"]
stacks: ["go"]
source: original
---

# Go

## Hard Constraints (MUST NOT)

- MUST NOT discard an error return value (e.g. `_ = err`); handle it or explicitly propagate it.
- MUST NOT use `panic` for ordinary error handling in library code; reserve it for truly unrecoverable programmer errors.
- MUST NOT share a mutable value across goroutines without a synchronization primitive (mutex, channel).
- MUST NOT return a typed-nil pointer wrapped in an interface and treat it as if the interface itself were `nil`.
- MUST NOT block a caller indefinitely on a channel or goroutine without a `context` deadline or cancellation path.
- MUST NOT close a channel from a receiver; only the owning sender may close a channel.
- MUST NOT both log and return the same error; handle it once - wrap with `%w` and return, or log and handle at a boundary.
- MUST NOT build SQL or shell commands by concatenating untrusted input; use parameterized queries or argument vectors instead.

## Ecosystem Idioms & Conventions

- Return errors as the last value and check them immediately at the call site.
- Wrap errors with context (`fmt.Errorf("...: %w", err)`) instead of losing the original cause.
- Accept interfaces as parameters, return concrete structs.
- Keep goroutine lifetimes bounded and thread `context.Context` through call chains for cancellation.
- Define small, focused interfaces at the point of use rather than centralizing them in one package.
- Use `defer` for cleanup immediately after acquiring a resource.
