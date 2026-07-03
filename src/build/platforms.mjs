// src/build/platforms.mjs — per-platform artifact emitters for the single-source build
// (SPEC-BUILD-001, SPEC-PLATFORM-001, SPEC-TRIGGER-001, DES-PLAT-001). Each emitter renders one
// platform's explicit-invocation product from the shared fragments (fragments/<fragmentsDir>/*,
// fragments/shared/body.md) through that platform's template (fragments/templates/*.tmpl),
// burning in the platform's own frontmatter/argument-placeholder facts from registry.mjs plus the
// negative-invocation-guard description (SPEC-TRIGGER-001) every platform carries verbatim.
// Determinism (RISK-DET-001): templates are read once at module load from fixed repo-relative
// paths; rendering is pure string substitution — no timestamps, randomness, or locale-dependent
// behavior anywhere in this file.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const TEMPLATES_DIR = join(HERE, '..', '..', 'fragments', 'templates');

/**
 * Every fragments/templates/*.tmpl file opens with an explanatory comment for whoever is reading
 * the template source (an HTML `<!-- -->` block for the two Markdown templates, leading `#` lines
 * for the TOML one) documenting the placeholder contract; none of that is part of the rendered
 * artifact. Strip only that LEADING comment — never comment-like lines further in, since the
 * gemini template's rendered body legitimately contains Markdown `##` headers that also start
 * with `#` and must survive untouched.
 */
function stripLeadingComment(template) {
  if (template.startsWith('<!--')) {
    const end = template.indexOf('-->');
    if (end === -1) {
      throw new Error('platforms.mjs: template has an unterminated leading <!-- comment');
    }
    const rest = template.slice(end + '-->'.length);
    return rest.startsWith('\n') ? rest.slice(1) : rest;
  }
  if (template.startsWith('#')) {
    const lines = template.split('\n');
    let i = 0;
    while (i < lines.length && lines[i].startsWith('#')) i += 1;
    return lines.slice(i).join('\n');
  }
  return template;
}

const SKILL_TEMPLATE = stripLeadingComment(readFileSync(join(TEMPLATES_DIR, 'skill.md.tmpl'), 'utf8'));
const COMMAND_TEMPLATE = stripLeadingComment(
  readFileSync(join(TEMPLATES_DIR, 'command.md.tmpl'), 'utf8')
);
const GEMINI_TEMPLATE = stripLeadingComment(
  readFileSync(join(TEMPLATES_DIR, 'gemini.toml.tmpl'), 'utf8')
);

/**
 * Render `template` against `vars` (a flat `{ KEY: value }` map). Supports the two placeholder
 * forms used by fragments/templates/*.tmpl:
 *  - `{{KEY}}` — replaced with `String(vars[KEY])`. Any KEY referenced outside a conditional
 *    block below MUST be present in `vars`; a missing key throws rather than silently emitting
 *    the literal `undefined`, so a template/registry drift fails loudly at build time.
 *  - `{{#KEY}}\n...\n{{/KEY}}\n` — a whole-line conditional block. When `vars[KEY]` is truthy the
 *    block's inner lines are kept (with `{{KEY}}` inside them substituted too); when falsy the
 *    entire block — both marker lines and everything between them — is dropped. Blocks are never
 *    nested in these templates, so a flat single-pass line scan is sufficient.
 * Dropping a block removes its lines but not the blank line that used to separate it from its
 * neighbours, so afterwards any run of 3+ consecutive newlines is collapsed to a single blank
 * line, and the whole result is trimmed to exactly one trailing newline.
 */
function renderTemplate(template, vars) {
  const lines = template.split('\n');
  const out = [];
  let i = 0;
  while (i < lines.length) {
    const openMatch = lines[i].match(/^\{\{#([\w-]+)\}\}$/);
    if (openMatch) {
      const key = openMatch[1];
      const closeTag = `{{/${key}}}`;
      const blockLines = [];
      i += 1;
      while (i < lines.length && lines[i] !== closeTag) {
        blockLines.push(lines[i]);
        i += 1;
      }
      if (i >= lines.length) {
        throw new Error(`platforms.mjs: template block "${key}" has no matching "${closeTag}"`);
      }
      i += 1; // skip past the closing tag line itself
      if (vars[key]) {
        for (const blockLine of blockLines) out.push(substituteLine(blockLine, vars));
      }
      continue;
    }
    out.push(substituteLine(lines[i], vars));
    i += 1;
  }
  return (
    out
      .join('\n')
      .replace(/\n{3,}/g, '\n\n')
      .replace(/\s+$/, '') + '\n'
  );
}

function substituteLine(line, vars) {
  return line.replace(/\{\{([\w-]+)\}\}/g, (_match, key) => {
    if (!(key in vars)) {
      throw new Error(`platforms.mjs: no value provided for template placeholder "${key}"`);
    }
    return String(vars[key]);
  });
}

// The single sentence every platform's description/frontmatter carries verbatim: the
// negative-invocation guard (SCOPE-IN-006, SPEC-TRIGGER-001). Sourced from fragments.own
// ['triggers.md'] rather than duplicated here, so there is exactly one place this text is
// authored (each command's own fragments/<fragmentsDir>/triggers.md).
function guardText(fragments) {
  return fragments.own['triggers.md'].trim();
}

/**
 * Burn `platform`'s own literal name into fragment prose wherever a fragment author wrote the
 * `{{PLATFORM}}` token (SPEC-PLATFORM-001 "烙入 `--platform` 标识", SPEC-SYNC-001 "`--platform
 * <name>`(来自烙入产物)"). This is a plain literal-token substitution over the fragment's raw text
 * — deliberately NOT routed through substituteLine/renderTemplate's `{{KEY}}` machinery, since
 * that machinery only ever scans template lines once and would leave a token embedded inside an
 * already-substituted fragment value (e.g. BEHAVIOR) untouched (its single `.replace()` pass never
 * rescans replacement text for further matches). Doing the substitution here, before the fragment
 * text is placed into `vars`, guarantees every platform's rendered artifact carries its OWN
 * literal `--platform <name>` — never a shared generic placeholder — with no runtime env sniffing
 * (DES-PLAT-001).
 */
function burnInPlatform(text, platform) {
  return text.replaceAll('{{PLATFORM}}', platform);
}

function sharedVars(fragments, platform) {
  return {
    SHARED_BODY: burnInPlatform(fragments.shared['body.md'].trim(), platform),
    PURPOSE: burnInPlatform(fragments.own['purpose.md'].trim(), platform),
    TRIGGERS: burnInPlatform(fragments.own['triggers.md'].trim(), platform),
    BEHAVIOR: burnInPlatform(fragments.own['behavior.md'].trim(), platform),
    OUTPUT: burnInPlatform(fragments.own['output.md'].trim(), platform),
  };
}

/**
 * Claude Code and Codex both use the "skill" Markdown+YAML-frontmatter shape
 * (fragments/templates/skill.md.tmpl); only the structural frontmatter keys registry.mjs sets for
 * each platform (`name`, `disable-model-invocation`, `argument-hint`) differ between them — an
 * absent key drops that frontmatter line entirely (see renderTemplate).
 *
 * DESCRIPTION is wrapped with JSON.stringify rather than emitted raw: the guard sentence itself
 * contains ": " (colon-space), which a bare/unquoted YAML plain scalar must not contain without
 * becoming ambiguous with a mapping. JSON.stringify produces a valid quoted YAML/JSON string with
 * no such ambiguity while leaving the guard text fully intact as a substring, so the negative-
 * guard structural check still matches against it.
 */
function renderSkillFormat({ params, fragments, platform }) {
  const vars = {
    name: params.frontmatter?.name,
    'disable-model-invocation': params.frontmatter?.['disable-model-invocation'],
    DESCRIPTION: JSON.stringify(guardText(fragments)),
    ...sharedVars(fragments, platform),
  };
  return renderTemplate(SKILL_TEMPLATE, vars);
}

/**
 * opencode's command-file shape (fragments/templates/command.md.tmpl): same JSON-stringified
 * DESCRIPTION convention as renderSkillFormat (see rationale there); no structural frontmatter
 * keys are emitted today (registry.mjs's opencode `frontmatter` is `{}`).
 */
function renderCommandFormat({ fragments, platform }) {
  const vars = {
    DESCRIPTION: JSON.stringify(guardText(fragments)),
    ...sharedVars(fragments, platform),
  };
  return renderTemplate(COMMAND_TEMPLATE, vars);
}

/**
 * Gemini's TOML shape (fragments/templates/gemini.toml.tmpl): the template itself already
 * supplies the surrounding `'...'` single-quote literal-string syntax around `{{DESCRIPTION}}`,
 * so DESCRIPTION here is the raw guard sentence, not JSON-stringified — a TOML single-quoted
 * literal string needs no escaping for this text (it contains neither a `'''` run nor a trailing
 * apostrophe that would need padding).
 */
function renderGeminiFormat({ fragments, platform }) {
  const vars = {
    DESCRIPTION: guardText(fragments),
    ...sharedVars(fragments, platform),
  };
  return renderTemplate(GEMINI_TEMPLATE, vars);
}

// Platform identity is burned in both structurally AND textually: each emitter renders through
// that platform's own template plus registry.mjs's frontmatter/placeholder facts for that
// platform (DES-PLAT-001), and burnInPlatform() literally writes the platform's own name into
// fragment prose wherever a `{{PLATFORM}}` token appears (e.g. the sync.mjs manual-fallback
// invocation instruction, SPEC-SYNC-001) — never by inspecting the runtime environment
// (SCOPE-IN-002 / Non-Goals).
export const EMITTERS = {
  claude: renderSkillFormat,
  codex: renderSkillFormat,
  opencode: renderCommandFormat,
  gemini: renderGeminiFormat,
};

/**
 * Dispatch to the emitter registered for `platform` — build.mjs's single call point. Throws for
 * an unregistered platform rather than silently producing nothing, so a registry/emitter drift
 * fails loudly at build time.
 * @param {{ skill: object, platform: string, params: object, fragments: { own: object, shared: object } }} ctx
 * @returns {string}
 */
export function emitPlatform({ skill, platform, params, fragments }) {
  const emitter = EMITTERS[platform];
  if (!emitter) {
    throw new Error(`platforms.mjs: no emitter registered for platform "${platform}"`);
  }
  return emitter({ skill, params, fragments, platform });
}
