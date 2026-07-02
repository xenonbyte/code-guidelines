---
r2p_stage: raw_requirement
r2p_version: 1
r2p_status: approved
r2p_created_at: 2026-07-02T19:39:39.947685+00:00
r2p_updated_at: 2026-07-02T19:42:03.374465+00:00
---

---
status: active
slug: code-guidelines-skill
created_at: 2026-07-03
---

# code-guidelines:渐进式编码规范技能安装器

## Background

AI 编程工具(Claude Code、Codex、opencode、Gemini CLI)生成代码的常见缺陷:过度抽象、无关重构、忽视项目既有结构、套用通用模板、不符合语言与框架生态习惯。社区已有大量规则资产(PatrickJS/awesome-cursorrules,`rules/` 下 257 个扁平 `.mdc`,CC0 许可),但整包塞进 AGENTS.md / CLAUDE.md 会导致上下文膨胀、规则冲突与维护困难,且抽样确认上游质量参差:存在含作者私有路径与人设开场白的条目,不能照搬。研究结论(arXiv 2604.11088, "Guardrails Beat Guidance")支持:负向硬约束优于泛泛正向指导;机器强制的约束又强于散文约束。

本项目用渐进式披露把三类约束送达 agent:精选蒸馏的通用规则、机器强制的 lint 守卫、从目标仓库现场蒸馏的项目自有约定。

## Goal

交付独立品牌 `code-guidelines` 的 agent 技能安装器项目:安装后在四个平台提供唯一技能 `/code-guidelines`;在任意目标项目中检测技术栈,幂等维护 `.code-guidelines/` 规则目录、lint 基线守卫与入口文档托管索引;`distill` 子命令蒸馏项目专属约定。

## Scope

### In scope

- 安装器项目全套(CLI、四平台适配、manifest 安装安全、单源构建、测试、双语 README)。
- 48 个规则一次性蒸馏入库;11 套 lint 基线资产。
- 无参同步模式(V1 规则调和 + lint 首次自动布防 + 状态报告)与 `distill` 模式。
- 目标项目落盘物:`.code-guidelines/`、入口文档托管块、空白处 lint 脚手架配置。

### Out of scope(真非目标,从未属于本需求)

- hook、被动、关键字、意图触发;任何形式的自动触发建议。
- 深度解析或合并用户既有 lint 配置(仅存在性检测与只读缺口报告)。
- 自动安装依赖(仅打印安装命令)。
- 镜像上游全部 257 条规则;首批 48 栈之外的小众技术栈。
- 修改目标项目的 CI 配置。
- 为目标项目创建入口约束文件(`AGENTS.md` / `CLAUDE.md` / `GEMINI.md`);缺失时仅提示用户自行创建。

## Requirements

### R1 安装器项目结构(按 xsk-skill-scaffold 结构标准,品牌独立)

- CLI bin `code-guidelines`,五命令:`version`/`--version`/`-v`、`help`/`--help`/`-h`、`install [--platform <list>]`、`uninstall [--platform <list>]`、`status`(只读)。不实现 `doctor`。
- `--platform` 可选、逗号分隔、默认全部平台;未知值与重复值报错;未知选项响亮失败。`status` 校验 manifest 形状而非仅解析成功。
- 四平台:Claude Code、Codex、opencode、Gemini。每平台安装后技能均可被显式调用;opencode 使用命令文件形态,携带技能正文与该平台参数占位符。每平台产物在生成时烙入自身平台标识,运行时以 `--platform <name>` 传给 `sync.mjs`;不做运行时环境嗅探。
- manifest 安装安全:仅移除自有文件、所有权标记、原子写、拒绝 symlink、内容哈希改动检测、无标记哈希识别;`install` 为 uninstall-first(重装先重置旧自有文件、清理不再安装的技能),拒绝覆盖用户改过的自有文件并回滚。
- 单源构建:技能由 per-section 片段(purpose / triggers / behavior / output)+ 共享正文 + 模板组合生成,注册表列出技能;构建确定性,提交产物与生成器逐字节一致,由测试强制;golden snapshot 掩蔽共享正文。
- 共享资产目录 `~/.code-guidelines/`:`library/`(48 规则)、`lint/`(11 套基线)、`distill/`(蒸馏模板 + veto 清单)、`stacks.json`、`sync.mjs`、`VERSION`。install 写入并纳入 manifest,uninstall 一并移除;四平台技能文本引用该目录,不各自复制。

### R2 触发约束

- 唯一触发途径:用户键入 `/code-guidelines`(可带 `distill` 参数)。无关键字、意图、hook、副作用触发。
- SKILL.md frontmatter `description` 本身写为负向守卫:"Explicit-invocation only: run only when the user types /code-guidelines. Never invoke from intent, keywords, or as a side effect of coding tasks."。正文不设意图触发线索区(与常规技能写法的刻意偏离,README 说明原因)。
- 技能永不建议用户配置 hook 自动化。

### R3 无参模式 `/code-guidelines`

按序执行三个动作:V1 规则同步、lint 首次布防、状态报告。主路径为 `sync.mjs`(零依赖单文件 Node 脚本,支持 `--dry-run` 与 `--json`);SKILL.md 内写明与之等价的确定性手工算法作无 node 环境兜底。

**检测**:读 `stacks.json` 注册表;谓词四类:指定文件存在(如 `go.mod`、`Cargo.toml`、`pyproject.toml`)、`package.json` 依赖名精确匹配、源文件扩展名计数阈值(阈值逐条目声明于 `stacks.json`)、标签依赖(以其他栈的检出结果为条件,供横切规则使用,如检出任一前端框架则 a11y 适用);全部检测行为由 fixture 金样测试钉死。monorepo 全仓聚合检测,排除 `node_modules`、`vendor`、`dist`、`build`、`.git`;规则只装仓库根。

**选择**:特异度排序为框架 > 语言 > 领域;上限 12 个规则文件(含恒选的 guardrails-core)。

**调和(全量 reconcile)**:期望集(检测结果)对比 manifest 已装集;新增缺失项;移除不再匹配且内容哈希与 manifest 一致的项;升级库中有新版且哈希一致的项;哈希不符视为用户覆盖,跳过并在报告列出,永不静默覆盖。调和只作用于 manifest 记录的规则与 lint 文件;`project-conventions.md` 不参与 V1 期望集计算,仅由 distill 管理。

**零写入**:期望态与现状完全一致时不写任何文件、不改任何 mtime,输出"已是最新,无变更"。

**lint 首次布防**:同时满足以下三条才写入:a) 检测到对应栈;b) 项目不存在该工具的任何配置;c) manifest 无该工具的布防记录(at-most-once)。依赖永不自动安装,报告打印精确安装命令。用户删除脚手架配置后视为主动退出,不复活;状态报告标注该状态,用户在同一会话内答复确认后,agent 调用 `sync.mjs --relint <工具名>` 清除标记并重新布防(属本次显式调用内的分支,不违反 R2)。未被用户改动的脚手架配置(哈希匹配 manifest)随技能版本升级;改动过的视为用户财产,永久跳过。已有配置的工具:分毫不动,仅在状态报告给出推荐规则清单与建议片段(只读)。

**状态报告**:本次动作摘要(增/删/升级/跳过清单)、lint 布防与缺口详情、`project-conventions.md` 的存在性与蒸馏日期(事实陈述,不作过期判断)。

**平台前置检查**:四平台与入口约束文件的固定映射:Claude Code 对应 `CLAUDE.md`;Codex 与 opencode 对应 `AGENTS.md`;Gemini 对应 `GEMINI.md`(四平台对应三个文件)。平台标识来自安装产物烙入的 `--platform` 参数(见 R1)。执行任何写入前,检查当前平台映射的约束文件是否存在于仓库根:不存在则立即中止、零写入,提示"当前平台(<平台名>)无约束文件 <文件名>,请先创建该文件后重新执行 /code-guidelines"。本技能在任何情况下都不创建入口约束文件。

**入口文档托管块**:前置检查通过后,对仓库根已存在的 `AGENTS.md`、`CLAUDE.md`、`GEMINI.md` 逐一维护同一 `<!-- code-guidelines:begin -->` ... `<!-- code-guidelines:end -->` 块(存在几个就维护几个,不新建)。块内容 ≤25 行:3 行以内说明 + 每条规则一行触发条件式指针(如 "Before editing `*.tsx`, read `.code-guidelines/react.md`");`project-conventions.md` 存在时其指针恒排第一。块内整体重生成,块外内容一字不动;仅当块内容有变化才写文件。

**目标项目落盘**:`.code-guidelines/` 内为规则文件与 `manifest.json`(逐文件记录来源版本与内容哈希、lint 布防记录、conventions 哈希与蒸馏日期)。

### R4 distill 模式 `/code-guidelines distill`

- 执行前先过 R3 的平台前置检查,当前平台约束文件缺失时同样中止并提示。
- agent 驱动程序(由 SKILL.md 定义,非脚本):按检测到的栈抽样源文件(每栈至少 10 个,优先近期修改与被引用较多的文件;不足 10 则全量),提炼本仓库真实惯例:命名、目录组织、错误处理、技术选型、测试模式。
- 产出 `.code-guidelines/project-conventions.md`:固定模板、guardrails 措辞、≤80 行;每条约定必须引用 ≥2 处仓库内文件路径作证据;无证据的条目与通用最佳实践(那是规则库的职责)一律丢弃。
- manifest 记录内容哈希与蒸馏日期;重蒸馏时哈希不符(用户改过)则拒绝覆盖,输出新旧对比报告由用户选择。
- 永不并入无参调用(LLM 产出非确定性,并入即破坏零写入承诺);无参调用只报告其状态。

### R5 规则库(48 个,一次性全量蒸馏)

清单(9 类合计 48):

- 核心 1:guardrails-core(蒸馏合并自上游 clean-code / anti-overengineering / codequality),恒选。
- 语言 12:TypeScript、JavaScript、Python、Go、Rust、Java、Kotlin、Swift、C#、C++、PHP、Ruby。
- 前端 9:React、Next.js、Vue 3、Nuxt、Angular、Svelte/SvelteKit、Astro、Tailwind CSS、HTML/CSS 通用。
- 移动 4:React Native、Flutter、Android Jetpack Compose、iOS SwiftUI。
- 后端 9:Node API(Express/Nest/Fastify)、Django、FastAPI、Flask、Spring Boot、Laravel、Rails、ASP.NET Core、GraphQL。
- 数据 3:SQL 通用、MongoDB、Python 数据/ML(pandas/PyTorch/Jupyter)。
- 测试 3:JS 单测(Jest/Vitest)、E2E(Cypress/Playwright)、pytest。
- DevOps 4:Docker、Kubernetes、Terraform、GitHub Actions。
- 横切 3:REST API 设计、安全基线(OWASP 向)、无障碍(a11y)。

每文件规约:纯 `.md`;固定模板为硬约束(禁止项)在前、生态惯用法在后;≤100 行;正文英文;frontmatter 为 `name` / `description` / `appliesTo`(globs) / `stacks`(检测标签) / `source`(上游仓库路径 + commit,或 `original`)。

蒸馏纪律:剥除人设开场白、作者私有路径、项目私货;已由本项目 11 套 lint 基线强制的约束(格式、import 顺序、禁 `any` 一类)外移至基线,不进散文;基线未覆盖的机器可查约束(如 Dockerfile、Terraform 等无对应基线的领域)允许保留在散文中。逐文件过 veto 清单(模板段落顺序、无私货、行数上限、frontmatter 完整、无与基线重复的约束),不过闸不入库。

来源:主 PatrickJS/awesome-cursorrules(CC0);辅 github/awesome-copilot(MIT);两者皆无合格素材的栈原创撰写,`source: original`。

### R6 lint 基线(11 套,按语言组织)

- JS/TS:ESLint flat config + Prettier + 严格 tsconfig;React、Vue 等框架插件作为检测到对应框架时的条件附加项。
- Python:ruff + mypy。Go:golangci-lint。Rust:clippy + rustfmt。Java:Checkstyle。Kotlin:ktlint + detekt。Swift:SwiftLint。C#:`.editorconfig` + Roslyn 分析器严格级别。PHP:PHP-CS-Fixer + PHPStan。Ruby:RuboCop。C++:clang-format + clang-tidy。
- `stacks.json` 条目以 `lint` 键关联基线;每套基线附元数据,说明其强制了哪些约束(与规则散文的分工边界)。

### R7 文档与许可

- `README.md`(英文)+ `README.zh-CN.md`(中文),标题结构一致,内容由钉住测试保证。
- 必含章节:"How to use / 怎么使用"(安装、两种调用方式、输出解读)与 "When to use / 什么时候使用"(时机表:无参为日常同步,技术栈变化后重跑即可;distill 用于有存量代码的项目做一次、大型重构后手动刷新;lint 布防在无参内自动完成,无需单独操作)。
- 说明目标项目内生成物(`.code-guidelines/`、入口文档托管块、脚手架 lint 配置)的含义,使不知情的协作者能看懂。
- 说明 R2 的刻意偏离(SKILL.md 无意图触发区)与 distill 产出质量依赖 agent 的残余风险。
- `LICENSE`(MIT)+ `THIRD-PARTY.md`(上游许可与逐条溯源约定说明)。

### R8 测试(全部可执行)

- 安装器:五命令解析、install/uninstall、uninstall-first 重置、事务回滚、用户改动拒绝、symlink 拒绝、golden snapshot、README 双语标题对齐与内容钉住、自符合性。
- 同步:按栈的 fixture 检测金样;幂等(同一 fixture 连跑两次,第二次断言零文件写入);用户改动保护;托管块再生成且块外不动;12 上限与特异度排序;monorepo 聚合。
- 平台前置检查:四平台映射各一用例;当前平台约束文件缺失的 fixture 中止且零写入,提示文案含平台名与目标文件名;其余平台文件存在但当前平台文件缺失时同样中止;通过检查后托管块只写入已存在的约束文件、从不新建。
- lint:空白 fixture 首跑布防生效;二跑零写入;删除脚手架配置后不复活;既有配置 fixture 分毫未动;未改动配置随版本升级、改动过的跳过。
- 规则库结构校验:文件数恰为 48、frontmatter 完整、行数上限、模板段落顺序、`source` 可解析。
- distill:模板与 veto 清单文件存在、manifest 记录与覆盖保护逻辑;agent 产出质量不可机器测,以 R7 的残余风险声明兜底。
- SKILL.md 结构校验:`description` 含显式触发禁令、正文无意图触发线索区。

## Checkpoints

交付顺序 A → B → C,全部属于本需求的在范围工作;每个检查点暂停,对照本文件验收后再继续:

- **A(V1 可用)**:脚手架 + `stacks.json` + 48 规则入库 + `sync.mjs` + SKILL.md 无参模式(含平台前置检查)+ R8 对应测试全绿。跑 /xsk-skill-scaffold 审计,除品牌命名差异外全部符合。
- **B(lint)**:11 套基线 + 布防逻辑 + R8 对应测试全绿。人工抽查:在一个无 lint 配置的样例项目跑通全流程(布防、按报告安装依赖、工具实际可运行)。
- **C(distill)**:模板 + SKILL.md 程序 + 保护逻辑 + 测试。人工抽查:对一个真实存量仓库跑 distill,逐条核验证据引用的文件路径真实存在。
- **终验**:README 两个必含章节齐备且双语对齐;四平台安装后均存在名为 code-guidelines 的显式调用产物且可调用;`THIRD-PARTY.md` 与规则 frontmatter 溯源完整;全部测试绿。

## Open Questions

无。会话中的全部决策已内联为需求条款,无 UNCONFIRMED 事项:技能永不创建入口约束文件,平台与文件的映射固定(Claude Code 对应 `CLAUDE.md`,Codex 与 opencode 对应 `AGENTS.md`,Gemini 对应 `GEMINI.md`),缺失时中止并提示用户自行创建,不依赖任何待验证的平台行为。
