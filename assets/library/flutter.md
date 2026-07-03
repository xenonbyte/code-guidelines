---
name: flutter
description: Semantic Flutter/Dart guardrails for widget rebuild scope, state ownership, and side-effect placement.
appliesTo: ["**/*.dart"]
stacks: ["flutter"]
source: original
---

# Flutter

## Hard Constraints (MUST NOT)

- MUST NOT rebuild an entire widget subtree on every state change when only a leaf needs updating — scope state with a narrower widget (`Consumer`, `ValueListenableBuilder`) instead of a top-level `setState`.
- MUST NOT call `setState` (or notify listeners) during `build` — mutate state only in response to events or lifecycle callbacks.
- MUST NOT put business logic or network/database calls directly inside a widget's `build` method — belongs in a separate layer (bloc/provider/service).
- MUST NOT omit a `key` on items in a reorderable or rebuildable list — breaks widget identity and animation continuity.
- MUST NOT ignore a `Future` whose failure needs handling — `await` it or attach explicit error handling.
- MUST NOT mutate a domain/data model in place from the UI layer — treat models as immutable value objects (create a new instance to reflect changes) and keep data flowing one-way from the data layer to the UI.

## Ecosystem Idioms & Conventions

- Prefer composing small, focused widgets over one large monolithic `build` method.
- Use `const` constructors wherever the widget subtree is static, to skip unnecessary rebuilds.
- Pick one state-management pattern (Provider/Riverpod/Bloc) and use it consistently rather than mixing ad hoc `setState` with a framework.
- Abstract platform-specific behavior behind an interface rather than scattering `Platform.isIOS` checks through widgets.
- Prefer a router package or named routes for navigation instead of manually pushing raw `MaterialPageRoute` everywhere.
