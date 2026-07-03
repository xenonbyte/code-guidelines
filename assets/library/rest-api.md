---
name: rest-api
description: Semantic REST API design guardrails for versioning, error handling, and idempotency, independent of any one framework.
appliesTo: ["**/routes/**", "**/controllers/**", "**/*.controller.*"]
stacks: ["rest-api", "backend"]
source: original
---

# REST API

## Hard Constraints (MUST NOT)

- MUST NOT break backward compatibility of a published API version silently; version the API (URL path, header, or media type) and deprecate with advance notice.
- MUST NOT return inconsistent error shapes across endpoints; use one error envelope (e.g. `{ error: { code, message, details } }`) for every failure response.
- MUST NOT make `PUT` or `DELETE` non-idempotent; repeating the identical request must not change the outcome beyond the first successful call.
- MUST NOT leak internal implementation details (stack traces, SQL fragments, internal IDs, file paths) in error responses returned to clients.
- MUST NOT use `GET` requests to perform state-mutating side effects; reserve mutation for `POST`/`PUT`/`PATCH`/`DELETE`.
- MUST NOT return `200 OK` for a failed operation; use accurate HTTP status codes (4xx for client errors, 5xx for server errors).
- MUST NOT expose an endpoint that reads or mutates non-public data without an authentication and authorization check.

## Ecosystem Idioms & Conventions

- Use plural nouns for collection resources (`/orders`, `/orders/{id}`) and keep nesting shallow.
- Support pagination (cursor- or offset-based) on any endpoint that can return an unbounded collection.
- Use status codes precisely: `201` with a `Location` header on create, `204` on empty success, `409` on conflict.
- Document the API with an OpenAPI/Swagger spec kept in sync with the implementation.
- Support idempotency keys on `POST` endpoints that create resources and may be safely retried by clients.
