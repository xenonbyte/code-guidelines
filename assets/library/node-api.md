---
name: node-api
description: Semantic guardrails for Node.js API servers (Express/Fastify/NestJS) around the event loop, request handling, and process safety.
appliesTo: ["**/routes/**/*.js", "**/routes/**/*.ts", "**/controllers/**/*.js", "**/controllers/**/*.ts", "**/server.js", "**/server.ts", "**/middleware/**", "**/*.middleware.*"]
stacks: ["node-api", "backend"]
source: original
---

# Node.js API

## Hard Constraints (MUST NOT)

- MUST NOT perform synchronous, blocking I/O (`fs.*Sync`, CPU-heavy loops) inside a request handler - it stalls the single event loop for every concurrent request.
- MUST NOT leave a rejected Promise or thrown error inside an async route handler unhandled - always route errors to `next(err)` (Express) or the framework's error hook; an uncaught rejection can crash the process.
- MUST NOT trust `req.body`/`req.params`/`req.query` without validating/parsing them (schema validator) before use in business logic or a DB query.
- MUST NOT read secrets or DB credentials from anywhere but environment/config at startup - never hardcode them or accept them from request input.
- MUST NOT hold request-scoped data in a single shared mutable module-level object - concurrent requests interleave on the same event loop tick and will corrupt each other's data.
- MUST NOT swallow errors with an empty catch in middleware; unresolved failures must propagate to the framework's centralized error handler.

## Ecosystem Idioms & Conventions

- Prefer async/await with a top-level try/catch (or an async-handler wrapper) over callback pyramids for request handlers.
- Terminate the process gracefully on `SIGTERM`/`SIGINT` - drain in-flight requests and close DB pools before exit.
- Stream large request/response bodies instead of buffering them fully in memory.
- Centralize validation, auth, and error-formatting as composable middleware rather than repeating per-route.
- Use structured logging (with a request/correlation id) instead of ad-hoc `console.log`.
