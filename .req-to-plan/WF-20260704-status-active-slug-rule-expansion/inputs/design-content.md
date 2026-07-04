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
2. **fastapi/flask 检测谓词**：A) 保留 `main.py`/`app.py` 与 `pythonDeps` 做 AND；B) 直接以 `pythonDeps` 取代文件名。选 **B**（需求已定）——目的正是消除「任何含 `main.py` 的 Python 仓被误判 FastAPI」的全树 basename 误报，AND 无法消除该误报。副作用（未声明依赖则不检出）已在 RISK-DETECT-002 接受。`django` 保留 `manage.py` 作强信号。
3. **release 的 npm 版本保障**：A) 依赖 Node 24 bundled npm；B) 显式 `npm install -g npm@latest` 守门。选 **B**——早期 24.x 的 bundled npm 可能 < 11.5.1，显式升级令 ≥11.5.1 要求版本无关地满足（DES-ARCH-002）；此为发布运行器上的工具升级，不违反项目零依赖。
4. **CI 矩阵 fail-fast**：设 `fail-fast: false`——单腿失败不取消其余，9 腿一次性给全信号（G1 要求「9 腿全绿」的可诊断性）。

## Chosen Design

### DES-ARCH-001 ci.yml —— push/PR 全 gate 矩阵
新建 `.github/workflows/ci.yml`。`on: push(branches: [main])` + `pull_request`。单 job `test`，`strategy: { fail-fast: false, matrix: { os: [ubuntu-latest, macos-latest, windows-latest], node: [20, 22, 24] } }`，`runs-on: ${{ matrix.os }}`。步骤：`actions/checkout@v4` → `actions/setup-node@v4`（`node-version: ${{ matrix.node }}`，不配 registry、不配 cache）→ `npm run check` → `node --test`。无 `npm ci`（零项目依赖，无 lockfile 安装需求）。9 腿即 3×3。

### DES-ARCH-002 release.yml —— tag 触发 OIDC 发布
新建 `.github/workflows/release.yml`。`on: push(tags: ['v*'])`。`permissions: { id-token: write, contents: read }`。单 job `publish`，`runs-on: ubuntu-latest`。步骤：`actions/checkout@v4` → `actions/setup-node@v4`（`node-version: '24'`，`registry-url: 'https://registry.npmjs.org'`，不配 cache）→ `npm install -g npm@latest`（守 ≥11.5.1）→ `npm run check` → `node --test` → `npm publish --provenance --access public`。OIDC Trusted Publishing，不设 `NODE_AUTH_TOKEN`/`NPM_TOKEN`。**人工前置**：用户在 npmjs.com 为 `code-guidelines` 绑定 trusted publisher（repo + workflow 文件名 `release.yml`），须在 G4 打 tag 前完成（RISK-REL-001）。

### DES-DETECT-001 scanRepo：排除目录 + Python 内容收集
`EXCLUDED_DIRS`（`assets/sync.mjs:43`）加入 `.venv`、`venv`、`__pycache__`。`scanRepo` 在既有 `package.json` 内容收集旁，新增两条收集：遇 `name === 'pyproject.toml'` 读原文 push 到 `pyprojectTexts`；遇 basename 匹配 `/^requirements[^/]*\.txt$/` 读原文 push 到 `requirementsTexts`；各自 `try/catch` 静默跳过。返回对象扩为 `{ ..., pyprojectTexts, requirementsTexts }`。

### DES-DETECT-002 mergePythonDeps（纯函数，DES-DETECT-002）
签名 `mergePythonDeps(pyprojectTexts, requirementsTexts) -> Set<string>`（PEP503 归一名）。每个文本独立 `try/catch` 静默跳过。
- **pyproject 行状态机**：逐行跟踪当前 `[section]` 头。目标 section 分两类模式——
  - *数组模式*（值为 PEP508 引号串数组，支持跨行）：`[project]` 的 `dependencies` 键、`[project.optional-dependencies]` 的任意键、`[dependency-groups]`（PEP 735）的任意键。进入数组后逐行抽取引号内串，遇 `]` 结束。
  - *表键模式*（键即包名）：`[tool.poetry.dependencies]` 与 `[tool.poetry.group.<g>.dependencies]` 的每行 `key = ...`，取 `key`，**剔除 `python`**。
  - 非目标 section 内的行忽略。
- **PEP508 名字抽取**：从引号串行首取 `^[A-Za-z0-9][A-Za-z0-9._-]*`（截断于版本约束/extras/marker）。
- **requirements 行解析**：跳过空行、`#` 注释行、`-` 开头选项行、URL 行；取行首 `^[A-Za-z0-9][A-Za-z0-9._-]*`。
- **PEP503 归一**：全部 `toLowerCase()` 且 `/[-_.]+/g → '-'`，加入 Set。

### DES-DETECT-003 pythonDeps 谓词接入
新增 `matchPythonDeps(names, mergedPyDeps)`（镜像 `matchPackageDeps`：任一 `names` ∈ `mergedPyDeps` 即真；stacks 值与 merge 结果均已 PEP503 归一，故直接 `Set.has`）。`detect` 内在 `mergeDeps` 旁计算 `const mergedPyDeps = mergePythonDeps(scan.pyprojectTexts, scan.requirementsTexts)`。`baseMatch` 内新增：`if (Array.isArray(det.pythonDeps) && det.pythonDeps.length) results.push(matchPythonDeps(det.pythonDeps, mergedPyDeps))`——并入 base-OR，与 files/packageDeps/extensions 平级，pass1/pass2 与 `requiresTags` 机制不变。同步把 `SPEC-DETECT-001` [N/A] 注释块由「four-predicate」改「five-predicate」并补 `pythonDeps` OR 行。

### DES-DATA-001 stacks.json 谓词更新（内部 version 1.0.0→1.1.0）
- `fastapi` → `detect: { pythonDeps: ["fastapi"], tags: ["backend"] }`（删 `files:[main.py]`）。
- `flask` → `detect: { pythonDeps: ["flask"], tags: ["backend"] }`（删 `files:[app.py]`）。
- `django` → `detect: { files: ["manage.py"], pythonDeps: ["django"], tags: ["backend"] }`（保留 manage.py）。
- `pytest` → 增 `pythonDeps: ["pytest"]`。
- `python-ml` → 增 `pythonDeps: ["numpy","pandas","scikit-learn","torch","tensorflow","jupyter"]`（`requiresTags:[python]` 不变，baseMatch 变为 extensions OR pythonDeps）。
- `mongodb` → 增 `pythonDeps: ["pymongo","motor"]`。
- 顶层 `"version": "1.0.0"` → `"1.1.0"`。

### DES-TEST-001 测试
- `test/stacks.test.mjs`：validator 在 `packageDeps` 分支后加 `pythonDeps` 分支——`Array.isArray` 非空、每项 `typeof === 'string'` 且非空、形状 `^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$`（PEP503 归一后），非空则 `hasActionablePredicate = true`；`:188-191` 断言文案补 `pythonDeps`。
- `test/sync.test.mjs`：新增 (a)–(g) 七例——(a) main.py-only 仓不检出 fastapi（钉误报修复）、(b) pyproject `[project].dependencies` 含 fastapi 检出、(c) `requirements.txt` 写 `Flask==3.0` 检出 flask（大小写归一）、(d) poetry 依赖表检出、(e) optional-dependencies 检出、(f) 畸形 pyproject 静默跳过且不影响其余检测、(g) `.venv/` 内文件不参与任何检测。

### DES-RULE-001 9 条新规则 + stacks 条目
`assets/library/` 新增 `expo`/`dotnet-maui`/`solidjs`/`blazor`/`electron`/`frontend-state`/`prisma`/`web-perf`/`llm-app`（≤100 行、frontmatter `name`=文件名 /`description`/`appliesTo` 非空 /`stacks` 非空 /`source: original`，`## Hard Constraints (MUST NOT)` 先于 `## Ecosystem Idioms & Conventions`，负向具名反模式，「适配既有架构而非强加结构」口吻）；`assets/stacks.json` 按类别就近插入 9 条目，detect 谓词与 specificity 依需求表（expo pkg[expo]/70、dotnet-maui files[MauiProgram.cs]/65、solidjs pkg[solid-js]+tags[frontend]/55、blazor ext[razor≥1]+tags[frontend]/55、electron pkg[electron]+tags[frontend]/55、frontend-state pkg[8 库]+tags[frontend]/40、prisma pkg[prisma,@prisma/client]/50、web-perf requiresTags[frontend]/25、llm-app pkg[6 库]+pythonDeps[openai,anthropic,langchain,llama-index]/45）；9 条均 `lint: null`。`llm-app` 依赖 S2 已落地，自创建即双生态检测。`THIRD-PARTY.md` 维持 acknowledgement-only。

### DES-AUDIT-001 版本时效审计
对 13 条既有前端/移动规则逐条对官方当前大版本核查，**仅修过时表述、不扩行数、不重构**。已知嫌疑四条：`nextjs.md`(Next.js 16)、`tailwind.md`(v4 CSS-first)、`svelte.md`(Svelte 5 runes)、`ios-swiftui.md`(Swift 6 strict concurrency)；其余九条（react/vue/nuxt/angular/astro/html-css/react-native/flutter/android-compose）扫查无过时则不动。零改动是合法结果（RISK-AUDIT-001）。

### DES-PIN-001 数量钉死点 + 文档联动（同一提交内）
`library.test.mjs` `EXPECTED_FILE_COUNT` 48→57 及测试名、`stacks.test.mjs` 长度断言 48→57 及测试名；`README.md`/`README.zh-CN.md` 两处 48→57 + 分类清单（Frontend 9→13、Mobile 4→6、Data 3→4、Cross-cutting 3→5，双语章节对齐）；`THIRD-PARTY.md`/`AGENTS.md`/`CLAUDE.md` 中 48→57；`assets/VERSION` 1.2.0→1.3.0。不触 `fragments/`、`src/`（无 `npm run build`）、`assets/lint/`。

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
1. `mergePythonDeps` 行状态机的精确伪码（section 头识别、数组模式 vs 表键模式的进入/退出、跨行数组终止、PEP508 名字正则、PEP503 归一），及 `matchPythonDeps` 与 `detect` 内的接入点。
2. `scanRepo` 收集分支的精确插入位置与返回对象扩展；`EXCLUDED_DIRS` 三项新增。
3. `assets/stacks.json` 六处 detect 的精确 diff + 顶层 version 改动。
4. (a)–(g) 七个 `sync.test.mjs` 用例的 fixture 布局与断言；validator `pythonDeps` 分支的精确断言与文案更新。
5. `ci.yml`/`release.yml` 的完整 YAML（含 `fail-fast:false`、`npm install -g npm@latest` 守门、`registry-url`、`permissions`）。
6. 9 条规则各自的 frontmatter/正文骨架 + stacks 条目 detect/specificity/category/`lint:null`，及 `llm-app` 的双生态谓词。
7. DES-AUDIT-001 的 13 条逐条核查清单与「仅改过时表述」判定边界。
8. DES-PIN-001 的全部 48→57 联动位点清单（测试 2 处、README 双语各若干、THIRD-PARTY/AGENTS/CLAUDE、VERSION）。
9. `SPEC-DETECT-001` [N/A] 注释块由 four→five-predicate 的精确文案。

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

## Upstream Summary (read-only)
# Risk Discovery

## Risks

### RISK-SEC-001 发布工作流的供应链暴露面（OIDC + provenance）
Status: Mitigated
`release.yml` 持有 `id-token: write` 并执行 `npm publish --provenance`。风险：若发布可被非预期的 ref 触发、或 CI 在 PR 上以可写 token 运行不可信代码，则构成供应链风险。边界收敛：发布 job 仅由本仓 `v*` tag 触发；CI（push/PR）不申请任何写权限、不注入 secret、不用 `pull_request_target`；无 `NPM_TOKEN` 长期凭据（OIDC 短时令牌）。关联 SCOPE-IN-001/002。

### RISK-SEC-002 新增安全型规则的指导准确性
Status: Mitigated
`llm-app`（OWASP LLM Top 10）、`electron`（官方安全清单）、`blazor`/`dotnet-maui` 等规则的硬约束若表述失准，会把错误安全指导分发进下游仓库。缓解：SCOPE-IN-010 要求逐条官方文档 + OWASP 交叉核查，硬约束负向具名反模式，`source: original`。关联 SCOPE-IN-010。

### RISK-COMPAT-001 Windows 矩阵腿的路径不兼容
Status: Accepted (bounded, escalation defined)
新增 windows-latest 腿首次验证 Windows。风险：测试内路径拼接或 fixture 假设在 Windows 下失败。边界：`assets/sync.mjs` 的 LF 归一化已内建，预期仅涉及测试层；升级路径——若暴露产品源码结构性不兼容，暂停 S1 合入并上报用户决策（Open Question 1）。关联 SCOPE-IN-001/008。

### RISK-DETECT-001 手写 Python 依赖解析器的误判
Status: Mitigated
`mergePythonDeps` 以行状态机解析 pyproject/requirements，不引入完整 TOML 解析器（守零依赖约束）。风险：跨行数组、poetry 组表、注释/选项/URL 行等边界被误解析，产生假阴/假阳。缓解：解析异常静默跳过该文件（沿用 package.json best-effort 先例）；SCOPE-IN-008 用例 (d)(e)(f) 钉住 poetry/optional/畸形跳过。关联 SCOPE-IN-005/008。

### RISK-DETECT-002 fastapi/flask 谓词切换改变检测语义
Status: Accepted (intentional tradeoff)
`fastapi`/`flask` 由裸文件名改为 `pythonDeps` 后，仅在依赖被声明时检出。副作用：使用 fastapi/flask 但完全不在 pyproject/requirements 声明依赖的仓将不再检出——这是以「消除 main.py/app.py 全树误报」换来的刻意取舍，且此类仓极罕见。边界：需求已确认接受；`django` 保留 `manage.py` 以维持强信号。缓解：SCOPE-IN-008 用例 (a) 钉住误报消除、(b)(c) 钉住依赖声明路径检出。关联 SCOPE-IN-007/008。

### RISK-REGR-001 数量钉死点的漏改（48→57 联动）
Status: Mitigated
48→57 需在 `library.test`/`stacks.test`/`README` 双语/`THIRD-PARTY`/`AGENTS`/`CLAUDE`/`VERSION` 多处锁步；漏改一处即测试红。风险：分散更新遗漏其一。缓解：SCOPE-IN-012 要求同一提交内完成，既有测试即为强制机；`test/readme.test.mjs` 守双语对齐。关联 SCOPE-IN-012。

### RISK-REL-001 trusted publisher 未先配置导致发布失败
Status: Accepted (non-blocking, user prerequisite)
Trusted Publishing 需用户在 npmjs.com 人工绑定 repo 与 workflow 文件名；未配置则 `v0.3.0` tag 触发的发布会失败。边界：发布环节等待，不阻塞 S1–S3 合入；须在 G4 打 tag 前完成（Open Question 2）。关联 SCOPE-IN-002/014。

### RISK-AUDIT-001 版本审计的改动量不可预知
Status: Accepted (bounded, zero-change legal)
SCOPE-IN-011 的 13 条规则实际过时程度核查前未知。风险两端：过度改写（重构规则/扩行数）或改动不足（漏掉过时表述）。边界：仅修过时表述、不扩行数、不重构结构；无过时则零改动是合法结果（Open Question 3）。关联 SCOPE-IN-011。

### RISK-PIN-001 新增规则/条目破坏既有钉死不变式
Status: Mitigated
9 个新规则文件、9 个 stacks.json 条目须与 `assets/library/*.md`、数量测试、`lint: null` 约定锁步；`stacks.json` 每条须解析到真实 rule 文件。风险：形状/数量偏离触发 `library.test`/`stacks.test`/`baseline.test` 红。缓解：SCOPE-IN-010/012 固定文件形状与 `lint: null`，不触 `assets/lint/`；不改构建路径（`fragments/`、`src/`），无 `npm run build` 触发点，确定性约束不受影响。关联 SCOPE-IN-010/012。

## Boundaries

本需求的改动边界（越界即触发 Scope Overflow 或测试红）：

- **触及**：`.github/workflows/{ci,release}.yml`（新建）；`assets/sync.mjs`（`scanRepo`、`mergePythonDeps`、谓词接入、注释块）；`assets/stacks.json`（谓词更新 + 9 新条目，内部 version 1.0.0→1.1.0）；`assets/library/`（+9 文件，可能审计改 ≤13 既有文件）；`assets/VERSION`（→1.3.0）；`package.json`（→0.3.0）；`test/{sync,stacks,library}.test.mjs`；`README.md`/`README.zh-CN.md`/`THIRD-PARTY.md`/`AGENTS.md`/`CLAUDE.md`（数量与谓词/CI 文案联动）。
- **不触及**：`fragments/`、`src/`（无 `npm run build`）；`assets/lint/`（lint 基线，9 新 stack 均 `lint: null`）；三个安装/构建/同步程序的引擎结构；零第三方依赖约束（不新增 `dependencies`、不引 TOML 库）。
- **本仓自身禁止 dogfood**：检测/新 stack 的验证一律在抛弃式 scratch 仓进行（G2/G3）。

## Scope Overflow Risks

以下诱惑均已由 SCOPE-OUT 明确划出，实现期须守界；越界须回溯到 requirement_brief 改范围，不得在下游阶段私自扩张：

- 顺手修其它检测误报或重构 `scanRepo`/拆分 `sync.mjs` → 由 SCOPE-OUT-005 划出。
- 扩展 `setup.py`/`Pipfile`/`environment.yml` 解析以「顺便完整」→ 由 SCOPE-OUT-002 划出（记为已知限制）。
- 为 `frontend-state`/`prisma` 加 Python 侧检测 → 由 SCOPE-OUT-004 划出（JS-only）。
- 新增落选清单里的规则或超过 9 条 → 由 SCOPE-OUT-003 划出。
- 借 CI 之机做平台扩展（Cursor/Windsurf/…）→ 由 SCOPE-OUT-001 划出。
- 审计时把「过时表述修正」升级为规则重写/扩行 → 由 SCOPE-IN-011 的「仅修过时、不扩行数」边界约束。

## Mitigations

- **交付顺序即缓解**（SCOPE-IN-013）：S1 CI 先行，为 S2/S3 提供 9 腿矩阵保护；S2 引擎先行使 `llm-app` 双生态检测无条件分支。
- **测试即强制机**：main.py 误报回归 (a)、依赖声明检出 (b)(c)、poetry/optional (d)(e)、畸形静默跳过 (f)、`.venv` 排除 (g)、数量钉死、README 双语对齐——全部落在 `node --test` 上，CI 9 腿复核。
- **scratch 仓 dogfood**：G2 三例、G3 九个新 stack 逐一命中 + 12 条上限截断具名，均在抛弃式仓验证，避免污染本仓工作树。
- **发布风险收敛**：OIDC 短时令牌 + provenance + 仅 `v*` tag 触发 + 发布 job 内先跑完整 gate；trusted publisher 未配置则等待不阻塞合入。
- **升级路径明确**：Windows 结构性不兼容 → 暂停 S1 上报；审计零改动 → 合法结果；三条 Open Question 均已定处置。

## Trace
<!-- Map this stage's IDs to upstream/downstream. R3 derives & checks closure. -->
| This ID | Upstream | Status |
|---|---|---|
| RISK-SEC-001 | SCOPE-IN-001, SCOPE-IN-002 | ADDRESSED |
| RISK-SEC-002 | SCOPE-IN-010 | ADDRESSED |
| RISK-COMPAT-001 | SCOPE-IN-001, SCOPE-IN-008 | ADDRESSED |
| RISK-DETECT-001 | SCOPE-IN-005, SCOPE-IN-008 | ADDRESSED |
| RISK-DETECT-002 | SCOPE-IN-007, SCOPE-IN-008 | ADDRESSED |
| RISK-REGR-001 | SCOPE-IN-012 | ADDRESSED |
| RISK-REL-001 | SCOPE-IN-002, SCOPE-IN-014 | ADDRESSED |
| RISK-AUDIT-001 | SCOPE-IN-011 | ADDRESSED |
| RISK-PIN-001 | SCOPE-IN-010, SCOPE-IN-012 | ADDRESSED |
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
