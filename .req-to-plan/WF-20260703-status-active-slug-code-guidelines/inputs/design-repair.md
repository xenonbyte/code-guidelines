# Design

## Design Summary

`code-guidelines` 是一个零第三方依赖的 Node.js(ESM)安装器项目,以渐进式披露把三类约束送达 agent:(1)构建期从单源(per-section 片段 + 共享正文 + 模板 + 注册表)确定性生成四平台技能/命令产物;(2)`install` 以 manifest 驱动、两阶段提交(暂存后原子换入、旧自有文件清理后置)、原子写、拒绝 symlink、内容哈希保护地把四平台产物与共享资产目录 `~/.code-guidelines/`(48 规则、11 lint 基线、distill 模板与 veto 清单、`stacks.json`、`sync.mjs`、`VERSION`)落到用户机器;(3)运行期用户显式键入 `/code-guidelines` 触发技能,技能调用 `sync.mjs`(零依赖单文件,SKILL.md 内附等价手工算法)在目标仓库检测技术栈、幂等调和 `.code-guidelines/` 规则、首次布防 lint、维护入口托管块并输出状态报告;`/code-guidelines distill` 由 SKILL.md 定义的 agent 程序现场蒸馏项目约定。所有写入前先过平台前置检查;确定性(逐字节构建、零写入幂等)与安装安全(自有文件 + 哈希 + 回滚)是两条贯穿全局的硬约束。

## Current Code Evidence

Project Context Pack 显示本仓库为绿地:`languages: {}`、`package_managers: none`、`source_dirs: []`、`dependencies: 0`。工作树现有内容仅为需求与工作流元数据(`.xsk/`、`.req-to-plan/`),无任何产品源码。因此本设计从零编写、不改动既有代码;所有文件路径均为新建目标,PLAN 各任务据此标为 `create`。安装器运行时会读写用户目录 `~/.code-guidelines/`、各平台技能目录与目标仓库根——这些是运行期副作用,不落在本仓库工作树内。

## Requirements Coverage

SCOPE-IN → 设计组件映射(全部 21 项均有归属):

| SCOPE-IN | 设计组件 |
|---|---|
| SCOPE-IN-001 | DES-CLI-001 |
| SCOPE-IN-002 | DES-PLAT-001 |
| SCOPE-IN-003 | DES-INSTALL-001 |
| SCOPE-IN-004 | DES-BUILD-001 |
| SCOPE-IN-005 | DES-ASSET-001 |
| SCOPE-IN-006 | DES-SKILL-001 |
| SCOPE-IN-007 | DES-SYNC-001 |
| SCOPE-IN-008 | DES-DETECT-001 |
| SCOPE-IN-009 | DES-RECONCILE-001 |
| SCOPE-IN-010 | DES-RECONCILE-001 |
| SCOPE-IN-011 | DES-RECONCILE-001 |
| SCOPE-IN-012 | DES-LINT-001 |
| SCOPE-IN-013 | DES-SYNC-001 |
| SCOPE-IN-014 | DES-PRECHECK-001 |
| SCOPE-IN-015 | DES-PRECHECK-001 |
| SCOPE-IN-016 | DES-SYNC-001 / DES-RECONCILE-001 |
| SCOPE-IN-017 | DES-DISTILL-001 |
| SCOPE-IN-018 | DES-LIB-001 |
| SCOPE-IN-019 | DES-BASELINE-001 |
| SCOPE-IN-020 | DES-DOC-001 |
| SCOPE-IN-021 | DES-TEST-001 |

风险覆盖(risk_discovery 全部 13 项在设计中处置):

| 风险 | 处置组件 |
|---|---|
| RISK-SAFE-001 [ADDRESSED] | DES-INSTALL-001 |
| RISK-SAFE-002 [ADDRESSED] | DES-PRECHECK-001 |
| RISK-SAFE-003 [ADDRESSED] | DES-FSSAFE-001(安装 + 同步 + 入口编辑) |
| RISK-DET-001 [ADDRESSED] | DES-BUILD-001 |
| RISK-DET-002 [ADDRESSED] | DES-RECONCILE-001 |
| RISK-DET-003 [ADDRESSED] | DES-DISTILL-001 |
| RISK-DETECT-001 [ADDRESSED] | DES-DETECT-001 |
| RISK-SEL-001 [ADDRESSED] | DES-RECONCILE-001 |
| RISK-LINT-001 [ADDRESSED] | DES-LINT-001 |
| RISK-QUAL-001 [ADDRESSED] | DES-LIB-001 |
| RISK-LEGAL-001 [ADDRESSED] | DES-LIB-001 / DES-DOC-001 |
| RISK-PLAT-001 [ADDRESSED] | DES-PLAT-001 |
| RISK-PLAT-002 [ADDRESSED] | DES-PRECHECK-001 |

## Options Considered

- 实现语言:A) 纯 ESM JavaScript(选 A,见 DECISION-001);B) TypeScript + 构建步骤。A 令提交产物=源码、零转译,契合确定性与零依赖。
- 测试框架:A) Node 内置 `node:test`(选 A,见 DECISION-002);B) Vitest/Jest。A 避免第三方依赖。
- 同步引擎形态:A) 逻辑内联在安装器、目标项目需先安装本项目;B) 独立零依赖单文件 `sync.mjs` 随资产分发、技能直接调用(选 B,需求 R3 硬约束)。B 让技能在任意仓库免安装即可运行。
- 规则/基线承载:A) 每平台技能各自内嵌规则副本;B) 共享 `~/.code-guidelines/`、四平台技能仅引用(选 B,需求 R1)。B 单源、省上下文、易升级。
- lint 既有配置:A) 解析并合并;B) 仅存在性检测 + 只读缺口报告(选 B,SCOPE-OUT-002)。B 不碰用户财产。
- 无参与 distill:A) 无参顺带蒸馏;B) 严格隔离,无参零写入确定、distill 显式且 agent 驱动(选 B,需求 R4;处置 RISK-DET-003)。
- 安装提交/回滚:A) uninstall-first 直接改写 + 哈希 manifest 回滚;B) 两阶段"暂存后原子换入",提交前失败原安装原封不动(选 B,见 DECISION-006)。哈希无法还原文件内容,A 无法真正回滚。

## Chosen Design

### DES-ARCH-001 项目总体架构与目录布局
安装器仓库为 ESM Node 包,分四关注点:CLI + 安装引擎(`src/`)、单源构建(`fragments/` + `src/build/`)、共享资产单源(`assets/`,即 `~/.code-guidelines/` 的来源)、测试(`test/`)。建议布局:`bin/code-guidelines`(shebang 入口)、`src/cli.mjs`、`src/commands/*.mjs`、`src/install/{manifest,transaction,fsutil}.mjs`、`src/build/{build,registry}.mjs`、`fragments/<skill>/{purpose,triggers,behavior,output}.md` + `fragments/shared/*.md` + `fragments/templates/*`、`assets/{library/,lint/,distill/,stacks.json,sync.mjs,VERSION}`、`generated/<platform>/…`(提交的构建产物,golden)、`test/{fixtures,*.test.mjs}`、根 `README.md`/`README.zh-CN.md`/`LICENSE`/`THIRD-PARTY.md`/`package.json`。确切文件清单由 SPEC/PLAN 定稿。架构总纲覆盖全部 SCOPE-IN 项。

### DES-CLI-001 CLI 命令层
`bin/code-guidelines` → `src/cli.mjs` 手写零依赖解析:命令 `version`(`--version`/`-v`)、`help`(`--help`/`-h`)、`install [--platform <csv>]`、`uninstall [--platform <csv>]`、`status`(只读)。`--platform` 可选、逗号分隔、默认全部四平台;未知平台值、重复值、未知选项、未知命令一律以非零退出码响亮失败并打印用法。`status` 读安装 manifest 并校验其形状(字段类型、必需键、平台集合合法),而非仅 `JSON.parse` 成功。不实现 `doctor`。

### DES-INSTALL-001 manifest 安装引擎
所有权为 manifest 追踪(非文件内联标记):安装 manifest(`~/.code-guidelines/install-manifest.json`,见 DECISION-005)逐条记录每个自有文件的目标路径、SHA-256 内容哈希(规范化行尾后计算)、所属技能/平台;"无标记文件"即"磁盘上存在但不在(安装/目标)manifest 记录中的路径"。所有文件系统写入遵循 DES-FSSAFE-001 的共享安全不变式。本设计将 SCOPE-IN-003 的"uninstall-first"细化为等价而更安全的"清理后置"顺序:重装对旧自有文件与不再安装技能的清理照旧完整,只是在新集提交后执行(见 DECISION-006),以换取可行回滚;SCOPE-IN-003 的其余保证(拒绝覆盖用户改动、回滚)不变。`install` 采用两阶段提交(见 DECISION-006):(1) 预检并暂存——对每个将写文件,若磁盘现存内容哈希 ≠ manifest 记录(用户改过)或为无标记文件,则中止并报告冲突、零改动;通过后把全部新文件写入临时暂存位置;(2) 提交——以原子 rename 换入新集,仅在新集全部就位后才移除本次不再安装的旧自有文件。任一步在提交前失败即丢弃暂存、保留原安装原封不动("回滚到操作前状态"承诺覆盖提交前失败;提交为逐文件原子 rename,进程若在提交中途中断则由 install-manifest 与下次 `install` 重跑幂等收敛到目标集——可重入恢复,非跨多文件的单一原子)。`uninstall` 仅移除 manifest 记录的自有文件,最后移除 `install-manifest.json` 自身与随之变空的 `~/.code-guidelines/`。处置 RISK-SAFE-001。

### DES-FSSAFE-001 共享文件系统安全不变式
一条贯穿安装引擎、`sync.mjs` 目标落盘与入口文档编辑的共享不变式:每次写入前对目标路径及其各级父目录 `lstat`,任一为 symlink 即拒绝并报告(绝不跟随);路径规范化后必须落在本操作的允许根内(安装:平台技能目录 / `~/.code-guidelines/`;同步:目标仓库根下 `.code-guidelines/`、根级脚手架配置、根级入口文档),越界即拒绝;写入一律"临时文件 + 原子 rename"。入口文档编辑同样先 `lstat` 该文件本身。据此 `sync.mjs`(DES-SYNC-001 / DES-RECONCILE-001)、入口托管块(DES-PRECHECK-001)与安装引擎(DES-INSTALL-001)共享同一安全模型。处置 RISK-SAFE-003。

### DES-BUILD-001 单源确定性构建
`src/build/build.mjs` 从 per-section 片段(purpose/triggers/behavior/output)+ 共享正文 + 模板 + 技能注册表(`src/build/registry.mjs` 列出技能与各平台参数)组合出每平台产物,写入 `generated/`。确定性硬约束:稳定排序(注册表显式顺序、键排序)、固定 `\n` 行尾、无时间戳/随机数/locale 依赖。测试断言 `generated/` 与即时构建逐字节一致(自符合性);golden snapshot 对每技能产物比对并掩蔽共享正文段以降噪。处置 RISK-DET-001。

### DES-PLAT-001 四平台适配
四平台产物在构建期各自烙入平台标识(写入产物文本 / 命令定义),运行时技能体以 `--platform <name>` 传给 `sync.mjs`,不做环境嗅探。形态:Claude Code / Codex / Gemini 采用各自技能形态(SKILL.md 或等价技能定义 + 引用文件),opencode 采用命令文件形态,携带技能正文与该平台参数占位符。每平台安装后均存在名为 `code-guidelines` 的可显式调用产物(终验点)。各平台确切安装路径与产物文件形态由 SPEC 依据平台当前官方文档(Context7)定稿。处置 RISK-PLAT-001。

### DES-ASSET-001 共享资产目录
`assets/` 为单源,`install` 原样写到 `~/.code-guidelines/`:`library/`(48 规则)、`lint/`(11 基线,按语言子目录)、`distill/`(`template.md` + `veto-checklist.md`)、`stacks.json`、`sync.mjs`、`VERSION`。全部纳入安装 manifest,`uninstall` 一并移除。四平台技能文本只引用该目录路径,不各自复制规则/基线。

### DES-SYNC-001 sync.mjs 同步引擎
`assets/sync.mjs` 为零依赖单文件 Node 脚本,随资产分发、被技能直接调用;管线:平台前置检查(DES-PRECHECK-001)→ 检测(DES-DETECT-001)→ 选择+调和(DES-RECONCILE-001)→ lint 首次布防(DES-LINT-001)→ 状态报告。支持 `--platform <name>`、`--dry-run`(只报告不写)、`--json`(机器可读)、`--relint <工具名>`(见 DES-LINT-001)。目标仓库落盘 `.code-guidelines/`:规则文件 + `manifest.json`(逐文件来源版本与内容哈希、lint 布防记录、conventions 哈希与蒸馏日期)。状态报告:本次增/删/升级/跳过清单、lint 布防与缺口详情、`project-conventions.md` 存在性与蒸馏日期(事实陈述,不判过期)。所有目标落盘遵循 DES-FSSAFE-001。SKILL.md 内写明与 `sync.mjs` 等价的确定性手工算法作为无 node 兜底;`sync.mjs` 面向未知目标环境采用保守 Node 基线(精确基线与触发手工兜底的条件由 SPEC 定稿)。

### DES-DETECT-001 检测子系统与 stacks.json schema
`sync.mjs` 读 `stacks.json` 注册表(每条目:`id`、`category`(9 类之一:核心/语言/前端/移动/后端/数据/测试/DevOps/横切;guardrails-core 为 `核心`、恒选且不依赖谓词)、`specificity`、四类谓词、`rules`(规则文件名)、`lint`(基线键,可空)、可选 `tags`/`requiresTags`)。四类谓词:指定文件存在、`package.json` 依赖名精确匹配、源文件扩展名计数阈值(阈值逐条目声明)、标签依赖(以其他栈检出为条件,供横切规则,如任一前端框架→a11y)。monorepo 全仓聚合扫描,排除 `node_modules`/`vendor`/`dist`/`build`/`.git`;规则只装仓库根。全部检测行为由按栈 fixture 金样钉死。处置 RISK-DETECT-001。

### DES-RECONCILE-001 选择、全量调和与零写入
选择是检测输出的纯确定性函数。9 类映射到三特异度层:框架层={前端,移动,后端}、语言层={语言}、领域层={数据,测试,DevOps,横切};核心(guardrails-core)恒选且置顶、不参与截断。保留优先级:核心 > 框架层 > 语言层 > 领域层,层内平手按 `stacks.json` 注册表显式顺序稳定决胜。上限 12 个规则文件(含恒选核心 1 个);超限时按上述总序从最低优先级截断,被截断项在报告显式列出。全量调和(仅作用于 manifest 记录的规则与 lint 文件):期望集对比已装集,新增缺失项、移除不再匹配且哈希与 manifest 一致项、升级库中新版且哈希一致项;哈希不符=用户覆盖,跳过并报告,永不静默覆盖;`project-conventions.md` 不入 V1 期望集、仅由 distill 管理。零写入:期望态与现状一致(逐文件哈希一致、集合一致)时不写任何文件、不改 mtime,输出"已是最新,无变更"。处置 RISK-SEL-001、RISK-DET-002。

### DES-LINT-001 lint 首次布防子系统
对每个检出栈的关联基线,仅当三条件同时满足才写脚手架配置:a) 检出该栈;b) 项目不存在该工具的任何配置(存在性探测覆盖常见文件名与 `package.json` 字段);c) 目标 `manifest.json` 无该工具布防记录(at-most-once)。依赖永不自动安装,报告打印精确安装命令。用户删除脚手架=主动退出:不复活、报告标注;同一会话内用户确认后,agent 以 `sync.mjs --relint <工具名>` 清除标记并重新布防(属本次显式调用分支,不违反 R2)。未改动脚手架(哈希匹配 manifest)随版本升级;改动过的视为用户财产永久跳过。已有配置的工具分毫不动,仅在报告给出只读推荐清单与建议片段。处置 RISK-LINT-001。

### DES-PRECHECK-001 平台前置检查与入口托管块
固定映射:Claude Code→`CLAUDE.md`,Codex 与 opencode→`AGENTS.md`,Gemini→`GEMINI.md`(四平台三文件);平台来自烙入的 `--platform`。任何写入前,若当前平台映射文件不在仓库根:立即中止、零写入,提示"当前平台(<平台名>)无约束文件 <文件名>,请先创建该文件后重新执行 /code-guidelines";技能任何情况下都不创建入口约束文件。检查通过后,对仓库根已存在的 `AGENTS.md`/`CLAUDE.md`/`GEMINI.md` 逐一维护同一 `<!-- code-guidelines:begin -->` … `<!-- code-guidelines:end -->` 块(有几个维护几个、不新建):≤25 行(≤3 行说明 + 每规则一行触发条件式指针,`project-conventions.md` 指针恒排第一);块内整体重生成、块外一字不动;仅当块内容变化才写文件。遇畸形/重复/孤立(有 begin 无 end、多组标记、嵌套)的托管标记时:中止、零写入、报告,绝不猜测改写。入口文档读写遵循 DES-FSSAFE-001(先 `lstat` 该文件)。处置 RISK-SAFE-002、RISK-PLAT-002。

### DES-DISTILL-001 distill 模式
`/code-guidelines distill`:先过平台前置检查(缺文件同样中止)。程序由 SKILL.md 定义(agent 驱动、非脚本):按检出栈抽样源文件(每栈≥10,优先近期修改与被引用较多,不足则全量),提炼命名/目录组织/错误处理/技术选型/测试模式。产出 `.code-guidelines/project-conventions.md`:固定模板(来自 `~/.code-guidelines/distill/template.md`)、guardrails 措辞、≤80 行、每条约定引用≥2 处仓库内文件路径作证据、无证据条目与通用最佳实践一律丢弃(逐条过 `veto-checklist.md`)。`manifest.json` 记录内容哈希与蒸馏日期;重蒸馏哈希不符(用户改过)则拒绝覆盖并输出新旧对比报告由用户选择。用户审阅后若接受新蒸馏,经 `/code-guidelines distill --force` 显式覆盖(或手动删除 `project-conventions.md` 后重跑),二者皆属本次显式调用内的分支。永不并入无参调用;无参调用只报告 conventions 状态。处置 RISK-DET-003。

### DES-LIB-001 规则库(48)与蒸馏纪律
`assets/library/` 48 个纯 `.md` 规则(9 类:核心1/语言12/前端9/移动4/后端9/数据3/测试3/DevOps4/横切3),一次性全量蒸馏入库。每文件固定模板(硬约束/禁止项在前、生态惯用法在后)、≤100 行、正文英文、frontmatter `name`/`description`/`appliesTo`(globs)/`stacks`(检测标签)/`source`(上游仓库路径+commit 或 `original`)。蒸馏纪律:剥除人设开场白、作者私有路径、项目私货;已被 11 套 lint 基线强制的格式类约束外移至基线、不进散文;基线未覆盖的机器可查约束(如 Dockerfile/Terraform)可留散文。逐文件过 veto 清单(模板段落顺序、无私货、行数上限、frontmatter 完整、无与基线重复的约束),不过闸不入库。来源:awesome-cursorrules(CC0)主、awesome-copilot(MIT)辅、皆无合格素材则原创 `source: original`。处置 RISK-QUAL-001、RISK-LEGAL-001。

### DES-BASELINE-001 lint 基线(11)
`assets/lint/<语言>/` 11 套:JS/TS(ESLint flat config + Prettier + 严格 tsconfig;React/Vue 等框架插件作为检出对应框架时的条件附加)、Python(ruff+mypy)、Go(golangci-lint)、Rust(clippy+rustfmt)、Java(Checkstyle)、Kotlin(ktlint+detekt)、Swift(SwiftLint)、C#(`.editorconfig`+Roslyn 严格级别)、PHP(PHP-CS-Fixer+PHPStan)、Ruby(RuboCop)、C++(clang-format+clang-tidy)。`stacks.json` 条目以 `lint` 键关联基线;每套附元数据说明其强制了哪些约束(与规则散文的分工边界),供 DES-LIB-001 判定"重复即外移"。

### DES-SKILL-001 SKILL.md 结构与触发守卫
技能 frontmatter `description` 写为负向守卫:"Explicit-invocation only: run only when the user types /code-guidelines. Never invoke from intent, keywords, or as a side effect of coding tasks."。正文刻意不设"意图触发线索 / 何时使用"区(与常规技能写法的刻意偏离,README 说明原因);正文含:无参三动作流程、等价手工算法(无 node 兜底)、distill agent 程序、平台前置检查文案。技能永不建议配置 hook 自动化。结构校验测试:description 含显式触发禁令、正文无意图触发线索区。落实 SCOPE-IN-006。

### DES-DOC-001 文档与许可
`README.md`(英)+ `README.zh-CN.md`(中)标题结构一致,内容由钉住测试保证;必含"How to use / 怎么使用"(安装、两种调用、输出解读)与"When to use / 什么时候使用"(时机表:无参日常同步、栈变化后重跑;distill 存量项目做一次、大重构后手动刷新;lint 布防在无参内自动完成);说明目标项目生成物(`.code-guidelines/`、入口托管块、脚手架 lint 配置)含义;说明 R2 刻意偏离与 distill 依赖 agent 的残余风险。`LICENSE`(MIT)+ `THIRD-PARTY.md`(上游许可 + 逐条溯源约定说明)。处置 RISK-LEGAL-001(文档侧)。

### DES-TEST-001 测试架构
`node:test` + `node:assert`,`test/fixtures/` 承载按栈/monorepo/空白/既有配置/用户改动等场景。覆盖 R8 全量:安装器(命令解析、install/uninstall、两阶段提交重装清理(提交后清理旧自有文件)、事务回滚、用户改动拒绝、symlink 拒绝、golden snapshot、README 双语标题对齐+内容钉住、自符合性);同步(fixture 检测金样、幂等二跑零写入、用户改动保护、托管块再生成+块外不动、12 上限+9 类特异度总序截断、monorepo 聚合、目标侧 symlink 拒绝、畸形托管标记中止且零写入);平台前置检查(四映射、缺当前平台文件中止+零写入+提示含平台名与文件名、他平台文件存在但当前缺失仍中止、通过后只写已存在文件从不新建);lint(空白首跑布防、二跑零写入、删除不复活、既有配置不动、未改动升级/改动跳过);规则库结构(恰 48、frontmatter 完整、行数、模板段落顺序、`source` 可解析);distill(模板与 veto 存在、manifest 记录与覆盖保护);SKILL.md 结构。agent 产出质量不可机器测,以 README 残余风险声明兜底。

## Decision Requests

### DECISION-001 实现语言与运行时
Question: 安装器与构建/测试代码用什么语言与 Node 基线?
Options: A) 纯 ESM JavaScript(`.mjs`),Node ≥ 20 LTS,无转译 / B) TypeScript + 构建步骤
Selected: A
Rationale: 提交产物即源码、无构建/转译层,最契合"确定性构建 + 零依赖"与 `sync.mjs` 的 JS 形态,降低自符合性测试复杂度;Node ≥ 20 使 `node:test` 稳定可用。
Status: selected

### DECISION-002 测试框架
Question: 用哪种测试框架?
Options: A) Node 内置 `node:test` + `node:assert` / B) Vitest 或 Jest
Selected: A
Rationale: 零第三方依赖;golden snapshot、自符合性、fixture 断言只需文件读写与相等断言,内置能力足够。
Status: selected

### DECISION-003 CLI 参数解析
Question: 是否引入 arg-parse 库?
Options: A) 手写零依赖解析 / B) commander 或 yargs
Selected: A
Rationale: 五命令加单个 `--platform` 选项面积小;"未知选项/重复值响亮失败"与 `status` 形状校验需精确控制,手写更直接且免依赖。
Status: selected

### DECISION-004 内容哈希算法
Question: 安装安全与调和用什么哈希?
Options: A) SHA-256(`node:crypto`),对规范化行尾后的内容 / B) 其他摘要
Selected: A
Rationale: 内置、稳定、抗碰撞足够;规范化行尾避免跨平台行尾差异误判为用户改动。
Status: selected

### DECISION-005 两级 manifest 布局
Question: 安装侧与目标项目侧的 manifest 如何组织?
Options: A) 两级(安装 manifest 于 `~/.code-guidelines/install-manifest.json`,目标项目 manifest 于 `<repo>/.code-guidelines/manifest.json`) / B) 单一 manifest
Selected: A
Rationale: 安装(用户机器全局)与同步(每目标仓库)的关注点、生命周期与所有权不同,分离后各自哈希追踪清晰,避免跨仓库耦合。
Status: selected

### DECISION-006 安装提交与回滚策略
Question: 重装/升级如何保证"失败不留半成品"?哈希 manifest 无法还原被覆盖内容。
Options: A) uninstall-first 直接改写,失败时依 manifest 尝试回滚 / B) 两阶段提交:先把新集全部暂存(temp),校验通过后原子 rename 换入,再移除不再安装的旧自有文件;提交前任何失败即丢弃暂存、原安装原封不动
Selected: B
Rationale: SHA-256 无法重建文件内容、旧版本也未保留,A 在覆盖后失败即成半毁状态;B 在提交前从不删除或覆盖旧自有文件,故失败即回到操作前状态,且用户改动仍由预检哈希不符中止保护。
Status: selected

## Rollback

- 开发期:项目为绿地,任何阶段可用 git 回退;构建产物在 `generated/`,由自符合性测试守护、可重生成。
- 安装操作:`install` 为两阶段提交(DECISION-006)——预检 + 全量暂存,提交前失败即丢弃暂存、原安装原封不动(从不先删旧文件);提交为原子 rename,新集就位后才清理旧自有文件;`uninstall` 仅移除自有文件、最后移除 install-manifest 与空资产根,逆转安装。
- 目标项目同步:仅触碰自有规则/lint 文件与托管块;误装可 `uninstall` 或删除 `.code-guidelines/` 与托管块;用户改动过的文件永不被本工具动过,无需回滚。
- lint 布防:写入的脚手架配置纳入 manifest;不满意可直接删除(被视为主动退出、不复活)。

## Observability

- 状态报告为主要可观测面:本次增/删/升级/跳过(含用户覆盖跳过项)清单、lint 布防与缺口详情(含精确安装命令)、`project-conventions.md` 存在性与蒸馏日期。
- `--dry-run`:计算并报告全部拟改动而不写盘,供预演。
- `--json`:机器可读输出,便于 agent 解析与断言。
- 退出码:成功、前置检查中止、冲突(用户改动)、用法错误分别以不同非零码区分。
- 无遥测、无外呼:本地工具,不上报任何数据。
- `status`:只读汇报安装 manifest 形状与已装技能/资产/平台。

## SPEC Handoff

SPEC 阶段须据本设计给出精确契约(括注对应 DES 与 SCOPE-IN):
- CLI 每命令的入参、退出码、错误文案与用法(DES-CLI-001 / SCOPE-IN-001)。
- 安装 manifest 与目标 `.code-guidelines/manifest.json` 的 JSON schema、字段与哈希规范(DES-INSTALL-001 / DES-SYNC-001 / SCOPE-IN-003、016)。
- `stacks.json` 完整 schema、48 栈条目与逐条阈值/谓词/`lint` 键(DES-DETECT-001 / SCOPE-IN-008)。
- `sync.mjs` 管线各步的确定性算法及其在 SKILL.md 的等价手工描述,含零写入判定与状态报告字段(DES-SYNC-001 / DES-RECONCILE-001 / SCOPE-IN-007、010、011、013)。
- 平台前置检查文案、固定映射与托管块格式(≤25 行、指针语法、conventions 置顶)(DES-PRECHECK-001 / SCOPE-IN-014、015)。
- 四平台产物文件形态、烙入方式与各平台确切安装路径——须依据各平台当前官方文档(Context7)核实(DES-PLAT-001 / SCOPE-IN-002)。
- lint 三条件门、`--relint` 语义、升级/跳过判定与 11 套基线的元数据字段(DES-LINT-001 / DES-BASELINE-001 / SCOPE-IN-012、019)。
- 规则文件模板、frontmatter schema、veto 清单条目、distill 模板与 conventions 模板(DES-LIB-001 / DES-DISTILL-001 / SCOPE-IN-017、018)。
- README 两个必含章节的钉住内容、双语标题对齐规则与 `THIRD-PARTY.md` 结构(DES-DOC-001 / SCOPE-IN-020)。
- R8 测试矩阵到用例的映射与 fixture 清单(DES-TEST-001 / SCOPE-IN-021)。
- `sync.mjs` 的保守 Node 基线与触发无 node 手工兜底的精确条件(DES-SYNC-001 / SCOPE-IN-007)。
- 规则"升级"的版本判定机制(全局 `VERSION`、`source` commit 或内容哈希差异)与 manifest"逐文件来源版本"字段——避免 SPEC 隐式新增字段(DES-RECONCILE-001 / SCOPE-IN-010、016)。

## Trace

| This ID | Upstream | Status |
|---|---|---|
| DES-ARCH-001 | 全部 SCOPE-IN | designed |
| DES-CLI-001 | SCOPE-IN-001 | designed |
| DES-INSTALL-001 | SCOPE-IN-003 | designed |
| DES-FSSAFE-001 | SCOPE-IN-003 / 016 | designed |
| DES-BUILD-001 | SCOPE-IN-004 | designed |
| DES-PLAT-001 | SCOPE-IN-002 | designed |
| DES-ASSET-001 | SCOPE-IN-005 | designed |
| DES-SYNC-001 | SCOPE-IN-007 / 013 / 016 | designed |
| DES-DETECT-001 | SCOPE-IN-008 | designed |
| DES-RECONCILE-001 | SCOPE-IN-009 / 010 / 011 | designed |
| DES-LINT-001 | SCOPE-IN-012 | designed |
| DES-PRECHECK-001 | SCOPE-IN-014 / 015 | designed |
| DES-DISTILL-001 | SCOPE-IN-017 | designed |
| DES-LIB-001 | SCOPE-IN-018 | designed |
| DES-BASELINE-001 | SCOPE-IN-019 | designed |
| DES-SKILL-001 | SCOPE-IN-006 | designed |
| DES-DOC-001 | SCOPE-IN-020 | designed |
| DES-TEST-001 | SCOPE-IN-021 | designed |

## Upstream Summary (read-only)
# Risk Discovery

## Risks

### RISK-SAFE-001 install/uninstall 破坏用户改过的自有文件
Status: Open — mitigation planned
影响:重装或卸载若误判所有权/哈希,可能覆盖或删除用户改动过的自有文件,造成数据丢失。触发:哈希比对错误、uninstall-first 重置逻辑缺陷、回滚不完整。

### RISK-SAFE-002 托管块编辑损坏入口文档块外内容
Status: Open — mitigation planned
影响:维护 `code-guidelines:begin/end` 块时,块外内容被改动或整文件被破坏(用户 CLAUDE.md/AGENTS.md/GEMINI.md 是高价值文件)。触发:块边界解析错误、非幂等重写、begin/end 标记缺失或重复。

### RISK-SAFE-003 symlink 或路径穿越导致越界写入
Status: Open — mitigation planned
影响:安装或目标项目落盘经由 symlink 写到资产目录/仓库根之外。触发:未拒绝 symlink、未规范化路径、`~/.code-guidelines/` 或 `.code-guidelines/` 路径被替换。

### RISK-DET-001 单源构建非确定,破坏逐字节 golden snapshot
Status: Open — mitigation planned
影响:片段拼装顺序、locale、行尾、map 遍历顺序导致生成物与提交产物不一致,自符合性测试假红/假绿。触发:非稳定排序、时间戳注入、平台差异。

### RISK-DET-002 零写入/幂等被非确定性哈希或 mtime 破坏
Status: Open — mitigation planned
影响:期望态等于现状却仍写入或改 mtime,破坏"零写入"承诺与幂等测试。触发:哈希输入含易变字段、写入前未做等价判定、无谓 touch。

### RISK-DET-003 distill 的 LLM 非确定性污染无参确定性路径
Status: Open — mitigation planned
影响:distill 产物一旦并入无参调用即破坏零写入与幂等。触发:实现图省事把 conventions 纳入 V1 期望集,或让无参调用触发蒸馏。

### RISK-DETECT-001 技术栈检测误报或漏报
Status: Open — mitigation planned
影响:扩展名计数阈值、依赖名匹配、monorepo 聚合或排除目录处理不当,导致装错规则或漏装栈。触发:阈值设定不当、大小写/别名、未排除 `node_modules` 等目录。

### RISK-SEL-001 12 上限与特异度排序静默丢弃应装规则
Status: Open — mitigation planned
影响:命中超过 12 条时按 框架>语言>领域 截断,可能静默丢掉需要的规则且用户无感。触发:排序不稳定、截断无报告。

### RISK-LINT-001 lint 首次布防误触发或用户退出后复活
Status: Open — mitigation planned
影响:既有配置未被识别导致重复布防冲突;或用户删除脚手架后被再次写入(违反主动退出语义);或依赖未装导致工具报错、用户困惑。触发:配置存在性探测不全、退出标记未持久、`--relint` 分支误入无参路径。

### RISK-QUAL-001 规则蒸馏夹带私货或与 lint 基线重复
Status: Open — mitigation planned
影响:上游条目的人设开场白、作者私有路径、项目私货,或与 11 套 lint 基线重复的格式类约束进入规则库,降低信噪比。触发:veto 清单执行不严、直接照搬上游。

### RISK-LEGAL-001 上游许可署名与逐条溯源不完整或失真
Status: Open — mitigation planned
影响:CC0/MIT 素材未正确署名,或 `source` frontmatter 与 `THIRD-PARTY.md` 溯源缺失/错标(尤其 `source: original` 误标),带来合规风险。触发:溯源手工维护遗漏、原创判定草率。

### RISK-PLAT-001 某平台产物实际不可被显式调用或 opencode 形态偏差
Status: Open — mitigation planned
影响:四平台之一安装后 `/code-guidelines` 不可调用,或 opencode 命令文件形态/参数占位符不符该平台约定。触发:对平台技能/命令契约理解有误、构建模板漏配平台参数。

### RISK-PLAT-002 平台到入口文件映射错误或前置检查缺位导致误写
Status: Open — mitigation planned
影响:映射错(如 Codex 写到 CLAUDE.md)或前置检查缺位,在缺文件时仍写入,或创建了本不应创建的入口文件。触发:映射硬编码错误、前置检查未在所有写入前执行。

## Boundaries

- 规则仅安装到目标仓库根,不递归到子目录(monorepo 亦只在根)。
- 仅操作带所有权标记且内容哈希匹配的自有文件;任何用户改动过或无标记的文件视为不可侵犯。
- 入口文档只在 `code-guidelines:begin/end` 托管块内改动,块外一字不动;技能任何情况下都不创建入口约束文件(SCOPE-OUT-006)。
- lint 仅在"检出栈 / 无既有配置 / manifest 无布防记录"三条件同时满足时首次布防;永不自动安装依赖(SCOPE-OUT-003);不解析或合并用户既有 lint 配置(SCOPE-OUT-002)。
- 唯一触发为显式 `/code-guidelines`;无意图、关键字、hook、副作用触发(SCOPE-OUT-001)。
- distill(LLM 非确定性)产物永不并入无参零写入路径;无参调用只报告其状态。
- 不修改目标项目的 CI 配置(SCOPE-OUT-005)。
- 平台标识在构建时烙入并以 `--platform` 显式传入,运行时不嗅探环境。
- 规则库首批固定为 48 栈,不镜像上游全部 257 条,亦不覆盖 48 栈之外的小众栈(SCOPE-OUT-004)。
- 安装器不发布到包 registry,仅以本地 Node CLI 形态运行(SCOPE-OUT-007)。

## Scope Overflow Risks

- 诱惑:为"更智能"而解析或合并用户既有 lint 配置——SCOPE-OUT-002 已排除,只允许存在性检测与只读缺口报告。
- 诱惑:为省事自动安装 lint 依赖——SCOPE-OUT-003 已排除,只允许打印精确安装命令。
- 诱惑:因某栈缺失而临时新增第 49+ 条规则或小众栈——SCOPE-OUT-004 已排除,越界规则一律不入库。
- 诱惑:在缺入口文件时"顺手"创建 `CLAUDE.md`/`AGENTS.md`/`GEMINI.md`——SCOPE-OUT-006 已排除,只提示用户自行创建。
- 诱惑:为提升命中率加入意图、关键字或 hook 触发——SCOPE-OUT-001 已排除,守卫是负向的。
- 诱惑:为"体验"改动目标项目 CI——SCOPE-OUT-005 已排除。
- 诱惑:为便于分发把安装器发布到 npm——SCOPE-OUT-007 已排除,本交付只做本地 CLI。

## Mitigations

- RISK-SAFE-001:所有权标记 + 内容哈希双重判定;uninstall-first 重置与事务回滚有专门测试;用户改动拒绝覆盖用例(R8 安装器)。
- RISK-SAFE-002:托管块整体重生成 + 块外不动测试;begin/end 标记幂等解析;仅当块内容变化才写文件。
- RISK-SAFE-003:显式拒绝 symlink(安装器与目标落盘),路径规范化并限定在资产目录/仓库根内;symlink 拒绝用例。
- RISK-DET-001:确定性构建(稳定排序、固定行尾、无时间戳);golden snapshot 与自符合性测试断言逐字节一致。
- RISK-DET-002:写入前做期望态等于现状的等价判定,命中即零写入且不 touch;幂等测试(连跑两次第二次断言零写入)。
- RISK-DET-003:conventions 排除于 V1 期望集,由 distill 独占管理;无参调用只报告 distill 状态;测试断言无参路径不触发蒸馏。
- RISK-DETECT-001:阈值逐条声明于 `stacks.json`;按栈 fixture 检测金样 + monorepo 聚合 + 排除目录用例。
- RISK-SEL-001:特异度稳定排序 + 12 上限;超限截断在状态报告显式列出被跳过项;排序与上限测试。
- RISK-LINT-001:三条件门 + at-most-once manifest 记录;删除即退出且不复活(有测试);`--relint` 仅在同会话显式确认分支、不入无参路径;依赖只打印命令。
- RISK-QUAL-001:逐文件过 veto 清单(段落顺序、无私货、行数、frontmatter 完整、无与基线重复的约束),不过闸不入库;规则库结构校验测试。
- RISK-LEGAL-001:`source` frontmatter 逐条记录上游路径+commit 或 `original`;`THIRD-PARTY.md` 汇总许可;`source` 可解析性纳入结构测试。
- RISK-PLAT-001:每平台一条"安装后存在可显式调用产物"的终验;单源构建按平台注入参数占位符;opencode 命令文件形态单独产物。
- RISK-PLAT-002:固定映射钉死 + 平台前置检查在所有写入前执行;四映射各一用例 + 缺当前平台文件中止且零写入 + 通过后只写已存在文件从不新建。

## Trace

| This ID | Upstream | Status |
|---|---|---|
| RISK-SAFE-001 | SCOPE-IN-003 | mitigated |
| RISK-SAFE-002 | SCOPE-IN-015 | mitigated |
| RISK-SAFE-003 | SCOPE-IN-003 / SCOPE-IN-016 | mitigated |
| RISK-DET-001 | SCOPE-IN-004 | mitigated |
| RISK-DET-002 | SCOPE-IN-011 | mitigated |
| RISK-DET-003 | SCOPE-IN-010 / SCOPE-IN-017 | mitigated |
| RISK-DETECT-001 | SCOPE-IN-008 | mitigated |
| RISK-SEL-001 | SCOPE-IN-009 | mitigated |
| RISK-LINT-001 | SCOPE-IN-012 | mitigated |
| RISK-QUAL-001 | SCOPE-IN-018 | mitigated |
| RISK-LEGAL-001 | SCOPE-IN-018 / SCOPE-IN-020 | mitigated |
| RISK-PLAT-001 | SCOPE-IN-002 | mitigated |
| RISK-PLAT-002 | SCOPE-IN-014 | mitigated |
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