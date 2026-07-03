Every run ends with a status report, whether or not anything was written:

- **This run's changes** — files added, removed, and upgraded; files skipped, each with the reason (most commonly: the file's on-disk content no longer matches the manifest, meaning the user edited it).
- **`project-conventions.md` status** — whether it exists, and if so, the date it was last distilled. This is a fact, not a judgment: this command never claims conventions are stale.
- When nothing needed to change: "already up to date, nothing changed," with zero files written.
- A closing one-line pointer that the companion commands exist: `/code-guidelines-lint` arms machine-enforced lint baselines for the detected stack, `/code-guidelines-distill` mines this repository's own conventions. This command runs neither.

`--dry-run` computes and prints this same report without writing anything. `--json` prints the machine-readable equivalent:

    {
      "upToDate": false,
      "added": ["..."],
      "removed": ["..."],
      "upgraded": ["..."],
      "skipped": [{ "file": "...", "reason": "..." }],
      "conventions": { "present": true, "distilledAt": "..." },
      "exitCode": 0
    }

Exit codes are shared across this package's commands: `0` success; `2` usage error; `3` the platform precheck aborted (entry-point file missing); `4` a conflict or safety abort (a user-modified file, a rejected symlink, or a malformed managed block).
