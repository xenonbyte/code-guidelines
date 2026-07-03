---
name: react-native
description: Semantic React Native guardrails for platform divergence, list virtualization, and secure storage beyond React's own rules.
appliesTo: ["**/*.tsx", "**/*.jsx", "**/metro.config.*"]
stacks: ["react-native"]
source: original
---

# React Native

## Hard Constraints (MUST NOT)

- MUST NOT block the JS thread with synchronous heavy computation during interaction or animation — offload it or break it into chunks.
- MUST NOT mutate state directly instead of using a state setter/hook — React Native shares React's reactivity contract.
- MUST NOT call a platform-specific API without a `Platform.OS`/`Platform.select` branch or a platform-specific file, causing a runtime crash on the other platform.
- MUST NOT store sensitive tokens or credentials in `AsyncStorage` in plaintext — use secure, Keychain/Keystore-backed storage instead.
- MUST NOT manipulate the navigation stack outside the navigation library's own API.

## Ecosystem Idioms & Conventions

- Prefer `FlatList`/`SectionList` (virtualized) over mapping large arrays to `View` children for scrollable lists.
- Extract platform-diverging logic into `.ios.tsx`/`.android.tsx` files rather than inline branching everywhere.
- Enable the native driver (`useNativeDriver: true`) for animations whose properties support it.
- Prefer a typed navigation param list over untyped route params.
- Keep business logic in hooks/services shareable with a web codebase; keep native modules thin and isolated.
