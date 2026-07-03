Every run ends with a status report, whether or not anything was written. For every detected stack that has a lint baseline:

- **armed** — the scaffold was already in place, or was written this run;
- **armed, with a gap** — the scaffold is in place but the tool's dependency is missing, printed together with the exact command to install it (dependencies are never installed automatically);
- **existing config, read-only** — the tool already has its own configuration, so nothing was written; only the recommended rule set and a sample snippet are offered;
- **opted out** — the user deleted a previously armed scaffold and it has not been re-confirmed;
- **skipped (user-modified)** — the scaffold was hand-edited and is now the user's property;
- **skipped (path conflict)** — two baselines targeted the same path.
- When nothing needed to change: "already up to date, nothing changed," with zero files written.

`--dry-run` computes and prints this same report without writing anything. `--relint <tool>` clears a genuine opt-out (a fully deleted or managed-unmodified scaffold) and re-arms just that tool; a foreign existing config or a hand-modified scaffold is reported and never overwritten. `--json` prints the machine-readable equivalent:

    {
      "upToDate": false,
      "lint": [{ "tool": "...", "armed": true, "gap": false, "installCmd": "...", "optedOut": false }],
      "exitCode": 0
    }

Exit codes are shared across this package's commands: `0` success; `2` usage error; `4` a conflict or safety abort (a rejected symlink or a scaffold path conflict). This command does not maintain the entry-point managed block, so it never emits the `3` precheck code.
