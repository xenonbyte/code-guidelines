---
name: e2e-test
description: Semantic guardrails for end-to-end UI tests (Playwright/Cypress) around determinism, selector stability, and test independence.
appliesTo: ["**/*.spec.ts", "**/e2e/**"]
stacks: ["e2e-test"]
source: original
---

# End-to-End Testing

## Hard Constraints (MUST NOT)

- MUST NOT use fixed `sleep`/`wait(ms)` delays to synchronize with the UI - wait on an explicit condition (element visible, network response, state change) instead; fixed sleeps are both flaky and slow.
- MUST NOT select elements by brittle, presentation-coupled selectors (styling-only class names, nth-child position) when a stable test hook (`data-testid`, role, accessible name) is available.
- MUST NOT depend on a previous test's leftover data or execution order - each test must set up its own state (fixtures/seed/API calls) and clean up after itself.
- MUST NOT point end-to-end tests at a shared mutable production or staging environment that other tests/users can concurrently mutate - use an isolated environment or test-scoped data.
- MUST NOT suppress a flaky or failing test by wrapping it in a retry loop or swallowing its exceptions instead of fixing the root cause or removing it.

## Ecosystem Idioms & Conventions

- Prefer user-facing selectors (role, label, text, `data-testid`) that reflect how a real user finds the element.
- Seed required state through APIs/fixtures rather than driving the UI through every setup step (e.g. logging in via a UI form every test).
- Keep each test scoped to one user journey/scenario; avoid one long test asserting many unrelated things.
- Run tests against a representative environment (same build config as production) rather than a hand-tuned test-only page.
- Capture traces/screenshots/videos on failure so flaky or failing runs are diagnosable without local reproduction.
