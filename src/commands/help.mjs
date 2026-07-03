// src/commands/help.mjs — prints CLI usage information (SPEC-CLI-001).
const USAGE = `code-guidelines — progressive coding-guideline installer

Usage:
  code-guidelines version                        Print the installed version
  code-guidelines help                           Show this usage information
  code-guidelines install [--platform <csv>]     Install for one or more platforms
  code-guidelines uninstall [--platform <csv>]   Uninstall for one or more platforms
  code-guidelines status                         Report installed manifest state (read-only)

Options:
  --platform <csv>  Comma-separated list of claude,codex,opencode,gemini (default: all)

Aliases:
  --version, -v   same as "version"
  --help, -h      same as "help"`;

export function help() {
  console.log(USAGE);
  return 0;
}
