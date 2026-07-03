// src/cli.mjs — zero-dependency, hand-rolled CLI parsing and dispatch (SPEC-CLI-001).
import { version } from './commands/version.mjs';
import { help } from './commands/help.mjs';

export const PLATFORMS = ['claude', 'codex', 'opencode', 'gemini'];

const COMMAND_ALIASES = new Map([
  ['version', 'version'],
  ['--version', 'version'],
  ['-v', 'version'],
  ['help', 'help'],
  ['--help', 'help'],
  ['-h', 'help'],
  ['install', 'install'],
  ['uninstall', 'uninstall'],
  ['status', 'status'],
]);

const PLATFORM_AWARE_COMMANDS = new Set(['install', 'uninstall']);

/**
 * Parse CLI argv into { cmd, platforms, error }.
 * - cmd: one of 'version' | 'help' | 'install' | 'uninstall' | 'status', or null on error.
 * - platforms: resolved platform list for install/uninstall (defaults to all four), else null.
 * - error: a human-readable string describing the usage violation, or null on success.
 */
export function parseArgs(argv) {
  if (!Array.isArray(argv) || argv.length === 0) {
    return { cmd: null, platforms: null, error: 'missing command' };
  }

  const [first, ...rest] = argv;
  const cmd = COMMAND_ALIASES.get(first);
  if (!cmd) {
    return { cmd: null, platforms: null, error: `unknown command: ${first}` };
  }

  const allowsPlatform = PLATFORM_AWARE_COMMANDS.has(cmd);
  let platforms = null;

  for (let i = 0; i < rest.length; i += 1) {
    const token = rest[i];
    let key = token;
    let inlineValue = null;
    const eqIdx = token.startsWith('--') ? token.indexOf('=') : -1;
    if (eqIdx !== -1) {
      key = token.slice(0, eqIdx);
      inlineValue = token.slice(eqIdx + 1);
    }

    if (key !== '--platform' || !allowsPlatform) {
      return { cmd: null, platforms: null, error: `unknown option: ${token}` };
    }

    let rawValue = inlineValue;
    if (rawValue === null) {
      i += 1;
      rawValue = rest[i];
    }
    if (rawValue === undefined || rawValue === '') {
      return { cmd: null, platforms: null, error: '--platform requires a value' };
    }

    const values = rawValue.split(',').map((v) => v.trim());
    const seen = new Set();
    for (const value of values) {
      if (value === '') {
        return { cmd: null, platforms: null, error: 'malformed --platform value' };
      }
      if (!PLATFORMS.includes(value)) {
        return { cmd: null, platforms: null, error: `unknown platform: ${value}` };
      }
      if (seen.has(value)) {
        return { cmd: null, platforms: null, error: `duplicate platform: ${value}` };
      }
      seen.add(value);
    }
    platforms = values;
  }

  if (allowsPlatform && platforms === null) {
    platforms = [...PLATFORMS];
  }

  return { cmd, platforms, error: null };
}

function printUsage() {
  console.error(`Usage: code-guidelines <command> [options]

Commands:
  version                        Print the installed version
  help                           Show usage information
  install [--platform <csv>]     Install code-guidelines for one or more platforms
  uninstall [--platform <csv>]   Uninstall code-guidelines for one or more platforms
  status                         Report installed manifest state (read-only)

Options:
  --platform <csv>  Comma-separated platform list: ${PLATFORMS.join(',')} (default: all)`);
}

export async function main(argv) {
  const { cmd, platforms, error } = parseArgs(argv);
  if (error) {
    printUsage();
    return 2;
  }

  switch (cmd) {
    case 'version':
      return version();
    case 'help':
      return help();
    case 'install': {
      const { install } = await import('./commands/install.mjs');
      return install(platforms);
    }
    case 'uninstall': {
      const { uninstall } = await import('./commands/uninstall.mjs');
      return uninstall(platforms);
    }
    case 'status': {
      const { status } = await import('./commands/status.mjs');
      return status();
    }
    default:
      printUsage();
      return 2;
  }
}
