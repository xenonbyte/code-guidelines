import test from 'node:test';
import assert from 'node:assert/strict';
import { PLATFORMS, parseArgs, main } from '../src/cli.mjs';

test('PLATFORMS is the fixed four-platform set', () => {
  assert.deepEqual(PLATFORMS, ['claude', 'codex', 'opencode', 'gemini']);
});

test('parseArgs: version command and its aliases', () => {
  for (const argv of [['version'], ['--version'], ['-v']]) {
    const result = parseArgs(argv);
    assert.equal(result.cmd, 'version');
    assert.equal(result.error, null);
  }
});

test('parseArgs: help command and its aliases', () => {
  for (const argv of [['help'], ['--help'], ['-h']]) {
    const result = parseArgs(argv);
    assert.equal(result.cmd, 'help');
    assert.equal(result.error, null);
  }
});

test('parseArgs: install defaults --platform to all four platforms', () => {
  const result = parseArgs(['install']);
  assert.equal(result.cmd, 'install');
  assert.equal(result.error, null);
  assert.deepEqual(result.platforms, PLATFORMS);
});

test('parseArgs: install accepts an explicit --platform csv (space form)', () => {
  const result = parseArgs(['install', '--platform', 'claude,codex']);
  assert.equal(result.cmd, 'install');
  assert.equal(result.error, null);
  assert.deepEqual(result.platforms, ['claude', 'codex']);
});

test('parseArgs: install accepts --platform=csv inline form', () => {
  const result = parseArgs(['install', '--platform=gemini']);
  assert.equal(result.cmd, 'install');
  assert.equal(result.error, null);
  assert.deepEqual(result.platforms, ['gemini']);
});

test('parseArgs: uninstall defaults --platform to all four platforms', () => {
  const result = parseArgs(['uninstall']);
  assert.equal(result.cmd, 'uninstall');
  assert.equal(result.error, null);
  assert.deepEqual(result.platforms, PLATFORMS);
});

test('parseArgs: uninstall accepts an explicit --platform csv', () => {
  const result = parseArgs(['uninstall', '--platform', 'opencode']);
  assert.equal(result.cmd, 'uninstall');
  assert.equal(result.error, null);
  assert.deepEqual(result.platforms, ['opencode']);
});

test('parseArgs: status parses with no platform option required', () => {
  const result = parseArgs(['status']);
  assert.equal(result.cmd, 'status');
  assert.equal(result.error, null);
});

test('parseArgs: five commands all parse cleanly', () => {
  for (const argv of [['version'], ['help'], ['install'], ['uninstall'], ['status']]) {
    const result = parseArgs(argv);
    assert.equal(result.error, null, `expected no error for ${JSON.stringify(argv)}`);
  }
});

test('parseArgs: missing command is a usage error', () => {
  const result = parseArgs([]);
  assert.equal(result.cmd, null);
  assert.notEqual(result.error, null);
});

test('parseArgs: unknown command is a usage error (doctor is not implemented)', () => {
  const result = parseArgs(['doctor']);
  assert.equal(result.cmd, null);
  assert.notEqual(result.error, null);
});

test('parseArgs: unknown global option is a usage error', () => {
  const result = parseArgs(['version', '--bogus']);
  assert.notEqual(result.error, null);
});

test('parseArgs: --platform on a command that does not support it is a usage error', () => {
  const result = parseArgs(['status', '--platform', 'claude']);
  assert.notEqual(result.error, null);
});

test('parseArgs: unknown --platform value is a usage error', () => {
  const result = parseArgs(['install', '--platform', 'bogus']);
  assert.notEqual(result.error, null);
});

test('parseArgs: duplicate --platform value is a usage error', () => {
  const result = parseArgs(['install', '--platform', 'claude,claude']);
  assert.notEqual(result.error, null);
});

test('parseArgs: malformed --platform value (trailing comma) is a usage error', () => {
  const result = parseArgs(['install', '--platform', 'claude,']);
  assert.notEqual(result.error, null);
});

test('parseArgs: --platform missing a value entirely is a usage error', () => {
  const result = parseArgs(['install', '--platform']);
  assert.notEqual(result.error, null);
});

test('main: version command prints and exits 0', async () => {
  const code = await main(['version']);
  assert.equal(code, 0);
});

test('main: help command prints and exits 0', async () => {
  const code = await main(['help']);
  assert.equal(code, 0);
});

test('main: unknown command exits 2', async () => {
  const code = await main(['bogus']);
  assert.equal(code, 2);
});

test('main: unknown option exits 2', async () => {
  const code = await main(['version', '--bogus']);
  assert.equal(code, 2);
});

test('main: unknown --platform value exits 2', async () => {
  const code = await main(['install', '--platform', 'bogus']);
  assert.equal(code, 2);
});

test('main: duplicate --platform value exits 2', async () => {
  const code = await main(['install', '--platform', 'claude,claude']);
  assert.equal(code, 2);
});
