---
r2p_stage: plan
r2p_version: 5
r2p_status: approved
r2p_created_at: 2026-07-02T21:22:08.231818+00:00
r2p_updated_at: 2026-07-02T23:27:35.197981+00:00
---

# Plan

## Tasks

### PLAN-TASK-001 项目脚手架(package.json + gitignore)
Spec References: SPEC-CLI-001, SPEC-TEST-001
Change Type: create
TDD Applicable: no
Files:
- package.json
- .gitignore
Skeleton:
package.json:`{ "name": "code-guidelines", "type": "module", "version": "0.1.0", "bin": { "code-guidelines": "bin/code-guidelines" }, "scripts": { "test": "node --test", "build": "node src/build/build.mjs" }, "engines": { "node": ">=20" }, "license": "MIT" }`(无第三方 dependencies)。.gitignore 忽略 `node_modules`、临时暂存目录。
Steps:
- [ ] 写 package.json(type=module、bin、scripts、engines node>=20、无 deps)
- [ ] 写 .gitignore
Verification: `node -e "const p=require('./package.json'); if(p.type!=='module'||!p.bin['code-guidelines']||Object.keys(p.dependencies||{}).length) process.exit(1)"` 退出 0;`node --version` ≥ v20。

### PLAN-TASK-002 CLI 解析、分发与 version/help
Spec References: SPEC-CLI-001
Change Type: create
TDD Applicable: yes
Files:
- bin/code-guidelines
- src/cli.mjs
- src/commands/version.mjs
- src/commands/help.mjs
- test/cli.test.mjs
Skeleton:
```js
// src/cli.mjs — 零依赖手写解析
export const PLATFORMS = ['claude', 'codex', 'opencode', 'gemini'];
export function parseArgs(argv) { /* → {cmd, platforms, error} */ }
export async function main(argv) {
  const { cmd, platforms, error } = parseArgs(argv);
  if (error) { printUsage(); return 2; }        // 未知命令/选项/平台值/重复值
  switch (cmd) {                                 // 动态 import:仅加载所选命令,version/help 不依赖尚未创建的 install 系模块
    case 'version': return version(); case 'help': return help();
    case 'install': return (await import('./commands/install.mjs')).install(platforms);
    case 'uninstall': return (await import('./commands/uninstall.mjs')).uninstall(platforms);
    case 'status': return (await import('./commands/status.mjs')).status();
    default: printUsage(); return 2; }
}
```
Steps:
- [ ] 实现 parseArgs:命令 + `--platform` csv(合法集校验、重复值报错)+ 未知选项报错
- [ ] version/help 命令;install/uninstall/status 经动态 import 延迟加载(本任务不创建这些模块,故 version/help 可独立通过);bin/code-guidelines 调 main 并以返回码 process.exit
- [ ] 写 test/cli.test.mjs:五命令解析、未知命令/选项/平台值/重复值均退出 2
Verification: `node --test test/cli.test.mjs` 全绿(0 fail);`node bin/code-guidelines version` 打印版本且退出 0;`node bin/code-guidelines --bogus` 退出 2。

### PLAN-TASK-003 文件系统安全不变式与哈希库
Spec References: SPEC-INSTALL-001
Change Type: create
TDD Applicable: yes
Files:
- src/install/fsutil.mjs
- test/fsutil.test.mjs
Skeleton:
```js
import { createHash } from 'node:crypto';
export function sha256Normalized(buf) {           // 统一 \n 再哈希(DECISION-004)
  return createHash('sha256').update(String(buf).replace(/\r\n/g, '\n')).digest('hex');
}
export function assertSafeTarget(path, allowedRoots) { /* lstat 目标+各级父目录拒 symlink;规范化后须在 allowedRoots 内 */ }
export async function atomicWrite(path, content) { /* 临时文件 + rename */ }
```
Steps:
- [ ] sha256Normalized(行尾规范化);assertSafeTarget(lstat 拒 symlink + 路径限定);atomicWrite
- [ ] 写 test/fsutil.test.mjs:CRLF/LF 同哈希、symlink 目标/父目录被拒、越界路径被拒、原子写
Verification: `node --test test/fsutil.test.mjs` 全绿;含用例断言 symlink 目标抛错、`\r\n` 与 `\n` 内容哈希相等。

### PLAN-TASK-004 两级 manifest 读写与形状校验
Spec References: SPEC-MANIFEST-001
Change Type: create
TDD Applicable: yes
Files:
- src/install/manifest.mjs
- test/manifest.test.mjs
Skeleton:
```js
// 安装 manifest: {version, installedAt, files:[{path,sha256,skill,platform}], skills, platforms}
// 目标 manifest: {version, rules:[{file,sourceVersion,sha256}], lint:[{tool,armedAt,sha256|null,optedOut?}], conventions:{sha256,distilledAt}|null}
export function validateInstallManifest(o) { /* 必需键/类型/platform∈集合/文件条目含 path+sha256 → bool */ }
export function validateTargetManifest(o) { /* 形状校验 */ }
export function loadManifest(path) {} export function saveManifest(path, o) {}
```
Steps:
- [ ] 定义两 schema 的读写 + 形状校验函数
- [ ] 写 test/manifest.test.mjs:合法/缺键/错类型/非法 platform 值均被正确判定
Verification: `node --test test/manifest.test.mjs` 全绿;非法 manifest 使 validate 返回 false。

### PLAN-TASK-005 两阶段提交事务与 install/uninstall/status 命令
Spec References: SPEC-INSTALL-001, SPEC-CLI-001, SPEC-MANIFEST-001, SPEC-PLATFORM-001, SPEC-STATUS-001
Change Type: create
TDD Applicable: yes
Files:
- src/install/transaction.mjs
- src/commands/install.mjs
- src/commands/uninstall.mjs
- src/commands/status.mjs
- test/install.test.mjs
Skeleton:
```js
export async function install(platforms) {
  // 1 预检:每个将写路径 assertSafeTarget;磁盘存在且 sha≠manifest 或无标记 → 退出 4 列冲突
  // 2 暂存:全部新文件写临时位置
  // 3 提交:逐文件原子 rename 换入;成功后移除不再安装的旧自有文件;写安装 manifest
  // 提交前失败 → 删暂存、原安装不动;中断 → 下次 install 幂等收敛
}
export async function uninstall(platforms) { /* 仅移除 manifest 记录且哈希未变的文件;最后删 install-manifest + 空 ~/.code-guidelines */ }
```
Steps:
- [ ] 实现两阶段提交、冲突预检(退出 4)、卸载、status 形状校验(退出 2)
- [ ] 枚举四平台安装根(SPEC-PLATFORM-001):`~/.claude/skills/code-guidelines/`、`~/.codex/prompts/`、`~/.config/opencode/commands/`(按 `XDG_CONFIG_HOME` 解析,缺省 `~/.config`)、`~/.gemini/commands/`
- [ ] status 命令汇报已装技能/资产/平台(SPEC-STATUS-001),非仅形状校验
- [ ] 覆盖 SCOPE-IN-005:共享资产目录 `~/.code-guidelines/` 随 install 落盘并纳入 manifest、uninstall 一并移除
- [ ] 写 test/install.test.mjs:全新安装、重装暂存-换入、提交前失败原样保留、用户改动拒绝退出 4、symlink 拒绝、uninstall 清 install-manifest 与空根、status 报告含平台/资产
Verification: `node --test test/install.test.mjs` 全绿;含用例:预置用户改动文件后 install 退出 4 且磁盘未变;`node bin/code-guidelines status` 输出含已装平台列表。

### PLAN-TASK-006 单源确定性构建引擎与注册表
Spec References: SPEC-BUILD-001
Change Type: create
TDD Applicable: yes
Files:
- src/build/build.mjs
- src/build/registry.mjs
- test/build.test.mjs
Skeleton:
```js
// registry.mjs: 显式有序技能列表 + 每平台参数
export const REGISTRY = [{ id: 'code-guidelines', platforms: {/* claude/codex/opencode/gemini 参数 */} }];
// build.mjs: 确定性原语(可独立单测)+ 组合器;发射器在 build() 内动态 import('./platforms.mjs')(PLAN-TASK-008),
// 故本任务不在模块加载期硬依赖 fragments/emitters
export function stableStringify(o) {}   // 键排序,确定性
export function normalizeEol(s) {}      // 统一 \n、无时间戳/随机
export function build({ check = false } = {}) { /* 读 fragments + 动态 import emitters;check: 比对 generated/ 与即时构建 */ }
```
Steps:
- [ ] 实现确定性原语(stableStringify 键排序、normalizeEol 固定 \n、无时间戳/随机)与 build 组合器骨架;发射器经动态 import 延迟加载
- [ ] 写 test/build.test.mjs 单测原语(稳定排序、\n 规范化幂等、无时间戳)——自足,不依赖 fragments/generated
Verification: `node --test test/build.test.mjs` 全绿(仅测确定性原语,自足);完整 `--check` 自符合门在 PLAN-TASK-008 执行(generated 与 emitters 就位后)。

### PLAN-TASK-007 技能单源片段(负向守卫、手工算法、distill 程序、前置检查文案)
Spec References: SPEC-TRIGGER-001, SPEC-SYNC-001, SPEC-DISTILL-001, SPEC-PRECHECK-001
Change Type: create
TDD Applicable: no
Files:
- fragments/shared/body.md
- fragments/skill/purpose.md
- fragments/skill/triggers.md
- fragments/skill/behavior.md
- fragments/skill/output.md
- fragments/templates/skill.md.tmpl
- fragments/templates/command.md.tmpl
- fragments/templates/gemini.toml.tmpl
Skeleton:
triggers.md 写负向守卫 description 原文("Explicit-invocation only: run only when the user types /code-guidelines. Never invoke from intent, keywords, or as a side effect of coding tasks.");正文刻意不设意图触发/何时使用区。behavior.md 含无参三动作 + 与 sync.mjs 等价的确定性手工算法(无 node 兜底)+ distill agent 抽样/证据/veto 程序 + 平台前置检查文案("当前平台(<平台名>)无约束文件 <文件名>…")。模板:skill.md.tmpl(Claude/Codex Markdown+frontmatter,Claude 含 `disable-model-invocation: true`)、command.md.tmpl(opencode)、gemini.toml.tmpl(TOML `prompt`/`description`)。
Steps:
- [ ] 写共享正文与 per-section 片段(负向守卫、手工算法、distill 程序、前置检查文案)
- [ ] 写三套平台模板(skill / command / gemini toml)
Verification: `grep -q "Explicit-invocation only" fragments/skill/triggers.md` 且 `grep -Rqi "when to use\|意图触发" fragments/skill/` 无匹配(退出非 0);`grep -q "disable-model-invocation" fragments/templates/skill.md.tmpl`。

### PLAN-TASK-008 四平台产物发射与提交 generated(含 golden 与自符合)
Spec References: SPEC-PLATFORM-001, SPEC-BUILD-001, SPEC-TRIGGER-001
Change Type: create
TDD Applicable: yes
Files:
- src/build/platforms.mjs
- generated/claude/SKILL.md
- generated/codex/code-guidelines.md
- generated/opencode/code-guidelines.md
- generated/gemini/code-guidelines.toml
- test/platform.test.mjs
Skeleton:
```js
// platforms.mjs: 按平台发射对应形态并烙入 --platform 标识
export const EMITTERS = {
  claude: (b) => renderSkillMd(b, { platform: 'claude', disableModelInvocation: true }),
  codex:  (b) => renderPromptMd(b, { platform: 'codex' }),
  opencode:(b) => renderCommandMd(b, { platform: 'opencode' }),
  gemini: (b) => renderGeminiToml(b, { platform: 'gemini' }),  // TOML,必需 prompt
};
```
Steps:
- [ ] 实现四发射器(Gemini=TOML,其余 Markdown),各烙入平台标识 + 负向守卫;Claude 加 disable-model-invocation
- [ ] 提交 generated/*;写 test/platform.test.mjs:即时构建==已提交 generated 逐字节(自符合)+ golden snapshot + 每平台可显式调用产物存在 + 四平台 description 均含负向守卫串 + 仅 Claude 含 disable-model-invocation + Gemini 为合法 TOML
Verification: `node src/build/build.mjs --check` 退出 0;`node --test test/platform.test.mjs` 全绿;`test -f generated/gemini/code-guidelines.toml`。

### PLAN-TASK-009 stacks.json 注册表、VERSION 与 schema 校验
Spec References: SPEC-STACKS-001, SPEC-DETECT-001, SPEC-SELECT-001
Change Type: create
TDD Applicable: yes
Files:
- assets/stacks.json
- assets/VERSION
- test/stacks.test.mjs
- test/fixtures/detect-go/go.mod
- test/fixtures/detect-monorepo/package.json
Skeleton:
```js
// stacks.json: {version, stacks:[{id,category,specificity,detect:{files,packageDeps,extensions,tags,requiresTags},rules,lint}]}
// guardrails-core: category '核心', 恒选, 无 detect。48 栈条目齐全。
// stacks.test.mjs 纯数据 schema 校验(不 import sync.mjs、不做跨文件磁盘存在性检查):stacks 长度=48;
// 每条 category∈枚举、specificity 为 int、detect 四类谓词形状合法、rules 为非空字符串数组、lint 为字符串或 null。
// (rules→library、lint→baseline 的磁盘存在性交叉校验放在 PLAN-TASK-021,届时被引用文件均已创建。)
// 检测/选择的行为金样(检出集、四级总序、12 上限、monorepo 排除)在 PLAN-TASK-010 的 sync.test.mjs 复用本任务 fixtures。
```
Steps:
- [ ] 写 assets/stacks.json(48 条目 + 四类谓词 + lint 键 + specificity)与 VERSION
- [ ] 建检测 fixtures;写 test/stacks.test.mjs 做纯数据 schema 校验(48 计数、枚举、specificity 类型、谓词形状、rules/lint 字段形状),不依赖 sync.mjs、不做跨文件磁盘存在性检查
Verification: `node --test test/stacks.test.mjs` 全绿;`node -e "const s=JSON.parse(require('fs').readFileSync('assets/stacks.json')); if(s.stacks.length!==48) process.exit(1)"` 退出 0。

### PLAN-TASK-010 sync.mjs 全管线 + distill 记录 seam(design 强制的零依赖单文件)
Spec References: SPEC-SYNC-001, SPEC-DETECT-001, SPEC-SELECT-001, SPEC-RECONCILE-001, SPEC-PRECHECK-001, SPEC-HOSTFMT-001, SPEC-LINT-001, SPEC-STATUS-001, SPEC-MANIFEST-001, SPEC-DISTILL-001
Change Type: create
TDD Applicable: yes
Files:
- assets/sync.mjs
- test/sync.test.mjs
Skeleton:
```js
// 零依赖单文件(design 强制:随资产分发、在目标仓库免安装运行,故不能跨 create 任务拆分、禁 import src/*);
// 内联 fs-safety(lstat 拒 symlink、路径限定、atomic write)与 sha256 行尾规范化。
// 开关:--platform/--dry-run/--json/--relint <tool>/--distill-record <file> [--force];退出码 0/2/3/4。
export function detect(repo) {}   export function select(hits) {}        // 阶段一:检出 + 四级总序 + 12 上限
export function reconcile(sel, manifest) {}                             // 阶段二:增/删/升级;哈希不符=用户覆盖跳过;保留 manifest.conventions 原样
export function armLint(detected, manifest) {}                          // 阶段三:三条件门 at-most-once;删除不复活;--relint 重布防
export function maintainHostBlock(entryFiles) {}                        // 阶段四:块内重生成、块外不动;畸形标记退出 4
export function distillRecord(file, { force } = {}) {}                  // 确定性 seam:计算 conventions sha256;哈希不符且非 force → 拒绝并输出对比;写 manifest.conventions{sha256,distilledAt}
export async function sync({ platform, dryRun, json, relint }) {
  precheck(platform);                          // 缺映射入口文件 → 退出 3、零写
  const plan = reconcile(select(detect(repo)), targetManifest);
  if (isNoop(plan)) return report('已是最新,无变更');   // 阶段五:零写入、不改 mtime;--json 结构
  armLint(...); maintainHostBlock(...); return report(...);  // report 不触碰 conventions,仅陈述其状态
}
```
Steps:
- [ ] 阶段一 检测+选择(四级总序、12 上限);阶段二 调和+零写入(用户覆盖保护;调和期望集不含 conventions,写 manifest 时保留既有 conventions 字段不动)
- [ ] 阶段三 lint 三条件布防 + --relint;阶段四 precheck + 托管块(畸形标记退出 4);阶段五 报告 + --json + 退出码 0/2/3/4
- [ ] distillRecord seam(确定性):写/守护 `conventions` 字段、哈希不符拒覆盖、--force 覆盖(供 SKILL 的 distill agent 调用);无参 sync 永不触发蒸馏
- [ ] 内联 fs-safety(lstat/atomic)与 sha256 行尾规范化,禁 import src/*
- [ ] 覆盖 SCOPE-IN-011(零写入承诺:期望态==现状则不写、mtime 不变)与 SCOPE-IN-016(目标 `.code-guidelines/manifest.json` 落盘并逐文件记录)
- [ ] 写 test/sync.test.mjs:检测/选择金样(用 PLAN-TASK-009 fixtures)、幂等二跑零写入、用户覆盖保护、升级判定、dry-run 不写、--json 形状、无参运行既不写也不引用 project-conventions.md(conventions 不入期望集)、distillRecord 对已改文件拒覆盖且 --force 通过、sync.mjs 无相对 import
Verification: `node --test test/sync.test.mjs` 全绿;含用例:连跑两次第二次零写入且 mtime 不变;无参运行断言未写 project-conventions.md;distillRecord 哈希不符拒覆盖、--force 通过;`grep -Eq "from ['\"]\.\.?/" assets/sync.mjs` 无匹配(退出非 0)。

### PLAN-TASK-011 平台前置检查与托管块 fixture 测试
Spec References: SPEC-PRECHECK-001, SPEC-HOSTFMT-001
Change Type: create
TDD Applicable: yes
Files:
- test/precheck.test.mjs
- test/fixtures/precheck-missing/README.md
- test/fixtures/precheck-claude/CLAUDE.md
Skeleton:
```js
// 断言:claude→CLAUDE.md 缺失 → 退出 3、零写、提示含平台名与文件名;
// 他平台文件存在但当前平台文件缺失仍中止;通过后只写已存在入口文件、从不新建;
// 托管块整体重生成、块外一字不动;畸形/重复/孤立标记 → 退出 4、零写。
```
Steps:
- [ ] 建 precheck/hostblock fixtures(缺文件、仅他平台文件、畸形标记)
- [ ] 写 test/precheck.test.mjs 覆盖四映射、缺文件中止零写、块外不动、畸形标记中止
Verification: `node --test test/precheck.test.mjs` 全绿;含用例断言缺 CLAUDE.md 时退出 3 且目标目录零写。

### PLAN-TASK-012 lint 首次布防 fixture 测试
Spec References: SPEC-LINT-001, SPEC-BASELINE-001
Change Type: create
TDD Applicable: yes
Files:
- test/lint.test.mjs
- test/fixtures/lint-blank/package.json
- test/fixtures/lint-existing/eslint.config.js
- test/fixtures/lint-baseline/js-ts/eslint.config.js
Skeleton:
```js
// armLint 的基线来源在测试中指向 test/fixtures/lint-baseline/(注入的最小基线),不依赖 PLAN-TASK-017 的 assets/lint/,使本任务自足。
// 断言:空白项目首跑布防生效(从 fixture 基线写脚手架 + 打印安装命令,永不装依赖);
// 二跑零写入;删除脚手架后不复活;--relint 后重布防;
// 既有配置(当前或历史文件名如 .eslintrc*)分毫不动;未改动升级、改动过跳过。
```
Steps:
- [ ] 建空白/既有配置 fixtures + fixture 基线目录;写 test/lint.test.mjs(armLint 指向 fixture 基线)覆盖布防、二跑零写、不复活、既有不动、升级/跳过
Verification: `node --test test/lint.test.mjs` 全绿;含用例:既有 eslint.config.js 的 fixture 跑后该文件字节不变。

### PLAN-TASK-013 规则库:核心 + 12 语言(13 文件)
Spec References: SPEC-RULEFMT-001
Change Type: create
TDD Applicable: no
Files:
- assets/library/guardrails-core.md
- assets/library/typescript.md
- assets/library/javascript.md
- assets/library/python.md
- assets/library/go.md
- assets/library/rust.md
- assets/library/java.md
- assets/library/kotlin.md
- assets/library/swift.md
- assets/library/csharp.md
- assets/library/cpp.md
- assets/library/php.md
- assets/library/ruby.md
Skeleton:
每文件纯 .md,frontmatter `name`/`description`/`appliesTo`/`stacks`/`source`;正文英文;硬约束(禁止项)段在前、生态惯用法段在后;≤100 行;逐条过 veto(无人设/私有路径/私货、无与 lint 基线重复的约束);来源 awesome-cursorrules(CC0)/awesome-copilot(MIT)/original。guardrails-core 蒸馏合并 clean-code/anti-overengineering/codequality。
Steps:
- [ ] 蒸馏并写入 13 个规则文件,逐文件过 veto 清单
Verification: `for f in assets/library/{guardrails-core,typescript,javascript,python,go,rust,java,kotlin,swift,csharp,cpp,php,ruby}.md; do test -f "$f" && head -1 "$f" | grep -q '^---' && [ $(wc -l < "$f") -le 100 ] || exit 1; done` 退出 0。

### PLAN-TASK-014 规则库:前端 9 + 移动 4(13 文件)
Spec References: SPEC-RULEFMT-001
Change Type: create
TDD Applicable: no
Files:
- assets/library/react.md
- assets/library/nextjs.md
- assets/library/vue.md
- assets/library/nuxt.md
- assets/library/angular.md
- assets/library/svelte.md
- assets/library/astro.md
- assets/library/tailwind.md
- assets/library/html-css.md
- assets/library/react-native.md
- assets/library/flutter.md
- assets/library/android-compose.md
- assets/library/ios-swiftui.md
Skeleton:
同 PLAN-TASK-013 的每文件规约(模板、frontmatter、≤100 行、英文、veto、来源)。前端 9 + 移动 4。
Steps:
- [ ] 蒸馏并写入 13 个前端/移动规则文件,逐文件过 veto
Verification: `ls assets/library/{react,nextjs,vue,nuxt,angular,svelte,astro,tailwind,html-css,react-native,flutter,android-compose,ios-swiftui}.md` 全部存在;各文件首行为 `---` 且行数 ≤100。

### PLAN-TASK-015 规则库:后端 9 + 数据 3 + 测试 3(15 文件)
Spec References: SPEC-RULEFMT-001
Change Type: create
TDD Applicable: no
Files:
- assets/library/node-api.md
- assets/library/django.md
- assets/library/fastapi.md
- assets/library/flask.md
- assets/library/spring-boot.md
- assets/library/laravel.md
- assets/library/rails.md
- assets/library/aspnet-core.md
- assets/library/graphql.md
- assets/library/sql.md
- assets/library/mongodb.md
- assets/library/python-ml.md
- assets/library/js-unit-test.md
- assets/library/e2e-test.md
- assets/library/pytest.md
Skeleton:
同 PLAN-TASK-013 每文件规约。后端 9 + 数据 3 + 测试 3。
Steps:
- [ ] 蒸馏并写入 15 个后端/数据/测试规则文件,逐文件过 veto
Verification: `ls assets/library/{node-api,django,fastapi,flask,spring-boot,laravel,rails,aspnet-core,graphql,sql,mongodb,python-ml,js-unit-test,e2e-test,pytest}.md` 全部存在且各 ≤100 行。

### PLAN-TASK-016 规则库:DevOps 4 + 横切 3(7 文件)
Spec References: SPEC-RULEFMT-001
Change Type: create
TDD Applicable: no
Files:
- assets/library/docker.md
- assets/library/kubernetes.md
- assets/library/terraform.md
- assets/library/github-actions.md
- assets/library/rest-api.md
- assets/library/security.md
- assets/library/a11y.md
Skeleton:
同 PLAN-TASK-013 每文件规约。DevOps 4 + 横切 3(rest-api / security-OWASP 向 / a11y)。a11y 由标签依赖(任一前端框架)触发。
Steps:
- [ ] 蒸馏并写入 7 个 DevOps/横切规则文件,逐文件过 veto
Verification: `ls assets/library/{docker,kubernetes,terraform,github-actions,rest-api,security,a11y}.md` 全部存在;`ls assets/library/*.md | wc -l` = 48。

### PLAN-TASK-017 lint 基线集一(js-ts / python / go / rust)
Spec References: SPEC-BASELINE-001, SPEC-LINT-001
Change Type: create
TDD Applicable: no
Files:
- assets/lint/js-ts/eslint.config.js
- assets/lint/js-ts/.prettierrc
- assets/lint/js-ts/tsconfig.json
- assets/lint/js-ts/meta.json
- assets/lint/python/ruff.toml
- assets/lint/python/mypy.ini
- assets/lint/python/meta.json
- assets/lint/go/.golangci.yml
- assets/lint/go/meta.json
- assets/lint/rust/rustfmt.toml
- assets/lint/rust/clippy.toml
- assets/lint/rust/meta.json
Skeleton:
按 SPEC-BASELINE-001 核实的当前格式:ESLint flat config(`eslint.config.js`,非 eslintrc)、tsconfig strict + `noUncheckedIndexedAccess`;ruff 规则置 `[lint]`;golangci v2(`version: "2"`、`linters.default`、`formatters:`);rust `rustfmt.toml`+`clippy.toml`(级别在目标项目 Cargo.toml [lints],基线附说明)。每套 meta.json 列出强制约束。
Steps:
- [ ] 写四套基线配置(当前非弃用格式)+ 各 meta.json
Verification: `node -e "JSON.parse(require('fs').readFileSync('assets/lint/js-ts/tsconfig.json'))"` 退出 0;`grep -q '^version: "2"' assets/lint/go/.golangci.yml`;`grep -q '\[lint\]' assets/lint/python/ruff.toml`。

### PLAN-TASK-018 lint 基线集二(java/kotlin/swift/csharp/php/ruby/cpp)
Spec References: SPEC-BASELINE-001, SPEC-LINT-001
Change Type: create
TDD Applicable: no
Files:
- assets/lint/java/checkstyle.xml
- assets/lint/java/meta.json
- assets/lint/kotlin/.editorconfig
- assets/lint/kotlin/detekt.yml
- assets/lint/kotlin/meta.json
- assets/lint/swift/.swiftlint.yml
- assets/lint/swift/meta.json
- assets/lint/csharp/.editorconfig
- assets/lint/csharp/Directory.Build.props
- assets/lint/csharp/meta.json
- assets/lint/php/.php-cs-fixer.dist.php
- assets/lint/php/phpstan.neon
- assets/lint/php/meta.json
- assets/lint/ruby/.rubocop.yml
- assets/lint/ruby/meta.json
- assets/lint/cpp/.clang-format
- assets/lint/cpp/.clang-tidy
- assets/lint/cpp/meta.json
Skeleton:
按 SPEC-BASELINE-001 核实格式:checkstyle DTD 1.3;ktlint 用 .editorconfig + detekt.yml;SwiftLint `only_rules`;C# `.editorconfig`+`Directory.Build.props`(AnalysisLevel=latest-all/EnforceCodeStyleInBuild/TreatWarningsAsErrors);PHP `.php-cs-fixer.dist.php`(非 .php_cs)+ phpstan.neon(level 10);RuboCop `plugins:`(非 require:);clang-format/clang-tidy(CheckOptions map)。每套附 `meta.json`(强制约束清单,格式同 PLAN-TASK-017)。
Steps:
- [ ] 写七套基线配置(当前非弃用格式)+ 每套 meta.json
Verification: `grep -q 'plugins:' assets/lint/ruby/.rubocop.yml`;`grep -q 'AnalysisLevel' assets/lint/csharp/Directory.Build.props`;`test -f assets/lint/php/.php-cs-fixer.dist.php`;`for d in java kotlin swift csharp php ruby cpp; do test -f assets/lint/$d/meta.json || exit 1; done` 退出 0。

### PLAN-TASK-019 distill 模板与 veto 清单
Spec References: SPEC-DISTILL-001, SPEC-RULEFMT-001
Change Type: create
TDD Applicable: no
Files:
- assets/distill/template.md
- assets/distill/veto-checklist.md
- assets/distill/conventions-template.md
Skeleton:
conventions-template.md:固定模板、guardrails 措辞、≤80 行、每条约定须引用 ≥2 处仓库内文件路径作证据、无证据/通用最佳实践丢弃。veto-checklist.md:模板段落顺序、无人设/私有路径/私货、行数上限、frontmatter 完整、无与基线重复的约束。
Steps:
- [ ] 写 distill 抽样/证据/丢弃规则模板、conventions 模板、veto 清单
Verification: `test -f assets/distill/template.md && test -f assets/distill/veto-checklist.md && test -f assets/distill/conventions-template.md`;`grep -qi "≥2\|two file\|两处" assets/distill/conventions-template.md`。

### PLAN-TASK-020 文档与许可(双语 README + LICENSE + THIRD-PARTY)
Spec References: SPEC-DOC-001
Change Type: create
TDD Applicable: yes
Files:
- README.md
- README.zh-CN.md
- LICENSE
- THIRD-PARTY.md
- test/readme.test.mjs
Skeleton:
```js
// readme.test.mjs: 断言两 README 标题结构一致(双语对齐);
// 均含 "How to use / 怎么使用" 与 "When to use / 什么时候使用" 章节(时机表);
// 说明目标项目生成物、R2 刻意偏离与 distill 残余风险;THIRD-PARTY 列 CC0/MIT 溯源。
```
Steps:
- [ ] 写英/中 README(两必含章节 + 时机表 + 生成物说明 + 残余风险)、LICENSE(MIT)、THIRD-PARTY.md
- [ ] 写 test/readme.test.mjs 钉住双语标题对齐与两章节内容
Verification: `node --test test/readme.test.mjs` 全绿;`grep -q "When to use" README.md && grep -q "什么时候使用" README.zh-CN.md`。

### PLAN-TASK-021 规则库与 lint 基线结构校验
Spec References: SPEC-RULEFMT-001, SPEC-STACKS-001, SPEC-BASELINE-001, SPEC-TEST-001
Change Type: create
TDD Applicable: yes
Files:
- test/library.test.mjs
- test/baseline.test.mjs
Skeleton:
```js
// library.test.mjs: assets/library 恰 48 个 .md;每文件 frontmatter 含 name/description/appliesTo/stacks/source;
//   行数 ≤100;模板段落顺序(硬约束段在生态惯用法段之前);source 可解析(上游路径+commit 或 original);
//   stacks.json 每条 rules 均指向存在的 library 文件。
// baseline.test.mjs: assets/lint 恰 11 套;每套含 SPEC-BASELINE-001 规定的当前文件名(如 js-ts/eslint.config.js、
//   go/.golangci.yml 含 version:"2"、python/ruff.toml 含 [lint]、php/.php-cs-fixer.dist.php、ruby/.rubocop.yml 含 plugins:)+ meta.json;
//   stacks.json 每个非空 lint 键均指向存在的 assets/lint/<lang> 目录。
```
Steps:
- [ ] 写 test/library.test.mjs 校验文件数=48、frontmatter、行数、段落顺序、source、rules 指向
- [ ] 写 test/baseline.test.mjs 校验 11 套基线文件名/meta 齐备、当前格式关键串、stacks.json lint 键解析
Verification: `node --test test/library.test.mjs test/baseline.test.mjs` 全绿;失败时明确报出违规文件名。

### PLAN-TASK-022 distill 与 SKILL 结构测试
Spec References: SPEC-DISTILL-001, SPEC-TRIGGER-001, SPEC-TEST-001
Change Type: create
TDD Applicable: yes
Files:
- test/distill.test.mjs
- test/skill.test.mjs
Skeleton:
```js
// distill.test.mjs: 模板与 veto 清单文件存在;import assets/sync.mjs 的 distillRecord(PLAN-TASK-010),
//   断言首次写 conventions{sha256,distilledAt}、对已改文件哈希不符拒覆盖、--force 覆盖成功。
// skill.test.mjs: 四平台生成产物(generated/{claude,codex,opencode,gemini})description 均含显式触发禁令串;
//   正文无意图触发/何时使用线索区;仅 Claude 产物含 disable-model-invocation。
```
Steps:
- [ ] 写 distill.test.mjs:模板/veto 存在 + 调用 distillRecord 验证记录与覆盖保护(拒覆盖 / --force)
- [ ] 写 skill.test.mjs:四平台 description 含触发禁令、正文无意图区、仅 Claude 含 disable-model-invocation
Verification: `node --test test/distill.test.mjs test/skill.test.mjs` 全绿。

## Execution Readiness
- Requirement brief reviewed;design 决策(DECISION-001..006)已定、无 pending
- 高风险(RISK-SAFE/DET/PLAT)均有承接任务,见 Risk Handling
- Non-goals(SCOPE-OUT-001..007)受保护,无任务触碰
- 每任务 Verification 可执行、期望产物已列;绿地全部为 create
- 无未决歧义;范围外仅在 brief 声明,未在此下沉

## Risk Handling
| Risk | Handling Task | Closure |
|---|---|---|
| RISK-SAFE-001 | PLAN-TASK-005 | [ADDRESSED] |
| RISK-SAFE-002 | PLAN-TASK-011 | [ADDRESSED] |
| RISK-SAFE-003 | PLAN-TASK-003 | [ADDRESSED] |
| RISK-DET-001 | PLAN-TASK-008 | [ADDRESSED] |
| RISK-DET-002 | PLAN-TASK-010 | [ADDRESSED] |
| RISK-DET-003 | PLAN-TASK-010 | [ADDRESSED] |
| RISK-DETECT-001 | PLAN-TASK-009 | [ADDRESSED] |
| RISK-SEL-001 | PLAN-TASK-009 | [ADDRESSED] |
| RISK-LINT-001 | PLAN-TASK-012 | [ADDRESSED] |
| RISK-QUAL-001 | PLAN-TASK-021 | [ADDRESSED] |
| RISK-LEGAL-001 | PLAN-TASK-020 | [ADDRESSED] |
| RISK-PLAT-001 | PLAN-TASK-008 | [ADDRESSED] |
| RISK-PLAT-002 | PLAN-TASK-011 | [ADDRESSED] |

## Trace

| This ID | Upstream | Status |
|---|---|---|
| PLAN-TASK-001 | SCOPE-IN-001 | planned |
| PLAN-TASK-002 | SCOPE-IN-001 | planned |
| PLAN-TASK-003 | SCOPE-IN-003 | planned |
| PLAN-TASK-004 | SCOPE-IN-003 / 016 | planned |
| PLAN-TASK-005 | SCOPE-IN-003 / 005 | planned |
| PLAN-TASK-006 | SCOPE-IN-004 | planned |
| PLAN-TASK-007 | SCOPE-IN-006 / 007 | planned |
| PLAN-TASK-008 | SCOPE-IN-002 / 004 | planned |
| PLAN-TASK-009 | SCOPE-IN-008 / 009 | planned |
| PLAN-TASK-010 | SCOPE-IN-007 / 010 / 011 / 013 / 014 / 015 / 012 / 016 | planned |
| PLAN-TASK-011 | SCOPE-IN-014 / 015 | planned |
| PLAN-TASK-012 | SCOPE-IN-012 / 019 | planned |
| PLAN-TASK-013 | SCOPE-IN-018 | planned |
| PLAN-TASK-014 | SCOPE-IN-018 | planned |
| PLAN-TASK-015 | SCOPE-IN-018 | planned |
| PLAN-TASK-016 | SCOPE-IN-018 | planned |
| PLAN-TASK-017 | SCOPE-IN-019 | planned |
| PLAN-TASK-018 | SCOPE-IN-019 | planned |
| PLAN-TASK-019 | SCOPE-IN-017 | planned |
| PLAN-TASK-020 | SCOPE-IN-020 | planned |
| PLAN-TASK-021 | SCOPE-IN-018 / 021 | planned |
| PLAN-TASK-022 | SCOPE-IN-017 / 006 / 021 | planned |

## Upstream Summary (read-only)
# Spec

## Behavior Contracts

### SPEC-CLI-001 CLI 命令面与错误处理
`bin/code-guidelines`(ESM + shebang)分发五命令。退出码(`install` 与 `sync.mjs` 共用):0 成功;2 用法错误(未知命令/未知选项/未知平台值/重复平台值/manifest 形状不合法);3 平台前置检查中止(当前平台入口文件缺失);4 冲突/安全中止(用户改动、fs-safety/symlink 拒绝、或畸形/重复/孤立托管块标记)。
- `version` / `--version` / `-v`:打印 `VERSION`,退出 0。
- `help` / `--help` / `-h`:打印用法,退出 0。
- `install [--platform <csv>]` / `uninstall [--platform <csv>]`:见 SPEC-INSTALL-001。
- `status`:只读,读安装 manifest 并校验形状(必需键存在、类型正确、`platform ∈ {claude,codex,opencode,gemini}`、文件条目含 path+sha256),不合法退出 2;绝不修改任何文件。
`--platform` 可选、逗号分隔,合法值集合 `{claude, codex, opencode, gemini}`,默认全部四值;未知值或重复值退出 2。未知全局选项、未知命令响亮失败(退出 2 + 用法)。不实现 `doctor`。(SCOPE-IN-001)

### SPEC-INSTALL-001 两阶段安装、卸载与文件系统安全
`install`(两阶段提交):(1) 解析目标平台集 → 计算应写自有文件集(各平台产物 + `~/.code-guidelines/` 全量资产);(2) 预检:每个将写路径过 fs-safety 不变式,若磁盘已存在且内容 SHA-256 ≠ 安装 manifest 记录(用户改过)或存在但不在 manifest(无标记文件),则中止、零改动、退出 4 并列冲突路径;(3) 暂存:全部新文件写入同卷临时位置;(4) 提交:逐文件原子 rename 换入,仅当新集全部就位后才移除本次不再安装平台/技能的旧自有文件,并写新安装 manifest;(5) 提交前任一步失败即删暂存、原安装原封不动;若进程在提交中途中断,下次 `install` 重跑依 manifest 与磁盘状态幂等收敛到目标集(可重入恢复)。fs-safety 不变式(贯穿 install / sync 落盘 / 入口编辑):写前对目标及各级父目录 `lstat`,任一 symlink 即拒绝(不跟随);路径规范化后必须落在允许根内(install:各平台技能目录、`~/.code-guidelines/`);写入一律临时文件 + 原子 rename。`uninstall [--platform]`:仅移除安装 manifest 记录且哈希未变的自有文件(用户改过的跳过并报告),最后移除 `install-manifest.json` 与随之变空的 `~/.code-guidelines/`。(SCOPE-IN-003、005)

### SPEC-BUILD-001 单源确定性构建与自符合
构建从 per-section 片段(purpose/triggers/behavior/output)+ 共享正文 + 模板 + 技能注册表生成 `generated/<platform>/` 产物。确定性:注册表显式顺序 + 对象键排序、固定 `\n` 行尾、无时间戳/随机/locale 依赖。自符合性测试:即时构建输出与提交的 `generated/` 逐字节相等;golden snapshot 对每平台产物比对并掩蔽共享正文段。按平台发射对应形态(见 SPEC-PLATFORM-001:Gemini 为 TOML,其余为 Markdown)。(SCOPE-IN-004)

### SPEC-TRIGGER-001 显式调用唯一触发(逐平台)
统一:每平台产物文本(及 SKILL.md 正文)以负向守卫 description 表达"仅当用户显式键入 `/code-guidelines` 时运行;绝不因意图、关键字或作为编码任务副作用触发";正文不设意图触发/何时使用线索区;永不建议配置 hook。逐平台:Claude Code —— SKILL.md frontmatter 置 `disable-model-invocation: true`(平台级硬禁自动加载)+ 负向守卫 description;opencode / Gemini —— slash command 本质用户触发、天然显式,description/prompt 写负向守卫;Codex —— 采用 custom-prompt 形态(SPEC-PLATFORM-001),其显式调用为机制保证,负向守卫随附。结构校验:description 含显式触发禁令、正文无意图触发线索区。(SCOPE-IN-006)

### SPEC-SYNC-001 无参同步管线、零写入与开关
`sync.mjs`(零依赖单文件)按序执行:平台前置检查 → 检测 → 选择 → 全量调和 → lint 首次布防 → 状态报告。开关:`--platform <name>`(来自烙入产物)、`--dry-run`(计算并报告,零写盘)、`--json`(机器可读结果)、`--relint <tool>`(清该工具退出标记并重布防,属显式调用分支)。零写入:期望态与现状一致(逐文件哈希一致 + 集合一致)则不写任何文件、不改 mtime,输出"已是最新,无变更"。目标落盘遵循 fs-safety 不变式。SKILL.md 内含与之等价的确定性手工算法作无 node 兜底;`sync.mjs` 采用保守 Node 基线(基线值与触发兜底条件由 PLAN 依官方文档钉死)。`sync.mjs` 与 CLI 共用 SPEC-CLI-001 的退出码方案(0/2/3/4)。(SCOPE-IN-007、011)

### SPEC-DETECT-001 检测行为
读 `stacks.json`,对每条目求值四类谓词(见 SPEC-STACKS-001)。标签依赖两趟求值:先判定基础栈、收集其检出标签,再判定依赖标签的谓词(如任一前端框架检出→a11y 适用)。monorepo 全仓聚合扫描,排除 `node_modules`/`vendor`/`dist`/`build`/`.git`;规则只装仓库根。检测为纯函数,按栈 fixture 金样钉死。(SCOPE-IN-008)

### SPEC-SELECT-001 选择总序与 12 上限
选择是检测输出的纯确定性函数,总序由四级键唯一确定(降序即保留优先级):(1) 核心(guardrails-core)恒选置顶、永不截断;(2) 层序 框架层{前端,移动,后端} > 语言层{语言} > 领域层{数据,测试,DevOps,横切}(由 category→层映射);(3) 同层内按 `specificity` 数值降序(越大越特异);(4) `specificity` 相等时按 `stacks.json` 注册表索引升序(靠前者优先)作最终决胜。规则文件上限 12(含核心);超限按该总序从最低优先级截断,被截断项在状态报告显式列出。(SCOPE-IN-009)

### SPEC-RECONCILE-001 全量调和与用户覆盖保护
仅作用于目标 manifest 记录的规则与 lint 文件。期望集(检测+选择结果)对比已装集:新增缺失项;移除不再匹配且磁盘哈希==manifest 项;升级库中更新且磁盘哈希==manifest 项;磁盘哈希≠manifest ⇒ 用户覆盖,跳过并报告,永不静默覆盖。`project-conventions.md` 不入期望集,仅由 distill 管理。(SCOPE-IN-010)

### SPEC-LINT-001 lint 首次布防行为
对每检出栈的关联基线,三条件同时满足才写:a) 检出该栈;b) 项目无该工具任何配置(按 SPEC-BASELINE-001 的当前+历史配置文件名探测);c) 目标 manifest 无该工具布防记录(at-most-once)。依赖永不自动安装,报告打印精确安装命令。用户删除脚手架=主动退出:不复活、报告标注;同一会话内确认后 `sync.mjs --relint <tool>` 清标记重布防。未改动脚手架(哈希匹配)随版本升级,改动过的永久跳过。已有配置的工具分毫不动,报告只读推荐。(SCOPE-IN-012)

### SPEC-PRECHECK-001 平台前置检查与入口托管块行为
固定映射:`claude→CLAUDE.md`、`codex→AGENTS.md`、`opencode→AGENTS.md`、`gemini→GEMINI.md`(平台来自烙入 `--platform`)。任何写入前:若当前平台映射文件不在仓库根,立即中止、零写入,提示"当前平台(<平台名>)无约束文件 <文件名>,请先创建该文件后重新执行 /code-guidelines";绝不创建入口文件。通过后:对已存在的 AGENTS.md/CLAUDE.md/GEMINI.md 逐一维护同一 `code-guidelines:begin/end` 块(有几个维护几个);遇畸形/重复/孤立标记则中止、零写入、报告;块内整体重生成、块外一字不动;仅当块内容变化才写(经 fs-safety 不变式,先 `lstat` 该文件)。(SCOPE-IN-014、015)

### SPEC-DISTILL-001 distill 行为
`distill`:先过平台前置检查(缺文件同样中止)。agent 驱动(SKILL.md 定义):按检出栈抽样源文件(每栈≥10,优先近期修改 + 被引用较多,不足则全量),产出 `.code-guidelines/project-conventions.md`(SPEC-RULEFMT-001 的 conventions 模板,≤80 行,每条约定≥2 处仓库内路径证据,无证据/通用最佳实践丢弃,逐条过 veto)。manifest 记录内容哈希 + 蒸馏日期;重蒸馏哈希不符则拒绝覆盖 + 输出新旧对比;接受走 `distill --force` 或手动删除后重跑。永不并入无参调用;无参只报告 conventions 状态。(SCOPE-IN-017)

### SPEC-STATUS-001 状态报告与 status 命令
无参运行末尾输出状态报告:本次 增/删/升级/跳过(含用户覆盖跳过项)清单;lint 每工具的 布防/缺口(缺口附精确安装命令)/退出状态;`project-conventions.md` 存在性 + 蒸馏日期(事实陈述,不判过期)。`--json` 输出等价结构化对象:`{ upToDate: bool, added: [file], removed: [file], upgraded: [file], skipped: [{file, reason}], lint: [{tool, armed: bool, gap: bool, installCmd?, optedOut?}], conventions: { present: bool, distilledAt? }, exitCode: int }`。`status` 命令只读汇报安装 manifest 形状与已装技能/资产/平台。(SCOPE-IN-013)

### SPEC-DOC-001 文档与许可
`README.md`(英)+ `README.zh-CN.md`(中):标题结构一致(双语标题对齐由测试断言),必含"How to use / 怎么使用"与"When to use / 什么时候使用"(含时机表),说明目标项目生成物含义、R2 刻意偏离(SKILL 无意图触发区)与 distill 依赖 agent 的残余风险;两章节关键内容由钉住测试保证。`LICENSE`(MIT)+ `THIRD-PARTY.md`(上游许可 + 逐条溯源约定)。(SCOPE-IN-020)

### SPEC-TEST-001 测试完备性
本 SPEC 全部行为与数据契约均有可执行测试(`node:test` + `node:assert`),映射见 `## Test Matrix`;绿地项目全部测试须全绿方为完成。agent 产出质量(distill 与规则蒸馏语义)不可机器测,以 SPEC-DOC-001 的残余风险声明兜底。(SCOPE-IN-021)

## API / Data / Config Contracts

### SPEC-STACKS-001 stacks.json schema
顶层 `{ version, stacks: [entry...] }`。entry 字段:`id`(唯一 string)、`category`(枚举:核心/语言/前端/移动/后端/数据/测试/DevOps/横切)、`specificity`(int,层内主排序键,数值越大越特异;层序由 category→层映射决定,见 SPEC-SELECT-001)、`detect`(四类谓词组合:`files` 路径存在如 `go.mod`/`Cargo.toml`/`pyproject.toml`;`packageDeps` 对 `package.json` 依赖名精确匹配;`extensions` 为 `{ ext, minCount }` 计数阈值逐条声明;`tags`/`requiresTags` 标签依赖,以其他栈检出为条件如任一前端框架→a11y)、`rules`(规则文件名数组 ⊆ library)、`lint`(基线键或 null)。guardrails-core:`category=核心`、恒选、不依赖 detect。全部检测/选择由 fixture 金样钉死。(SCOPE-IN-008、009)

### SPEC-MANIFEST-001 两级 manifest schema
安装 manifest `~/.code-guidelines/install-manifest.json`:`{ version, installedAt, files: [{ path, sha256, skill, platform }], skills: [...], platforms: [...] }`;所有权=manifest 追踪,"无标记"=磁盘路径不在 files。目标 manifest `<repo>/.code-guidelines/manifest.json`:`{ version, rules: [{ file, sourceVersion, sha256 }], lint: [{ tool, armedAt, sha256|null, optedOut? }], conventions: { sha256, distilledAt } | null }`。全部 `sha256` 均对规范化行尾(统一 `\n`)后的内容计算(DECISION-004),以免 CRLF/LF 差异被误判为用户改动。"升级"判定规则:当且仅当 磁盘内容哈希 == `manifest.sha256`(未被用户改动)且 库中该文件内容哈希 != `manifest.sha256`(库有新版)时,替换为库版本并更新 manifest 的 `sha256` 与 `sourceVersion`;`sourceVersion`(源自规则 frontmatter `source` 的 commit,或资产全局 `VERSION`)仅作溯源记录、不参与升级判定(其精确取值来源留 PLAN 钉死,不新增字段)。(SCOPE-IN-003、016、010)

### SPEC-PLATFORM-001 四平台产物形态与安装路径(已依官方文档核实,2026-07-03)
- Claude Code:`~/.claude/skills/code-guidelines/SKILL.md`(Markdown + YAML frontmatter);目录名即 `/code-guidelines`;frontmatter 含 `description`(负向守卫)与 `disable-model-invocation: true`。入口文件 CLAUDE.md。
- Codex:`~/.codex/prompts/code-guidelines.md`(Markdown + frontmatter `description`/`argument-hint`;占位符 `$ARGUMENTS`/`$1`);custom-prompt 为显式调用形态。入口文件 AGENTS.md。残余风险:该 custom-prompt 机制官方标注 deprecated(建议迁移 skills),且精确 slash 前缀 UNCONFIRMED;PLAN 须在实现时对目标 Codex 版本复核,必要时以 skills 形态承载并保留负向守卫。
- opencode:`~/.config/opencode/commands/code-guidelines.md`(复数 `commands/` 为规范、单数 `command/` 为兼容别名);安装路径按 `XDG_CONFIG_HOME`(缺省 `~/.config`)解析,精确 env 覆盖(含 Windows homedir/`.config` 解析)留 PLAN 实现细节;Markdown + frontmatter;占位符 `$ARGUMENTS`/`$1`;`/code-guidelines`。入口文件 AGENTS.md。
- Gemini CLI:`~/.gemini/commands/code-guidelines.toml`(TOML;必需 `prompt`、可选 `description`;占位符 `{{args}}`);`/code-guidelines`。入口文件 GEMINI.md。
构建按平台发射对应形态(Gemini=TOML,其余=Markdown)并烙入 `--platform` 标识。(SCOPE-IN-002)

### SPEC-RULEFMT-001 规则文件、frontmatter、模板与 veto
规则文件:纯 `.md`,frontmatter `name`/`description`/`appliesTo`(globs)/`stacks`(检测标签)/`source`(上游仓库路径+commit 或 `original`);正文英文;固定模板:硬约束(禁止项)段在前、生态惯用法段在后;≤100 行。veto 清单 `~/.code-guidelines/distill/veto-checklist.md` 条目:模板段落顺序、无人设/私有路径/私货、行数上限、frontmatter 完整、无与 lint 基线重复的约束。distill 模板与 conventions 模板(≤80 行、每条≥2 证据路径、guardrails 措辞)存 `~/.code-guidelines/distill/`。(SCOPE-IN-018、017)

### SPEC-BASELINE-001 11 套 lint 基线配置文件名与元数据(已核实当前格式,2026-07-03)
每套基线为一组当前(非弃用)配置文件,存 `~/.code-guidelines/lint/<lang>/`;`stacks.json` 以 `lint` 键关联;每套附 `meta`(强制约束清单,划定与规则散文的分工)。规范文件名/格式:
- js-ts:`eslint.config.js`(flat config;ESLint v10 已移除 eslintrc,只发 flat)+ `.prettierrc` + 严格 `tsconfig.json`(`strict` + `noUncheckedIndexedAccess` 等非 strict 项);React/Vue 等框架插件为检出框架时条件附加。
- python:`ruff.toml`(lint 规则置于 `[lint]` 子表)+ `mypy.ini`(`strict = true`)。
- go:`.golangci.yml`(v2 schema:顶层 `version: "2"`、`linters.default`、独立 `formatters:`)。
- rust:`rustfmt.toml` + `clippy.toml`(仅配置项)+ `Cargo.toml [lints]`(设 lint 级别)。
- java:`checkstyle.xml`(DTD Configuration 1.3,https DTD URL)。
- kotlin:`.editorconfig`(ktlint,`ktlint_*` 属性)+ `detekt.yml`(detekt 1.23.x 稳定线)。
- swift:`.swiftlint.yml`(用 `only_rules` 而非旧 `whitelist_rules`)。
- csharp:`.editorconfig` + `Directory.Build.props`(`AnalysisLevel=latest-all`、`EnforceCodeStyleInBuild=true`、`TreatWarningsAsErrors=true`)。
- php:`.php-cs-fixer.dist.php`(v3;旧 `.php_cs` 已废)+ `phpstan.neon`(PHPStan 2.x,max level 10)。
- ruby:`.rubocop.yml`(扩展经 `plugins:` 而非 `require:`,RuboCop ≥1.72)。
- cpp:`.clang-format` + `.clang-tidy`(`CheckOptions` 为 map)。
既有配置探测须覆盖上述当前文件名 + 常见历史名(如 `.eslintrc*`),命中即视为"已有配置"跳过布防。(SCOPE-IN-019、012)

### SPEC-HOSTFMT-001 入口托管块格式
块由 `<!-- code-guidelines:begin -->` 与 `<!-- code-guidelines:end -->` 界定;整块 ≤25 行:≤3 行说明 + 每条已装规则一行触发条件式指针(如 "Before editing `*.tsx`, read `.code-guidelines/react.md`");`project-conventions.md` 存在时其指针恒排第一。块内整体重生成、块外一字不动;仅内容变化才写文件。(SCOPE-IN-015)

## External Documentation Checked

平台技能/命令形态与 11 套 lint 工具配置格式均于 2026-07-03 依官方文档核实(Context7 优先,官方站点补充):

| Dependency | Version | Check Date | Conclusion |
|---|---|---|---|
| Claude Code (Anthropic CLI) | skills unified v2.1.x | 2026-07-03 | SKILL.md+YAML at `~/.claude/skills/code-guidelines/SKILL.md`, dir name→`/code-guidelines`, `disable-model-invocation: true` hard-disables auto; entry CLAUDE.md. CONFIRMED |
| Codex (OpenAI Codex CLI) | custom-prompt (deprecated) + skills | 2026-07-03 | custom-prompt `~/.codex/prompts/code-guidelines.md` explicit-only; deprecated, exact slash prefix UNCONFIRMED; entry AGENTS.md; recheck target version at impl |
| opencode | 2026 docs | 2026-07-03 | `~/.config/opencode/commands/code-guidelines.md` (plural canonical, singular alias + Windows quirk); Markdown+frontmatter; entry AGENTS.md. CONFIRMED |
| Gemini CLI (Google) | 2026 docs | 2026-07-03 | TOML `~/.gemini/commands/code-guidelines.toml`, required `prompt`, `{{args}}`; entry GEMINI.md. CONFIRMED |
| ESLint + Prettier + tsconfig | ESLint 10.6.0 / Prettier 3.9.4 / TS 5.x | 2026-07-03 | flat `eslint.config.js` only (v10 removed eslintrc); `.prettierrc` stable; tsconfig strict + `noUncheckedIndexedAccess`. CONFIRMED |
| ruff + mypy | ruff / mypy (current; exact version UNCONFIRMED) | 2026-07-03 | ruff rules under `[lint]` (since 0.2.0); mypy `strict=true`. Formats CONFIRMED; pin exact versions at impl |
| golangci-lint | v2.12.2 | 2026-07-03 | `.golangci.yml` MUST be v2 schema (`version: "2"`, `linters.default`, `formatters:`); v1 rejected. CONFIRMED |
| Rust clippy + rustfmt | toolchain-versioned ([lints] stable 1.74+) | 2026-07-03 | `rustfmt.toml` + `clippy.toml` (config only) + `Cargo.toml [lints]` (levels). CONFIRMED |
| Checkstyle | current 10.x line (exact version UNCONFIRMED) | 2026-07-03 | `checkstyle.xml`, DTD Configuration 1.3 (https URL). Format CONFIRMED; watch check renames across majors, pin version at impl |
| ktlint + detekt | ktlint 1.8.0 / detekt 1.23.x | 2026-07-03 | ktlint via `.editorconfig`; detekt `detekt.yml`; detekt 2.0 changes Gradle plugin id. CONFIRMED (stable line) |
| SwiftLint | ~0.63/0.64 (exact UNCONFIRMED) | 2026-07-03 | `.swiftlint.yml`, `only_rules`. Format CONFIRMED |
| C# Roslyn analyzers | .NET SDK 9/10 | 2026-07-03 | `.editorconfig` + MSBuild props (`AnalysisLevel=latest-all`); .NET 9+ honors on CLI builds. CONFIRMED |
| PHP-CS-Fixer + PHPStan | CS-Fixer 3.72+ / PHPStan 2.1.50 | 2026-07-03 | `.php-cs-fixer.dist.php` (old `.php_cs` gone); `phpstan.neon`, max level 10. CONFIRMED |
| RuboCop | ~1.84 | 2026-07-03 | `.rubocop.yml`, extensions via `plugins:` (≥1.72). CONFIRMED |
| clang-format + clang-tidy | LLVM 20/21 | 2026-07-03 | `.clang-format` + `.clang-tidy` (`CheckOptions` map); version-match via `--dump-config`. CONFIRMED |

## Test Matrix

| 领域 | 用例(SPEC 契约) |
|---|---|
| CLI | 五命令解析、未知命令/选项/平台值/重复值退出 2、status 形状校验(SPEC-CLI-001) |
| 安装 | install/uninstall、两阶段暂存-换入、提交前失败原样保留、用户改动拒绝+退出 4、symlink 拒绝、uninstall 移除 install-manifest+空根(SPEC-INSTALL-001) |
| 构建 | golden snapshot、即时构建==提交产物逐字节(自符合)、每平台形态(Gemini=TOML)(SPEC-BUILD-001 / SPEC-PLATFORM-001) |
| 触发守卫 | 各平台 description 含负向守卫、Claude 有 `disable-model-invocation: true`、正文无意图触发区(SPEC-TRIGGER-001) |
| 检测 | 按栈 fixture 金样、四谓词、monorepo 聚合+排除目录(SPEC-DETECT-001 / SPEC-STACKS-001) |
| 选择 | 四级总序(核心>层序>specificity 降序>注册表索引)、12 上限截断+报告(SPEC-SELECT-001) |
| 调和/零写入 | 幂等二跑零写入、用户覆盖保护、升级判定(SPEC-RECONCILE-001) |
| 平台前置 | 四映射各一、缺当前平台文件中止+零写入+提示含平台名与文件名、他平台文件存在但当前缺失仍中止、通过后只写已存在文件从不新建(SPEC-PRECHECK-001) |
| 托管块 | 再生成+块外不动、畸形/重复/孤立标记中止且零写入(SPEC-HOSTFMT-001 / SPEC-PRECHECK-001) |
| lint | 空白首跑布防、二跑零写入、删除不复活、既有配置不动、未改动升级/改动跳过、既有配置探测覆盖当前+历史文件名(SPEC-LINT-001 / SPEC-BASELINE-001) |
| 规则库 | 恰 48 文件、frontmatter 完整、行数上限、模板段落顺序、`source` 可解析(SPEC-RULEFMT-001) |
| distill | 模板与 veto 存在、manifest 记录、覆盖保护、`--force`/删除后重蒸馏(SPEC-DISTILL-001) |
| 文档 | README 双语标题对齐 + 必含两章节内容钉住、THIRD-PARTY 溯源(SPEC-DOC-001) |

## Non-goals

- 不解析或合并用户既有 lint 配置;仅存在性检测 + 只读缺口报告(SCOPE-OUT-002)。
- 不自动安装依赖;仅打印精确安装命令(SCOPE-OUT-003)。
- 不镜像上游全部 257 条规则,不覆盖 48 栈之外的小众栈(SCOPE-OUT-004)。
- 不修改目标项目 CI 配置(SCOPE-OUT-005)。
- 不创建入口约束文件;缺失仅提示用户自行创建(SCOPE-OUT-006)。
- 不引入意图/关键字/hook/副作用触发(SCOPE-OUT-001)。
- 不发布安装器到包 registry;仅本地 Node CLI(SCOPE-OUT-007)。

## PLAN Handoff

PLAN 须把以下拆为 create 任务(绿地全部新建),每任务带可执行验证:
- 安装器骨架:`package.json`(type=module + bin)、`bin/code-guidelines`、`src/cli.mjs` + `src/commands/*`(SPEC-CLI-001)。
- 安装引擎:`src/install/{manifest,transaction,fsutil}.mjs`(两阶段提交 + fs-safety;SPEC-INSTALL-001)。
- 构建:`src/build/{build,registry}.mjs` + `fragments/*` + 提交 `generated/*`(SPEC-BUILD-001);按平台发射 Markdown/TOML(SPEC-PLATFORM-001)。
- 资产:`assets/stacks.json`(SPEC-STACKS-001)、`assets/sync.mjs`(SPEC-SYNC-001..SPEC-STATUS-001)、`assets/VERSION`、`assets/distill/{template.md,veto-checklist.md}`(SPEC-RULEFMT-001)。
- 规则库:`assets/library/` 48 文件(SPEC-RULEFMT-001;逐条过 veto)。
- lint 基线:`assets/lint/<lang>/` 11 套,用 SPEC-BASELINE-001 核实的当前文件名/格式,每套附 meta。
- SKILL/命令正文单源片段 + 负向守卫(SPEC-TRIGGER-001)。
- 文档:`README.md`/`README.zh-CN.md`、`LICENSE`(MIT)、`THIRD-PARTY.md`(SPEC-DOC-001)。
- 测试:`test/*` + `test/fixtures/*` 覆盖 Test Matrix 全部行(SPEC-TEST-001)。
实现须复核项(实现时用 Context7/官方文档钉死,避免隐式假设):Codex custom-prompt 的精确 slash 前缀与目标版本 deprecated 状态(必要时以 skills 形态承载并保留负向守卫,SPEC-PLATFORM-001);`sync.mjs` 保守 Node 基线与触发手工兜底的精确条件(SPEC-SYNC-001);各 lint 工具随版本的配置微调以核实的当前格式为准(SPEC-BASELINE-001)。

## Trace

| This ID | Upstream | Status |
|---|---|---|
| SPEC-CLI-001 | SCOPE-IN-001 | specified |
| SPEC-INSTALL-001 | SCOPE-IN-003 / 005 | specified |
| SPEC-BUILD-001 | SCOPE-IN-004 | specified |
| SPEC-TRIGGER-001 | SCOPE-IN-006 | specified |
| SPEC-SYNC-001 | SCOPE-IN-007 / 011 | specified |
| SPEC-DETECT-001 | SCOPE-IN-008 | specified |
| SPEC-SELECT-001 | SCOPE-IN-009 | specified |
| SPEC-RECONCILE-001 | SCOPE-IN-010 | specified |
| SPEC-LINT-001 | SCOPE-IN-012 | specified |
| SPEC-PRECHECK-001 | SCOPE-IN-014 / 015 | specified |
| SPEC-DISTILL-001 | SCOPE-IN-017 | specified |
| SPEC-STATUS-001 | SCOPE-IN-013 | specified |
| SPEC-DOC-001 | SCOPE-IN-020 | specified |
| SPEC-TEST-001 | SCOPE-IN-021 | specified |
| SPEC-STACKS-001 | SCOPE-IN-008 / 009 | specified |
| SPEC-MANIFEST-001 | SCOPE-IN-003 / 016 / 010 | specified |
| SPEC-PLATFORM-001 | SCOPE-IN-002 | specified |
| SPEC-RULEFMT-001 | SCOPE-IN-018 / 017 | specified |
| SPEC-BASELINE-001 | SCOPE-IN-019 / 012 | specified |
| SPEC-HOSTFMT-001 | SCOPE-IN-015 | specified |
<!-- /r2p-read-only -->

## Project Context (read-only)
# Project Context Pack

- repo_root: `/Users/xubo/x-studio/code-guidelines`
- languages: {}
- package_managers: none
- test_commands: none
- entrypoints: none
- config_files: none
- dependencies (0): none
- source_dirs: []
<!-- /r2p-read-only -->
