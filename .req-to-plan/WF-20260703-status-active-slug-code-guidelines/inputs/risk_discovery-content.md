# Risk Discovery

## Risks

### RISK-SAFE-001 install/uninstall 破坏用户改过的自有文件
Status: mitigated
影响:重装或卸载若误判所有权/哈希,可能覆盖或删除用户改动过的自有文件,造成数据丢失。触发:哈希比对错误、uninstall-first 重置逻辑缺陷、回滚不完整。

### RISK-SAFE-002 托管块编辑损坏入口文档块外内容
Status: mitigated
影响:维护 `code-guidelines:begin/end` 块时,块外内容被改动或整文件被破坏(用户 CLAUDE.md/AGENTS.md/GEMINI.md 是高价值文件)。触发:块边界解析错误、非幂等重写、begin/end 标记缺失或重复。

### RISK-SAFE-003 symlink 或路径穿越导致越界写入
Status: mitigated
影响:安装或目标项目落盘经由 symlink 写到资产目录/仓库根之外。触发:未拒绝 symlink、未规范化路径、`~/.code-guidelines/` 或 `.code-guidelines/` 路径被替换。

### RISK-DET-001 单源构建非确定,破坏逐字节 golden snapshot
Status: mitigated
影响:片段拼装顺序、locale、行尾、map 遍历顺序导致生成物与提交产物不一致,自符合性测试假红/假绿。触发:非稳定排序、时间戳注入、平台差异。

### RISK-DET-002 零写入/幂等被非确定性哈希或 mtime 破坏
Status: mitigated
影响:期望态等于现状却仍写入或改 mtime,破坏"零写入"承诺与幂等测试。触发:哈希输入含易变字段、写入前未做等价判定、无谓 touch。

### RISK-DET-003 distill 的 LLM 非确定性污染无参确定性路径
Status: mitigated
影响:distill 产物一旦并入无参调用即破坏零写入与幂等。触发:实现图省事把 conventions 纳入 V1 期望集,或让无参调用触发蒸馏。

### RISK-DETECT-001 技术栈检测误报或漏报
Status: mitigated
影响:扩展名计数阈值、依赖名匹配、monorepo 聚合或排除目录处理不当,导致装错规则或漏装栈。触发:阈值设定不当、大小写/别名、未排除 `node_modules` 等目录。

### RISK-SEL-001 12 上限与特异度排序静默丢弃应装规则
Status: mitigated
影响:命中超过 12 条时按 框架>语言>领域 截断,可能静默丢掉需要的规则且用户无感。触发:排序不稳定、截断无报告。

### RISK-LINT-001 lint 首次布防误触发或用户退出后复活
Status: mitigated
影响:既有配置未被识别导致重复布防冲突;或用户删除脚手架后被再次写入(违反主动退出语义);或依赖未装导致工具报错、用户困惑。触发:配置存在性探测不全、退出标记未持久、`--relint` 分支误入无参路径。

### RISK-QUAL-001 规则蒸馏夹带私货或与 lint 基线重复
Status: mitigated
影响:上游条目的人设开场白、作者私有路径、项目私货,或与 11 套 lint 基线重复的格式类约束进入规则库,降低信噪比。触发:veto 清单执行不严、直接照搬上游。

### RISK-LEGAL-001 上游许可署名与逐条溯源不完整或失真
Status: mitigated
影响:CC0/MIT 素材未正确署名,或 `source` frontmatter 与 `THIRD-PARTY.md` 溯源缺失/错标(尤其 `source: original` 误标),带来合规风险。触发:溯源手工维护遗漏、原创判定草率。

### RISK-PLAT-001 某平台产物实际不可被显式调用或 opencode 形态偏差
Status: mitigated
影响:四平台之一安装后 `/code-guidelines` 不可调用,或 opencode 命令文件形态/参数占位符不符该平台约定。触发:对平台技能/命令契约理解有误、构建模板漏配平台参数。

### RISK-PLAT-002 平台到入口文件映射错误或前置检查缺位导致误写
Status: mitigated
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

## Upstream Summary (read-only)
# Requirement Brief

## Goal

交付独立品牌 `code-guidelines` 的 agent 技能安装器项目:一次安装即在 Claude Code、Codex、opencode、Gemini 四平台提供唯一显式技能 `/code-guidelines`;在任意目标项目中检测技术栈,幂等维护 `.code-guidelines/` 规则目录、lint 基线首次布防与入口文档托管索引;`distill` 子命令从目标仓库现场蒸馏项目专属约定。以"渐进式披露 + 负向硬约束优先 + 机器强制优先"把三类约束(精选蒸馏的通用规则、机器强制的 lint 守卫、项目自有约定)送达 agent。

## In-Scope

- SCOPE-IN-001 — CLI bin `code-guidelines` 五命令(`version`/`--version`/`-v`、`help`/`--help`/`-h`、`install [--platform <list>]`、`uninstall [--platform <list>]`、`status` 只读);`--platform` 可选、逗号分隔、默认全部平台,未知值与重复值报错,未知选项响亮失败;`status` 校验 manifest 形状而非仅解析成功;不实现 `doctor`。(R1)
- SCOPE-IN-002 — 四平台适配(Claude Code / Codex / opencode / Gemini),每平台安装后技能均可被显式调用;opencode 采用命令文件形态并携带技能正文与该平台参数占位符;平台标识在构建时烙入产物,运行时以 `--platform <name>` 传给 `sync.mjs`,不做运行时环境嗅探。(R1)
- SCOPE-IN-003 — manifest 安装安全:仅移除自有文件、所有权标记、原子写、拒绝 symlink、内容哈希改动检测、无标记哈希识别;`install` 为 uninstall-first(重装先重置旧自有文件、清理不再安装的技能);拒绝覆盖用户改过的自有文件并回滚。(R1)
- SCOPE-IN-004 — 单源确定性构建:技能由 per-section 片段(purpose/triggers/behavior/output)+ 共享正文 + 模板组合生成,注册表列出技能;提交产物与生成器输出逐字节一致由测试强制;golden snapshot 掩蔽共享正文。(R1)
- SCOPE-IN-005 — 共享资产目录 `~/.code-guidelines/`(`library/` 48 规则、`lint/` 11 基线、`distill/` 模板与 veto 清单、`stacks.json`、`sync.mjs`、`VERSION`):install 写入并纳入 manifest、uninstall 一并移除,四平台技能文本引用该目录而不各自复制。(R1)
- SCOPE-IN-006 — 显式调用唯一触发:SKILL.md frontmatter `description` 写为负向守卫("Explicit-invocation only … Never invoke from intent, keywords, or as a side effect of coding tasks"),正文刻意不设意图触发线索区,技能永不建议配置 hook 自动化。(R2)
- SCOPE-IN-007 — 无参主路径 `sync.mjs`(零依赖单文件 Node 脚本,支持 `--dry-run` 与 `--json`);SKILL.md 内写明与之等价的确定性手工算法作为无 node 环境兜底。(R3)
- SCOPE-IN-008 — 检测:读 `stacks.json` 注册表,四类谓词(指定文件存在、`package.json` 依赖名精确匹配、源文件扩展名计数阈值、标签依赖);monorepo 全仓聚合并排除 `node_modules`/`vendor`/`dist`/`build`/`.git`,规则只装仓库根;全部检测行为由 fixture 金样钉死。(R3)
- SCOPE-IN-009 — 选择:特异度排序 框架 > 语言 > 领域,规则文件上限 12(含恒选 guardrails-core)。(R3)
- SCOPE-IN-010 — 全量 reconcile:期望集对比 manifest 已装集,新增缺失项、移除不再匹配且内容哈希一致项、升级库中新版且哈希一致项;哈希不符视为用户覆盖并跳过+报告,永不静默覆盖;`project-conventions.md` 不参与 V1 期望集计算,仅由 distill 管理。(R3)
- SCOPE-IN-011 — 零写入:期望态与现状完全一致时不写任何文件、不改任何 mtime,输出"已是最新,无变更"。(R3)
- SCOPE-IN-012 — lint 首次布防:同时满足(检出栈 / 项目无该工具任何配置 / manifest 无布防记录)才写入,at-most-once;永不自动装依赖,报告打印精确安装命令;用户删除脚手架视为退出且不复活(状态报告标注,同一会话内确认后 `sync.mjs --relint <工具名>` 清标记重布防);未改动脚手架随版本升级、改动过的视为用户财产永久跳过;已有配置的工具分毫不动,仅只读推荐规则清单与建议片段。(R3)
- SCOPE-IN-013 — 状态报告:本次动作摘要(增/删/升级/跳过清单)、lint 布防与缺口详情、`project-conventions.md` 存在性与蒸馏日期(事实陈述,不作过期判断)。(R3)
- SCOPE-IN-014 — 平台前置检查:固定映射(Claude Code→`CLAUDE.md`,Codex 与 opencode→`AGENTS.md`,Gemini→`GEMINI.md`),平台来自烙入的 `--platform`;任何写入前若当前平台映射文件不在仓库根则立即中止、零写入并给出含平台名与目标文件名的提示;技能任何情况下都不创建入口约束文件。(R3)
- SCOPE-IN-015 — 入口文档托管块:对已存在的 `AGENTS.md`/`CLAUDE.md`/`GEMINI.md` 逐一维护同一 `<!-- code-guidelines:begin -->` … `<!-- code-guidelines:end -->` 块(有几个维护几个、不新建),≤25 行(≤3 行说明 + 每规则一行触发条件式指针,`project-conventions.md` 指针恒排第一),块内整体重生成、块外一字不动,仅当块内容变化才写文件。(R3)
- SCOPE-IN-016 — 目标项目落盘:`.code-guidelines/` 内规则文件 + `manifest.json`(逐文件记录来源版本与内容哈希、lint 布防记录、conventions 哈希与蒸馏日期)。(R3)
- SCOPE-IN-017 — `distill` 模式:先过平台前置检查;agent 驱动程序(SKILL.md 定义、非脚本)按检出栈抽样源文件(每栈≥10、优先近期修改与被引用较多、不足则全量),产出 `.code-guidelines/project-conventions.md`(固定模板、guardrails 措辞、≤80 行、每条约定引用≥2 处仓库内文件路径作证据、无证据条目与通用最佳实践一律丢弃);manifest 记录内容哈希与蒸馏日期,重蒸馏哈希不符则拒绝覆盖并输出新旧对比报告;永不并入无参调用。(R4)
- SCOPE-IN-018 — 规则库 48 个一次性全量蒸馏(9 类:核心1、语言12、前端9、移动4、后端9、数据3、测试3、DevOps4、横切3);每文件纯 `.md`、固定模板(硬约束在前、生态惯用法在后)、≤100 行、正文英文、frontmatter(`name`/`description`/`appliesTo`/`stacks`/`source`);蒸馏纪律(剥人设开场白与作者私有路径与项目私货、已被基线强制的格式类约束外移至基线、逐文件过 veto 清单不过闸不入库);来源 awesome-cursorrules(CC0)主、awesome-copilot(MIT)辅、皆无合格素材则原创 `source: original`。(R5)
- SCOPE-IN-019 — lint 基线 11 套(JS/TS ESLint flat+Prettier+严格 tsconfig 且框架插件为检出时条件附加;Python ruff+mypy;Go golangci-lint;Rust clippy+rustfmt;Java Checkstyle;Kotlin ktlint+detekt;Swift SwiftLint;C# `.editorconfig`+Roslyn 严格级别;PHP PHP-CS-Fixer+PHPStan;Ruby RuboCop;C++ clang-format+clang-tidy);`stacks.json` 以 `lint` 键关联,每套附元数据说明其强制的约束(与规则散文的分工边界)。(R6)
- SCOPE-IN-020 — 文档与许可:`README.md`(英)+ `README.zh-CN.md`(中)标题结构一致且内容由钉住测试保证,必含"How to use / 怎么使用"与"When to use / 什么时候使用"(含时机表),说明目标项目生成物含义、R2 刻意偏离与 distill 残余风险;`LICENSE`(MIT)+ `THIRD-PARTY.md`(上游许可与逐条溯源约定)。(R7)
- SCOPE-IN-021 — 全部可执行测试(R8):安装器(命令解析、install/uninstall、uninstall-first 重置、事务回滚、用户改动拒绝、symlink 拒绝、golden snapshot、README 双语标题对齐+内容钉住、自符合性);同步(按栈 fixture 检测金样、幂等第二次零写入、用户改动保护、托管块再生成+块外不动、12 上限+特异度排序、monorepo 聚合);平台前置检查(四映射各一、缺当前平台文件中止+零写入+提示含平台名与文件名、其余平台文件存在但当前缺失仍中止、通过后只写已存在文件从不新建);lint(空白 fixture 首跑布防、二跑零写入、删除不复活、既有配置不动、未改动升级/改动跳过);规则库结构(恰 48 文件、frontmatter 完整、行数上限、模板段落顺序、`source` 可解析);distill(模板与 veto 清单存在、manifest 记录与覆盖保护逻辑);SKILL.md 结构(description 含显式触发禁令、正文无意图触发线索区)。(R8)

## Out-of-Scope

- SCOPE-OUT-001 — hook、被动、关键字、意图触发,以及任何形式的自动触发建议。(R2)
- SCOPE-OUT-002 — 深度解析或合并用户既有 lint 配置(仅存在性检测与只读缺口报告)。
- SCOPE-OUT-003 — 自动安装依赖(仅打印精确安装命令)。
- SCOPE-OUT-004 — 镜像上游全部 257 条规则,以及首批 48 栈之外的小众技术栈。
- SCOPE-OUT-005 — 修改目标项目的 CI 配置。
- SCOPE-OUT-006 — 为目标项目创建入口约束文件(`AGENTS.md`/`CLAUDE.md`/`GEMINI.md`);缺失时仅提示用户自行创建。
- SCOPE-OUT-007 — 将安装器自身发布到包 registry(npm 等);本交付以本仓库检出的本地 Node CLI 形态运行(边界澄清,原始需求从未涉及发布)。

## Non-Goals

- 不做运行时环境嗅探:平台标识在构建时烙入并以 `--platform` 显式传递,行为完全确定。
- 不充当人工代码评审或平台原生规则系统的替代;交付的是机器/结构化守卫(guardrails),而非泛泛的正向指导。
- 不追求技术栈生态的穷尽覆盖;48 栈首批是刻意的范围选择(边界见 SCOPE-OUT-004)。
- 不做 lint 配置的管理与合并;仅在空白处首次布防,其余保持只读观察。
- 无参路径以确定性优先于完备性:LLM 非确定性产出(distill)永不并入零写入的同步路径。

## Assumptions

- 上游素材(PatrickJS/awesome-cursorrules @ CC0、github/awesome-copilot @ MIT)在一次性蒸馏期间可访问,其许可允许带署名的衍生分发;逐条溯源写入规则 frontmatter 的 `source` 与 `THIRD-PARTY.md`。
- 目标环境通常具备 Node.js 以运行 `sync.mjs`;无 node 时以 SKILL.md 内的等价确定性手工算法兜底。
- 四平台各自支持一个可被显式调用的技能/命令产物(Claude Code / Codex / Gemini 技能形态、opencode 命令文件形态);设计不依赖除"显式调用"之外的任何未验证平台运行时行为。
- 固定平台→入口文件映射(Claude Code→`CLAUDE.md`,Codex 与 opencode→`AGENTS.md`,Gemini→`GEMINI.md`)在本交付内稳定。
- 本仓库为绿地(起始工作树为空),安装器项目在此从零编写。
- 安装器以本地 Node CLI 形态从仓库检出运行(见 SCOPE-OUT-007);install/uninstall 契约不依赖任何 registry 发布路径。
- 设计依据引用 arXiv 2604.11088《Guardrails Beat Guidance》;守卫优先/负向硬约束优先的取向独立成立,不因该引用是否可核验而改变。该引用的可核验性标注为 UNCONFIRMED,且不影响任何实现决策。

## Acceptance Criteria

- AC-A(检查点 A · V1 可用):脚手架 + `stacks.json` + 48 规则入库 + `sync.mjs` + SKILL.md 无参模式(含平台前置检查)+ 对应 R8 测试全绿;跑 /xsk-skill-scaffold 审计,除品牌命名差异外全部符合。
- AC-B(检查点 B · lint):11 套基线 + 布防逻辑 + 对应测试全绿;在一个无 lint 配置样例项目人工跑通全流程(布防、按报告安装依赖、工具实际可运行)。
- AC-C(检查点 C · distill):模板 + SKILL.md 程序 + 保护逻辑 + 测试;对一个真实存量仓库人工跑 distill,逐条核验证据引用的文件路径真实存在。
- AC-FINAL(终验):README 两个必含章节齐备且双语对齐;四平台安装后均存在名为 `code-guidelines` 的显式调用产物且可调用;`THIRD-PARTY.md` 与规则 frontmatter 溯源完整;全部测试绿。
- AC-DET(确定性):提交产物与生成器输出逐字节一致,由测试断言。
- AC-IDEM(幂等):同一 fixture 连跑两次,第二次断言零文件写入。
- AC-SAFE(安装安全):重装 uninstall-first 正确重置;用户改过的自有文件被拒绝覆盖并回滚;symlink 被拒绝——均有测试覆盖。
- AC-COUNT(规则库):文件数恰为 48,且 frontmatter/行数上限/模板段落顺序/`source` 可解析等结构校验全过。

## Open Questions

- 无。会话内全部决策已内联为需求条款,无待决事项;唯一被标注 UNCONFIRMED 的是 arXiv 2604.11088 引用的可核验性(见 Assumptions),该项不影响任何实现决策。

## Sources

- `00-raw-requirement.md`——本 run 的 raw_requirement 阶段产物(R1–R8 与 Checkpoints A/B/C/终验)。
- PatrickJS/awesome-cursorrules(CC0)——规则库主素材来源。
- github/awesome-copilot(MIT)——规则库辅助素材来源。
- arXiv 2604.11088《Guardrails Beat Guidance》——设计动机(守卫优先/负向硬约束优先);可核验性 UNCONFIRMED。
- xsk-skill-scaffold 结构标准——安装器项目结构参照(检查点 A 审计基准)。

## Trace

| This ID | Upstream | Status |
|---|---|---|
| SCOPE-IN-001 | raw_requirement R1 | 计划实现 |
| SCOPE-IN-002 | raw_requirement R1 | 计划实现 |
| SCOPE-IN-003 | raw_requirement R1 | 计划实现 |
| SCOPE-IN-004 | raw_requirement R1 | 计划实现 |
| SCOPE-IN-005 | raw_requirement R1 | 计划实现 |
| SCOPE-IN-006 | raw_requirement R2 | 计划实现 |
| SCOPE-IN-007 | raw_requirement R3 | 计划实现 |
| SCOPE-IN-008 | raw_requirement R3 | 计划实现 |
| SCOPE-IN-009 | raw_requirement R3 | 计划实现 |
| SCOPE-IN-010 | raw_requirement R3 | 计划实现 |
| SCOPE-IN-011 | raw_requirement R3 | 计划实现 |
| SCOPE-IN-012 | raw_requirement R3 | 计划实现 |
| SCOPE-IN-013 | raw_requirement R3 | 计划实现 |
| SCOPE-IN-014 | raw_requirement R3 | 计划实现 |
| SCOPE-IN-015 | raw_requirement R3 | 计划实现 |
| SCOPE-IN-016 | raw_requirement R3 | 计划实现 |
| SCOPE-IN-017 | raw_requirement R4 | 计划实现 |
| SCOPE-IN-018 | raw_requirement R5 | 计划实现 |
| SCOPE-IN-019 | raw_requirement R6 | 计划实现 |
| SCOPE-IN-020 | raw_requirement R7 | 计划实现 |
| SCOPE-IN-021 | raw_requirement R8 | 计划实现 |
| SCOPE-OUT-001 | raw_requirement Out-of-scope / R2 | 排除 |
| SCOPE-OUT-002 | raw_requirement Out-of-scope | 排除 |
| SCOPE-OUT-003 | raw_requirement Out-of-scope | 排除 |
| SCOPE-OUT-004 | raw_requirement Out-of-scope | 排除 |
| SCOPE-OUT-005 | raw_requirement Out-of-scope | 排除 |
| SCOPE-OUT-006 | raw_requirement Out-of-scope | 排除 |
| SCOPE-OUT-007 | 边界澄清(原始需求未涉及) | 排除 |
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
