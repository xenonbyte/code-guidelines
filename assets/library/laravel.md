---
name: laravel
description: Semantic Laravel guardrails for Eloquent query safety, request validation, and mass-assignment protection.
appliesTo: ["**/app/Http/Controllers/**/*.php", "**/app/Models/**/*.php"]
stacks: ["laravel", "backend"]
source: original
---

# Laravel

## Hard Constraints (MUST NOT)

- MUST NOT pass raw request input to `Model::create()`/`fill()` without a `$fillable`/`$guarded` allowlist - unguarded mass assignment lets attackers set arbitrary columns.
- MUST NOT build queries with raw string interpolation (`DB::raw`, `whereRaw` with concatenated input) - bind parameters instead.
- MUST NOT validate input with scattered manual `if` checks in a controller when a Form Request (`$request->validate()` or a dedicated `FormRequest` class) can declare the rules.
- MUST NOT access a relationship inside a loop without eager loading (`with()`) - this is Eloquent's N+1 trap.
- MUST NOT commit secrets (`APP_KEY`, DB credentials, API tokens) into `config/*.php` as literals - read them from `.env` via `env()`/config caching.

## Ecosystem Idioms & Conventions

- Prefer Form Request classes for validation and authorization so controllers stay thin.
- Use Eloquent relationships and query scopes instead of hand-written joins for common access patterns.
- Wrap multi-step writes in `DB::transaction()`.
- Use Jobs/Queues for slow or non-critical work (email, exports) instead of blocking the request-response cycle.
- Use Policies/Gates for authorization checks instead of inline role checks scattered across controllers.
