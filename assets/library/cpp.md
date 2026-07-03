---
name: cpp
description: Semantic memory-safety and correctness guardrails for C++ beyond what clang-format/clang-tidy enforce mechanically.
appliesTo: ["**/*.cpp", "**/*.cc", "**/*.hpp", "**/*.h"]
stacks: ["cpp"]
source: original
---

# C++

## Hard Constraints (MUST NOT)

- MUST NOT manage a raw owning pointer with manual `new`/`delete`; use RAII and smart pointers (`unique_ptr`, `shared_ptr`) instead.
- MUST NOT let an exception escape a destructor.
- MUST NOT use C-style casts to bypass the type system; use the appropriate named cast (`static_cast`, `dynamic_cast`, etc.) or redesign the type.
- MUST NOT return a reference or pointer to a local (stack) variable.
- MUST NOT share mutable state across threads without a synchronization primitive or a lock-free design with documented invariants.
- MUST NOT define one of the five special members (destructor, copy/move constructor, copy/move assignment) without considering all five (Rule of Five); prefer Rule of Zero when RAII members already suffice.
- MUST NOT violate the One Definition Rule: no conflicting or duplicate definitions of a non-inline entity across translation units.

## Ecosystem Idioms & Conventions

- Follow RAII for every resource: memory, file handles, locks, sockets.
- Maintain `const` correctness throughout signatures and member functions.
- Prefer standard containers and algorithms over hand-rolled loops.
- Pass small trivial types by value, larger objects by `const&`, and use move semantics for ownership transfer.
- Keep headers minimal (forward declarations, include guards) to control compile-time coupling.
