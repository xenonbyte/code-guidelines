---
name: aspnet-core
description: Semantic ASP.NET Core guardrails for dependency injection lifetimes, async correctness, and model validation.
appliesTo: ["**/Controllers/**/*.cs", "**/Program.cs"]
stacks: ["aspnet-core", "backend"]
source: original
---

# ASP.NET Core

## Hard Constraints (MUST NOT)

- MUST NOT inject a scoped or transient service into a singleton - the singleton captures the first-resolved instance for the app's lifetime, causing state leaks or `ObjectDisposedException` for scoped resources like `DbContext`.
- MUST NOT call `.Result`/`.Wait()`/`.GetAwaiter().GetResult()` on a `Task` in request-handling code - it blocks a thread pool thread and can deadlock under a synchronization context.
- MUST NOT accept a request DTO in an action without model validation (`[ApiController]`'s automatic `ModelState` check, or explicit checks) before using it.
- MUST NOT share a single `DbContext` instance across concurrent requests - it is not thread-safe; resolve it scoped per-request via DI.
- MUST NOT store secrets/connection strings in `appsettings.json` checked into source - use user-secrets, environment variables, or a secret manager.

## Ecosystem Idioms & Conventions

- Use constructor injection for dependencies and register them with the narrowest correct lifetime (transient/scoped/singleton).
- Prefer `async`/`await` end-to-end through controller actions and services for I/O-bound work.
- Use minimal API endpoints or thin controllers; push logic into injectable services.
- Centralize error handling via exception-handling middleware rather than per-action try/catch.
- Use `IOptions<T>`/`IOptionsSnapshot<T>` for typed configuration instead of raw `IConfiguration` string lookups scattered through the codebase.
