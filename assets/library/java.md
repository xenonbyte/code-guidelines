---
name: java
description: Semantic correctness guardrails for Java beyond what Checkstyle enforces mechanically.
appliesTo: ["**/*.java"]
stacks: ["java"]
source: original
---

# Java

## Hard Constraints (MUST NOT)

- MUST NOT catch `Exception` or `Throwable` broadly and swallow it without rethrowing or logging with context.
- MUST NOT use mutable static fields for request-scoped or session-scoped state.
- MUST NOT return `null` from a method whose contract implies a collection; return an empty collection instead.
- MUST NOT perform blocking I/O inside code paths documented as non-blocking without an explicit scheduler switch.
- MUST NOT expose mutable internal collections directly from getters; return defensive copies or immutable views.

## Ecosystem Idioms & Conventions

- Prefer constructor injection over field injection for dependencies.
- Favor immutable objects (final fields, builder pattern) for value types.
- Use `Optional<T>` for return types that may legitimately be absent; avoid it for fields or parameters.
- Prefer try-with-resources for any `AutoCloseable` resource.
- Keep interfaces small and role-based rather than one large service interface.
