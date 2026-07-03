// src/commands/status.mjs — read-only report of the install manifest (SPEC-STATUS-001,
// SPEC-CLI-001). Loads ~/.code-guidelines/install-manifest.json, validates its SHAPE (exit 2 if
// invalid), and REPORTS installed skills, platforms, and assets — not merely a shape check.
// NEVER modifies any file.
import { loadManifest, validateInstallManifest } from '../install/manifest.mjs';
import { resolveConfig } from './install.mjs';

/**
 * `status` — SPEC-STATUS-001. Read-only.
 * @param {object} [options]  { home, env }
 * @returns {Promise<number>} 0 (reported, incl. "not installed"); 2 (manifest present but invalid).
 */
export async function status(options = {}) {
  const cfg = resolveConfig(options);

  let manifest;
  try {
    manifest = await loadManifest(cfg.manifestPath);
  } catch (err) {
    if (err.code === 'ENOENT') {
      console.log('code-guidelines: not installed (no install manifest found).');
      return 0;
    }
    // Unparseable JSON is an invalid manifest shape (SPEC-CLI-001 exit 2).
    console.error(`status: install manifest is not valid JSON: ${err.message}`);
    return 2;
  }

  if (!validateInstallManifest(manifest)) {
    console.error(`status: install manifest at ${cfg.manifestPath} has an invalid shape.`);
    return 2;
  }

  const platformFiles = manifest.files.filter((f) => typeof f.platform === 'string');
  const assetFiles = manifest.files.filter((f) => typeof f.platform !== 'string');
  const perPlatform = new Map();
  for (const f of platformFiles) {
    perPlatform.set(f.platform, (perPlatform.get(f.platform) ?? 0) + 1);
  }

  console.log('code-guidelines: installed');
  console.log(`  version:      ${manifest.version}`);
  console.log(`  installed at: ${manifest.installedAt}`);
  console.log(`  skills:       ${manifest.skills.join(', ') || '(none)'}`);
  console.log(`  platforms:    ${manifest.platforms.join(', ') || '(none)'}`);
  for (const platform of manifest.platforms) {
    console.log(`    - ${platform}: ${perPlatform.get(platform) ?? 0} product file(s)`);
  }
  console.log(`  shared assets: ${assetFiles.length} file(s) under ${cfg.sharedRoot}`);
  console.log(`  total tracked files: ${manifest.files.length}`);
  return 0;
}
