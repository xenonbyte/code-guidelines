---
name: fastapi
description: Semantic FastAPI guardrails for Pydantic validation, dependency injection, and async correctness.
appliesTo: ["**/main.py", "**/routers/**/*.py", "**/schemas.py"]
stacks: ["fastapi", "backend"]
source: original
---

# FastAPI

## Hard Constraints (MUST NOT)

- MUST NOT accept a raw `dict`/`Any` request body where a Pydantic model can define and validate the expected shape.
- MUST NOT call blocking/sync I/O (a blocking DB driver, `requests`, CPU-bound work) directly inside an `async def` path operation without offloading it (`run_in_threadpool`, a background worker, or an async driver).
- MUST NOT duplicate cross-cutting concerns (auth, DB session, pagination params) by hand in every route instead of using FastAPI's `Depends` dependency injection.
- MUST NOT leak internal exception details (stack traces, DB errors) in an HTTP response body - return a sanitized `HTTPException` detail.
- MUST NOT share a single DB session/connection across concurrent requests - scope it per-request via a dependency.
- MUST NOT hand-roll auth checks in a route body - require an auth dependency (`Depends(get_current_user)`) on every protected/business endpoint.
- MUST NOT raise `HTTPException` (or import `Request`/`Response`) from service/business-logic code - raise domain exceptions and translate to HTTP status only in the route handler.
- MUST NOT return a DB/ORM object from a route without declaring `response_model` (or an explicit response schema) - otherwise internal fields can leak.
- MUST NOT instantiate a new `httpx.AsyncClient` (or other pooled client) per call - use one shared client per dependency, closed in the app's lifespan handler.

## Ecosystem Idioms & Conventions

- Prefer Pydantic models for both request and response schemas (`response_model=`).
- Use `Depends()` for shared setup (auth, DB session, settings) rather than importing globals into each router function.
- Keep path operation functions thin; push business logic into service functions that are independently testable.
- Use `async def` consistently for I/O-bound routes when the underlying driver is async-native (e.g. `asyncpg`, `httpx`).
- Version and group routes with `APIRouter(prefix=...)` rather than duplicating path prefixes per route.
