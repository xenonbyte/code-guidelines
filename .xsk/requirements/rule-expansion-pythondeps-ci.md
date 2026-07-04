---
status: active
slug: rule-expansion-pythondeps-ci
created_at: 2026-07-04
---

# 规则库扩充（48→57）+ pythonDeps 检测谓词 + CI/发布自动化

## Background

本需求由两个已确认的研究 point 折叠而成（rule-library-expansion、python-deps-detection-and-ci），覆盖三条工作流：

- 仓库完全没有 `.github/`：质量 gate（`node --test` 全量测试 + `npm run check` 防 `generated/` 漂移）只靠本地自觉；npm 0.2.0 为手工发布，无 provenance；Windows 支持从未被验证。
- 检测引擎存在真实误报（已按源码核实）：谓词类型之间为 OR，`files` 裸文件名按 basename 全树命中，而 `fastapi` 靠 `files: ["main.py"]`、`flask` 靠 `files: ["app.py"]` 检测。任何含 `main.py` 的 Python 仓都会被误判为 FastAPI，并经误发的 `backend` tag 级联注入 security 规则。同时 `EXCLUDED_DIRS` 不含 `.venv`/`venv`/`__pycache__`，site-packages 会被扫进统计。
- 规则库（assets/VERSION 1.2.0，48 条，9 类）在移动端与前端有明确缺口；既有前端/移动规则存在版本过时嫌疑（Next.js 16、Tailwind v4、Svelte 5、Swift 6）。

## Goal

三条工作流全部落地并通过各自验收门（见 Checkpoints）：

1. GitHub Actions 在 push/PR 上跑完整 gate（3 OS × Node 20/22/24），tag 触发的 npm 发布带 provenance。
2. 检测引擎新增 `pythonDeps` 谓词，消除 fastapi/flask 文件名误报，扫描排除 `.venv`/`venv`/`__pycache__`。
3. 规则库 48→57（新增 9 条），13 条既有前端/移动规则完成版本时效审计；`assets/VERSION` 1.3.0、`package.json` 0.3.0，以 tag v0.3.0 发布。

## Scope

### In scope

- S1：`.github/workflows/ci.yml` 与 `release.yml`，及 dev 指南各一句 CI 说明。
- S2：`assets/sync.mjs` 检测引擎改造（pythonDeps 谓词、扫描排除）、`assets/stacks.json` 谓词更新、validator 与检测测试、谓词文档联动。
- S3：9 条新规则 + stacks.json 新条目、13 条既有规则版本审计、全部数量钉死点联动、版本号与发布。

### Out of scope（真非目标）

- 平台扩展（Cursor / Windsurf / Copilot / Cline）：需外部格式调研，未来另立研究 point，本需求不含任何相关工作。
- setup.py / Pipfile / environment.yml 的依赖解析：记录为已知限制。
- 两个 point 已评估落选的规则（uikit、harmonyos-arkts、nestjs、redis、drizzle、react-router-v7、tanstack-start、qwik、tauri、ionic-capacitor、kotlin-multiplatform、mcp-server、i18n、supabase、serverless、monorepo、wordpress 等）。
- frontend-state / prisma 的 Python 侧检测（二者本质是 JS 生态规则）。
- sync.mjs 拆分、npm 包 files 瘦身、`update` 子命令、`.venv` 排除之外的扫描性能优化（均已评估否决）。

## Requirements

### S1 CI 与发布自动化

- R1 `.github/workflows/ci.yml`：触发 push(main) 与 PR；矩阵 os × node = {ubuntu-latest, macos-latest, windows-latest} × {20, 22, 24}；步骤 checkout → setup-node → `npm run check` → `node --test`。零依赖，不使用 `npm ci`、不配缓存。
- R2 `.github/workflows/release.yml`：tag `v*` 触发；job 内先跑 `npm run check` 与 `node --test`，再 `npm publish --provenance --access public`；`permissions: id-token: write`；采用 npm Trusted Publishing（OIDC 免 token，不设 NPM_TOKEN 备选路径）。人工前置：用户在 npmjs.com 为该包配置 trusted publisher（绑定 repo 与 workflow 文件名），安排在 G4 前完成。
- R3 本仓 `AGENTS.md` 与 `CLAUDE.md` 的 gate 说明段各加一句：CI 在 push/PR 上跑同一 gate。README 不动。

### S2 检测引擎 pythonDeps

- R4 `scanRepo`：`EXCLUDED_DIRS` 增加 `.venv`、`venv`、`__pycache__`；收集全树 `pyproject.toml` 内容，以及 basename 匹配 `/^requirements[^/]*\.txt$/` 的文件内容。
- R5 新增纯函数 `mergePythonDeps`：
  - pyproject 提取范围：PEP 621 `[project].dependencies`、`[project.optional-dependencies].*`、PEP 735 `[dependency-groups].*`（数组内带引号的 PEP 508 串），以及 `[tool.poetry.dependencies]` 与 `[tool.poetry.group.<g>.dependencies]` 的表键（剔除 `python`）。按 section 行状态机实现，支持跨行数组，不引入完整 TOML 解析器。
  - requirements 行解析：跳过注释行、`-` 开头的选项行、URL 行；取行首包名（`^[A-Za-z0-9][A-Za-z0-9._-]*`）。
  - 全部按 PEP 503 归一化（小写，`[-_.]+` 替换为 `-`）。
  - 解析异常静默跳过该文件，与既有 package.json 处理先例一致（检测是 best-effort）。
- R6 谓词接入：`pythonDeps` 并入 base-OR（与 files/packageDeps/extensions 平级）；同步更新 sync.mjs 的 SPEC-DETECT-001 注释块。
- R7 `assets/stacks.json`（内部 version 1.0.0 → 1.1.0）：
  - `fastapi` 改为 `{ pythonDeps: ["fastapi"], tags: ["backend"] }`，删除 `main.py`；
  - `flask` 改为 `{ pythonDeps: ["flask"], tags: ["backend"] }`，删除 `app.py`；
  - `django` 保留 `manage.py`，增 `pythonDeps: ["django"]`；
  - `pytest` 增 `pythonDeps: ["pytest"]`；`python-ml` 增 `["numpy","pandas","scikit-learn","torch","tensorflow","jupyter"]`；`mongodb` 增 `["pymongo","motor"]`。
- R8 测试：
  - `test/stacks.test.mjs` validator 增 `pythonDeps` 分支：非空 string 数组、形状 `^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$`（PEP 503 归一后），计入 hasActionablePredicate。
  - `test/sync.test.mjs` 新用例：(a) 含 `main.py` 但无 fastapi 依赖的仓不检出 fastapi（钉住误报修复）；(b) pyproject `[project].dependencies` 含 fastapi 时检出；(c) requirements.txt 写 `Flask==3.0` 时检出 flask（大小写归一）；(d) poetry 依赖表检出；(e) optional-dependencies 检出；(f) 畸形 pyproject 静默跳过且不影响其余检测；(g) `.venv/` 内文件不参与任何检测。
- R9 文档联动：本仓 `CLAUDE.md` 与 `AGENTS.md` 的谓词清单（files / packageDeps / extensions / requiresTags）补入 pythonDeps。

### S3 规则库扩充与版本审计

- R10 新增 9 条规则，全部 `source: original`（研读上游 → 原创撰写 → 官方文档逐条核查；安全项对照 OWASP）。每条不超过 100 行，frontmatter `name`（等于文件名）/`description`/`appliesTo`（非空数组）/`stacks`（非空数组）/`source`，`## Hard Constraints (MUST NOT)` 先于 `## Ecosystem Idioms & Conventions`，硬约束优先负向、带具名反模式，沿用"适配既有架构而非强加结构"的口吻（参照 android-compose 现例）。THIRD-PARTY.md 维持 acknowledgement-only。

  | 规则 | 类别 | specificity | stacks.json detect | 来源与核查 |
  |---|---|---|---|---|
  | expo | 移动 | 70 | packageDeps `["expo"]` | acr react-native-expo/expo-router → Expo 官方文档 |
  | dotnet-maui | 移动 | 65 | files `["MauiProgram.cs"]` | copilot dotnet-maui → MS MAUI 官方文档 |
  | solidjs | 前端 | 55 | packageDeps `["solid-js"]` + tags `["frontend"]` | acr solidjs 系列 → solidjs.com |
  | blazor | 前端 | 55 | extensions `[{ext:"razor",minCount:1}]` + tags `["frontend"]` | copilot blazor → MS 官方文档 |
  | electron | 前端 | 55 | packageDeps `["electron"]` + tags `["frontend"]` | Electron 官方安全清单为主 |
  | frontend-state | 前端 | 40 | packageDeps `["zustand","@reduxjs/toolkit","mobx","jotai","pinia","@tanstack/react-query","@tanstack/vue-query","swr"]` + tags `["frontend"]` | acr react-zustand + vue-pinia + tanstack-query-v5 → 各官方文档 |
  | prisma | 数据 | 50 | packageDeps `["prisma","@prisma/client"]` | Prisma 官方文档直取 |
  | web-perf | 横切 | 25 | requiresTags `["frontend"]` | acr web-app-optimization + copilot performance-optimization → web.dev Core Web Vitals |
  | llm-app | 横切 | 45 | packageDeps `["openai","@anthropic-ai/sdk","ai","langchain","@langchain/core","llamaindex"]` + pythonDeps `["openai","anthropic","langchain","llama-index"]` | copilot ai 安全系列 → OWASP LLM Top 10 + 各 SDK 官方文档 |

  llm-app 的 pythonDeps 依赖 S2 先行落地（交付顺序保证），使其条目自创建起即具备双生态检测；frontend-state 与 prisma 为 JS-only，不加 pythonDeps。
- R11 版本时效审计：对 13 条既有前端与移动规则逐条核查当前官方大版本，只修过时表述、不扩行数。已知嫌疑四条：`nextjs.md`（Next.js 16：async request APIs、Cache Components、RSC 内 `next/dynamic { ssr:false }` 禁令）、`tailwind.md`（v4 CSS-first，`@theme`，无 tailwind.config.js）、`svelte.md`（Svelte 5 runes）、`ios-swiftui.md`（Swift 6 strict concurrency）。其余九条（react/vue/nuxt/angular/astro/html-css/react-native/flutter/android-compose）扫一遍，无过时表述则不动。
- R12 数量与文档联动（同一提交内完成，漏一处即测试红）：
  - `assets/library/` 增 9 个文件；`assets/stacks.json` 增 9 个条目（按类别分组就近插入）。
  - `test/library.test.mjs` `EXPECTED_FILE_COUNT` 48→57；`test/stacks.test.mjs` 条目数 48→57。
  - `README.md` 与 `README.zh-CN.md`：两处 "48"→"57"，分类清单更新（Frontend 9→13、Mobile 4→6、Data 3→4、Cross-cutting 3→5），保持双语章节对齐。
  - `THIRD-PARTY.md` 两处 "48"→"57"；`AGENTS.md`、`CLAUDE.md` 中 "48"→"57"。
  - `assets/VERSION` 1.2.0 → 1.3.0。
  - 不触 `fragments/` 与 `src/`，无需 `npm run build`；lint 基线目录不动，9 个新 stack 均 `lint: null`。

### 交付顺序与版本

- R13 交付顺序 S1 → S2 → S3：CI 先行保护后续改动；引擎先于规则使 llm-app 免除条件分支。提交划分：S1 一个提交；S2 一个提交；S3 中新增规则与数量联动（R10+R12）为一个 feat 提交，版本审计（R11）如有改动另出一个提交。
- R14 版本与发布：`package.json` 0.2.0 → 0.3.0（引擎新能力 + 规则扩充随包分发）；全部合入后打 tag `v0.3.0`，由 release workflow 发布，本需求内只发布这一次。`assets/VERSION` 的 1.3.0 已含在 R12。

## Open Questions（均非阻塞，已定处置）

1. Windows 矩阵腿可能暴露未知路径问题：由实现者在 G1 内以测试层修复解决（LF 归一化已内建，预期只涉及测试内路径拼接）；若出现涉及产品源码的结构性不兼容，暂停 S1 合入并上报用户决策。
2. npm Trusted Publishing 配置是用户人工动作：上报用户，在 G4 打 tag 前完成；未配置则发布环节等待，不影响 S1 至 S3 合入。
3. R11 审计的实际改动量在核查前未知：由实现者在 G3 前按各官方文档判定，仅修过时表述；无改动则 R11 零提交，属合法结果。

## Checkpoints

- G1（S1 合入门）：PR 上 9 条矩阵腿全绿（含 windows）；`generated/` 漂移能被 `npm run check` 在 CI 上拦截（可用一次故意漂移的临时提交验证后撤销）。
- G2（S2 合入门）：R8 全部用例通过，尤其回归用例 (a) 证明 main.py 误报消除；全量 `node --test` 与 `npm run check` 绿；抛弃式 scratch 仓 dogfood 三例通过（main.py-only 仓不再检出 fastapi/security；pyproject+fastapi 仓检出；requirements+flask 仓检出）。本仓自身仍禁止 dogfood。
- G3（S3 合入门）：全量测试绿（含 57 数字联动与 README 双语对齐测试）；scratch 仓逐一验证 9 个新 stack 检测命中（expo 依赖、MauiProgram.cs、.razor、solid-js/zustand/electron/prisma/openai 依赖、纯前端仓命中 web-perf）且 12 条上限截断行为正常、截断文件在报告中具名。
- G4（发布门）：trusted publisher 已配置；tag `v0.3.0` 推送后 release workflow 内建 gate 通过并发布成功；`npm view code-guidelines version` 返回 0.3.0 且带 provenance。

四个门全部通过即为本需求验收完成。
