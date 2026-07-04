---
name: web-perf
description: Cross-cutting web performance guardrails aligned to Core Web Vitals (LCP, INP, CLS), independent of any one frontend framework.
appliesTo: ["**/*.tsx", "**/*.jsx", "**/*.vue", "**/*.html", "**/*.svelte"]
stacks: ["web-perf", "frontend"]
source: original
---

# Web Performance

## Hard Constraints (MUST NOT)

- MUST NOT ship an `<img>`/media element without explicit `width`/`height` (or `aspect-ratio`) — the browser can't reserve space before the asset loads, causing a layout shift that pushes Cumulative Layout Shift (CLS) above the 0.1 "good" threshold.
- MUST NOT block the main thread with a long synchronous task (heavy computation, large synchronous JSON parse) inside an event handler — long tasks delay the next paint after user input and push Interaction to Next Paint (INP) past the 200ms "good" threshold.
- MUST NOT render-block the initial viewport behind a large unoptimized hero image, an unpreloaded web font, or a synchronous third-party script — these are the dominant causes of Largest Contentful Paint (LCP) exceeding the 2.5s "good" threshold.
- MUST NOT inject content above already-rendered content (banners, ads, late-loading widgets) without a reserved slot — this is a common CLS regression even when the rest of the layout is stable.
- MUST NOT ship the entire application bundle to render a single route — split by route/feature so the client only downloads and parses what the current page needs.
- MUST NOT attach a non-passive scroll/touch listener that conditionally calls `preventDefault` on a hot path — it forces the browser to wait for JS before it can scroll, hurting responsiveness metrics.

## Ecosystem Idioms & Conventions

- Measure Core Web Vitals at the 75th percentile of real user page loads (field data), not just single lab-tool runs, before treating a metric as "passing."
- Preload the LCP candidate resource (hero image, critical font) and use `fetchpriority="high"` where the framework/browser supports it.
- Lazy-load below-the-fold images/iframes (`loading="lazy"`) and code-split non-critical JS (dynamic `import()`) instead of loading everything eagerly.
- Debounce/throttle expensive handlers (resize, scroll, input) and move genuinely heavy work off the main thread (web workers) where possible.
- Track all three Core Web Vitals (LCP, INP, CLS) in production monitoring, not only in CI/lab checks, since real device/network conditions dominate the numbers.
