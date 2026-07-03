---
name: php
description: Semantic correctness guardrails for PHP beyond what PHP-CS-Fixer/PHPStan enforce mechanically.
appliesTo: ["**/*.php"]
stacks: ["php"]
source: original
---

# PHP

## Hard Constraints (MUST NOT)

- MUST NOT use the `@` error-suppression operator to silence a warning/error instead of handling the underlying condition.
- MUST NOT interpolate unescaped user input directly into SQL strings; use parameterized queries/prepared statements.
- MUST NOT rely on loose comparison (`==`) for type-sensitive checks such as hash or token comparison; use strict comparison (`===`) or a timing-safe helper for secrets.
- MUST NOT catch `\Throwable`/`\Exception` broadly and discard it without logging or rethrowing.
- MUST NOT use global mutable state (`global` keyword, static class state) to pass request-scoped data between unrelated components.
- MUST NOT call `unserialize()` on untrusted input (PHP object injection via magic methods); use JSON, or pass `['allowed_classes' => false]` if unavoidable.
- MUST NOT pass user-controlled values into `include`/`require`(`_once`) without a strict allow-list; this enables local/remote file inclusion.
- MUST NOT call `extract()` on request data (`$_GET`/`$_POST`/`$_REQUEST`); it lets an attacker overwrite arbitrary local variables.

## Ecosystem Idioms & Conventions

- Prefer typed properties and return types on all new code over untyped/mixed.
- Prefer dependency injection over static facades/service locators for testability.
- Use `readonly` properties for value objects that should not change after construction.
- Prefer exceptions for error signaling over magic return values (`false`, `-1`, `null`) for failure.
- Keep controllers/handlers thin; push business logic into dedicated services/domain classes.
