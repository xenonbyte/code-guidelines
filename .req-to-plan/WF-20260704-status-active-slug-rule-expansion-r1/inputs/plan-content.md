# Plan

交付顺序 S1→S2→S3 是硬约束（CI 先保护；引擎先于 llm-app）。提交划分：S1=commit①(TASK-001/002/003)、S2=commit②(TASK-004/005)、S3-feat=commit③(TASK-006)、S3-audit=commit④(TASK-007，条件性)、版本与发布(TASK-008+G4 运维步)。本仓禁 dogfood——检测验证一律在抛弃式 scratch 仓。

## Tasks
<!-- Granularity: one PLAN-TASK = one implementer subagent, one task-reviewer; split a task spanning too many files/behaviors, merge only one indivisible behavior. -->

### PLAN-TASK-001 新建 CI 工作流
Spec References: SPEC-CI-001
Scope: 闭合 SCOPE-IN-001
Change Type: create
TDD Applicable: no
Files:
- `.github/workflows/ci.yml`
Skeleton:
```yaml
name: CI
on: { push: { branches: [main] }, pull_request: {} }
jobs:
  test:
    runs-on: ${{ matrix.os }}
    strategy:
      fail-fast: false
      matrix: { os: [ubuntu-latest, macos-latest, windows-latest], node: [20, 22, 24] }
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: ${{ matrix.node }} }
      - run: npm run check
      - run: node --test
```
Steps:
- [ ] 按 SPEC-CI-001 逐字写出 ci.yml（`fail-fast:false`、9 腿矩阵、无 `npm ci`、无 cache、不配 registry-url）。
Verification: (1) 目标：字段/矩阵存在性 smoke 检查（`node -e` grep 关键字段 `fail-fast: false`/`windows-latest`/三 node 版本，或可得的 YAML linter 验语法）——此为 smoke 级，**完整语法与 9 腿实跑的权威验证在 G1**（合入 PR 后于 CI）；(2) 证据：粘贴文件内容并核对与 SPEC 逐字一致。

### PLAN-TASK-002 新建 Release 工作流
Spec References: SPEC-RELEASE-001
Scope: 闭合 SCOPE-IN-002
Change Type: create
TDD Applicable: no
Files:
- `.github/workflows/release.yml`
Skeleton:
```yaml
name: Release
on: { push: { tags: ['v*'] } }
permissions: { id-token: write, contents: read }
jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '24', registry-url: 'https://registry.npmjs.org' }
      - run: npm install -g npm@latest
      - run: npm run check
      - run: node --test
      - run: npm publish --provenance --access public
```
Steps:
- [ ] 按 SPEC-RELEASE-001 写出 release.yml（OIDC，`id-token:write`+`contents:read`，`npm install -g npm@latest` 守 ≥11.5.1，无 `NODE_AUTH_TOKEN`）。
- [ ] 在 PR 描述/Execution Readiness 提醒用户：G4 打 tag 前须在 npmjs.com 绑定 trusted publisher（repo + `release.yml`）。
Verification: (1) 目标：YAML 语法与字段核验（`id-token: write`、`registry-url`、`--provenance --access public`、无 token env）；(2) 证据：粘贴文件内容核对。实际发布在 G4（tag 推送后 CI 内）验证。

### PLAN-TASK-003 dev 指南 CI 说明
Spec References: SPEC-DOC-001
Scope: 闭合 SCOPE-IN-003
Change Type: modify
TDD Applicable: no
Files:
- `AGENTS.md`
- `CLAUDE.md`
Skeleton:
```text
（在两文件的 gate 说明段各加一句）CI 在 push/PR 上跑同一 gate（`npm run check` + `node --test`）。
```
Steps:
- [ ] 在 `AGENTS.md` 与 `CLAUDE.md` 的 gate 说明段各加一句 CI 文案；README 不动。
Verification: (1) 目标：`git diff AGENTS.md CLAUDE.md` 仅新增一句 CI 文案；全量 `node --test` 绿（`readme.test.mjs` 只守 README，不覆盖 AGENTS/CLAUDE，故不单列）；(2) 证据：粘贴 diff 与测试输出。

### PLAN-TASK-004 pythonDeps 检测（引擎+数据+检测测试，S2 不可分单元）
Spec References: SPEC-SCAN-001, SPEC-PYDEPS-001, SPEC-PREDICATE-001, SPEC-STACKS-001, SPEC-STACKSTEST-001, SPEC-SYNCTEST-001
Scope: 闭合 SCOPE-IN-004, SCOPE-IN-005, SCOPE-IN-006, SCOPE-IN-007, SCOPE-IN-008
Change Type: modify
TDD Applicable: yes
Files:
- `assets/sync.mjs`
- `assets/stacks.json`
- `test/sync.test.mjs`
- `test/stacks.test.mjs`
Skeleton:
```js
function stripStrings(s) { return s.replace(/"[^"]*"|'[^']*'/g, ''); }
function closesArray(s) { return stripStrings(stripInlineTables(s)).includes(']'); } // ] 仅在引号串/内联表之外才闭合数组
function mergePythonDeps(pyprojectTexts, requirementsTexts) { /* SPEC-PYDEPS-001 状态机；parsePyproject 用 closesArray 判数组闭合、parseRequirements 剥注释/跳 URL 行 */ }
function matchPythonDeps(names, mergedPyDeps) { for (const n of names) if (mergedPyDeps.has(n)) return true; return false; }
// detect(): const mergedPyDeps = mergePythonDeps(scan.pyprojectTexts, scan.requirementsTexts)
// baseMatch(): if (Array.isArray(det.pythonDeps) && det.pythonDeps.length) results.push(matchPythonDeps(det.pythonDeps, mergedPyDeps))
```
Steps:
- [ ] 先写 `test/sync.test.mjs` 的 (a)–(h) 八例（含 (h) 跨行数组非末位 extras 假阴回归：`["uvicorn[standard]","fastapi"]` 逐行仍检出 fastapi）与 `test/stacks.test.mjs` 的 `pythonDeps` validator 分支（红）。
- [ ] `scanRepo`：`EXCLUDED_DIRS` 加 `.venv`/`venv`/`__pycache__`；收集 `pyprojectTexts`/`requirementsTexts`（SPEC-SCAN-001）。
- [ ] 实现 `mergePythonDeps`（SPEC-PYDEPS-001：单/跨行数组、**跨行数组闭合以 `closesArray`（引号串/内联表外的 `]`）判定——extras 内 `]` 不提前闭合**、poetry 表键剔 `python`、`include-group` 内联表剥离、requirements 剥注释+仅跳整行 URL、PEP503 归一）。
- [ ] 接入 `matchPythonDeps` + `baseMatch` + `detect`；同步 `SPEC-DETECT-001` [N/A] 注释块 four→five（`:256`）与 three→four populated（`:264`）。
- [ ] `assets/stacks.json`：六处 detect（fastapi/flask 改 pythonDeps 删裸名、django 增、pytest/python-ml/mongodb 增）+ 顶层 version 1.0.0→1.1.0；`stacks.test.mjs:102` 测试名 four→five、断言文案补 pythonDeps。
- [ ] 全部转绿。
Verification: (1) 目标：`node --test test/sync.test.mjs test/stacks.test.mjs` 全绿（尤其 (a) 误报回归与 (h) 跨行 extras 假阴回归）；(2) 全量 `node --test` + `npm run check` 绿；(3) scratch 仓 dogfood 四例（main.py-only 不检出 fastapi/security、pyproject+fastapi 检出、requirements+flask 检出、跨行数组 `["uvicorn[standard]","fastapi"]` 逐行仍检出 fastapi）；(4) 证据：粘贴测试通过计数与 dogfood 输出。

### PLAN-TASK-005 谓词清单文档
Spec References: SPEC-DOC-001
Scope: 闭合 SCOPE-IN-009
Change Type: modify
TDD Applicable: no
Files:
- `CLAUDE.md`
- `AGENTS.md`
Skeleton:
```text
files / packageDeps / extensions / requiresTags / pythonDeps
```
Steps:
- [ ] 在两文件谓词清单处加入 `pythonDeps`。
Verification: (1) 目标：`git diff` 仅谓词清单新增；全量 `node --test` 绿；(2) 证据：粘贴 diff。

### PLAN-TASK-006 规则库 48→57 + 数量钉死联动（S3-feat，数量耦合不可分）
Spec References: SPEC-RULE-001, SPEC-PIN-001
Scope: 闭合 SCOPE-IN-010, SCOPE-IN-012
Change Type: create
TDD Applicable: yes
Files:
- `assets/library/{expo,dotnet-maui,solidjs,blazor,electron,frontend-state,prisma,web-perf,llm-app}.md`（新增 9）
- `assets/stacks.json`（+9 条目就近插入、按 SPEC-RULE-001 detect/specificity/`lint:null`）
- `assets/VERSION`（1.2.0→1.3.0）
- `test/library.test.mjs`、`test/stacks.test.mjs`（48→57 及测试名/消息，SPEC-PIN-001 全 16 位点）
- `README.md`、`README.zh-CN.md`、`THIRD-PARTY.md`、`AGENTS.md`、`CLAUDE.md`（48→57 + 分类清单双语对齐、`AGENTS.md:12` pattern）
Skeleton:
```md
---
name: <id>
description: <one line>
appliesTo: ["**/*.<ext>"]
stacks: ["<id>"]
source: original
---
# <Title>
## Hard Constraints (MUST NOT)
- MUST NOT <具名反模式> …
## Ecosystem Idioms & Conventions
- <惯例> …
```
Steps:
- [ ] 逐条撰写 9 条 `source: original` 规则（研读上游→官方文档逐条核查，安全项对照 OWASP；≤100 行、frontmatter/heading 结构、负向具名反模式）。
- [ ] `assets/stacks.json` 按类别就近插入 9 条目（detect 逐字 SPEC-RULE-001：solidjs/blazor/electron/frontend-state emit `tags:[frontend]`、web-perf gate `requiresTags:[frontend]`、其余 base；均 `lint:null`）。
- [ ] 一次性改齐 SPEC-PIN-001 的全 16 位点 + `assets/VERSION`。
Verification: (1) 目标：全量 `node --test`（含 library.test/stacks.test 的 57 计数与 readme.test 双语对齐）+ `npm run check` 绿；(2) scratch 仓 dogfood：9 个新 stack 逐一命中（expo/MauiProgram.cs/.razor/solid-js/zustand/electron/prisma/openai + 纯前端命中 web-perf）、12 条上限截断且截断文件在报告具名；(3) 证据：粘贴测试计数与 dogfood 命中/截断输出；**每条新规则另附其官方文档/OWASP 逐条核查依据**（RISK-SEC-002 的可追溯闭合证据，尤其 llm-app/electron/blazor/dotnet-maui 的安全硬约束）。

### PLAN-TASK-007 既有规则版本时效审计（条件性）
Spec References: SPEC-AUDIT-001
Scope: 闭合 SCOPE-IN-011
Change Type: modify
TDD Applicable: no
Files:
- `assets/library/nextjs.md`
- `assets/library/tailwind.md`
- `assets/library/svelte.md`
- `assets/library/ios-swiftui.md`
（以上四条必查；其余九条 react/vue/nuxt/angular/astro/html-css/react-native/flutter/android-compose 如经核查有过时表述再改，无则不动——见 Steps）
Skeleton:
```text
逐条对官方当前大版本核查 → 仅替换过时表述（不扩行数、不改结构）；无过时则不动。
```
Steps:
- [ ] 对 13 条逐条核官方文档；仅修过时表述（Next.js16 / Tailwind v4 / Svelte5 runes / Swift6 等）。
- [ ] 无改动是合法结果（零提交）。
Verification: (1) 目标：全量 `node --test`（行数/frontmatter/heading 钉死不破）+ `npm run check` 绿；(2) 证据：每条改动附官方文档依据；若零改动，说明各条核查结论。

### PLAN-TASK-008 版本号与发布
Spec References: SPEC-REL-001
Scope: 闭合 SCOPE-IN-013, SCOPE-IN-014
Change Type: modify
TDD Applicable: no
Files:
- `package.json`
Skeleton:
```json
{ "version": "0.3.0" }
```
Steps:
- [ ] 全部合入后 `package.json` 0.2.0→0.3.0（`assets/VERSION` 1.3.0 已在 TASK-006）。
- [ ] G4 运维步（非代码任务）：确认 trusted publisher 已配置 → 打 tag `v0.3.0` 推送 → release workflow 内建 gate 通过并发布 → `npm view code-guidelines version` 返回 0.3.0 且带 provenance。本需求内仅此一次发布。
Verification: (1) 目标：全量 `node --test` + `npm run check` 绿；(2) 证据：粘贴 `package.json` diff；G4 发布结果（`npm view`）在 tag 推送后核验。

## Execution Readiness
- 需求简报已复核；design decision requests pending：none。
- 交付顺序 S1→S2→S3 为硬约束；TASK-004 与 TASK-006 因测试/计数耦合为各自提交内的不可分单元。
- 高风险缓解已入任务（见 Risk Handling）；非目标受保护（不触 `fragments/`/`src/`/`assets/lint/`，零依赖，无 `npm run build`）。
- 每任务后跑目标测试；S2/S3 另在 scratch 仓 dogfood（本仓禁 dogfood）；最终审查跑一次全量回归。
- 两处 user-gated 前置（非阻塞合入）：G4 前 npm trusted publisher 配置（TASK-002/008）；Windows 腿若暴露产品源码结构性不兼容则暂停 S1 上报（TASK-001/004）。
- 无未决歧义；out-of-scope 由简报的 SCOPE-OUT 声明，未在此下沉丢弃。

## Risk Handling
| Risk | Handling Task | Closure |
|---|---|---|
| RISK-SEC-001 | PLAN-TASK-002 | [ADDRESSED] |
| RISK-SEC-002 | PLAN-TASK-006 | [ADDRESSED] |
| RISK-COMPAT-001 | PLAN-TASK-001, PLAN-TASK-004 | [ADDRESSED] |
| RISK-DETECT-001 | PLAN-TASK-004 | [ADDRESSED] |
| RISK-DETECT-002 | PLAN-TASK-004 | [ADDRESSED] |
| RISK-REGR-001 | PLAN-TASK-006 | [ADDRESSED] |
| RISK-REL-001 | PLAN-TASK-002, PLAN-TASK-008 | [ADDRESSED] |
| RISK-AUDIT-001 | PLAN-TASK-007 | [ADDRESSED] |
| RISK-PIN-001 | PLAN-TASK-006 | [ADDRESSED] |

## Trace
<!-- Map this stage's IDs to upstream/downstream. R3 derives & checks closure. -->
| This ID | Upstream | Status |
|---|---|---|
| PLAN-TASK-001 | SPEC-CI-001 | [ADDRESSED] |
| PLAN-TASK-002 | SPEC-RELEASE-001 | [ADDRESSED] |
| PLAN-TASK-003 | SPEC-DOC-001 | [ADDRESSED] |
| PLAN-TASK-004 | SPEC-SCAN-001, SPEC-PYDEPS-001, SPEC-PREDICATE-001, SPEC-STACKS-001, SPEC-STACKSTEST-001, SPEC-SYNCTEST-001 | [ADDRESSED] |
| PLAN-TASK-005 | SPEC-DOC-001 | [ADDRESSED] |
| PLAN-TASK-006 | SPEC-RULE-001, SPEC-PIN-001 | [ADDRESSED] |
| PLAN-TASK-007 | SPEC-AUDIT-001 | [ADDRESSED] |
| PLAN-TASK-008 | SPEC-REL-001 | [ADDRESSED] |

## Upstream Summary (read-only)
# Spec

## Behavior Contracts

### SPEC-CI-001 ci.yml（DES-ARCH-001 [ADDRESSED]）
新建 `.github/workflows/ci.yml`，内容契约：
```yaml
name: CI
on:
  push:
    branches: [main]
  pull_request:
jobs:
  test:
    name: test (${{ matrix.os }}, node ${{ matrix.node }})
    runs-on: ${{ matrix.os }}
    strategy:
      fail-fast: false
      matrix:
        os: [ubuntu-latest, macos-latest, windows-latest]
        node: [20, 22, 24]
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ matrix.node }}
      - run: npm run check
      - run: node --test
```
契约点：`fail-fast: false`（9 腿独立报）；无 `npm ci`、无 `cache`（仓零 `dependencies`/`devDependencies`、无 lockfile，`npm ci` 反会报错）；`setup-node` 不配 `registry-url`。

### SPEC-RELEASE-001 release.yml（DES-ARCH-002 [ADDRESSED]）
新建 `.github/workflows/release.yml`：
```yaml
name: Release
on:
  push:
    tags: ['v*']
permissions:
  id-token: write
  contents: read
jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '24'
          registry-url: 'https://registry.npmjs.org'
      - run: npm install -g npm@latest
      - run: npm run check
      - run: node --test
      - run: npm publish --provenance --access public
```
契约点：`permissions.id-token: write` + `contents: read`（OIDC）；`registry-url` 必配（写 `.npmrc`）；`npm install -g npm@latest` 守 npm ≥ 11.5.1；**无** `NODE_AUTH_TOKEN`/`NPM_TOKEN` env（Trusted Publishing 用 OIDC）；发布前先跑 `npm run check` 与 `node --test`。人工前置（G4 前）：npmjs.com 为 `code-guidelines` 绑定 trusted publisher（repo + workflow 文件名 `release.yml`）。

### SPEC-SCAN-001 scanRepo 扩展（DES-DETECT-001 [ADDRESSED]）
`assets/sync.mjs`：
- `EXCLUDED_DIRS`（`:43`）新增 `'.venv'`、`'venv'`、`'__pycache__'`（现有 `node_modules/vendor/dist/build/.git` 之外）。
- `scanRepo` 内新增两个收集数组 `pyprojectTexts=[]`、`requirementsTexts=[]`。在既有 `if (name === 'package.json')` 内容读取分支旁：`if (name === 'pyproject.toml') { try { pyprojectTexts.push(readFileSync(join(abs,name),'utf8')) } catch {} }`；`if (/^requirements[^/]*\.txt$/.test(name)) { try { requirementsTexts.push(readFileSync(join(abs,name),'utf8')) } catch {} }`。返回对象扩为 `{ ..., packageJsons, pyprojectTexts, requirementsTexts }`。

### SPEC-PYDEPS-001 mergePythonDeps 纯函数（DES-DETECT-002 [ADDRESSED]）
新增纯函数，契约按下列伪码（不引 TOML 库；每个文本独立 `try/catch` 静默跳过；PEP503 归一）。**数组闭合检测须无视引号串与内联表内部的 `]`**：只有出现在引号串/内联表之外的 `]` 才闭合跨行数组，否则 extras 依赖（如 `"uvicorn[standard]"`）内的 `]` 会在跨行数组里被误判为数组结束、丢弃其后的所有依赖（跨行数组假阴回归）。
```
normalize(n)  = n.toLowerCase().replace(/[-_.]+/g, '-')
addName(s, S) = { m = /^([A-Za-z0-9][A-Za-z0-9._-]*)/.exec(s.trim()); if (m) S.add(normalize(m[1])) }

mergePythonDeps(pyprojectTexts, requirementsTexts):
  S = new Set()
  for t in pyprojectTexts:     try { parsePyproject(t, S) } catch {}
  for t in requirementsTexts:  try { parseRequirements(t, S) } catch {}
  return S

parsePyproject(text, S):
  section = ''; mode = 'none'; inArray = false
  for raw in text.split(/\r?\n/):
    tr = raw.trim()
    if inArray:
      for q in quotedStrings(stripInlineTables(tr)): addName(q, S)   // stripInlineTables removes {…}
      if closesArray(tr): inArray = false                            // ] OUTSIDE quoted strings/inline-tables only
      continue
    if tr.startsWith('['):
      section = tr; mode = classify(section); continue
    if mode == 'array':
      key = tr.split('=')[0].trim()
      if section == '[project]' && key != 'dependencies': continue
      rhs = tr.slice(tr.indexOf('=') + 1).trim()
      if tr.includes('=') && rhs.startsWith('['):
        for q in quotedStrings(stripInlineTables(rhs)): addName(q, S)
        if !closesArray(rhs): inArray = true                         // no ] outside quotes/tables ⇒ array continues on next line
    else if mode == 'table':
      key = tr.split('=')[0].trim()
      if key && key != 'python' && !key.startsWith('['): addName(key, S)

classify(sec):
  '[project]' -> 'array'                      // 仅 dependencies 键当依赖数组，其余键（keywords/classifiers/requires-python…）跳过
  '[project.optional-dependencies]' -> 'array'
  '[dependency-groups]' -> 'array'            // PEP 735
  '[tool.poetry.dependencies]' -> 'table'
  /^\[tool\.poetry\.group\.[^.\]]+\.dependencies\]$/ -> 'table'
  else -> 'none'

stripInlineTables(s) = s.replace(/\{[^}]*\}/g, '')   // 移除 { include-group = "..." } 等内联表引用，避免误取 group 名
stripStrings(s)      = s.replace(/"[^"]*"|'[^']*'/g, '')   // 移除引号串内容（含其中的 [ ] 括号），供数组闭合检测使用
closesArray(s)       = stripStrings(stripInlineTables(s)).includes(']')   // 引号串/内联表之外若含 ] 则数组闭合
quotedStrings(s)     = 从 s 匹配所有 /"([^"]*)"|'([^']*)'/ 的捕获内容

parseRequirements(text, S):
  for raw in text.split(/\r?\n/):
    tr = raw.replace(/\s+#.*$/, '').trim()          // 先剥离行内注释（空白+#…），再判空/取名
    if tr == '' || tr.startsWith('#') || tr.startsWith('-'): continue
    if /^[a-z][a-z0-9+.-]*:\/\//i.test(tr): continue   // 仅跳过“整行以 URL scheme 开头”的直链；不再用 includes('://')（避免误伤 `pkg @ url` 或残留注释）
    addName(tr, S)                                   // `pkg @ https://…` 由名字正则天然取到 pkg
```
边界契约：poetry `python = "^3.11"` 被 `key != 'python'` 剔除；poetry 内联表依赖 `fastapi = { version="^0.1" }` 由表键模式取 `fastapi`；extras（`uvicorn[standard]`）由名字正则截断为 `uvicorn`；**跨行数组中非末位的 extras 依赖不再提前闭合数组**——`closesArray` 仅认引号串与内联表之外的 `]`，故 `dependencies = [\n "uvicorn[standard]",\n "fastapi",\n]` 会同时取到 `uvicorn` 与 `fastapi`（`[standard]` 内的 `]` 被忽略）；单行数组（`dependencies = ["uvicorn[standard]", "fastapi"]`）由开括号行的 `quotedStrings` 一次取全，`closesArray(rhs)` 为真故不进入跨行态；`[project]` 的 `keywords`/`classifiers`/`requires-python` 等非 `dependencies` 键跳过；PEP 735 `include-group` 内联表经 `stripInlineTables` 移除；PEP503 归一。

### SPEC-PREDICATE-001 pythonDeps 谓词接入 + 注释同步（DES-DETECT-003 [ADDRESSED]）
- 新增 `matchPythonDeps(names, mergedPyDeps)`：`for (const n of names) if (mergedPyDeps.has(n)) return true; return false;`（stacks 值与 merge 结果均 PEP503 归一，直接 `Set.has`）。
- `detect` 内 `const mergedDeps = mergeDeps(...)` 旁新增 `const mergedPyDeps = mergePythonDeps(scan.pyprojectTexts, scan.requirementsTexts)`。
- `baseMatch` 内在 extensions 分支后新增：`if (Array.isArray(det.pythonDeps) && det.pythonDeps.length) results.push(matchPythonDeps(det.pythonDeps, mergedPyDeps));`（并入 `results.some(Boolean)` 的 base-OR；pass1/pass2/`requiresTags`/`tags` 发射不变）。
- 注释同步（`SPEC-DETECT-001` [N/A] 块）：`:256`「four-predicate」→「five-predicate」；`:264`「ACROSS the three populated non-requiresTags predicate types」→「four」；新增一行说明 `pythonDeps` 列表内 OR（任一 pyproject/requirements 声明的依赖命中）。

### SPEC-STACKS-001 stacks.json 谓词更新（DES-DATA-001 [ADDRESSED]）
顶层 `"version": "1.0.0"` → `"1.1.0"`。六处 detect（保持既有 `category`/`specificity`/`rules`/`lint` 不变）：
- `fastapi`(`:517`) `detect` → `{ "pythonDeps": ["fastapi"], "tags": ["backend"] }`（删 `files`）。
- `flask`(`:534`) `detect` → `{ "pythonDeps": ["flask"], "tags": ["backend"] }`（删 `files`）。
- `django`(`:500`) `detect` → `{ "files": ["manage.py"], "pythonDeps": ["django"], "tags": ["backend"] }`。
- `pytest`(`:721`) `detect` → `{ "files": ["pytest.ini","conftest.py"], "pythonDeps": ["pytest"] }`。
- `python-ml`(`:670`) `detect` → 保留 `extensions:[ipynb]` + `requiresTags:[python]`，增 `"pythonDeps": ["numpy","pandas","scikit-learn","torch","tensorflow","jupyter"]`。
- `mongodb`(`:655`) `detect` → 保留 `packageDeps:[mongodb,mongoose]`，增 `"pythonDeps": ["pymongo","motor"]`。

### SPEC-STACKSTEST-001 validator（DES-TEST-001 [ADDRESSED]）
`test/stacks.test.mjs`：
- `:59` `assert.equal(stacks.length, 48)` → `57`；`:57` 测试名 48→57。
- `:102` 测试名「well-formed four-predicate detect shape」→「five-predicate」。
- validator（`:124-134` packageDeps 分支后）新增 `pythonDeps` 分支：`if ('pythonDeps' in detect) { assert Array.isArray; for each dep: typeof==='string' && length>0 && /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(dep); if length>0 hasActionablePredicate=true }`。
- `:188-191` 断言文案 `(files/packageDeps/extensions/requiresTags)` → 补 `pythonDeps`。

### SPEC-SYNCTEST-001 检测用例 (a)–(h)
`test/sync.test.mjs`，沿用 `tmpDir()`/`writeF()`/`detect(repo).map(h=>h.id)` 模式（排除用例参照 `:134-139`）：
- (a) `writeF(repo/'main.py','')` 且无依赖声明 → `!ids.includes('fastapi')` 且 `!ids.includes('security')`（误报 + backend→security 级联双消除）。
- (b) `writeF(repo/'pyproject.toml','[project]\ndependencies = ["fastapi"]\n')` → `ids.includes('fastapi')`。
- (c) `writeF(repo/'requirements.txt','Flask==3.0\n')` → `ids.includes('flask')`（大小写归一）。
- (d) `writeF(repo/'pyproject.toml','[tool.poetry.dependencies]\npython = "^3.11"\nfastapi = "^0.110"\n')` → `ids.includes('fastapi')`（`python` 键的剔除是 `mergePythonDeps` 内部不变式、`detect()` 层不可观测——无 `pythonDeps:["python"]` 的 stack，故此用例只断言 fastapi 命中；`python` 剔除可另留纯函数单测，非必须）。
- (e) `writeF(repo/'pyproject.toml','[project.optional-dependencies]\ndev = ["pytest"]\n')` → `ids.includes('pytest')`。
- (f) 畸形 pyproject + 有效 `writeF(repo/'package.json', JSON({dependencies:{vue:"^3"}}))` → 不抛、`ids.includes('vue')`。用例验证的终态目标是「畸形 pyproject 不影响其余检测」；状态机对多数畸形输入是健壮不抛的，`try/catch` 为防御性兜底（镜像 package.json 先例）。若要专门覆盖 catch 路径，可用能触发异常的输入（如 mock `readFileSync` 抛错），非必须。
- (g) `writeF(repo/'.venv/lib/site-packages/fastapi/pyproject.toml','[project]\ndependencies=["fastapi"]\n')` → `!ids.includes('fastapi')`（`.venv` 被排除）。
- (h) **跨行数组含非末位 extras（回归）**：`writeF(repo/'pyproject.toml','[project]\ndependencies = [\n  "uvicorn[standard]",\n  "fastapi",\n]\n')` → `ids.includes('fastapi')`。断言 `uvicorn[standard]` 内的 `]` 不得提前闭合跨行数组、丢弃其后的 `fastapi`——即 `closesArray` 无视引号串内括号。此例钉死 SPEC-PYDEPS-001 的跨行数组假阴修复。

### SPEC-RULE-001 9 条新规则 + stacks 条目（DES-RULE-001 [ADDRESSED]）
每条 `assets/library/<id>.md` frontmatter 契约（参照 `android-compose.md`）：`name`=文件名去 `.md`、`description` 一句、`appliesTo` 非空 glob 数组、`stacks` 非空数组（含本 id）、`source: original`；正文 `# <Title>` → `## Hard Constraints (MUST NOT)`（负向、具名反模式）→ `## Ecosystem Idioms & Conventions`；≤100 行。硬约束正文为**执行期原创撰写**（研读上游 → 官方文档逐条核查；安全项对照 OWASP），SPEC 不锁定其文字。`assets/stacks.json` 按类别就近插入 9 条目：

| id | category | specificity | detect | lint |
|---|---|---|---|---|
| expo | 移动 | 70 | `{packageDeps:["expo"]}` | null |
| dotnet-maui | 移动 | 65 | `{files:["MauiProgram.cs"]}` | null |
| solidjs | 前端 | 55 | `{packageDeps:["solid-js"],tags:["frontend"]}` | null |
| blazor | 前端 | 55 | `{extensions:[{ext:"razor",minCount:1}],tags:["frontend"]}` | null |
| electron | 前端 | 55 | `{packageDeps:["electron"],tags:["frontend"]}` | null |
| frontend-state | 前端 | 40 | `{packageDeps:["zustand","@reduxjs/toolkit","mobx","jotai","pinia","@tanstack/react-query","@tanstack/vue-query","swr"],tags:["frontend"]}` | null |
| prisma | 数据 | 50 | `{packageDeps:["prisma","@prisma/client"]}` | null |
| web-perf | 横切 | 25 | `{requiresTags:["frontend"]}` | null |
| llm-app | 横切 | 45 | `{packageDeps:["openai","@anthropic-ai/sdk","ai","langchain","@langchain/core","llamaindex"],pythonDeps:["openai","anthropic","langchain","llama-index"]}` | null |

detect 按需求表**逐字实现**（`tags` 为 emit、`requiresTags` 为 gate，按需求原记法区分，无偏离）：solidjs/blazor/electron/frontend-state 作 base 谓词命中并 **emit** `tags:["frontend"]`（与既有 react/vue 框架规则同型，使 a11y/web-perf 等 requiresTags 门控规则得以联动）；web-perf 为纯横切、`requiresTags:["frontend"]` **gate**（pass2）；expo/dotnet-maui/prisma/llm-app 无 tags/requiresTags 交互。llm-app 的 pythonDeps 依赖 S2 已落地，自创建即双生态检测。

### SPEC-AUDIT-001 版本时效审计（DES-AUDIT-001 [ADDRESSED]）
对 13 条既有前端/移动规则逐条核查官方当前大版本，**仅修过时表述、不扩行数、不改 frontmatter/heading 结构**：
- 必查四条：`nextjs.md`（Next.js 16：async request APIs、Cache Components、RSC 内 `next/dynamic {ssr:false}` 禁令）、`tailwind.md`（v4 CSS-first、`@theme`、无 `tailwind.config.js`）、`svelte.md`（Svelte 5 runes：`$state`/`$derived`/`$effect`）、`ios-swiftui.md`（Swift 6 strict concurrency）。
- 扫查九条（react/vue/nuxt/angular/astro/html-css/react-native/flutter/android-compose）：无过时则不动。
- 每条改动前须对官方文档核实；零改动是合法结果。

### SPEC-PIN-001 数量钉死点 48→57（DES-PIN-001 [ADDRESSED]，同一提交内改齐）
全量 16 处 + VERSION：
- 计数断言（不改则红）：`test/library.test.mjs:15` `EXPECTED_FILE_COUNT` `48`→`57`；`:76` 测试名字符串；`test/stacks.test.mjs:59` `stacks.length` 断言；`:57` 测试名字符串。
- 陈旧文案（不红）：`test/stacks.test.mjs:208` 测试名、`:213` 断言消息「48 stack ids」；`test/precheck.test.mjs:68` 注释「48-rule library」。
- README 双语：`README.md:21`、`:52`；`README.zh-CN.md:17`、`:45`（含分类清单 Frontend 9→13、Mobile 4→6、Data 3→4、Cross-cutting 3→5，双语章节对齐）。
- 其它文档：`THIRD-PARTY.md:8`、`:11`；`CLAUDE.md:138`；`AGENTS.md:69`；`AGENTS.md:12` 的 `--test-name-pattern="48"`→`"57"`。
- 版本：`assets/VERSION` `1.2.0`→`1.3.0`。

### SPEC-DOC-001 谓词清单 + CI 文案（DES-DOC-001 [ADDRESSED]）
`CLAUDE.md`/`AGENTS.md` 谓词清单 `files / packageDeps / extensions / requiresTags` 处补 `pythonDeps`；两文件 gate 段各加一句「CI 在 push/PR 上跑同一 gate（`npm run check` + `node --test`）」。README 不动。

### SPEC-REL-001 提交划分与发布（DES-REL-001 [ADDRESSED]）
提交序：① S1（`ci.yml`+`release.yml`+SPEC-DOC-001 的 CI 文案句）；② S2（SPEC-SCAN/PYDEPS/PREDICATE/STACKS/STACKSTEST/SYNCTEST + SPEC-DOC-001 谓词清单）；③ S3-feat（SPEC-RULE-001/002 + SPEC-PIN-001）；④ S3-audit（SPEC-AUDIT-001 如有改动，独立提交）。全部合入后 `package.json` `0.2.0`→`0.3.0`，打 tag `v0.3.0` 触发 release，仅此一次发布。

## API / Data / Config Contracts

- `scanRepo(repoRoot) -> { fileRelPaths:Set, dirRelPaths:Set, fileBasenames:Set, extCounts:Map, packageJsons:Object[], pyprojectTexts:string[], requirementsTexts:string[] }`（新增末两字段）。
- `mergePythonDeps(pyprojectTexts:string[], requirementsTexts:string[]) -> Set<string>`（PEP503 归一名；纯函数；异常静默；数组闭合检测无视引号串/内联表内的 `]`）。
- `matchPythonDeps(names:string[], mergedPyDeps:Set<string>) -> boolean`。
- stacks.json `detect.pythonDeps?: string[]`（每项形状 `^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$`）；顶层 `version: "1.1.0"`。
- 无新增运行时依赖；`package.json` 不新增 `dependencies`/`devDependencies`。

## External Documentation Checked

| Dependency | Version | Check Date | Conclusion |
|---|---|---|---|
| npm Trusted Publishing (docs.npmjs.com/trusted-publishers; Context7 /websites/npmjs) | npm ≥11.5.1 / Node ≥22.14.0 | 2026-07-04 | OIDC 需 id-token:write + contents:read、setup-node registry-url、免长期 token → SPEC-RELEASE-001 |
| PEP 621 / 735 / 503 + Poetry 表键约定 | PEP 508/503 | 2026-07-04 | dependencies / optional-dependencies / dependency-groups(+include-group) / poetry 表键 → PEP503 归一，反映于 SPEC-PYDEPS-001；跨行数组闭合须无视引号串内 `]`（extras 场景），否则非末位 extras 依赖会丢弃后续依赖 |
| Expo / .NET MAUI / SolidJS / Blazor / Electron / Prisma / web.dev CWV / OWASP LLM Top 10 / Next.js16 / Tailwind v4 / Svelte 5 / Swift 6 | 当期 major | 2026-07-04 | 9 新规则+13 审计原创依据；正文逐条官方核查在执行期进行 → SPEC-RULE-001 / SPEC-AUDIT-001 |

## Test Matrix

| 契约 | 测试 | 断言要点 |
|---|---|---|
| SPEC-PYDEPS/PREDICATE/STACKS | SPEC-SYNCTEST-001 (a) | main.py-only 不检出 fastapi/security（误报回归） |
| 同上 | (b) pyproject [project] | fastapi 检出 |
| 同上 | (c) requirements | Flask→flask（归一） |
| 同上 | (d) poetry 表 | fastapi 检出（python 键内部剔除，不可观测） |
| 同上 | (e) optional-deps | pytest 检出 |
| SPEC-SCAN | (f) 畸形 pyproject | 不抛、vue 仍检出 |
| SPEC-SCAN | (g) `.venv` | 排除、fastapi 不检出 |
| SPEC-PYDEPS（跨行 extras 回归） | (h) 跨行数组非末位 extras | fastapi 检出——`"uvicorn[standard]"` 内的 `]` 不提前闭合数组 |
| SPEC-STACKS/RULE | validator (SPEC-STACKSTEST-001) | pythonDeps 形状 + hasActionablePredicate |
| SPEC-PIN | library.test/stacks.test 计数 | 57 |
| 全量 | `node --test` + `npm run check` | 绿 |
| SPEC-CI | 9 腿矩阵 | 全绿（含 windows） |
| SPEC-RULE | scratch 仓 dogfood（G3） | 9 新 stack 逐一命中 + 12 上限截断具名 |

## Non-goals

- 不引 TOML 解析库；不覆盖 `setup.py`/`Pipfile`/`environment.yml`（SCOPE-OUT-002）。
- 不为 frontend-state/prisma 加 pythonDeps（JS-only，SCOPE-OUT-004）。
- 不触 `fragments/`、`src/`、`assets/lint/`；无 `npm run build`。
- 不锁定 9 条新规则与审计改动的正文文字（执行期原创 + 官方核查）。
- `closesArray` 的引号串剥离用简单正则（`/"[^"]*"|'[^']*'/`），不处理 TOML 转义引号/多行三引号串——依赖名中不含引号，与既有 `quotedStrings` 同等健壮度即可，不追求完整 TOML 词法。

## PLAN Handoff

- 按 SPEC-REL-001 的四提交序切 PLAN 任务；S1→S2→S3 顺序是硬约束（CI 先保护、引擎先于 llm-app）。
- SPEC-RULE-001 的 9 条 detect 已按需求表逐字定形（`tags` emit / `requiresTags` gate）；PLAN/执行照实现，勿改字段语义。
- SPEC-PYDEPS-001 的跨行数组闭合已由 `closesArray`（引号串/内联表外的 `]`）定形；SPEC-SYNCTEST-001 (a)–(h) 八例须全落地，(h) 为跨行 extras 假阴回归钉死点。
- 每提交后跑 `node --test` + `npm run check`；S2/S3 另在抛弃式 scratch 仓 dogfood（本仓禁 dogfood）。
- Windows 腿若暴露产品源码结构性不兼容 → 暂停 S1 上报（RISK-COMPAT-001 [ADDRESSED]）；trusted publisher 未配置 → 发布等待、不阻塞合入（RISK-REL-001 [ADDRESSED]）。

## Trace
<!-- Map this stage's IDs to upstream/downstream. R3 derives & checks closure. -->
| This ID | Upstream | Status |
|---|---|---|
| SPEC-CI-001 | DES-ARCH-001 | ADDRESSED |
| SPEC-RELEASE-001 | DES-ARCH-002 | ADDRESSED |
| SPEC-SCAN-001 | DES-DETECT-001 | ADDRESSED |
| SPEC-PYDEPS-001 | DES-DETECT-002 | ADDRESSED |
| SPEC-PREDICATE-001 | DES-DETECT-003 | ADDRESSED |
| SPEC-STACKS-001 | DES-DATA-001 | ADDRESSED |
| SPEC-STACKSTEST-001 | DES-TEST-001 | ADDRESSED |
| SPEC-SYNCTEST-001 | DES-TEST-001 | ADDRESSED |
| SPEC-RULE-001 | DES-RULE-001 | ADDRESSED |
| SPEC-AUDIT-001 | DES-AUDIT-001 | ADDRESSED |
| SPEC-PIN-001 | DES-PIN-001 | ADDRESSED |
| SPEC-DOC-001 | DES-DOC-001 | ADDRESSED |
| SPEC-REL-001 | DES-REL-001 | ADDRESSED |
<!-- /r2p-read-only -->

## Project Context (read-only)
# Project Context Pack

- repo_root: `/Users/xubo/x-studio/code-guidelines`
- languages: {'JavaScript': 27, 'PHP': 21}
- package_managers: npm
- test_commands: ['npm test']
- entrypoints: none
- config_files: ['test/fixtures/detect-go/go.mod', 'assets/lint/js-ts/tsconfig.json']
- dependencies (0): none
- source_dirs: ['assets', 'bin', 'fragments', 'generated', 'src', 'test']
<!-- /r2p-read-only -->
