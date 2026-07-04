---
r2p_stage: spec
r2p_version: 2
r2p_status: approved
r2p_created_at: 2026-07-04T09:13:04.654723+00:00
r2p_updated_at: 2026-07-04T09:39:21.953265+00:00
---

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

## Upstream Summary (read-only)
# Design

## Design Summary

三条工作流按 S1→S2→S3 交付，均为**加法式、可独立回滚**的改动，且不触碰构建路径（`fragments/`、`src/`）或 lint 基线（`assets/lint/`），因此零第三方依赖与确定性约束不受影响：

- **S1 CI/发布**（DES-ARCH-001/002）：新增两个 GitHub Actions 工作流。`ci.yml` 在 push(main)/PR 上跑 9 腿矩阵（3 OS × Node 20/22/24），步骤仅 checkout→setup-node→`npm run check`→`node --test`（零项目依赖，无 `npm ci`、无缓存）。`release.yml` 由 `v*` tag 触发，OIDC Trusted Publishing 发布，带 provenance。
- **S2 检测引擎**（DES-DETECT-001/002/003 + DES-DATA-001）：给检测引擎加**第 5 个谓词** `pythonDeps`，与既有 `files`/`packageDeps`/`extensions` 在 base-OR 中平级。核心是一个纯函数 `mergePythonDeps`，镜像既有 `mergeDeps`（package.json 先例，`assets/sync.mjs:323`）的形状与 best-effort 静默跳过契约，把 pyproject/requirements 依赖归一为 PEP 503 名字集合。`fastapi`/`flask` 由裸文件名改判为 `pythonDeps`，消除 `main.py`/`app.py` 全树误报。
- **S3 规则库**（DES-RULE-001 + DES-AUDIT-001 + DES-PIN-001 + DES-REL-001）：加 9 条 `source: original` 规则与对应 stacks 条目，审计 13 条既有前端/移动规则的版本时效，并把 48→57 的数量钉死点与双语文档锁步联动，最终 `assets/VERSION`→1.3.0、`package.json`→0.3.0，以 `v0.3.0` 单次发布。

## Current Code Evidence

（均按当前源码核实，行号为证据锚点）

- 检测扫描：`assets/sync.mjs:276` `scanRepo` 返回 `{ fileRelPaths, dirRelPaths, fileBasenames, extCounts, packageJsons }`；`:310-316` 已有「遇 `package.json` 读原文入数组、异常 `try/catch` 静默跳过」的**内容收集先例**（`mergePythonDeps` 直接沿用）。`:43` `EXCLUDED_DIRS = {node_modules, vendor, dist, build, .git}`（不含 `.venv`/`venv`/`__pycache__`——即 site-packages 会被扫入）。
- 依赖归并：`:323` `mergeDeps(packageJsons)` 遍历 `dependencies/devDependencies/peerDependencies/optionalDependencies` 键 → Set。`mergePythonDeps` 是它的 Python 侧镜像。
- 谓词求值：`:396` `detect` 内 `:402` `baseMatch(det)` 现把 `matchFiles`/`matchPackageDeps`/`matchExtensions` 结果 `results.some(Boolean)`（**跨谓词类型 OR**）；`:391` `matchPackageDeps(names, mergedDeps)` 为 `matchPythonDeps` 的直接范本。两遍求值（pass1 base、pass2 `requiresTags`）与 `tags` 发射机制在 `:422-441`。
- 语义注释块：`assets/sync.mjs:256-274` 的 `SPEC-DETECT-001` [N/A] 注释（当前写「four-predicate」）须同步为「five-predicate」并补 `pythonDeps` 的 OR 语义行。
- stacks 数据：`assets/stacks.json:2` `"version": "1.0.0"`；`:500` `django`(`files:[manage.py]`+`tags:[backend]`)、`:517` `fastapi`(`files:[main.py]`+`tags:[backend]`)、`:534` `flask`(`files:[app.py]`+`tags:[backend]`)、`:655` `mongodb`(`packageDeps:[mongodb,mongoose]`)、`:670` `python-ml`(`extensions:[ipynb]`+`requiresTags:[python]`)、`:721` `pytest`(`files:[pytest.ini,conftest.py]`)。
- 钉死点：`test/stacks.test.mjs:59` `assert.equal(stacks.length, 48)` 与 `:57` 测试名；`:113-192` validator 的 `hasActionablePredicate` 分支结构（`files`/`packageDeps`/`extensions`/`requiresTags`）与 `:188-191` 断言文案；`test/library.test.mjs:15` `EXPECTED_FILE_COUNT = 48` 与 `:76` 测试名。`assets/VERSION`=1.2.0、`package.json`=0.2.0。
- 外部核实（发布路径）：npm 官方文档（docs.npmjs.com/trusted-publishers）确认 **Trusted Publishing (OIDC) 要求 npm CLI ≥ 11.5.1 且 Node ≥ 22.14.0**；工作流需 `permissions: id-token: write` + `contents: read`、`setup-node` 配 `registry-url: https://registry.npmjs.org`、发布免长期 token。

## Requirements Coverage

| SCOPE-IN | Design 承接 | 覆盖 |
|---|---|---|
| SCOPE-IN-001 ci.yml | DES-ARCH-001 | ✓ |
| SCOPE-IN-002 release.yml | DES-ARCH-002 | ✓ |
| SCOPE-IN-003 dev-guide CI 文案 | DES-DOC-001 | ✓ |
| SCOPE-IN-004 scanRepo 排除+收集 | DES-DETECT-001 | ✓ |
| SCOPE-IN-005 mergePythonDeps | DES-DETECT-002 | ✓ |
| SCOPE-IN-006 谓词接入+注释 | DES-DETECT-003 | ✓ |
| SCOPE-IN-007 stacks.json 谓词更新 | DES-DATA-001 | ✓ |
| SCOPE-IN-008 测试 | DES-TEST-001 | ✓ |
| SCOPE-IN-009 谓词清单文档 | DES-DOC-001 | ✓ |
| SCOPE-IN-010 9 条新规则 | DES-RULE-001 | ✓ |
| SCOPE-IN-011 版本审计 | DES-AUDIT-001 | ✓ |
| SCOPE-IN-012 数量+文档联动 | DES-PIN-001 | ✓ |
| SCOPE-IN-013 交付顺序+提交划分 | DES-REL-001 | ✓ |
| SCOPE-IN-014 版本+发布 | DES-REL-001 | ✓ |

## Options Considered

需求源自两个已定研 point，多数选择已锁定；下列为设计期确认的取舍：

1. **Python 依赖解析实现**：A) 引入完整 TOML 解析库；B) 手写行状态机。选 **B**——硬产品约束零第三方依赖（`package.json` 无 `dependencies`），且检测是 best-effort，行状态机足够（DES-DETECT-002）。
2. **fastapi/flask 检测谓词**：A) 保留 `main.py`/`app.py` 与 `pythonDeps` 做 AND；B) 直接以 `pythonDeps` 取代文件名。选 **B**（需求已定）——目的正是消除「任何含 `main.py` 的 Python 仓被误判 FastAPI」的全树 basename 误报，AND 无法消除该误报。副作用（未声明依赖则不检出）已在 RISK-DETECT-002 [ADDRESSED] 接受。`django` 保留 `manage.py` 作强信号。
3. **release 的 npm 版本保障**：A) 依赖 Node 24 bundled npm；B) 显式 `npm install -g npm@latest` 守门。选 **B**——早期 24.x 的 bundled npm 可能 < 11.5.1，显式升级令 ≥11.5.1 要求版本无关地满足（DES-ARCH-002）；此为发布运行器上的工具升级，不违反项目零依赖。
4. **CI 矩阵 fail-fast**：设 `fail-fast: false`——单腿失败不取消其余，9 腿一次性给全信号（G1 要求「9 腿全绿」的可诊断性）。

## Chosen Design

### DES-ARCH-001 ci.yml —— push/PR 全 gate 矩阵
新建 `.github/workflows/ci.yml`。`on: push(branches: [main])` + `pull_request`。单 job `test`，`strategy: { fail-fast: false, matrix: { os: [ubuntu-latest, macos-latest, windows-latest], node: [20, 22, 24] } }`，`runs-on: ${{ matrix.os }}`。步骤：`actions/checkout@v4` → `actions/setup-node@v4`（`node-version: ${{ matrix.node }}`，不配 registry、不配 cache）→ `npm run check` → `node --test`。无 `npm ci`（零项目依赖，无 lockfile 安装需求）。9 腿即 3×3。

### DES-ARCH-002 release.yml —— tag 触发 OIDC 发布
新建 `.github/workflows/release.yml`。`on: push(tags: ['v*'])`。`permissions: { id-token: write, contents: read }`。单 job `publish`，`runs-on: ubuntu-latest`。步骤：`actions/checkout@v4` → `actions/setup-node@v4`（`node-version: '24'`，`registry-url: 'https://registry.npmjs.org'`，不配 cache）→ `npm install -g npm@latest`（守 ≥11.5.1）→ `npm run check` → `node --test` → `npm publish --provenance --access public`。OIDC Trusted Publishing，不设 `NODE_AUTH_TOKEN`/`NPM_TOKEN`。**人工前置**：用户在 npmjs.com 为 `code-guidelines` 绑定 trusted publisher（repo + workflow 文件名 `release.yml`），须在 G4 打 tag 前完成（RISK-REL-001 [ADDRESSED]）。

### DES-DETECT-001 scanRepo：排除目录 + Python 内容收集
`EXCLUDED_DIRS`（`assets/sync.mjs:43`）加入 `.venv`、`venv`、`__pycache__`。`scanRepo` 在既有 `package.json` 内容收集旁，新增两条收集：遇 `name === 'pyproject.toml'` 读原文 push 到 `pyprojectTexts`；遇 basename 匹配 `/^requirements[^/]*\.txt$/` 读原文 push 到 `requirementsTexts`；各自 `try/catch` 静默跳过。返回对象扩为 `{ ..., pyprojectTexts, requirementsTexts }`。

### DES-DETECT-002 mergePythonDeps（纯函数，DES-DETECT-002）
签名 `mergePythonDeps(pyprojectTexts, requirementsTexts) -> Set<string>`（PEP503 归一名）。每个文本独立 `try/catch` 静默跳过。
- **pyproject 行状态机**：逐行跟踪当前 `[section]` 头。目标 section 分两类模式——
  - *数组模式*（值为 PEP508 引号串数组）：`[project]` 的 `dependencies` 键、`[project.optional-dependencies]` 的任意键、`[dependency-groups]`（PEP 735）的任意键。须**同时**支持单行数组（`dependencies = ["fastapi"]`——须抽取开括号那一行内的引号串，否则主路径假阴）与跨行数组（逐行抽取引号内串，遇 `]` 结束）。PEP 735 的 `{ include-group = "..." }` 内联表是对其它 group 的引用而非包名，须忽略（不得误取 `include-group`）。extras 由名字正则天然截断（`uvicorn[standard]`→`uvicorn`）。
  - *表键模式*（键即包名）：`[tool.poetry.dependencies]` 与 `[tool.poetry.group.<g>.dependencies]` 的每行 `key = ...`，取 `key`，**剔除 `python`**。
  - 非目标 section 内的行忽略。
- **PEP508 名字抽取**：从引号串行首取 `^[A-Za-z0-9][A-Za-z0-9._-]*`（截断于版本约束/extras/marker）。
- **requirements 行解析**：跳过空行、`#` 注释行、`-` 开头选项行、URL 行；取行首 `^[A-Za-z0-9][A-Za-z0-9._-]*`。
- **PEP503 归一**：全部 `toLowerCase()` 且 `/[-_.]+/g → '-'`，加入 Set。

### DES-DETECT-003 pythonDeps 谓词接入
新增 `matchPythonDeps(names, mergedPyDeps)`（镜像 `matchPackageDeps`：任一 `names` ∈ `mergedPyDeps` 即真；stacks 值与 merge 结果均已 PEP503 归一，故直接 `Set.has`）。`detect` 内在 `mergeDeps` 旁计算 `const mergedPyDeps = mergePythonDeps(scan.pyprojectTexts, scan.requirementsTexts)`。`baseMatch` 内新增：`if (Array.isArray(det.pythonDeps) && det.pythonDeps.length) results.push(matchPythonDeps(det.pythonDeps, mergedPyDeps))`——并入 base-OR，与 files/packageDeps/extensions 平级，pass1/pass2 与 `requiresTags` 机制不变。同步更新检测语义注释：`SPEC-DETECT-001` [N/A] 注释块 `assets/sync.mjs:256`「four-predicate」→「five-predicate」、`:264`「three populated non-requiresTags predicate types」→「four populated」，并补 `pythonDeps` OR 行。

### DES-DATA-001 stacks.json 谓词更新（内部 version 1.0.0→1.1.0）
- `fastapi` → `detect: { pythonDeps: ["fastapi"], tags: ["backend"] }`（删 `files:[main.py]`）。
- `flask` → `detect: { pythonDeps: ["flask"], tags: ["backend"] }`（删 `files:[app.py]`）。
- `django` → `detect: { files: ["manage.py"], pythonDeps: ["django"], tags: ["backend"] }`（保留 manage.py）。
- `pytest` → 增 `pythonDeps: ["pytest"]`。
- `python-ml` → 增 `pythonDeps: ["numpy","pandas","scikit-learn","torch","tensorflow","jupyter"]`（`requiresTags:[python]` 不变，baseMatch 变为 extensions OR pythonDeps）。
- `mongodb` → 增 `pythonDeps: ["pymongo","motor"]`。
- 顶层 `"version": "1.0.0"` → `"1.1.0"`。

### DES-TEST-001 测试
- `test/stacks.test.mjs`：validator 在 `packageDeps` 分支后加 `pythonDeps` 分支——`Array.isArray` 非空、每项 `typeof === 'string'` 且非空、形状 `^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$`（PEP503 归一后），非空则 `hasActionablePredicate = true`；`:188-191` 断言文案补 `pythonDeps`；`:102` 测试名「well-formed four-predicate detect shape」→「five-predicate」。
- `test/sync.test.mjs`：新增 (a)–(g) 七例——(a) main.py-only 仓不检出 fastapi（钉误报修复）、(b) pyproject `[project].dependencies` 含 fastapi 检出、(c) `requirements.txt` 写 `Flask==3.0` 检出 flask（大小写归一）、(d) poetry 依赖表检出、(e) optional-dependencies 检出、(f) 畸形 pyproject 静默跳过且不影响其余检测、(g) `.venv/` 内文件不参与任何检测。

### DES-RULE-001 9 条新规则 + stacks 条目
`assets/library/` 新增 `expo`/`dotnet-maui`/`solidjs`/`blazor`/`electron`/`frontend-state`/`prisma`/`web-perf`/`llm-app`（≤100 行、frontmatter `name`=文件名 /`description`/`appliesTo` 非空 /`stacks` 非空 /`source: original`，`## Hard Constraints (MUST NOT)` 先于 `## Ecosystem Idioms & Conventions`，负向具名反模式，「适配既有架构而非强加结构」口吻）；`assets/stacks.json` 按类别就近插入 9 条目，detect 谓词与 specificity 依需求表（expo pkg[expo]/70、dotnet-maui files[MauiProgram.cs]/65、solidjs pkg[solid-js]+tags[frontend]/55、blazor ext[razor≥1]+tags[frontend]/55、electron pkg[electron]+tags[frontend]/55、frontend-state pkg[8 库]+tags[frontend]/40、prisma pkg[prisma,@prisma/client]/50、web-perf requiresTags[frontend]/25、llm-app pkg[6 库]+pythonDeps[openai,anthropic,langchain,llama-index]/45）；9 条均 `lint: null`。`llm-app` 依赖 S2 已落地，自创建即双生态检测。`THIRD-PARTY.md` 维持 acknowledgement-only。

### DES-AUDIT-001 版本时效审计
对 13 条既有前端/移动规则逐条对官方当前大版本核查，**仅修过时表述、不扩行数、不重构**。已知嫌疑四条：`nextjs.md`(Next.js 16)、`tailwind.md`(v4 CSS-first)、`svelte.md`(Svelte 5 runes)、`ios-swiftui.md`(Swift 6 strict concurrency)；其余九条（react/vue/nuxt/angular/astro/html-css/react-native/flutter/android-compose）扫查无过时则不动。零改动是合法结果（RISK-AUDIT-001 [ADDRESSED]）。

### DES-PIN-001 数量钉死点 + 文档联动（同一提交内）
48→57 的**全部**联动位点（含设计子代理复核 F1 补齐的易漏项），同一提交内改齐：
- 测试计数（不改则测试红）：`test/library.test.mjs:15` `EXPECTED_FILE_COUNT` 48→57、`:76` 测试名；`test/stacks.test.mjs:59` `stacks.length` 断言 48→57、`:57` 测试名。
- 测试内文案（不致红但会陈旧）：`test/stacks.test.mjs:208` 测试名与 `:213` 断言消息「48 stack ids」→57；`test/precheck.test.mjs:68` 注释「48-rule library」→57。
- README 双语：`README.md:21`/`:52` 与 `README.zh-CN.md:17`/`:45` 的 48→57 + 分类清单（Frontend 9→13、Mobile 4→6、Data 3→4、Cross-cutting 3→5，双语章节对齐）。
- 其它文档：`THIRD-PARTY.md:8`/`:11`、`CLAUDE.md:138`、`AGENTS.md:69` 的 48→57；`AGENTS.md:12` 的 `--test-name-pattern="48"` 示例→`"57"`（与被改的计数测试名耦合，不改则示例失效）。
- 版本：`assets/VERSION` 1.2.0→1.3.0。
- 不触 `fragments/`、`src/`（无 `npm run build`）、`assets/lint/`。

### DES-DOC-001 文档：谓词清单 + CI 文案
`CLAUDE.md`/`AGENTS.md` 谓词清单（files/packageDeps/extensions/requiresTags）补 `pythonDeps`（SCOPE-IN-009）；两文件 gate 说明段各加一句「CI 在 push/PR 上跑同一 gate」（SCOPE-IN-003）；README 不动。

### DES-REL-001 交付顺序、提交划分、版本发布
提交顺序 S1→S2→S3。提交划分：S1 一提交（两个 workflow + DES-DOC-001 的 CI 文案句）；S2 一提交（DES-DETECT-001/002/003 + DES-DATA-001 + DES-TEST-001 + DES-DOC-001 的谓词清单）；S3 中 DES-RULE-001+DES-PIN-001 为一个 feat 提交，DES-AUDIT-001 如有改动另出一提交。全部合入后 `package.json` 0.2.0→0.3.0、`assets/VERSION` 已在 1.3.0，打 tag `v0.3.0` 触发 release，仅此一次发布。

## Decision Requests
none

## Rollback

- 三条工作流是独立提交（DES-REL-001），任一可 `git revert` 单提交回滚，互不牵连。
- S1：两个 workflow 是纯新增文件，删除即完全回滚，对产品逻辑零影响。
- S2：引擎改动全部落在测试网（DES-TEST-001）之下；回滚该提交即恢复旧检测行为，`stacks.json` 内部 version 随之回 1.0.0。
- S3：规则与条目均加法式，回滚提交即回 48 条；版本审计提交（若有）独立可单独回滚。
- 版本号（`package.json`/`assets/VERSION`）随各自提交回滚；`v0.3.0` tag 未推送前不产生任何发布副作用。

## Observability

- **CI 可见性**：9 腿矩阵在 PR checks 页逐腿显示；`npm run check` 在 CI 上以非零退出拦截 `generated/` 漂移（G1 用一次故意漂移临时提交验证后撤销）。
- **测试即断言机**：误报回归 (a)、依赖检出 (b)(c)、poetry/optional (d)(e)、畸形跳过 (f)、`.venv` 排除 (g)、48→57 数量、README 双语对齐——全部由 `node --test` 输出。
- **scratch 仓 dogfood**：G2 三例、G3 九个新 stack 命中 + 12 条上限截断具名，均在抛弃式仓验证（本仓禁 dogfood）。
- **发布可观测**：`npm view code-guidelines version` 返回 0.3.0；npm 包页显示 provenance 证明（G4）。

## SPEC Handoff

SPEC 阶段须把下列钉到可执行精度：
1. `mergePythonDeps` 行状态机的精确伪码（section 头识别、数组模式 vs 表键模式的进入/退出、单行与跨行数组、`include-group` 内联表忽略、PEP508 名字正则、PEP503 归一），及 `matchPythonDeps` 与 `detect` 内的接入点。
2. `scanRepo` 收集分支的精确插入位置与返回对象扩展；`EXCLUDED_DIRS` 三项新增。
3. `assets/stacks.json` 六处 detect 的精确 diff + 顶层 version 改动。
4. (a)–(g) 七个 `sync.test.mjs` 用例的 fixture 布局与断言；validator `pythonDeps` 分支的精确断言与文案更新。
5. `ci.yml`/`release.yml` 的完整 YAML（含 `fail-fast:false`、`npm install -g npm@latest` 守门、`registry-url`、`permissions`）。
6. 9 条规则各自的 frontmatter/正文骨架 + stacks 条目 detect/specificity/category/`lint:null`，及 `llm-app` 的双生态谓词。
7. DES-AUDIT-001 的 13 条逐条核查清单与「仅改过时表述」判定边界。
8. DES-PIN-001 的完整 48→57 位点清单（须含 `stacks.test.mjs:208/213`、`precheck.test.mjs:68`、`AGENTS.md:12` 的 `--test-name-pattern` 等易漏项）。
9. 检测语义注释的精确文案：`sync.mjs:256` four→five-predicate、`:264` three→four populated types，及 `stacks.test.mjs:102` 测试名 four→five。

## Trace
<!-- Map this stage's IDs to upstream/downstream. R3 derives & checks closure. -->
| This ID | Upstream | Status |
|---|---|---|
| DES-ARCH-001 | SCOPE-IN-001 | ADDRESSED |
| DES-ARCH-002 | SCOPE-IN-002 | ADDRESSED |
| DES-DETECT-001 | SCOPE-IN-004 | ADDRESSED |
| DES-DETECT-002 | SCOPE-IN-005 | ADDRESSED |
| DES-DETECT-003 | SCOPE-IN-006 | ADDRESSED |
| DES-DATA-001 | SCOPE-IN-007 | ADDRESSED |
| DES-TEST-001 | SCOPE-IN-008 | ADDRESSED |
| DES-RULE-001 | SCOPE-IN-010 | ADDRESSED |
| DES-AUDIT-001 | SCOPE-IN-011 | ADDRESSED |
| DES-PIN-001 | SCOPE-IN-012 | ADDRESSED |
| DES-DOC-001 | SCOPE-IN-003, SCOPE-IN-009 | ADDRESSED |
| DES-REL-001 | SCOPE-IN-013, SCOPE-IN-014 | ADDRESSED |
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
