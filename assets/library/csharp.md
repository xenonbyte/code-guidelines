---
name: csharp
description: Semantic correctness guardrails for C# beyond what Roslyn analyzers enforce mechanically.
appliesTo: ["**/*.cs"]
stacks: ["csharp"]
source: original
---

# C#

## Hard Constraints (MUST NOT)

- MUST NOT catch `Exception` broadly and swallow it without rethrowing, wrapping, or logging with context.
- MUST NOT use `async void` methods except for top-level event handlers; use `async Task` elsewhere so exceptions propagate.
- MUST NOT block on asynchronous code with `.Result`/`.Wait()` when the call path can instead be made `async` end-to-end.
- MUST NOT expose mutable fields or mutable collections as public members; expose controlled properties or read-only views.
- MUST NOT rely on a finalizer to dispose of an `IDisposable`; use `using`/`await using`.

## Ecosystem Idioms & Conventions

- Prefer records for immutable data-carrying types.
- Use nullable reference type annotations deliberately and honor them rather than suppressing warnings.
- Prefer LINQ for declarative collection transformations over manual loops where it improves readability.
- Use constructor-based dependency injection rather than service locators.
- Prefer `IEnumerable<T>`/`IReadOnlyList<T>` in public signatures unless the caller genuinely needs to mutate.
