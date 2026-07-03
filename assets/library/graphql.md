---
name: graphql
description: Semantic GraphQL guardrails for query cost, N+1 avoidance, and field-level authorization.
appliesTo: ["**/*.graphql", "**/*.gql", "**/*.resolver.ts", "**/*.resolver.js", "**/resolvers/**", "**/schema.ts", "**/schema.js"]
stacks: ["graphql", "backend"]
source: original
---

# GraphQL

## Hard Constraints (MUST NOT)

- MUST NOT expose a schema without bounding query depth and complexity/cost - an unbounded schema lets a single query fan out into an unbounded number of nested resolvers (denial of service).
- MUST NOT resolve a list field's per-item relations with one DB call per item - batch with a DataLoader (or equivalent) to avoid N+1 across a single request.
- MUST NOT perform authorization only at the top-level query/mutation and skip it on nested fields that return sensitive data - check authorization at the field/type level where the data is actually resolved.
- MUST NOT return raw internal error messages or stack traces in the `errors` array of a production response.
- MUST NOT let a mutation resolver perform a non-idempotent side effect without input validation equivalent to a REST endpoint's.

## Ecosystem Idioms & Conventions

- Batch and cache per-request with a DataLoader keyed by request/context, not a shared global cache.
- Keep resolvers thin; delegate business logic to service functions shared with any REST equivalent.
- Use persisted queries or an allowlist in production to prevent arbitrary client-supplied queries.
- Evolve the schema additively (deprecate fields with `@deprecated`) rather than making breaking changes.
- Paginate list fields (cursor-based `Connection` pattern) instead of returning unbounded arrays.
