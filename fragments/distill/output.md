This command's output is the new or refreshed `.code-guidelines/project-conventions.md` file plus its `conventions` record in `.code-guidelines/manifest.json` — never a silent overwrite. On a protected overwrite (the existing file was hand-edited since it was last distilled), the output is instead a comparison report of the existing content against a fresh distillation, and nothing is written until the user re-runs with `--force` or deletes the file first.

The deterministic recording seam reports its result on success (`conventions recorded: <hash> @ <date>`) and, on the overwrite guard, prints the old and new hashes with instructions to re-run with `--force` or delete the file.

Exit codes are shared across this package's commands: `0` success; `2` usage error; `4` the overwrite guard tripped or the target manifest was invalid. This command does not maintain the entry-point managed block, so it never emits the `3` precheck code.
