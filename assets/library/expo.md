---
name: expo
description: Semantic Expo/EAS guardrails for environment-variable exposure, OTA update safety, and native config-plugin discipline.
appliesTo: ["**/*.tsx", "**/*.jsx", "**/app.json", "**/app.config.*", "**/eas.json"]
stacks: ["expo"]
source: original
---

# Expo

## Hard Constraints (MUST NOT)

- MUST NOT put secrets or API keys in an `EXPO_PUBLIC_`-prefixed environment variable — anything with that prefix is inlined into the JS bundle at build time and readable by any end user who inspects the app.
- MUST NOT use `eas.json`'s `env` field for passwords or secrets — it is documented for values you would commit to git; use EAS environment variables (`eas env:create`) with a non-plaintext visibility instead.
- MUST NOT hand-edit generated `ios/`/`android/` native project files in a managed workflow — `expo prebuild` regenerates them and silently discards manual edits; make native changes through a config plugin in `app.config.js`.
- MUST NOT ship a native module addition, new permission, or native dependency bump as an `expo-updates` OTA update — JS-only OTA updates cannot change compiled native code or Info.plist/AndroidManifest permissions; those require a new store build.
- MUST NOT publish an EAS Update straight to the `production` channel without first validating it on a preview/internal channel — a broken JS bundle pushed to production strands every user on that channel with no store review to catch it before rollout.
- MUST NOT block the JS thread with synchronous heavy computation inside an `expo-router` route component — it stalls navigation transitions and gesture handling for the whole app.

## Ecosystem Idioms & Conventions

- Use `expo-router`'s file-based routing (`app/` directory) for screens/layouts instead of hand-wiring a separate navigation library.
- Keep platform divergence in `.ios.tsx`/`.android.tsx` file-suffix variants or `Platform.select`, not scattered runtime `if` branches.
- Prefer Expo's first-party modules (`expo-secure-store`, `expo-camera`, `expo-notifications`) over community native modules for prebuild/EAS Build compatibility.
- Treat `app.config.js` as the single source of build-time configuration; don't duplicate the same values into `eas.json`.
- Gate EAS Update rollouts behind channel/branch mapping and monitor crash-free rate before promoting a release to more users.
