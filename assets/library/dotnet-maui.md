---
name: dotnet-maui
description: Semantic .NET MAUI guardrails for secure storage, DI service lifetimes, and platform-specific code isolation.
appliesTo: ["**/*.xaml", "**/*.xaml.cs", "**/MauiProgram.cs"]
stacks: ["dotnet-maui"]
source: original
---

# .NET MAUI

## Hard Constraints (MUST NOT)

- MUST NOT store secrets, tokens, or credentials in `Preferences` — it persists as plaintext via the platform's native key-value store (`NSUserDefaults`/`SharedPreferences`/`ApplicationDataContainer`) with no encryption; use `SecureStorage` for sensitive values.
- MUST NOT assume a `SecureStorage` value survives Android Auto Backup restoring the app to a new device — the encryption key doesn't transfer, so the restored ciphertext can't be decrypted; wrap reads in try/catch, call `RemoveAll` on failure, or exclude the SecureStorage file from backup.
- MUST NOT register a service holding per-page or per-user UI state as `Singleton` in `MauiProgram.cs` — use `Scoped`/`Transient` so state doesn't leak across navigation or between users on the same instance.
- MUST NOT perform blocking I/O or long-running work inside a lifecycle callback (`OnAppearing`, `OnStart`) on the calling thread — offload to a background `Task` and marshal UI updates back via `MainThread.BeginInvokeOnMainThread`.
- MUST NOT scatter `#if ANDROID`/`#if IOS` conditional compilation through shared view-model or business logic — isolate platform divergence behind an interface implemented once per platform folder.
- MUST NOT bind a XAML property/command to a heavy synchronous computation — the binding engine re-evaluates it on every property-changed notification, not once.

## Ecosystem Idioms & Conventions

- Register pages, view-models, and services in `MauiProgram.cs`'s `CreateMauiApp()` via `builder.Services`, and resolve them through constructor injection rather than a service-locator call.
- Reserve `Preferences` for non-sensitive user settings (theme, last-viewed tab) and `SecureStorage` for anything an attacker with device access shouldn't read.
- Prefer `CommunityToolkit.Mvvm` source generators (`[ObservableProperty]`, `[RelayCommand]`) over hand-written `INotifyPropertyChanged` boilerplate.
- Use `ConfigureLifecycleEvents` for platform lifecycle hooks instead of subclassing platform-native activity/delegate types directly.
- Keep platform-divergent implementations behind a shared interface with one partial-class/file per `Platforms/<OS>` folder.
