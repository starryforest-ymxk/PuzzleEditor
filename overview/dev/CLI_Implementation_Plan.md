# PuzzleEditor CLI 首版开发建议

日期：2026-10-08。源码核对基线：`88f649f` / `1.0.0-beta`。

**状态：C1、C2 已完成，C3–C5 待实施。** 本文将[外部 Agent 接口方案](./AI_Automation_Development_Plan.md)中的 A1/A2 拆成可交付的 C1–C5。目前已有独立 Node 只读入口及 `create/preview/apply/export`，详见 [C1 实施报告](./CLI_C1_Implementation.md)、[C2 实施报告](./CLI_C2_Implementation.md)和 [Agent 使用说明](./CLI_Agent_Usage.md)。完整 FSM/演出图命令、备用 JSON 写审批与发行仍为后续计划；实际能力以 `describe` 的 `implemented` 字段及 plan Schema 为准。

## 1. 首版目标和范围

交付可由 Codex 等外部 Agent 调用的离线 CLI：读取已有工程 → 查询局部上下文 → 创建/修改内容 → 预览/校验 → 保存新工程 → 导出运行时文件。操作使用当前 `.puzzle.json`，不另创工程格式，不调用模型。常规领域命令不依赖打开编辑窗口；备用 JSON 直接编辑必须经过可信的用户确认通道。

首版覆盖 Stage/Puzzle 层级、黑板资源、FSM、演出图及常用 Inspector 配置。只写入显式指定的新目标，目标已存在时拒绝覆盖。正在打开的编辑器内存、Undo/Redo、窗口刷新和自动保存不属于离线模式；在线桥后续独立实现。原 A1 中在线内容 epoch/单次撤销的完整验收放在 A3，首版先实现候选事务与文件交付。

首版同时开放完整 JSON 只读入口，以及最高权限的备用 JSON 直接编辑入口。常规领域命令仍优先使用，不因某个领域命令失败而自动转入 JSON 直接编辑。MCP、原地覆盖、永久删除已实现资源、任意脚本执行、跨进程持久事务日志和引擎仿真放在后续。初始交付仍必须能完成真实创建与编辑任务，不能把只读原型称为完整 CLI。这里“直接编辑 JSON”指允许外部提交完整文件候选，不等同于必须原地覆盖源文件；首版确认后保存到明确的新目标，覆盖源文件的后续选项仍须最高权限确认及工程所有权保护。

### 1.1 用户已明确的要求：assetName 必须外部指定

所有由 CLI 新建、克隆或模板实例化的资产对象，其 `assetName` 都必须由调用方明确传入。禁止从显示名称、ID、翻译结果、固定模板或命名计数器推导；字段缺失、空串、空白或非法时直接报错，不能静默补值或增加后缀避重。

| 现有带 assetName 的对象 | 外部输入要求 |
| --- | --- |
| Stage，包括工程根 Stage | 创建工程要求 `--root-asset-name`；创建 Stage 的配置要求 `assetName` |
| PuzzleNode | 创建配置要求 `assetName` |
| FSM State | 每个状态要求 `assetName`；创建 Puzzle 时连带产生的初始状态也要求显式 `initialState.assetName` |
| VariableDefinition，包括全局和 Stage/Node 局部变量 | 定义变量要求 `assetName`，按已有作用域检查名称和引用 |
| EventDefinition | 定义事件要求 `assetName` |
| ScriptDefinition 的各类别 | 声明脚本要求 `assetName` |

ProjectMeta、FSM 本体、Transition、PresentationGraph、PresentationNode 和参数绑定内的临时变量元数据目前没有该字段，不为 CLI 擅自添加文件字段。后续模型若正式增加资产类型，必须同时扩展共用输入规则、测试和帮助。

`name` 与 `assetName` 分开传递。编辑已有对象时，省略 `assetName` 表示保留；修改显示名称不重命名资产。显式修改 `assetName` 必须提供有效值，沿用共用命名、生命周期和引用规则。克隆/模板须提供每个新资产的 alias → assetName 映射，不能漏掉嵌套状态和局部变量。已有工程允许读取和诊断；旧对象缺名时不自动修复，错误基线政策也不能放过本批新增或清空的资产名。

当前 `assetName` 在文件类型中为可选字段，但 CLI 的创建契约设为必填；不因此破坏旧文件读取。格式复用 `ASSET_NAME_REGEX`，CLI 另加非空与无空白检查，不能使用把空串视为合法的 `isValidAssetName` 作为完整创建校验。C1 提供根 Stage、普通资产和 Puzzle 连带初始状态的命名输入片段；C2 已在写入契约中执行，并补齐共用局部变量命名检查；`validateNames` 以 error 报告缺名，不另维护一套格式正则。

### 1.2 用户已明确的要求：完整 JSON 可读，直接编辑须逐次人工确认

权限在共用协调服务中执行，命令描述必须返回所需级别。普通写权限不包含 `raw_json_write`，安装、启动或允许 Agent 使用 CLI 不等于授权直接编辑 JSON。

| 级别 | 能力 | 授权方式 |
| --- | --- | --- |
| `read` | 局部查询、完整 JSON 读取、校验、候选预览 | 在用户允许读取的工程范围内执行，不要求写入确认 |
| `semantic_write` | 通过领域命令创建/编辑并保存新目标 | 按普通任务授权、scope 和事务规则执行 |
| `raw_json_write`（最高权限） | 备用入口提交完整 `.puzzle.json` 候选 | 每一次实际写入前，必须由用户直接确认已展示的具体差异和目标；不提供永久允许 |

完整读取包含磁盘文件的全部字段：`fileType/editorVersion/savedAt`、完整 `project` 和存在时的 `editorState`，不能只返回运行时导出、摘要或迁移后的数据。`json read --json` 返回未经裁剪的解析对象、完整 `rawText`、源路径和原始内容指纹；原文作为无损依据，解析歧义须附诊断。`json read --raw` 输出原始 UTF-8 JSON 文本，保留空白和字段顺序，两种输出选项互斥。读取不先调用会过滤、迁移或规范化内容的导入器，也不改变文件、偏好或当前 GUI。未知字段和已有业务错误不阻断完整读取；语法损坏时结构化读取返回明确错误，`--raw` 仍可取得原文用于修复。大文件不静默截断或自动分页，工具端输出上限不代表 CLI 已返回完整内容。离线读取明确对应磁盘快照，不冒充 GUI 未保存的内存状态。

备用编辑首版接收完整候选文件，不必再设计一套通用 JSON Patch DSL。流程固定为 **完整读取 → 外部编辑候选 → `json preview` → 展示差异与诊断 → 用户直接确认 → `json apply` 事务写入 → 重读核验**。确认前准备好完整可审阅候选；原文、候选、目标或差异变化后必须重新预览和确认。普通命令缺功能、返回错误或遭用户拒绝时，都不能自动降级为该入口。

确认由受信任的审批宿主处理，首选桌面版提供的独立审阅窗口，复用 `components/shared/Dialog.tsx` 等 UI 唯一入口。无需加载/替换用户当前工程，也不增加软件内 AI 调用。审批接口只允许 CLI 发起请求和查询结果，不提供外部可调用的“批准”命令；确认结果由宿主核验窗口/请求来源后产生。Agent 不得代点批准。未来外部客户端审批只有在能验证实际人工确认来源时才接入，不能把客户端自动批准当作用户直接确认。

审批凭据绑定权限级别、规范源/目标路径、源 SHA-256、候选 SHA-256、目标预期不存在、写入方式、审阅差异及有效期；只可使用一次。CLI 可持有不透明审批句柄，不能自行签发或扩大授权。预览回执、`--yes`、`--force`、stdin 的 `y`、环境变量、计划内 `approved: true` 和 Agent 自写的审批文件都不是授权。没有可信确认通道、用户取消/拒绝、确认超时、凭据过期/重放或内容变化时不得写入，并返回 `APPROVAL_REQUIRED`、`APPROVAL_DENIED`、`APPROVAL_EXPIRED`、`APPROVAL_REPLAYED` 或冲突诊断。不能用简单 TTY 问答宣称已验证操作来自用户。

最高权限仅允许走完整 JSON 候选入口，不绕过格式、类型、引用、作用域、生命周期、允许路径及错误基线规则。需比较前后状态，防止整文件替换隐藏不合法的永久删除、状态跃迁或资产名清空；差异覆盖元数据、编辑状态和领域数据，无法识别的变更也要展示原始路径与值。确认后只写已批准的候选字节，不能再自动填默认值、改时间或分配 ID。候选需要迁移/修正时，先形成新的完整候选再审阅。

确认宿主持有一次性授权状态，在实际提交前核对指纹并消费授权；提交响应丢失时查询该请求的既有结果，不能再次写入。该小范围授权记录不等同于已实现全部领域命令的跨进程事务日志。首版采用新目标排他发布，失败保留原文件；后续原地覆盖还须列明覆盖目标、备份策略、工程占用和内容前提，拒绝绕过正在 GUI 编辑的工程。

这里的最高权限是 **CLI 接口权限**。同一系统账户下拥有任意 shell/文件写权限的工具仍可绕过 CLI 直接改文件；本机 Agent 也可能具有 UI 自动化能力。不能宣称一个确认弹窗提供了操作系统隔离。若需要阻止这类绕过，必须另设文件访问边界和独立权限的写入/审批服务；没有满足所需可信程度的确认渠道时，直接编辑入口保持拒绝执行。

## 2. 当前源码的复用与必要调整

| 现有入口 | 首版处理 |
| --- | --- |
| `utils/projectFactory.ts` | 复用 `createEmptyProject`；如预览重建需要固定时间，渐进加入可注入时间参数，GUI 默认行为保持 |
| `utils/resourceIdGenerator.ts` | 复用现有 ID 分配；按正确所属集合分配并在候选中登记本批新 ID；不得根据导入 ID 格式猜身份 |
| `utils/projectImport/` / `services/projectFiles.ts` | 复用 unknown 输入边界、迁移和 `serializeProject`；保留现有文件包装与编辑状态 |
| `utils/validation/` / `types/validation.ts` | 复用业务规则，在规则产生处补稳定 code/可用字段路径；不从英文消息反向解析诊断类型 |
| `store/editorStore.ts` / reducer / slices / actionPolicy | 复用纯状态操作与生命周期策略；补足输入约束和跨实体保护，不把任意 Action 暴露为 CLI API |
| `store/commands/` | 按域抽出共用意图→操作构造，已有 UI 与 CLI 使用同一归属规则；保持选择、导航等 UI 行为在 GUI 适配层 |
| `services/projectExport.ts` | 拆出纯导出准备结果（校验、规范化、内容、建议文件名），现有 GUI 外壳与 CLI 共用；不直接在 CLI 调用选择器/面板回调 |
| `services/projectSession.ts` / `projectPlatform.ts` | GUI 会话继续负责界面切换和保存；CLI 用显式路径装配离线 runner，不能冒充 GUI 自动选择器 |
| `electron/ipc/fileService.ts` | 提取 read/临时写入/排他目标的通用 Node IO；CLI 不读取偏好、不改最近项目、不激活窗口 |

核对发现 `fileService.createProject` 仍保留与当前 `ProjectData` 不同的旧格式模板；CLI 必须使用实际 GUI 新建流程已使用的 `createEmptyProject + serializeProject`，不复用这份旧模板。旧入口的清理只在实际受影响范围中单独验证，不扩大为全仓改造。

## 3. 模块和工具选择

| 拟定位置 | 唯一职责 |
| --- | --- |
| `contracts/automation/` | 操作输入、实体引用、结果、错误、回执和版本契约；生成 TypeScript DTO、JSON Schema、帮助/示例元数据 |
| `store/commands/automation/` | Stage、Puzzle、黑板、FSM、演出图的共用领域操作构造；不读文件、不打印、不依赖 React |
| `services/automation/` | 查询、alias 分配、候选执行、作用域/范围检查、差异、诊断和离线协调 |
| `services/automation/` 的审批接口及桌面宿主适配 | 单一权限策略、原始 JSON 候选审阅、一次性人工授权与提交协调；UI 留在桌面适配层，Node 核心不导入 React/Electron |
| `platform/node/` | 通用文件 IO、指纹、路径规范化和排他创建；不依赖 Electron 偏好或编辑状态 |
| `cli/` | 入口、参数解析、命令路由、stdout/stderr 与退出码；不自行维护领域规则 |
| `tests/cli/` | 编译产物子进程测试、完整任务夹具及故障/冲突验证 |
| `overview/dev/CLI_Agent_Usage.md` | 实施时交付外部 Agent 使用流程和实际可运行示例，命令细节从契约生成或校验 |

参数解析首选 Node 内置 `util.parseArgs`，七组常规命令与独立 `json` 命令组无需先加入大型命令框架。该 API 在 Node 20 已转为稳定；使用项目已声明兼容范围内的功能，不依赖较新版本才提供的选项。参考 [Node 官方文档](https://nodejs.org/docs/latest-v22.x/api/util.html#utilparseargsconfig)。

新接口的运行时契约建议使用 Zod 4 严格对象与区分联合，并通过 `z.toJSONSchema` 导出 Schema；首批验证兼容后锁定版本。公开输入仅使用 JSON 可表示类型，拒绝未知字段，不以转换/任意宽松对象隐藏错误。结构 Schema 与工程上下文校验分工明确：引用、作用域、生命周期仍由领域服务负责。JSON Schema 导出不支持所有 Zod 类型，不能用忽略不可表示类型的方式交付失真的契约。参考 [Zod 官方文档](https://zod.dev/json-schema)。

现有 ProjectData/导入 Reader 不一次性替换；新操作参数复用其可共享规则，扩展时做差分验证，逐步收敛重复定义。CLI/MCP/GUI 不分别手写一套命令 Schema。

CLI 采用独立的 Vite 6 Node/SSR 构建配置，输出 `dist-cli/cli.js`，不加载 React 插件或 GUI 环境配置。第三方运行依赖显式打包或随产物提供；不能因开发机 `node_modules` 存在就认为发行物自足。构建模式参考 [Vite 6 官方文档](https://v6.vite.dev/guide/ssr#building-for-production)。

**编译边界必须先验证**：当前 Electron `rootDir` 是 `electron/`。通用 Node IO 放到目录外后，不能让 Electron 直接跨根编译源码并意外改变入口布局。建议独立编译 `platform/node` 为 `dist-node` 的 JS/声明，Electron 引用生成入口，CLI 可消费同一构建入口；相对路径及 `dist-node` 的打包收录在 C1 验证。为 `electron:compile`、`cli:build` 加入前置 Node IO 构建，不直接扩大 Electron rootDir。生成物纳入忽略规则，源模块只有一份。

## 4. 七组常规命令与独立 JSON 能力

| 命令 | 主要参数和输出 |
| --- | --- |
| `describe` | `--operation` 可选；输出已实现能力、API 版本、输入/输出 Schema、规则、权限级别和示例；未实现能力不能冒充可用 |
| `create` | `--name`、`--root-asset-name`、`--out` 必填；`--plan` 可选；所有新增资产名外部传入，工厂创建和同批填充后校验，排他保存完整工程 |
| `inspect` | 工程路径；`--view summary/tree/entities/fsm/presentation/references/variables/bindings`、目标/上下文/深度/分页；返回 ID、所属、状态及 token |
| `validate` | 工程路径；返回结构/业务诊断；warnings 默认不使进程失败，可显式 `--warnings-as-errors` |
| `preview` | 工程路径、`--plan`；返回候选差异、诊断、alias 映射及回执；默认不写任何文件，可显式 `--receipt-out` 写回执但不改工程 |
| `apply` | 工程路径、`--plan`、`--receipt`、`--out`；核对回执并重建同一候选，排他写入新目标，返回实际结果与内容指纹 |
| `export` | 工程路径、`--out`；复用导出规则，error 阻断，保护 `.puzzle.json`，生成 `.export.json` |
| `json read` | 工程路径；`--json` 返回完整对象与原文，`--raw` 返回原始文本；只读，包含所有文件字段，不裁剪或迁移 |
| `json preview` | 工程路径、`--candidate`、`--out`；校验完整候选并展示全文件差异、影响和目标，生成绑定内容的回执；可显式 `--receipt-out` 保存回执，不写工程 |
| `json apply` | 工程路径、`--candidate`、`--receipt`、`--out`；仅作备用，需最高权限；请求可信宿主让用户确认该次差异，核验一次性授权后写入 |

参数支持 `--plan -` 从 stdin 接收 JSON；常规命令无交互提示和文件选择器。直接 JSON 编辑是明确例外，只能通过可信宿主请求用户确认；无宿主时返回权限错误，不能转为 stdin 自确认。工程、计划、候选、输出路径明确绑定，不能让输出覆盖输入工程、计划、候选或回执。路径含中文、空格、长路径与错误编码应有实际子进程测试。

统一 `--json`：stdout 仅一个结果对象，日志到 stderr，UTF-8，无颜色/进度条混入。`json read --raw` 是显式原文输出例外，不混入结果包装、诊断或额外换行。人类帮助和工具消息使用 English，开发文档与关键代码注释使用中文。拟定退出码：0 成功；2 参数/契约错误；3 领域或校验 error；4 冲突；5 IO 失败；6 人工授权未满足；1 内部错误；130 中断。`inspect` 可成功返回现有工程的业务诊断；不能把“可读取”当作“可导出”。

结果统一带 `apiVersion`、`ok`、`command`、`data`、`diagnostics` 和失败时的 `error`；错误具有稳定 code、操作序号、实体定位、可用字段路径、建议与可重试属性。实体定位使用所属域/图及 ID，不能把人类 location 或诊断自增 ID 当作稳定错误身份。

## 5. 操作计划与数据一致性

计划包含 `apiVersion`、源 token、明确修改 scope 和 `commands`。API 版本与工程文件版本独立，不在 `.puzzle.json` 中偷偷加入新的 API 字段。

操作覆盖：

- Stage：创建、属性/解锁配置、移动、重排；根保护、防层级环、父子一致、初始项变化明确列入差异。
- Puzzle：创建并分配 FSM/初始状态、移动、属性、监听器、局部变量；保持已有 ID 和排序。
- 黑板：变量/事件/脚本声明与属性、类型/作用域、Draft 删除、Implemented 标记删除与恢复；不开放永久移除非 Draft 资源。
- FSM：状态增改删、初始状态、迁移增改删/重定向、优先级、多触发器、递归条件、参数修改、事件和演出绑定。
- 演出图：节点增改删、入口、连线/重定向、命名 True/False 出口、Wait/Branch/Parallel 配置、脚本参数和子图绑定；关联边属性和分支槽位保持。

alias 仅在一个批次内有效；服务先登记创建对象与预留 ID，再解析依赖和执行，返回正式 ID。候选分配器保留源工程、新分配及同批删除的 ID，不能仅扫描当前剩余对象后分配，避免批次内重复或删除后复用。现有计数器基于传入 ID 集合，不自行保证跨历史永久不复用；跨版本更新依靠 token 和实体前提检查。已有状态/图节点通过所属 FSM/Graph 加 ID 定位，不能假定 ID 在工程全局唯一。未知或重复 alias、跨图错误引用、保留字段与超范围操作报错。

所有操作在隔离候选上执行，最终进行结构与业务校验；计划解析/命令执行/校验失败不产生目标工程。已有工程的业务 error 按稳定 code + 对象 + 上下文比较基线，允许修复草稿但拒绝新增 error；结构错误不能跳过。删除/移动的关联影响在同一候选内显式处理，不自动提升变量作用域或修改共享图的所有调用者。

现有 Slice 对非法目标有时返回原状态；外部接口必须给出明确错误。操作执行前检查前提，并区分合法 no-op 和目标不存在，不能只派发 Action 后报告成功。新增跨域规则只由共用领域入口维护，UI 的同类入口逐步复用，避免把有价值的修复只留在 CLI。

常规更新只覆盖契约允许的字段；省略表示保持，清空须明确表达。不传入整个精简查询对象覆盖实体，不把 JSON Pointer/任意 reducer Action 加入普通领域写入口。独立 `json` 入口允许完整文件候选编辑，由 §1.2 的最高权限、共同校验和逐次用户确认约束，不能借普通 `apply` 或导入命令绕过。

## 6. 预览、冲突、重试和文件交付

`preview` 回执包含 API 版本、规范源路径、原始内容 SHA-256、计划指纹、固定 ID/时间输入、候选指纹和影响摘要。工程工厂的 `meta.id` 并非跨工程唯一身份，不能仅靠它判断请求归属。

`apply` 校验回执与参数，重新读取工程、重建候选并比较指纹；回执本身不是可信授权或免校验证据。源内容、计划或候选变化时返回冲突并要求重新预览。数组顺序属于语义，指纹计算不能把命令、子 Stage 顺序或 True/False 出口排序后再比较。

先完整写同目录临时文件，再以排他方式发布目标；清理临时文件。首版不覆盖源工程，也不承诺任意第三方程序参与文件锁。apply 成功代表新目标已写入，返回实际路径和 hash；不声称当前 GUI 已保存、刷新或可 Undo。备用 JSON 编辑写新副本同样必须人工确认，并且只写批准的候选；不能以“没有覆盖源文件”为由免除最高权限要求。

重试不得自动换随机目标或重复追加对象。固定目标已存在时返回冲突；若有同一回执并且目标内容与候选一致，可以确认已有输出。响应丢失的结果需要查验目标，不能一律称为未提交。跨进程可靠请求日志/恢复另行实现，首版不以进程内 requestId 缓存冒充持久幂等。

读取快照期间源文件变化或多页跨版本时拒绝拼接上下文。apply 也核对源读取前提；离线输出是对应某个已读取快照的副本，不声称锁定了可能正在人工编辑的原工程。

## 7. 五批实施和验收

| 批次 | 交付 | 验收标准 |
| --- | --- | --- |
| C1：契约、只读入口与无界面构建（已完成） | API/结果/权限规范，Node IO 编译边界，`describe/inspect/validate/json read`，assetName 必填身份片段，纯导出准备函数及编译测试 | 独立 Node 产物、完整读取/只读副作用、45 项 C1 测试、全部 271 项回归、Electron 与 GUI 导出验证通过；详见 [实施报告](./CLI_C1_Implementation.md) |
| C2：工程、层级、资源与事务（已完成） | `create/preview/apply/export`，22 种领域操作，全部资产名外部输入，alias、scope、候选、回执和排他写入 | 创建→多层 Stage/不同层 Puzzle→保存→GUI 重开/手工修改→再次 CLI 校验/导出通过；41 项 C2 子进程测试、完整 310 项回归通过；详见 [实施报告](./CLI_C2_Implementation.md) |
| C3：完整 FSM 编辑 | 状态、迁移、触发器、条件、参数、事件与演出绑定；常用字段覆盖 | 正常/失败/重试分支及递归条件完整构造；增量修改保留无关字段；删除初始状态、跨 FSM 引用、false/0、迁移效果归属验证 |
| C4：演出图与跨资源影响 | 节点/边/入口/分支/并行/子图/参数；引用查询与调用上下文完善 | True/False 槽位不串位，共享图影响可见；脚本类别/参数/作用域错误拒绝；局部改边保留坐标与其他绑定；GUI 展示及导出往返一致 |
| C5：备用 JSON 编辑、人工授权与发行 | `json preview/apply`、可信审批宿主、一次性授权、Windows CLI 发行物、运行时/启动器、Agent 示例与完整回归 | 用户确认具体候选后才写入；无确认/取消/重放/换内容零写入；审批 UI 复用共用弹窗；普通命令无开发依赖环境运行；外部 Agent 完成领域编辑及获人工确认的备用任务；GUI 重开/手工编辑/保存正常 |

C1 是只读原型；C2 完成后应有可用的创建/保存闭环；C3/C4 补齐复杂内容；C5 完成人工授权的备用 JSON 编辑及发行。**C1–C5 全部完成才称为首版 CLI 完成**。最高权限确认通道未通过验收时，不能仅增加 `--force` 就宣称备用功能完成。不用等 MCP 才交付，后续 A3 在线桥与 A4 MCP 复用核心。

第一批具体文件范围：新增 contracts、cli、Node IO 源与独立编译配置、CLI 构建配置、tests/cli；调整诊断类型/规则、纯导出准备、文件服务通用 IO 调用及质量脚本。首批不接入写命令，不改画布交互和工程格式。

## 8. 验证与发布要求

使用现有 Vitest 验证领域规则/候选不变性；编译后的 CLI 必须由真实子进程执行，不能只 mock 路由函数。至少包含 UTF-8/中文与空格路径、非法参数/未知字段、破损工程、已有业务 error、末步失败、alias 冲突、旧回执、输出已存在、源目标重合、IO 失败及输出纯净。

图和层级测试验证真实行为：移动影响引用、递归条件、分支出口、迁移效果、共享图上下文和源文件保留。按命令契约生成可验证示例，固定成功/失败夹具；不以 JSON 能解析替代操作验收。

资产名验收覆盖根 Stage、Puzzle 及自动初始状态、事件、各类脚本和全局/局部变量；缺失、空白、非法、所属范围内重复、克隆映射遗漏均失败且零写入。改显示名称保留原 assetName，CLI 不调用 GUI 翻译/自动命名入口；完整 JSON 候选同样拒绝新增缺名或清空已有名称。

完整读取验证全部包装、业务与编辑状态、未知字段、原文顺序/空白、破损 JSON 的原文获取及大文件不截断；重复键/数值精度等解析歧义须给出诊断并保留原文，候选写入不接受含重复键的歧义 JSON。备用编辑验证普通写权限不足、伪造批准参数/文件、无宿主、用户拒绝/取消/超时、过期/重放、换候选/源/目标、审批后源变动、审批后 IO 失败与响应丢失。真实人工确认必须单独手工验收，mock 宿主通过不等同于该要求已满足。

新增 `cli:build`、`typecheck:cli`、`test:cli`，纳入 `npm run check`；contracts/cli/Node IO 源和配置加入 UTF-8、渐进格式、lint/依赖反向探针，生成物 dist-cli/dist-node 加入忽略。CLI/Core 禁止运行时依赖 React、DOM、GUI 平台实例或 Electron；`check:ui` 继续保留。

共用工厂/导出/Reducer/Node IO 变化要跑既有回归与相应 Electron 检查。C2/C4/C5 用 CLI 生成文件在浏览器/桌面实际打开并检查树、FSM、演出、诊断，手工修改保存后再 CLI 读取/校验；只读 C1 不声称完成新增 UI 功能。基线 release 记录为 226 用例，实施时报告实际最新结果，不复制历史通过数。

开发入口可为 `node dist-cli/cli.js`。Windows 发行首选独立 companion ZIP：打包 CLI、需要的共用模块、锁定的兼容 Node 运行时、`puzzle.cmd` 启动器和许可证/校验记录；使用绝对启动路径即可，不自动修改系统 PATH。验证移走源码/node_modules、无全局 Node 时仍可运行。以后并入 NSIS 时明确收录 dist-cli/dist-node/运行时；保持 Electron 正常入口，不用未经验证的 GUI 启动或 Electron RunAsNode 代替 CLI 交付。

普通 CLI 命令和完整读取可独立运行；备用 JSON 写入使用随桌面版提供的审批宿主，不依赖桌面工程在线编辑桥。发行说明必须列出该依赖，未安装/未连接宿主时仅拒绝最高权限写入，不影响读取和常规领域命令，也不能静默跳过确认。

首版典型调用（普通命令已在 C1/C2 实现；`puzzle` 启动器及末尾两个 JSON 写命令仍属于 C5）：

```text
puzzle describe --json
puzzle create --name Demo --root-asset-name DemoRoot --out Demo.puzzle.json --json
puzzle inspect Demo.puzzle.json --view tree --json
puzzle preview Demo.puzzle.json --plan edit-plan.json --receipt-out preview.json --json
puzzle apply Demo.puzzle.json --plan edit-plan.json --receipt preview.json --out Demo-edited.puzzle.json --json
puzzle validate Demo-edited.puzzle.json --json
puzzle export Demo-edited.puzzle.json --out Demo.export.json --json
puzzle json read Demo.puzzle.json --json
puzzle json read Demo.puzzle.json --raw
puzzle json preview Demo.puzzle.json --candidate candidate.puzzle.json --out Demo-raw-edited.puzzle.json --receipt-out raw-preview.json --json
puzzle json apply Demo.puzzle.json --candidate candidate.puzzle.json --receipt raw-preview.json --out Demo-raw-edited.puzzle.json --json
```

最后一条会请求用户审阅并确认该次候选；命令示例不表示已授权，不接受无人工来源的“确认参数”。候选内容由外部提供，不能直接改源文件后再让 CLI 补一次确认。

## 9. 实施记录

前期方案阶段完成源码与官方资料核对，明确所有新增 assetName 外部必填、完整原始 JSON 只读、最高权限备用完整候选编辑和逐次人工确认，并形成 C1–C5 验收边界。

2026-10-08 完成 C1：独立构建、共用 Node IO、只读命令、稳定诊断、外部命名输入片段及纯导出准备。新增 45 项 C1 测试，完整 271 项回归通过；前端构建、真实 Electron 11 项及 7 个关闭场景、浏览器阻断/修正/导出/保存再 CLI 校验通过。完整 JSON 对重复键和不安全数值保留原文、返回 `parsedAvailable: false`，不返回有损解析对象。历史证据由 [C1 报告](./CLI_C1_Implementation.md)维护。

2026-10-08 完成 C2：新增 22 种领域操作、工程创建/预览/回执提交/导出，全部新资产名外部输入，保护源文件与所有输入，排他另存和重试核验。补齐共用局部变量命名、脚本类型/目标、参数运算和原型成员查找保护。新增 41 项 C2 子进程测试，当前完整 310 项回归通过；Electron、前端构建、CLI→GUI 手工修改保存→CLI 校验及 GUI/CLI 导出一致验证通过。详见 [C2 报告](./CLI_C2_Implementation.md)。C3–C5 待实施，未打新 release 或提交 Git。
