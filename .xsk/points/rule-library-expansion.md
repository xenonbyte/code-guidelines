---
status: ready
slug: rule-library-expansion
created_at: 2026-07-04
---

# 规则库扩充:移动端/前端补全 + 高价值新域(48 → 57)

## Aspect

在保持"小而精"定位的前提下,补全规则库的移动端与前端覆盖并纳入其他高价值缺口,从 PatrickJS/awesome-cursorrules 与 github/awesome-copilot 蒸馏灵感、对照官方文档做权威核查,同时顺带修复既有前端/移动规则中的版本过时表述。

## Research

### 现状(assets/VERSION 1.2.0,48 条规则,9 类)

核心 1 · 语言 12 · 前端 9(react/nextjs/vue/nuxt/angular/svelte/astro/tailwind/html-css)· 移动 4(react-native/flutter/android-compose/ios-swiftui)· 后端 9 · 数据 3 · 测试 3 · DevOps 4 · 横切 3(rest-api/security/a11y)。

### 仓库内约束(加规则的联动面,全部已核实)

- 数量钉死点共 8 处:`test/library.test.mjs`(`EXPECTED_FILE_COUNT = 48`)、`test/stacks.test.mjs`(48 个 stack 条目 + 9 类枚举)、`README.md` / `README.zh-CN.md`(两处 "48" + 分类清单,双语标题结构对齐由测试保证)、`THIRD-PARTY.md`(两处 "48")、`AGENTS.md`、`CLAUDE.md`。
- 规则文件形状:≤100 行;frontmatter `name`(=文件名)/`description`/`appliesTo`(非空数组)/`stacks`(非空数组)/`source`;`## Hard Constraints (MUST NOT)` 必须先于 `## Ecosystem Idioms & Conventions`。
- 检测引擎(`assets/sync.mjs` SPEC-DETECT-001,已读实现):全树递归扫描(排除 node_modules/vendor/dist/build/.git);`files` 裸文件名按 basename 全树匹配(含 `/` 则按相对路径);`packageDeps` 读取全树所有 package.json 的 dependencies/devDependencies/peerDependencies/optionalDependencies;`extensions` 全树计数;`requiresTags` 为 OR 门。**pyproject.toml 依赖不参与检测**——Python 侧依赖类检测暂不可行。
- 选择器:前端/移动/后端同属 layer 0(framework 层),单仓上限 12 条(含 core);扩库只增广度,不增单仓注入量。9 类枚举被测试钉死,新规则全部落入既有类别,`sync.mjs` 零改动。
- 蒸馏管线已有先例:`THIRD-PARTY.md` 已将 awesome-cursorrules(CC0-1.0)与 awesome-copilot(MIT)列为灵感来源;48 条全部 `source: original`(研读上游 → 原创撰写 → 对照官方文档核查,安全项对照 OWASP)。沿用该管线则 THIRD-PARTY.md 只需更新数字;若某条改为改编上游文本,须按 SPEC-RULEFMT-001 在 `source` 记录上游路径+commit 并在 THIRD-PARTY.md 列明。
- 版本:`assets/VERSION` 1.2.0 → 1.3.0(minor,新增规则),驱动目标仓 reconcile 升级;`package.json#version`(安装器 0.2.0)不动。
- 无需 `npm run build`(fragments/ 不含规则数量与清单);lint 基线不动(新增 stack 全部 `lint: null`,Blazor/MAUI 的 C# lint 已由既有 csharp stack 经 `.cs` 检测覆盖)。

### 上游调研(2026-07-04 取数)

**awesome-cursorrules**(40k+ star,`rules/` 下 257 个扁平 `.mdc`):
- 移动缺口信号:Expo(canonical 条目 `react-native-expo`,另有 Expo Router 专条)> UIKit > Detox 移动 E2E > NativeScript > HarmonyOS ArkTS。库中完全无 KMP/Ionic/MAUI 条目。
- 前端缺口信号:**状态管理是整个缺失类别**,且是该库写得最成熟的一批规则——`react-zustand`(状态归属决策树:短暂态放组件、可分享筛选放 URL、真共享客户端态才进 store、服务端态归 TanStack Query/SWR 永不复制进 store;persist 的 partialize/version/migrate;禁持久化密钥/PII)、`vue-pinia`(同一归属模型的 Vue 版)、`tanstack-query-v5`(服务端态硬边界、query key 工厂、v5 options 对象形态)。其余:Solid(3 条)、Qwik(2 条)、React Router v7、TanStack Start、HTMX、styled-components/chakra/shadcn、Vite、web 性能、SEO、Tauri/Electron 类(vscode-extension)。
- 其他高信号类别:AI/LLM 应用开发(最强跨切信号,8+ 条)、Supabase/BaaS(8 条,该库最大单一集成主题)、NestJS(含 anti-hallucination 变体)、Solidity/web3、游戏(Unity)、Elixir/Phoenix。**Prisma/Drizzle/Redis 在该库为空白**(是上游缺口,非需求缺口)。
- 成熟条目的共同形态(值得移植):状态归属边界、具体数字上限(如 SwiftUI `body` ≤50 行)、具名反模式清单、"适配既有架构而非强加结构"声明;另有"版本迁移 delta 规则"这一独特体裁(svelte-5-vs-svelte-4:专门阻止模型输出上一大版本习语)。

**awesome-copilot**(`instructions/` 189 个文件):
- 头部发现:该库**没有** react/angular/nuxt/react-native/android/ios 条目——本库的语言/前端/移动核心覆盖已超过它;其真正差异化在 AI/agent/MCP 工程(28 条,最大集群)、Azure/Power Platform(45+ 条,企业微软生态,不适配本库)、版本迁移指南、meta/工作流。
- 移动:唯一实质缺口是 `dotnet-maui`(113 行,NEVER 清单蒸馏价值极高:禁 ListView/Frame/*AndExpand/运行时 svg/renderer 混用,编译绑定 x:DataType,Shell 唯一导航宿主,SecureStorage 而非 Preferences)。
- 前端:`blazor`(未覆盖,C# SPA)、`tanstack-start-shadcn-tailwind`、`wordpress`;跨切:`performance-optimization`、`localization`、`security-and-owasp`、`a11y`(后两者已覆盖)。
- **版本时效性警示**(直接指向本库既有规则的"优化"面):其 `nextjs` 条目已按 Next.js 16.1(2026-01)撰写(async request APIs:`await cookies()/headers()`、Cache Components、禁在 RSC 内用 `next/dynamic { ssr:false }`);`tailwind-v4-vite` 为 v4 CSS-first(`@theme`,无 tailwind.config.js);`svelte` 为 Svelte 5 runes 语法。本库对应规则若仍按 v3/v15/Svelte 4 撰写即为过时,需审计。

### 候选取舍(逐项决策)

**入选(9 条,理由 = 语料信号 × 可检测性 × 护栏价值):**

| 新规则 | 类别 | specificity | detect | 蒸馏来源 → 权威核查 |
|---|---|---|---|---|
| expo | 移动 | 70(高于 react-native 60,镜像 nextjs>react) | packageDeps `["expo"]` | acr react-native-expo/expo-router → Expo 官方文档(Expo Router、SecureStore、EAS/OTA) |
| dotnet-maui | 移动 | 65 | files `["MauiProgram.cs"]`(basename 全树匹配,已验证语义) | copilot dotnet-maui → MS MAUI 官方文档 |
| solidjs | 前端 | 55 | packageDeps `["solid-js"]` + tags `["frontend"]` | acr solidjs-* → solidjs.com(细粒度响应式:禁解构 props、无重渲染心智模型) |
| blazor | 前端 | 55 | extensions `[{ext:"razor",minCount:1}]` + tags `["frontend"]`(.razor 专属 Blazor,Razor Pages 用 .cshtml,不误报) | copilot blazor → MS 官方文档 |
| electron | 前端 | 55 | packageDeps `["electron"]` + tags `["frontend"]` | 权威优先:Electron 官方安全清单(contextIsolation、禁 nodeIntegration、IPC 入参校验、sandbox);语料仅作旁证 |
| frontend-state | 前端 | 40(低于框架规则,高于 tailwind 30) | packageDeps `["zustand","@reduxjs/toolkit","mobx","jotai","pinia","@tanstack/react-query","@tanstack/vue-query","swr"]` + tags `["frontend"]` | acr react-zustand + vue-pinia + tanstack-query-v5(三条同构)→ 各官方文档;核心内容:状态归属决策树、服务端态硬边界、持久化安全 |
| prisma | 数据 | 50 | packageDeps `["prisma","@prisma/client"]` | 语料空白,权威直取:Prisma 官方文档(事务、N+1/include 纪律、migrate vs db push、serverless 连接池) |
| web-perf | 横切 | 25(介于 a11y/security 20 与 rest-api 30) | requiresTags `["frontend"]`(同 a11y 模式) | acr web-app-optimization + copilot performance-optimization → web.dev Core Web Vitals |
| llm-app | 横切 | 45 | packageDeps `["openai","@anthropic-ai/sdk","ai","langchain","@langchain/core","llamaindex"]` | copilot ai-prompt-engineering-safety/agent-safety → OWASP LLM Top 10 + 各 SDK 官方文档;内容:prompt 注入防御、模型输出不可信、密钥不入 prompt、token/成本上限、流式错误处理 |

**落选(已评估,记入 backlog,均有明确理由):**
- uikit:Info.plist 已被 ios-swiftui 占用,files/deps 谓词无法区分 UIKit 与 SwiftUI 工程(需内容检查,引擎不支持);SwiftUI 是当代默认。
- harmonyos-arkts:可检测(`.ets` 扩展名),中国市场相关,但单语料单条目、权威核查成本高 → 二批候选。
- nestjs:node-api 已经由 `@nestjs/core` 触发,基线已覆盖;专条留待需求出现。
- react-router-v7/remix、tanstack-start、qwik、tauri、ionic-capacitor、kotlin-multiplatform(检测需 gradle 内容)、redis、drizzle、mcp-server、i18n/localization、supabase/BaaS、serverless(cloudflare-workers/azure-functions)、monorepo 工具、wordpress:信号中等或检测不净,暂缓。
- Python 侧 LLM/数据栈依赖检测:需检测引擎读 pyproject.toml 依赖,属引擎改造,另立 point。

**批量规模决策:** +9(48→57,≈19%)。再大伤"curated"定位;再小则移动/前端补不全。类别分布:移动 4→6,前端 9→13,数据 3→4,横切 3→5,其余不动;9 类枚举与 `LAYER_BY_CATEGORY` 零改动。

## Landed plan

### A. 新增 9 条规则(全部 `source: original`:研读上游 → 原创撰写 → 官方文档逐条核查)

按上表落地。每条 ≤100 行、frontmatter `name` = 文件名、`## Hard Constraints (MUST NOT)` 在前、`## Ecosystem Idioms & Conventions` 在后;硬约束优先负向、带具名反模式;沿用"适配既有架构"的口吻(参照 android-compose 现例)。不改编上游文本,THIRD-PARTY.md 维持 acknowledgement-only。

### B. 既有前端/移动规则版本时效审计(本次"优化"面)

对 13 条既有前端+移动规则做版本时效核查,只修过时表述、不扩行数;已知嫌疑(来自上游对照):
1. `nextjs.md` — 对照 Next.js 16(async request APIs、Cache Components、RSC 内 `next/dynamic { ssr:false }` 禁令)。
2. `tailwind.md` — 对照 v4 CSS-first(若仍规定 tailwind.config.js/content 数组即过时)。
3. `svelte.md` — 对照 Svelte 5 runes(`$:`/`on:click` 习语即过时)。
4. `ios-swiftui.md` — 对照 Swift 6 strict concurrency(@MainActor、`.task(id:)`、Sendable)。
5. 其余 9 条(react/vue/nuxt/angular/astro/html-css/react-native/flutter/android-compose)扫一遍当前官方大版本,无过时表述则不动。

### C. 机械联动(一次提交内同步,漏一处即测试红)

1. `assets/library/` +9 文件;`assets/stacks.json` +9 条目(四谓词形状如上表,插入位置按类别分组就近)。
2. `test/library.test.mjs` `EXPECTED_FILE_COUNT` 48→57;`test/stacks.test.mjs` 条目数 48→57。
3. `README.md` + `README.zh-CN.md`:两处 "48"→"57",分类清单更新(Frontend 9→13、Mobile 4→6、Data 3→4、Cross-cutting 3→5),保持双语标题结构对齐。
4. `THIRD-PARTY.md` 两处 "48"→"57";`AGENTS.md`、`CLAUDE.md` 中 "48"→"57"。
5. `assets/VERSION` 1.2.0 → 1.3.0。
6. 不触 `fragments/`/`src/`/`generated/`,无需 build;lint 基线目录不动。

### D. 验证

1. `node --test`(267+ 全绿,含 library/stacks/readme 形状测试)与 `npm run check`。
2. 抛弃式 scratch 仓库 dogfood(遵守本仓禁 dogfood 约定):分别放置 `package.json`(expo dep)、`MauiProgram.cs`、`*.razor`、`solid-js`/`zustand`/`electron`/`prisma`/`openai` dep、纯前端仓,逐一确认新 stack 检测命中、选择顺序与 12 条上限截断行为符合预期。
3. 交付顺序:A+C 一个 commit(feat,资产 1.3.0),B 若有修改另一个 commit(fix/docs),互不阻塞。

### 已知限制(接受并记录)

- llm-app / frontend-state / prisma 仅覆盖 JS 生态检测(pyproject 依赖不参与检测);Python 侧同类覆盖待检测引擎扩展(backlog,另立 point)。
- blazor 经 `.razor` 检测同时命中 Blazor Server/WASM/Hybrid,规则内容按两者共性撰写。
