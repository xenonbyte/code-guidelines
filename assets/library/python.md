---
name: python
description: Semantic correctness guardrails for Python beyond what ruff/mypy enforce mechanically.
appliesTo: ["**/*.py"]
stacks: ["python"]
source: original
---

# Python

## Hard Constraints (MUST NOT)

- MUST NOT use mutable default arguments (e.g. `def f(x=[])`); they are shared across all calls.
- MUST NOT use a bare `except:` or a blanket `except Exception:` without re-raising or explicitly handling the failure.
- MUST NOT use `assert` for runtime input validation on production code paths; assertions are stripped under `-O`.
- MUST NOT shadow builtins (`list`, `dict`, `id`, `type`) as variable or parameter names.
- MUST NOT perform blocking I/O inside an `async def` function without an async-safe wrapper.

## Ecosystem Idioms & Conventions

- Prefer context managers (`with`) for any resource that must be released deterministically (files, locks, connections).
- Prefer dataclasses or `NamedTuple` over ad-hoc dict-as-struct for structured data.
- Prefer f-strings for interpolation over manual string concatenation in loops.
- Use explicit `is None` / `is not None` checks for optional values that may legitimately be falsy (`0`, `""`, `[]`).
- Prefer generators/iterators for large or lazily-produced sequences over building full lists in memory.
- Add type hints to public function signatures even where mypy is not yet enforced project-wide.
