---
name: typescript
description: Semantic type-safety guardrails for TypeScript beyond what the compiler and linter enforce mechanically.
appliesTo: ["**/*.ts", "**/*.tsx"]
stacks: ["typescript"]
source: original
---

# TypeScript

## Hard Constraints (MUST NOT)

- MUST NOT use non-null assertions (`!`) or `as` type assertions to silence a type error without first proving the invariant holds; narrow or fix the type instead.
- MUST NOT chain double casts (`as unknown as X`) as a routine escape hatch around the type system.
- MUST NOT catch an error and rethrow a different type without preserving the original as `cause`.
- MUST NOT export mutable module-level state that other modules can silently mutate.
- MUST NOT leave a `Promise` unhandled; always `await` it or attach an explicit `.catch`.

## Ecosystem Idioms & Conventions

- Prefer `unknown` plus narrowing over `any` for values of uncertain shape.
- Model domain states with discriminated unions rather than optional-flag combinations.
- Prefer `readonly` types and arrays for data that must not mutate after construction.
- Use branded/nominal types for identifiers that share a primitive representation (e.g. `UserId` vs `OrderId`) when the distinction matters.
- Co-locate types with the module that owns them rather than centralizing everything in one omnibus types file.
- Derive shapes with utility types (`Pick`, `Omit`, `Partial`) instead of redeclaring overlapping interfaces.
