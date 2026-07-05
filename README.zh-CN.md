# code-guidelines

`code-guidelines` 是一个零第三方依赖的 Node.js 安装器,向四个 AI 编程工具——Claude Code、Codex、
opencode、Gemini CLI——交付三个显式调用的命令:`/code-guidelines`、`/code-guidelines-lint`、
`/code-guidelines-distill`。安装后,`/code-guidelines` 检测目标仓库技术栈并在仓库内保持一套精选守卫
规则(以及入口文件里的托管指针块)同步;`/code-guidelines-lint` 为检出的技术栈布防机器强制的 lint
基线;`/code-guidelines-distill` 从目标仓库自身源码现场蒸馏出项目专属的约定文件。每个命令都只手动调用、
只做一件事——绝不因意图触发。

英文版见 [README.md](README.md)(与本文件章节结构逐一对齐)。

## 概述

`code-guidelines` 采用渐进式披露设计:不是把成百条规则一次性塞进一个吃上下文的大文件,而是按需分三层
送达约束,每一层各自对应一个显式命令——

1. `/code-guidelines` —— 一套精选的、57 个规则文件组成的守卫规则库(每个受支持的栈/框架/语言各一),
   外加入口文件里的托管指针块;
2. `/code-guidelines-lint` —— 机器强制的 lint 基线(11 套工具链),在某个栈首次被检出、且项目对该工具
   尚无任何既有配置时一次性布防;
3. `/code-guidelines-distill` —— 项目专属的 `project-conventions.md`,从目标仓库自身源码现场蒸馏而来。

这三个命令通过 `code-guidelines` CLI 按机器(按平台)安装一次,随后在每个目标项目中通过显式键入对应
命令来调用——每个命令只做你要它做的那件事,别无其他。

## 支持的平台

三个命令被交付到四个 AI 编程工具。每个平台拿到平台原生形态的产物(每个命令一个文件),并各自维护该平台
自己的入口文件。下表展示核心命令的产物;`-lint` 与 `-distill` 命令就紧挨在它旁边——在 Claude Code 上是
同级的 `code-guidelines-lint/` / `code-guidelines-distill/` 技能目录,在其他平台上是同目录下的
`code-guidelines-lint.<ext>` / `code-guidelines-distill.<ext>` 文件:

| 平台 | 已装技能产物(核心命令) | 维护的入口文件 | 调用方式 |
|---|---|---|---|
| Claude Code | `~/.claude/skills/code-guidelines/SKILL.md`(Markdown + `disable-model-invocation: true`) | `CLAUDE.md` | `/code-guidelines`、`/code-guidelines-lint`、`/code-guidelines-distill` |
| Codex | `~/.agents/skills/code-guidelines/SKILL.md`（Agent Skill） | `AGENTS.md` | `/skills` 选择器或 `$code-guidelines`（`-lint`/`-distill`） |
| opencode | `~/.config/opencode/commands/code-guidelines.md` | `AGENTS.md` | 同样三个 |
| Gemini CLI | `~/.gemini/commands/code-guidelines.toml`(TOML) | `GEMINI.md` | 同样三个 |

`install` / `uninstall` 的 `--platform` 参数接受 `claude`、`codex`、`opencode`、`gemini` 的任意逗号
分隔子集(默认四个全装)。

## 支持的语言与技术栈

检测会从 **9 大类共 57 个守卫规则文件** 中选择。`guardrails-core` 恒定生效;其余按检出仓库技术栈选取,
每仓总序封顶 12 个规则文件:

- **核心(1):** guardrails-core —— 通用整洁代码 / 反过度工程守卫,恒定生效。
- **语言(12):** TypeScript、JavaScript、Python、Go、Rust、Java、Kotlin、Swift、C#、C++、PHP、Ruby。
- **前端(13):** React、Next.js、Vue、Nuxt、Angular、Svelte、Astro、Tailwind CSS、HTML/CSS、SolidJS、
  Blazor、Electron、前端状态管理(Zustand/Redux Toolkit/Pinia/TanStack Query 等)。
- **移动(6):** React Native、Flutter、Android(Jetpack Compose)、iOS(SwiftUI)、Expo、.NET MAUI。
- **后端(9):** Node.js API、Django、FastAPI、Flask、Spring Boot、Laravel、Rails、ASP.NET Core、GraphQL。
- **数据(4):** SQL、MongoDB、Python ML、Prisma。
- **测试(3):** JS 单元测试、端到端测试、pytest。
- **DevOps(4):** Docker、Kubernetes、Terraform、GitHub Actions。
- **横切(5):** REST API、安全(OWASP 向)、无障碍(a11y)、Web 性能(Core Web Vitals)、
  LLM 应用安全(OWASP LLM Top 10)。

**lint 基线(11 套工具链)** 由独立的 `/code-guidelines-lint` 命令布防:每个工具一次,在某个栈被检出、
且项目对该工具尚无既有配置时——采用每个工具当前(非弃用)的配置格式:

| 语言 | 基线配置 |
|---|---|
| JS / TypeScript | ESLint flat config(`eslint.config.mjs`)+ Prettier + 严格 `tsconfig.json` |
| Python | Ruff(`ruff.toml`)+ mypy(strict) |
| Go | golangci-lint v2(`.golangci.yml`) |
| Rust | rustfmt + Clippy |
| Java | Checkstyle |
| Kotlin | ktlint(`.editorconfig`)+ detekt |
| Swift | SwiftLint |
| C# | Roslyn 分析器(`.editorconfig` + `Directory.Build.props`) |
| PHP | PHP-CS-Fixer + PHPStan |
| Ruby | RuboCop |
| C / C++ | clang-format + clang-tidy |

## 怎么使用

### 1. 安装技能

从 npm 安装——该 CLI **零第三方依赖**。一次性使用(无需全局安装):

```sh
npx code-guidelines install
```

或全局安装 CLI 后再运行:

```sh
npm install -g code-guidelines
code-guidelines install
```

也可以直接从本仓库的检出目录运行:`node bin/code-guidelines install`。

默认会把技能安装到全部四个受支持平台。若只想安装其中一部分,传入以逗号分隔的 `--platform` 列表,取值
来自 `claude`、`codex`、`opencode`、`gemini`:

```sh
code-guidelines install --platform claude,codex
```

其他 CLI 命令:

- `code-guidelines status` —— 只读报告当前已安装内容(manifest 形状、已装技能/资产/平台)。
- `code-guidelines uninstall [--platform <list>]` —— 移除本工具拥有、且未被手工改动过的已装文件。
- `code-guidelines version` / `help` —— 打印版本 / 用法。

### 2. 在目标项目中调用命令

在任意目标仓库中,键入三个命令之一。`/code-guidelines` 要求该平台对应的入口文件已存在(`CLAUDE.md`、
`AGENTS.md` 或 `GEMINI.md`——见下文"生成物说明");另外两个只写入 `.code-guidelines/`(lint 命令还会
写工具配置文件),不要求入口文件存在:

- `/code-guidelines` —— 检测技术栈,在 `.code-guidelines/` 内调和规则库,并维护入口文件内的托管指针
  块。若再次运行时一切未变,则不写任何文件(幂等、零写入)。它不布防 lint、也不蒸馏。
- `/code-guidelines-lint` —— 为每个已检出、且对该工具尚无既有配置的技术栈,首次适用时布防机器强制的
  lint 基线。它会写入工具的配置文件,但永不安装依赖——而是打印出精确的安装命令。删除已布防的脚手架即
  为永久退出。
- `/code-guidelines-distill` —— 一次性、agent 驱动地蒸馏出这个具体仓库的真实约定(命名、目录组织、
  错误处理、技术选型、测试模式),产出 `.code-guidelines/project-conventions.md`。使用前请先阅读下文
  的残余风险说明。

### 3. 解读输出

每个命令结束都会输出一份状态报告。

- `/code-guidelines` 涵盖本次新增/删除/升级/跳过的文件清单(用户手工改动过的项一律跳过、永不被静默
  覆盖)、`project-conventions.md` 是否存在及其最近一次蒸馏日期(仅作事实陈述,不判断新旧),以及一行
  指向两个配套命令的提示。
- `/code-guidelines-lint` 逐个 lint 工具报告:是否已布防、是否存在依赖缺口(附精确的安装命令——依赖
  永不自动安装)、是否因已有配置而只读推荐、或用户是否已通过删除脚手架主动退出。

加 `--dry-run` 可只计算并打印同样的报告而不写任何文件;加 `--json` 可得到同一结构的机器可读版本。

## 什么时候使用

三个命令都仅接受显式调用(见"设计说明")。用下表判断该在何时键入哪一个——以及同样重要的,何时不该。

| 场景 | 该怎么做 | 原因 |
|---|---|---|
| 日常例行规则同步,或刚新增/移除了某个技术栈依赖之后 | 键入 `/code-guidelines`(仅规则 + 托管块) | 确定性地重新检测技术栈并调和规则;可放心频繁运行——无变化的一次运行不写任何文件 |
| 想让某个尚无配置的技术栈开始接受 lint 约束 | 键入 `/code-guidelines-lint` | 每个工具一次性布防机器强制基线;这是一个刻意的、独立的命令,绝不作为规则同步的副作用发生 |
| 从零开始一个全新(greenfield)项目、尚无代码 | 现在就键入 `/code-guidelines` 与 `/code-guidelines-lint`,从第一天起获得守卫 + lint;等写了几个真实文件后,再运行 `/code-guidelines-distill` | 空仓库没有可蒸馏的东西——规则库与 lint 基线立即生效;项目专属约定只有在有代码可作证据后才能固化 |
| 接手一个已有真实约定值得沉淀的存量代码库 | 键入一次 `/code-guidelines-distill` | 一次性、有证据门槛的提炼,把本仓库真实惯例写入 `project-conventions.md` |
| 一次大重构之后,项目约定发生了有意的变化 | 手动重新运行 `/code-guidelines-distill --force`(或先删除 `project-conventions.md`) | 蒸馏永不自动发生;过期的 `project-conventions.md` 只会被如实报告,不会被自动刷新 |
| 正在做手头的编码任务,忽然想"这里如果有点指导就好了" | 不要 仅凭这个念头去调用它们中的任何一个 | 仅显式调用(R2):这些命令绝不因意图、关键字或作为编码任务的副作用而触发 |
| 想让它在每次提交或保存文件时自动运行 | 不要 要求它配置 hook | 这些命令永不建议或配置基于 hook 的自动化 |
| 在对话中提到了"python"或"docker" | 不要 指望这会触发任何行为 | 关键字/意图触发被明确排除在范围之外 |

## 生成物说明

这三个命令(或在机器层面运行 `install`)会产生以下产物。任何审阅 diff 或接手一个使用本工具的项目的
协作者都应该认得这些:

- **目标仓库内的 `.code-guidelines/`** —— 当前为该仓库检出技术栈所选定的精选守卫规则文件,以及
  `manifest.json`(逐文件记录来源版本与内容哈希、每个 lint 工具的布防/退出状态,以及
  `project-conventions.md`——如果存在——的内容哈希与蒸馏日期)。该目录完全由本工具拥有并调和;对已
  追踪文件的手工改动会被哈希检测到,永不被静默覆盖。
- **平台入口文件内的托管块**(Claude Code 对应 `CLAUDE.md`,Codex 与 opencode 对应 `AGENTS.md`,
  Gemini CLI 对应 `GEMINI.md`)—— 一段 `<!-- code-guidelines:begin -->` / `<!-- code-guidelines:end
  -->` 块,不超过 25 行,为每条已装规则给出一行触发条件式指针(例如"Before editing `*.tsx`, read
  `.code-guidelines/react.md`")。块外的一切内容保持逐字节不变,且仅当块内容真正发生变化时才会重写
  文件。本工具在任何情况下都不会自行创建这个入口文件——它必须预先存在。
- **lint 脚手架配置文件**(例如 JS/TS 的 `eslint.config.mjs` + `.prettierrc` + `tsconfig.json`,
  Python 的 `ruff.toml` + `mypy.ini`,以及其余 9 套受支持工具链各自的一组配置)—— 由独立的
  `/code-guidelines-lint` 命令写入,仅当某个匹配的技术栈被首次检出、且项目对该工具尚无任何既有配置时。
  依赖永不自动安装;状态报告会打印精确的安装命令。一旦布防,未被改动的脚手架会随工具版本升级;被用户
  手工改动过的脚手架被视为用户财产并永久跳过;删除脚手架被视为主动退出,不会在没有显式
  `/code-guidelines-lint --relint <工具名>` 的情况下复活。

## 设计说明:仅显式调用与蒸馏残余风险

**刻意偏离常规技能写法(R2)。** 大多数 agent 技能会在自己的正文里写一段简短的"何时使用本技能"或
"触发条件"说明,让模型可以凭意图或关键字自行判断是否调用。这三个命令的正文都刻意不设这样的区块,每个
`description` 也都被写成一条负向守卫,而不是正向触发条件——例如:"仅当用户键入 `/code-guidelines` 时
运行……绝不因意图、关键字或作为编码任务的副作用而触发。"在 Claude Code 上,每个命令还在 frontmatter 中
设置了 `disable-model-invocation: true`,在平台层面硬性禁止自动加载。这是刻意的选择,而非疏漏:一个
会跨仓库改写文件的工具(即便改写很保守)绝不应该作为无关编码任务的副作用被触发,也绝不应该被配置成
通过 hook 自动运行——这些命令同样不会建议这么做。如果你期待在某个命令的正文里找到一段"模型应该在什么
情况下调用它"的说明,你不会找到;这部分说明被有意放在本 README 里,给人读,而不是给模型用来自我触发。

**`distill` 的产出质量依赖 agent,不可机器验证。** 确定性命令(`/code-guidelines` 与
`/code-guidelines-lint`——检测、选择、调和、lint 布防)是一个零依赖的脚本,输出逐字节可复现——被自动化
测试全面覆盖。`/code-guidelines-distill` 则不同:它是一段由命令正文定义的 agent 驱动程序(而非脚本),
会抽样源文件并写出散文。工具层面为其套上了结构性护栏——固定模板、
80 行上限,以及每条约定必须引用至少两处仓库内真实文件路径作为证据、无证据或泛泛最佳实践的条目一律
丢弃——但它无法验证一条被蒸馏出的约定在语义上是否真的正确、是否真的代表这个仓库。自动化测试可以(也确实)
检查模板、证据格式与覆盖保护逻辑是否工作;但无法检查 agent 所写内容的判断质量。使用一份新蒸馏出的
`project-conventions.md` 之前,请像审阅其他任何 agent 撰写的文档一样先审阅它。

## 许可证

MIT —— 见 `LICENSE`。精选规则库与 lint 基线所涉及的第三方来源与许可,记录在 `THIRD-PARTY.md` 中。
