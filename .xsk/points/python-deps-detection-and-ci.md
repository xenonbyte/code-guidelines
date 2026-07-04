---
status: ready
slug: python-deps-detection-and-ci
created_at: 2026-07-04
---

# 规则资产之外的正收益优化：Python 依赖检测（修误报）+ CI/发布自动化

## Aspect

在规则资产（rule-library-expansion 已覆盖）之外，盘点本项目全部可优化面，筛出确有正向收益的方向并给出落地决策。

## Research

### 排查方法

通读 README / package.json / assets/sync.mjs（SPEC-DETECT-001 检测语义与 scanRepo 实现）/ assets/stacks.json 全部谓词 / test 目录结构 / fragments 与 AGENTS.md 的谓词提及面，核查 npm 发布状态与 `.github/` 存在性，逐项评估候选。

### 候选盘点（逐项处置）

**1. CI + 发布自动化 —— 入选（P0）**

- 仓库**完全没有 `.github/`**：无 CI、无发布流水线。而本仓的质量 gate（`node --test` 267 个测试 + `npm run check` 防 `generated/` 漂移）目前只靠本地自觉；`generated/` 是"提交的可复现产物"，正是最容易静默漂移、也最值得机器把关的一类。
- npm 已发布 0.2.0（2026-07-03，手工发布，已核实 `npm view`），README 主安装路径 `npx code-guidelines install` 成立；但发布不可复现、无 provenance。
- Windows 支持整体 UNCONFIRMED（路径解析用 `homedir()`/`join()`，LF 归一化已内建，但从未在 Windows 上跑过测试）——CI 矩阵加 windows-latest 可把"未验证"变成"已验证"。
- 讽刺点顺带修复：本工具自己 ship 一条 github-actions 规则，仓库却没有 CI。
- 成本约半天，风险趋零，纯正收益。

**2. 检测引擎 pythonDeps 谓词 + FastAPI/Flask 误报修复 —— 入选（P1）**

- **真实正确性问题（已按源码核实）**：检测谓词类型之间为 OR，`files` 裸文件名按 basename **全树任意位置**命中（sync.mjs SPEC-DETECT-001 注释块 + `matchFiles` 实现）。而 `fastapi` 的检测是 `files: ["main.py"]`、`flask` 是 `files: ["app.py"]` —— 任何含 `main.py` 的 Python 仓（CLI、脚本、任意项目）都被误判为 FastAPI 并注入 fastapi 规则；更糟的是误命中会发出 `backend` tag，经 `requiresTags` 级联触发 security 规则注入。django 的 `manage.py` 是特有文件，不受影响。
- 这正是 [[rule-library-expansion]] 明确留下的 backlog（"Python 侧依赖类检测需引擎改造，另立 point"），且该 point 落地后 llm-app 等新规则的"仅覆盖 JS 生态检测"限制也靠它解除。
- **连带发现**：`EXCLUDED_DIRS = {node_modules, vendor, dist, build, .git}` 不含 `.venv`/`venv`/`__pycache__` —— 今天扫描就已把 site-packages 的成千上万个 `.py` 计入扩展名统计（性能损耗）；若不先排除，解析 `.venv` 内的 pyproject.toml 会把传递依赖当项目依赖（新误报源）。必须随本项一起修。
- 联动面小（已核实）：fragments/ 与 AGENTS.md 均无谓词细节 ⇒ **不触发 `npm run build`**；README 不枚举谓词 ⇒ readme.test 无关；改动集中在 sync.mjs + stacks.json + 两个测试文件 + 两份 dev 指南各一行。
- 无版本 skew 风险：sync.mjs 与 stacks.json 同属 assets/，同一次 install 原子性成对拷贝到 `~/.code-guidelines/`，目标仓不留副本。
- 零依赖约束下 TOML 解析可行：不需要完整 TOML 解析器，只需按 section 的行状态机提取依赖数组/表键（约 80 行，纯函数、确定性）；解析异常按既有 package.json 先例静默跳过（检测是 best-effort，仓内已有此模式）。

**3. 平台扩展（Cursor / Windsurf / Copilot / Cline 等）—— 另立 point，本次不拍板**

registry.mjs 驱动的构建架构使"加一个平台"实现成本很低，市场收益潜力是全部候选里最大的；但每个平台的全局命令/技能格式、入口文件约定、是否支持 manual-only 语义都需要对照官方文档做外部调研，本 point 内信息不足以决策。建议后续以 `platform-expansion` 为 slug 另立 point。

**4. 否决清单（均已评估）**

- **sync.mjs（1468 行）拆分**：standalone 单文件是 load-bearing 设计（ship 进目标机、零 import），拆分直接违背 CLAUDE.md 钉死的约束。
- **dogfood fixtures 误检修复**：文档已警示；把 `test/fixtures` 类目录加入扫描排除会伤害真实仓库检测语义，收益不抵风险。
- **npm 包瘦身（剔除 fragments/、src/build/）**：节省几 KB；保留它们使 tarball 可完整重建（`npm run build`/`check` 可跑），反而是特性。
- **`update` 子命令**：`npx` 天然拉最新版，重跑 `install` 即升级，README 也无此承诺。
- **扫描性能专项**：无痛点证据；P1 顺带排除 `.venv` 已是最大的一笔实际改善。
- **LICENSE / 文档对齐 / 测试覆盖**：已核实均在位且有测试守护，无缺口。

## Landed plan

两项落地，顺序 P0 → P1（先有 CI 保护再动引擎）；与 [[rule-library-expansion]] 互不阻塞，可并行（stacks.json 冲突面小）。

### P0 — GitHub Actions CI + 发布自动化（约半天）

1. `.github/workflows/ci.yml`：触发 push(main) + PR；矩阵 os × node = {ubuntu-latest, macos-latest, windows-latest} × {20, 22, 24}；步骤 checkout → setup-node → `npm run check` → `node --test`。零依赖，无需 `npm ci`、无缓存配置。windows 腿若暴露路径问题，同 PR 修复（LF 归一化已内建，预期改动仅限测试内路径拼接）。
2. `.github/workflows/release.yml`：tag `v*` 触发；job 内先跑 check + test，再 `npm publish --provenance --access public`；`permissions: id-token: write`；采用 npm Trusted Publishing（OIDC 免 token）。**唯一人工前置**：在 npmjs.com 为该包配置 trusted publisher（绑定 repo + workflow 文件名）。
3. 文档：AGENTS.md 与 CLAUDE.md 的"gate 即 node --test / npm run check"段各加一句"CI 在 push/PR 上跑同一 gate"。README 不动。

### P1 — pythonDeps 谓词 + 误报修复（约一天，P0 合入后）

1. **scanRepo**：`EXCLUDED_DIRS` 增加 `.venv`、`venv`、`__pycache__`；收集全树 `pyproject.toml` 内容与 basename 匹配 `/^requirements[^/]*\.txt$/` 的文件内容。
2. **新增 `mergePythonDeps`**（纯函数）：
   - pyproject 提取范围：PEP 621 `[project].dependencies`、`[project.optional-dependencies].*`、PEP 735 `[dependency-groups].*`（数组内带引号的 PEP 508 串），以及 `[tool.poetry.dependencies]` / `[tool.poetry.group.<g>.dependencies]` 的表键（剔除 `python`）。按 section 行状态机实现，支持跨行数组。
   - requirements 行解析：跳过注释/`-`开头选项行/URL 行，取行首包名（`^[A-Za-z0-9][A-Za-z0-9._-]*`）。
   - 全部按 PEP 503 归一化（小写，`[-_.]+`→`-`）；解析异常静默跳过该文件（沿用 package.json 先例）。
   - 不解析 setup.py / Pipfile / environment.yml —— 记为已知限制。
3. **谓词接入**：`pythonDeps` 并入 base-OR（与 files/packageDeps/extensions 平级）；更新 SPEC-DETECT-001 注释块。
4. **stacks.json**（内部 version 1.0.0 → 1.1.0）：
   - `fastapi` → `{ pythonDeps: ["fastapi"], tags: ["backend"] }`（**删除 main.py**）；
   - `flask` → `{ pythonDeps: ["flask"], tags: ["backend"] }`（**删除 app.py**）；
   - `django` 保留 `manage.py`，增 `pythonDeps: ["django"]`；
   - `pytest` 增 `["pytest"]`；`python-ml` 增 `["numpy","pandas","scikit-learn","torch","tensorflow","jupyter"]`；`mongodb` 增 `["pymongo","motor"]`；
   - 若 rule-library-expansion 已落地：`llm-app` 增 `["openai","anthropic","langchain","llama-index"]`（其"仅 JS 生态检测"的已知限制随之解除；frontend-state / prisma 本就是 JS-only，不动）。
5. **test/stacks.test.mjs**：validator 增 `pythonDeps` 分支 —— 非空 string 数组、PEP 503 归一形状 `^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$`、计入 hasActionablePredicate。
6. **test/sync.test.mjs** 新用例：(a) 含 `main.py` 但无 fastapi 依赖 ⇒ 不检出 fastapi（钉住误报修复的回归测试）；(b) pyproject `[project].dependencies` 含 fastapi ⇒ 检出；(c) requirements.txt `Flask==3.0` ⇒ 检出 flask（大小写归一）；(d) poetry 表；(e) optional-dependencies；(f) 畸形 pyproject 静默跳过；(g) `.venv/` 内文件不参与任何检测。
7. **文档联动**：本仓 CLAUDE.md / AGENTS.md 的谓词清单 "(files / packageDeps / extensions / requiresTags)" 增 pythonDeps，各一行。
8. **版本**：`package.json` 0.2.0 → 0.3.0（引擎新能力，随下次 npm 发布）；`assets/VERSION` 不动（规则内容未变）。
9. **验证**：`node --test` 全绿 + `npm run check`；抛弃式 scratch 仓 dogfood 三例 —— main.py-only 仓（确认不再误检 fastapi/security）、pyproject+fastapi 仓、requirements+flask 仓。

### 后续（不在本计划内）

平台扩展另立 point（`platform-expansion`）：调研 Cursor / Windsurf / Copilot / Cline 的全局命令格式与入口文件事实后再决策。
