---
name: ruby
description: Semantic correctness guardrails for Ruby beyond what RuboCop enforces mechanically.
appliesTo: ["**/*.rb"]
stacks: ["ruby"]
source: original
---

# Ruby

## Hard Constraints (MUST NOT)

- MUST NOT rescue `Exception` (as opposed to `StandardError` or a specific error class); it also catches signals and system-exit.
- MUST NOT use a bare `rescue` that swallows the error without logging or re-raising.
- MUST NOT monkey-patch core/library classes to work around a local problem instead of solving it in your own code.
- MUST NOT mutate a method argument in place when the caller does not expect the object to change, unless the method name signals mutation (e.g. `sort!`).
- MUST NOT build SQL/shell strings via interpolation of untrusted input; use parameterized queries or safe APIs.
- MUST NOT `eval`/`instance_eval`/`class_eval` untrusted or user-controlled input; it is arbitrary code execution.
- MUST NOT call `send`/`public_send` with a user-controlled method name; allow-list the permitted names so an attacker cannot invoke unintended methods.
- MUST NOT `Marshal.load`, or `YAML.load` (use `YAML.safe_load`), on untrusted data; both can construct arbitrary objects and execute code.
- MUST NOT call `to_sym`/`String#to_sym` on unbounded user input; interned symbols enable a memory-exhaustion (symbol) DoS.
- MUST NOT pass untrusted strings to `Kernel#open`/`IO.popen`-style methods; a leading `|` triggers shell command execution.

## Ecosystem Idioms & Conventions

- Rely on the last-expression-is-the-value convention; use explicit `return` only when it clarifies control flow.
- Favor small, single-responsibility plain objects over routing all logic through framework base classes.
- Use `Struct`/`Data.define` for simple value objects instead of hand-rolled `attr_accessor` classes.
- Prefer keyword arguments for methods with more than two parameters to keep call sites self-documenting.
- Keep metaprogramming (`define_method`, `method_missing`) isolated and documented; prefer explicit code where feasible.
