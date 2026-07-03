---
name: pytest
description: Semantic guardrails for pytest test suites around fixture design, isolation, and assertion quality.
appliesTo: ["**/test_*.py", "**/*_test.py"]
stacks: ["pytest"]
source: original
---

# pytest

## Hard Constraints (MUST NOT)

- MUST NOT put assertions or business logic inside a fixture that a test then implicitly relies on - a fixture that can silently fail an expectation hides the real assertion from the test body.
- MUST NOT let a fixture or test depend on execution order or on module-level mutable state left behind by another test - use function-scoped fixtures unless a broader scope is deliberately safe.
- MUST NOT catch and discard an exception inside a test with a bare `except: pass` to avoid a failure - let it propagate, or assert on it explicitly with `pytest.raises`.
- MUST NOT hit a real network endpoint, a real filesystem path outside a temp fixture (`tmp_path`), or a real database in a unit test - use a fixture/mock/test double for out-of-process dependencies.
- MUST NOT write a test that exercises more than one behavior per function - split into separate `test_` functions so a failure pinpoints exactly what broke.
- MUST NOT depend on real wall-clock time or `time.sleep` in a test - inject or monkeypatch the clock so timing is deterministic.
- MUST NOT verify an outcome with `print()`/manual output inspection instead of an `assert` - only assertions produce a pass/fail signal and failure introspection.

## Ecosystem Idioms & Conventions

- Use `pytest.mark.parametrize` for testing the same behavior across multiple input/output cases instead of duplicating near-identical test functions.
- Prefer `tmp_path`/`tmp_path_factory` fixtures for filesystem-touching tests instead of writing into a fixed path.
- Scope fixtures (`function`, `module`, `session`) deliberately based on cost and isolation needs, not by default habit.
- Use `pytest.raises(ExceptionType)` to assert an expected exception rather than a manual try/except with a `fail()` call.
- Keep `conftest.py` fixtures focused and discoverable; avoid one sprawling conftest with unrelated fixtures for the whole repo.
