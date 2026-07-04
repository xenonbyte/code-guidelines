---
name: blazor
description: Semantic Blazor guardrails for render-mode security boundaries, JS-interop trust, and interactive-render lifecycle.
appliesTo: ["**/*.razor", "**/*.razor.cs"]
stacks: ["blazor", "frontend"]
source: original
---

# Blazor

## Hard Constraints (MUST NOT)

- MUST NOT place secrets, connection strings, or private business logic in a component compiled into a Blazor WebAssembly (`InteractiveWebAssembly`/`InteractiveAuto` client) app — the compiled assemblies ship to the browser and can be inspected/decompiled by any user regardless of `AuthorizeView` gating.
- MUST NOT rely on `<AuthorizeView>` or a client-side role check as the sole authorization gate for a mutating operation — re-check authorization server-side on every API call; client-side checks are UX only and can be bypassed.
- MUST NOT trust arguments a JavaScript interop call passes back into a `[JSInvokable]` .NET method — treat them as untrusted external input and validate them, the same as an HTTP request body.
- MUST NOT do expensive synchronous work inside a component's render path (`OnParametersSet`, template body) under `InteractiveServer` — it blocks the shared SignalR circuit and stalls every other update for that user's session.
- MUST NOT assume static server-side rendering (no `@rendermode`) supports two-way data binding or event handlers that need a live circuit — those require an interactive render mode to actually run.
- MUST NOT log raw JS-interop payloads or component parameters that may carry sensitive data — Blazor's own logging deliberately avoids this for the same reason.

## Ecosystem Idioms & Conventions

- Choose the render mode per component deliberately (`Static`, `InteractiveServer`, `InteractiveWebAssembly`, `InteractiveAuto`) rather than defaulting the whole app to one mode.
- Keep sensitive data and privileged logic behind a server-side Web API that a Blazor WebAssembly client calls, rather than embedding it in the client assembly.
- Use `EditForm`/`DataAnnotationsValidator` for form validation, backed by the same validation rules enforced server-side.
- Dispose of `IDisposable`/circuit-scoped resources (timers, subscriptions) in `Dispose`/`IAsyncDisposable` to avoid leaking state across a Server circuit's lifetime.
- Prefer a scoped `IJSObjectReference` for JS interop over global JS state when a component's JS side needs to be garbage-collected with the component.
