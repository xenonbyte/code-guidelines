// src/commands/version.mjs — prints the installer's own version (SPEC-CLI-001).
// Resolves the version from package.json so this command is self-contained and does
// NOT depend on assets/VERSION (that file is created by a later task).
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const packageJsonPath = join(__dirname, '..', '..', 'package.json');

export function version() {
  const pkg = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
  console.log(pkg.version);
  return 0;
}
