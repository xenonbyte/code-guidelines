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

## Upstream Summary (read-only)
# Requirement Brief

## Goal

在 `code-guidelines`（零第三方依赖的 Node ≥20 工具）上落地三条相互有交付依赖的工作流，并各自通过验收门 G1–G4，最终以带 provenance 的 `v0.3.0` 单次发布：

1. **CI/发布自动化**：GitHub Actions 在 push(main)/PR 上跑与本地一致的完整 gate（`npm run check` + `node --test`，3 OS × Node 20/22/24），tag 触发 npm Trusted Publishing 发布。
2. **检测引擎 pythonDeps 谓词**：新增基于 Python 依赖声明的检测谓词，消除 `fastapi`/`flask` 的 `main.py`/`app.py` 文件名误报（及其经 `backend` tag 级联注入 security 规则的连锁误报），并把 `.venv`/`venv`/`__pycache__` 排除出扫描。
3. **规则库扩充与版本审计**：规则库 48→57（新增 9 条 `source: original` 规则），对 13 条既有前端/移动规则做版本时效审计，全部数量钉死点与双语文档联动，`assets/VERSION` 1.2.0→1.3.0、`package.json` 0.2.0→0.3.0。

交付顺序固定 S1→S2→S3（CI 先保护后续改动；引擎先于规则，使 `llm-app` 的双生态检测无需条件分支）。

## In-Scope

- SCOPE-IN-001 `.github/workflows/ci.yml`：push(main) 与 PR 触发；矩阵 os×node = {ubuntu,macos,windows}-latest × {20,22,24}；步骤 checkout → setup-node → `npm run check` → `node --test`；零依赖，不用 `npm ci`、不配缓存。
- SCOPE-IN-002 `.github/workflows/release.yml`：tag `v*` 触发；job 内先跑 `npm run check` 与 `node --test`，再 `npm publish --provenance --access public`；`permissions: id-token: write`；采用 npm Trusted Publishing（OIDC 免 token，不设 NPM_TOKEN 备选路径）。
- SCOPE-IN-003 本仓 `AGENTS.md` 与 `CLAUDE.md` 的 gate 说明段各加一句「CI 在 push/PR 上跑同一 gate」；README 不动。
- SCOPE-IN-004 `assets/sync.mjs` `scanRepo`：`EXCLUDED_DIRS` 增加 `.venv`/`venv`/`__pycache__`；收集全树 `pyproject.toml` 内容及 basename 匹配 `/^requirements[^/]*\.txt$/` 的文件内容。
- SCOPE-IN-005 新增纯函数 `mergePythonDeps`：解析 PEP 621 `[project].dependencies`、`[project.optional-dependencies].*`、PEP 735 `[dependency-groups].*`、`[tool.poetry.dependencies]` 与 `[tool.poetry.group.<g>.dependencies]`（剔除 `python`），及 requirements 行首包名；按 section 行状态机 + 跨行数组，不引入完整 TOML 解析器；全部 PEP 503 归一；解析异常静默跳过该文件（与 package.json 先例一致）。
- SCOPE-IN-006 谓词接入：`pythonDeps` 并入 base-OR（与 files/packageDeps/extensions 平级）；同步更新 `assets/sync.mjs` 的 `SPEC-DETECT-001` [N/A] 注释块（该 ID 为源码内注释锚点，非 r2p 上游产物）。
- SCOPE-IN-007 `assets/stacks.json`（内部 version 1.0.0→1.1.0）：`fastapi`/`flask` 改用 `pythonDeps` 并删除对应裸文件名；`django` 保留 `manage.py` 增 `pythonDeps`；`pytest`/`python-ml`/`mongodb` 各增对应 `pythonDeps`。
- SCOPE-IN-008 测试：`test/stacks.test.mjs` validator 增 `pythonDeps` 分支（非空 string 数组、PEP503 形状、计入 hasActionablePredicate）；`test/sync.test.mjs` 新增 (a)–(g) 七个用例，含 main.py 误报回归、pyproject/requirements/poetry/optional 检出、畸形 pyproject 静默跳过、`.venv/` 不参与检测。
- SCOPE-IN-009 文档联动：本仓 `CLAUDE.md` 与 `AGENTS.md` 的谓词清单（files / packageDeps / extensions / requiresTags）补入 `pythonDeps`。
- SCOPE-IN-010 新增 9 条规则（expo、dotnet-maui、solidjs、blazor、electron、frontend-state、prisma、web-perf、llm-app），全部 `source: original`，逐条官方文档核查（安全项对照 OWASP），格式沿用既有规则（≤100 行、固定 frontmatter、Hard Constraints 先于 Ecosystem Idioms、负向具名反模式）；`llm-app` 依赖 S2 的 `pythonDeps` 已落地以获双生态检测。
- SCOPE-IN-011 版本时效审计：对 13 条既有前端/移动规则逐条核查当前官方大版本，仅修过时表述、不扩行数；已知嫌疑四条 `nextjs.md`(Next.js 16)/`tailwind.md`(v4)/`svelte.md`(Svelte 5 runes)/`ios-swiftui.md`(Swift 6)，其余九条扫查无过时则不动（零改动是合法结果）。
- SCOPE-IN-012 数量与文档联动（同一提交内完成）：`assets/library/` +9 文件、`assets/stacks.json` +9 条目；`test/library.test.mjs` `EXPECTED_FILE_COUNT` 48→57、`test/stacks.test.mjs` 条目数 48→57；`README.md`/`README.zh-CN.md` 两处 48→57 及分类清单更新（Frontend 9→13、Mobile 4→6、Data 3→4、Cross-cutting 3→5，双语对齐）；`THIRD-PARTY.md`/`AGENTS.md`/`CLAUDE.md` 中 48→57；`assets/VERSION` 1.2.0→1.3.0；不触 `fragments/` 与 `src/`（无需 `npm run build`），9 个新 stack 均 `lint: null`。
- SCOPE-IN-013 交付顺序与提交划分：S1→S2→S3；S1 一提交、S2 一提交、S3 中新增规则+数量联动（对应 SCOPE-IN-010/012）为一个 feat 提交、版本审计（SCOPE-IN-011）如有改动另出一提交。
- SCOPE-IN-014 版本与发布：`package.json` 0.2.0→0.3.0；全部合入后打 tag `v0.3.0`，由 release workflow 发布，本需求内仅此一次发布。

## Out-of-Scope

- SCOPE-OUT-001 平台扩展（Cursor / Windsurf / Copilot / Cline）：需外部格式调研，另立研究 point，本需求不含任何相关工作。
- SCOPE-OUT-002 `setup.py` / `Pipfile` / `environment.yml` 的依赖解析：记录为已知限制，`mergePythonDeps` 不覆盖。
- SCOPE-OUT-003 两个 point 已评估落选的规则（uikit、harmonyos-arkts、nestjs、redis、drizzle、react-router-v7、tanstack-start、qwik、tauri、ionic-capacitor、kotlin-multiplatform、mcp-server、i18n、supabase、serverless、monorepo、wordpress 等）。
- SCOPE-OUT-004 `frontend-state` / `prisma` 的 Python 侧检测（二者本质是 JS 生态规则，仅 `packageDeps`）。
- SCOPE-OUT-005 `sync.mjs` 拆分、npm 包 `files` 瘦身、`update` 子命令、以及 `.venv` 排除之外的扫描性能优化（均已评估否决）。

## Non-Goals

- 不改变零第三方依赖这一硬产品约束：`package.json` 不新增 `dependencies`，`mergePythonDeps` 不引入 TOML 解析库。
- 不改动构建路径（`fragments/`、`src/build/*`），本需求无 `npm run build` 触发点；确定性约束（`RISK-DET-001` [N/A]，本仓源码内的风险锚点标识，非 r2p 上游产物）不受影响。
- 不改动 lint 基线目录（`assets/lint/`），9 个新 stack 均 `lint: null`。
- 不做全库规则重写：SCOPE-IN-011 仅纠正过时表述，不重构规则结构、不扩行数。

## Assumptions

- 运行环境 Node ≥20，`node --test` + `npm run build`/`npm run check` 是本仓完整 gate（无独立 lint/typecheck 步）。
- `assets/sync.mjs` 的 LF 归一化已内建，Windows 矩阵腿的路径差异预期只涉及测试内路径拼接，可在测试层修复。
- 检测引擎的误报分析（谓词间 OR、`files` 按 basename 全树命中）已按源码核实为真实缺陷。
- npm Trusted Publishing（OIDC）为唯一发布认证路径；用户会在 G4 打 tag 前于 npmjs.com 完成 trusted publisher 配置（绑定 repo 与 workflow 文件名）。
- 「当前官方大版本」以实现时点（约 2026-07）为准做审计判定。
- 新增/改动 stack 条目须与 `assets/library/*.md`、`assets/lint/<key>/`、各数量钉死测试保持锁步（本仓测试已固化该不变式）。

## Acceptance Criteria

- **G1（S1 合入门）**：PR 上 9 条矩阵腿全绿（含 windows）；`generated/` 漂移能被 `npm run check` 在 CI 上拦截（可用一次故意漂移的临时提交验证后撤销）。
- **G2（S2 合入门）**：SCOPE-IN-008 全部用例通过，尤其回归用例 (a) 证明 main.py 误报消除；全量 `node --test` 与 `npm run check` 绿；抛弃式 scratch 仓 dogfood 三例通过（main.py-only 不再检出 fastapi/security；pyproject+fastapi 检出；requirements+flask 检出）。本仓自身禁止 dogfood。
- **G3（S3 合入门）**：全量测试绿（含 57 数字联动与 README 双语对齐测试）；scratch 仓逐一验证 9 个新 stack 检测命中且 12 条上限截断行为正常、截断文件在报告中具名。
- **G4（发布门）**：trusted publisher 已配置；tag `v0.3.0` 推送后 release workflow 内建 gate 通过并发布成功；`npm view code-guidelines version` 返回 0.3.0 且带 provenance。
- 四个门全部通过即为本需求验收完成。

## Open Questions

均为非阻塞、已定处置：

1. **Windows 矩阵腿未知路径问题**（关联 SCOPE-IN-001/008）：由实现者在 G1 内以测试层修复解决；若出现涉及产品源码的结构性不兼容，暂停 S1 合入并上报用户决策。
2. **npm Trusted Publishing 配置为用户人工动作**（关联 SCOPE-IN-002/014）：上报用户，在 G4 打 tag 前完成；未配置则发布环节等待，不影响 S1–S3 合入。
3. **SCOPE-IN-011 审计实际改动量核查前未知**：由实现者在 G3 前按各官方文档判定，仅修过时表述；无改动则零提交，属合法结果。

## Sources

- 折叠来源研究 point：`rule-library-expansion`、`python-deps-detection-and-ci`（均已确认）。
- 本仓源码：`assets/sync.mjs`（`scanRepo`、检测谓词、`SPEC-DETECT-001` 注释块）、`assets/stacks.json`、`assets/library/*.md`、`assets/VERSION`、`test/{sync,stacks,library,baseline,readme}.test.mjs`、`README.md`/`README.zh-CN.md`、`THIRD-PARTY.md`、`AGENTS.md`、`CLAUDE.md`、`package.json`。
- 外部权威文档（SCOPE-IN-010/011 逐条核查）：Expo、MS .NET MAUI、solidjs.com、MS Blazor、Electron 安全清单、Prisma、web.dev Core Web Vitals、OWASP LLM Top 10、各 LLM SDK 官方文档；Next.js 16 / Tailwind v4 / Svelte 5 / Swift 6 官方迁移文档。
- 规范：PEP 621 / PEP 735 / PEP 503（SCOPE-IN-005）；npm Trusted Publishing / provenance（SCOPE-IN-002）。

## Trace
<!-- Map this stage's IDs to upstream/downstream. R3 derives & checks closure. -->
| This ID | Upstream | Status |
|---|---|---|
| SCOPE-IN-001 | R1 | ADDRESSED |
| SCOPE-IN-002 | R2 | ADDRESSED |
| SCOPE-IN-003 | R3 | ADDRESSED |
| SCOPE-IN-004 | R4 | ADDRESSED |
| SCOPE-IN-005 | R5 | ADDRESSED |
| SCOPE-IN-006 | R6 | ADDRESSED |
| SCOPE-IN-007 | R7 | ADDRESSED |
| SCOPE-IN-008 | R8 | ADDRESSED |
| SCOPE-IN-009 | R9 | ADDRESSED |
| SCOPE-IN-010 | R10 | ADDRESSED |
| SCOPE-IN-011 | R11 | ADDRESSED |
| SCOPE-IN-012 | R12 | ADDRESSED |
| SCOPE-IN-013 | R13 | ADDRESSED |
| SCOPE-IN-014 | R14 | ADDRESSED |
| SCOPE-OUT-001 | Scope/Out-of-scope · 平台扩展 | OUT-OF-SCOPE |
| SCOPE-OUT-002 | Scope/Out-of-scope · setup.py/Pipfile/environment.yml | OUT-OF-SCOPE |
| SCOPE-OUT-003 | Scope/Out-of-scope · 落选规则 | OUT-OF-SCOPE |
| SCOPE-OUT-004 | Scope/Out-of-scope · frontend-state/prisma Python 检测 | OUT-OF-SCOPE |
| SCOPE-OUT-005 | Scope/Out-of-scope · sync.mjs 拆分等 | OUT-OF-SCOPE |
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
