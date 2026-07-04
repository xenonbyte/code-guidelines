---
name: electron
description: Electron desktop-app security guardrails for renderer isolation, IPC trust boundaries, and content loading, per Electron's own security checklist.
appliesTo: ["**/main.js", "**/main.ts", "**/preload.js", "**/preload.ts", "**/electron/**"]
stacks: ["electron", "frontend"]
source: original
---

# Electron

## Hard Constraints (MUST NOT)

- MUST NOT set `nodeIntegration: true` or `contextIsolation: false` on a `BrowserWindow` that loads remote or user-influenced content — either disables the renderer's isolation from Node.js and turns any script-injection bug into full OS code execution.
- MUST NOT load and execute remote content (`loadURL` to a non-bundled origin) in a window with Node integration enabled — Node APIs must never be reachable from anything other than your own packaged, trusted files.
- MUST NOT use the deprecated `remote` module (or its `@electron/remote` successor) to hand a renderer direct access to main-process objects — expose only the specific, narrow operations a renderer needs via a `contextBridge` preload API.
- MUST NOT skip validating the sender/payload of an `ipcMain.on`/`.handle` listener — any renderer (including one that later loads attacker content) can send arbitrary IPC messages, so treat them as untrusted input.
- MUST NOT set `webSecurity: false` or disable the sandbox on a production `BrowserWindow` — both remove same-origin and process-isolation protections that contain a compromised renderer.
- MUST NOT open arbitrary URLs via `window.open`/`target="_blank"` without a `setWindowOpenHandler`/`will-navigate` check — unrestricted navigation lets a malicious link pivot the app into loading attacker-controlled content.
- MUST NOT ship an `autoUpdater` configuration that fetches updates over plain HTTP or skips signature verification — an unsigned/unverified update channel is a full remote-code-execution vector.

## Ecosystem Idioms & Conventions

- Expose only a minimal, purpose-built API from `preload.js` via `contextBridge.exposeInMainWorld`, never the raw `ipcRenderer`/`require`.
- Set a restrictive `Content-Security-Policy` in the loaded HTML for any window that renders remote or user-generated content.
- Keep the main process as the trust boundary: perform filesystem, network-credential, and native-API access there, not in the renderer.
- Use `<webview>` or a separate isolated `BrowserWindow`/`WebContentsView` (with Node integration off) to display untrusted remote content.
- Keep Electron and its bundled Chromium up to date; security fixes land per-release and don't backport indefinitely.
