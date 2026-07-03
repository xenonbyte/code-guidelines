---
name: html-css
description: Semantic HTML and CSS guardrails for structure, accessibility, and cascade discipline beyond stylelint formatting rules.
appliesTo: ["**/*.html", "**/*.css"]
stacks: ["html-css", "frontend"]
source: original
---

# HTML & CSS

## Hard Constraints (MUST NOT)

- MUST NOT use a non-semantic element (`div`/`span`) for structural content that has a native semantic equivalent (`nav`, `button`, `header`, `main`, a list).
- MUST NOT rely on color alone to convey state or meaning (errors, required fields, links) without a text or icon cue.
- MUST NOT remove the focus outline (`outline: none`) without providing an equally visible replacement focus style.
- MUST NOT nest interactive elements inside other interactive elements (e.g. a button inside a link).
- MUST NOT reach for `!important` as a routine substitute for correct selector specificity and cascade order.

## Ecosystem Idioms & Conventions

- Prefer semantic HTML5 landmarks (`header`, `nav`, `main`, `footer`) for page structure over generic containers.
- Use relative units (`rem`/`em`, `%`, `fr`) for typography and layout instead of hard-coded pixel values throughout.
- Prefer CSS Grid/Flexbox for layout over legacy float or absolute-positioning hacks.
- Scope component styles (CSS Modules, BEM, or shadow DOM) to avoid global class name collisions.
- Provide meaningful `alt` text for informative images and empty `alt=""` for purely decorative ones.
