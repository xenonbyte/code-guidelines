---
name: js-unit-test
description: Semantic guardrails for JavaScript/TypeScript unit tests (Jest/Vitest) around isolation, determinism, and assertion quality.
appliesTo: ["**/*.test.ts", "**/*.test.js", "**/__tests__/**"]
stacks: ["js-unit-test"]
source: original
---

# JS/TS Unit Testing

## Hard Constraints (MUST NOT)

- MUST NOT let a test depend on execution order or on state mutated by a previous test (shared module-level mutable state, un-reset mocks) - each test must be runnable in isolation and in any order.
- MUST NOT mock the unit under test itself, or mock so much of its collaborators that the test only verifies the mocks were called rather than real behavior.
- MUST NOT leave a test with no assertion, or with an assertion that can never fail (e.g. asserting a mock was defined) - a test that cannot fail is not a test.
- MUST NOT use real timers, real network calls, or real timestamps (`Date.now()`, `setTimeout`) directly in a unit test - fake or mock them, or the test becomes flaky and slow.
- MUST NOT swallow an assertion failure inside a `try/catch` in the test body - let it propagate so the test framework reports the failure.
- MUST NOT modify the code under test merely to make it easier to test - test the code as it is.

## Ecosystem Idioms & Conventions

- Structure tests as Arrange-Act-Assert (or Given-When-Then) so intent is readable without prose comments.
- Prefer testing observable behavior/output over internal implementation details that can change without the behavior changing.
- Reset and restore mocks/spies between tests (`beforeEach`/`afterEach`) instead of relying on manual cleanup at the end of each test.
- Keep each test focused on one logical behavior, even if that requires multiple `expect` calls that all check the same outcome.
- Prefer test doubles that fail loudly on an unexpected call over permissive stubs that silently return `undefined`.
