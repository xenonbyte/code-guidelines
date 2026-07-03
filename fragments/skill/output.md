Every no-argument run ends with a status report, whether or not anything was written:

- **This run's changes** — files added, removed, and upgraded; files skipped, each with the reason (most commonly: the file's on-disk content no longer matches the manifest, meaning the user edited it).
- **Lint arming** — for every stack with a lint baseline: armed / has a gap (with the exact command to install the missing tool) / opted out (the user removed a previously armed scaffold and it has not been re-confirmed).
- **`project-conventions.md` status** — whether it exists, and if so, the date it was last distilled. This is a fact, not a judgment: this skill never claims conventions are stale.
- When nothing needed to change: "already up to date, nothing changed," with zero files written.

`--dry-run` computes and prints this same report without writing anything. `--json` prints the machine-readable equivalent:

    {
      "upToDate": false,
      "added": ["..."],
      "removed": ["..."],
      "upgraded": ["..."],
      "skipped": [{ "file": "...", "reason": "..." }],
      "lint": [{ "tool": "...", "armed": true, "gap": false, "installCmd": "...", "optedOut": false }],
      "conventions": { "present": true, "distilledAt": "..." },
      "exitCode": 0
    }

Exit codes are shared with the rest of this tool: `0` success; `2` usage error; `3` the platform precheck aborted (entry-point file missing); `4` a conflict or safety abort (a user-modified file, a rejected symlink, or a malformed managed block).

A `distill` run's own output is the new or refreshed `.code-guidelines/project-conventions.md` file plus, on a protected overwrite, a comparison report of the existing content against a fresh distillation — never a silent overwrite.
