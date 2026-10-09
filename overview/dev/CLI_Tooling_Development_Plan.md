# CLI 配套功能与图标修复计划：C11–C16

日期：2026-10-09。状态：**C11–C16 已按顺序完成开发与隔离成品验收**，详见 [C16 完成报告](./CLI_C16_Implementation.md)。当前用户实际安装、PATH 与 Skill 未变，安装后外观/宿主刷新仍需实际确认。本文是本轮任务范围、分批依赖和验收标准的维护入口；C6–C10 的历史计划保留在 [上一阶段计划](./CLI_Next_Development_Plan.md)。

## 1. 本轮目标与范围

用户要求：暂不考虑 npm 安装，补齐全局命令、可安装的 Skill、配置查看、doctor，并修复桌面/开始菜单图标。

采用现有 Windows x64 独立 CLI 包及其内置 Node。安装后可在任意工作目录调用 puzzle；Agent 可以发现并阅读配套 Skill；配置和环境状态可直接查询；诊断结果能说明问题和处理方法。原图标继续使用，不重新设计。

计划初次交付仅编写文档；用户随后要求直接按顺序执行 C11–C16，现已完成实现和隔离验收。实施各批功能与实际安装到用户电脑是两件事：本轮不修改用户实际 PATH、Skill 目录、已安装软件、业务工程或已有 Release，也不提交推送 Git。

首轮验收范围为 Windows x64 与 Codex。保留不安装即可使用的 ZIP；其他 Agent 可使用标准 Skill 内容，但其安装适配须另行验证。npm 发布、MCP、软件内 AI、云端认证、远程控制、GUI 导航/偏好指令不纳入本轮。

## 2. 当前基线与已确认问题

| 项目 | 当前情况 | 本轮处理 |
| --- | --- | --- |
| CLI 核心 | C10，22 个入口、47 种领域操作；API 1.0.0、权限策略 C10、转换器 C7.1、在线协议 2 | 复用工程查询、领域计划、预览、文件事务、在线会话和共同历史 |
| 发行 | ZIP 含固定 Node、puzzle.cmd、AGENTS.md、能力及 SHA-256 清单 | 增加用户级安装、配套 Skill 和诊断，不依赖全局 Node/npm |
| 全局命令 | 目前需传入 puzzle.cmd 路径 | 安装到受管位置，通过稳定启动器及用户 PATH 提供 puzzle |
| Agent 指南 | CLI_Distribution_Guide.md 是包内 AGENTS.md 唯一来源 | 增加标准 Skill 入口和离线参考文件；不维护第二套权限说明 |
| 配置/诊断 | 没有统一 config show/path 或 doctor | 汇总实际配置来源、版本、安装及连接状态 |
| EXE 图标 | C8/C10 为绕过 winCodeSign 解压权限错误，关闭 signAndEditExecutable，连带跳过图标嵌入 | 修复资源编辑流程；未签名与正确嵌入图标分别验收 |
| 图标事实 | public/icon.ico 与 public/icon.png 未改；已安装 C10 EXE 提取图标与 Electron 默认图标一致；两处快捷方式引用该 EXE 的图标 | 把 EXE、安装器和快捷方式图标纳入成品检查 |
| 窗口图标路径 | main.ts 指向 ../public/icon.png；当前打包 files 仅包含 dist、dist-electron、dist-node | 核对并修正生产图标路径，使用实际进入发行包的资源 |

既有报告的测试数量属于历史证据，不当作本轮新执行结果。具体基线见 [C10 报告](./CLI_C10_Implementation.md)、[发行记录](./Release_2026-10-09.md)、[架构指南](./Architecture_Guide.md)。

## 3. 共同设计原则

1. 工程规则继续由现有共同领域层维护。安装、配置和 Skill 管理放在工具配套层，不另建 Stage/FSM/演出图编辑实现。
2. 命令、严格输入 Schema、帮助、describe 与结构化结果同源；新增管理命令不能在脚本和 CLI 中各维护一份参数或校验逻辑。安装脚本作为薄入口调用打包的管理服务。
3. 版本、Node 要求、在线协议和权限从实际能力/构建元数据取得，不在 Skill、doctor、安装器中硬编码第二套值。工具版本推进不自动代表权限策略、转换器或在线协议需要变化。
4. 普通查询、config show/path、skills list/read/status 和 doctor 不写设置、PATH、技能目录或工程，不创建默认配置，也不启动/重启桌面程序。
5. 安装、升级和卸载先可预览目标与影响，只处理有本工具所有权记录的文件。遇到同名外部命令、外部 Skill 或用户修改，返回冲突；不以通用 force 参数静默覆盖。
6. 所有工程相对路径继续以调用者当前目录解析。全局启动器不切换到安装目录；不自动选取最近工程、第一个桌面窗口或默认输出文件。
7. 所有新 assetName 仍须外部指定。JSON 编辑、覆盖和永久删除继续按 [已有聊天授权规范](./CLI_Implementation_Plan.md)执行；配置、安装记录、Skill、doctor 均不能保存长期授权或自动补授权参数。
8. 新增环境安装动作明确标注文件/PATH/Skill 副作用，不将其混同于三项最高工程权限。配置输出不泄露 HMAC 密钥、完整会话登记或项目正文。
9. 关键代码注释和开发说明使用 UTF-8 中文；CLI 消息与界面元数据使用 English。复用现有共享 UI，本轮不新增安装确认类 GUI 弹窗。

## 4. C11：修复图标与资源编辑流程

**优先级最高，独立交付。** 目标是恢复已有图标并补上发布检查，不等待 CLI 安装功能完成。

### 实施内容

- 处理 Windows 资源工具的缓存/解压问题，保留原有 EXE 资源编辑；不再用关闭 signAndEditExecutable 的方式降级。记录工具来源及固定校验值，不修改依赖源码或系统权限。
- 继续使用原 ICO/PNG；检查 Windows EXE、NSIS 安装器/卸载器及快捷方式的资源来源。
- 修正 Electron 开发/生产图标路径，使生产路径对应实际打包的资源；打包前检查文件存在。
- 增加 EXE 图标提取/像素或资源核验。资源缺失、默认 Electron 图标或路径错误应阻断发布；证书缺失可以保持明确的未签名状态。
- 为新安装与从 C10 升级后的快捷方式分别检查目标、IconLocation 与实际提取图标。图标缓存只在证实需要时刷新，不先清空用户系统缓存。

### 验收与交付

原 ICO/PNG 字节保持；目录版与安装器内 EXE 均含原图标；独立测试快捷方式指向正确资源；窗口/任务栏使用有效生产资源。执行成品启动和关闭保护冒烟，保存资源核验结果及可操作时的图标截图。

输出 C11 技术设计、完成报告和独立新目录中的修复包。实际升级用户当前安装及对外替换附件按用户届时指令执行；旧包/历史哈希保留。

## 5. C12：不依赖 npm 的全局命令安装

### 安装形式

独立 ZIP 提供 install-cli.ps1 和 uninstall-cli.ps1 等薄入口；内部复用一个安装管理服务。默认安装到当前用户的 %LOCALAPPDATA%/StarryTree/PuzzleEditorCLI，不请求管理员权限，不写系统级 PATH。

建议结构：

| 位置 | 职责 |
| --- | --- |
| bin/puzzle.cmd | 稳定命令入口，指向已核验激活版本的内置 Node/CLI |
| versions/<发行标识>/ | 完整、不可原地覆盖的 CLI/Node/许可证/技能发行文件 |
| installation.json | 激活版本、所管理路径、文件指纹、PATH 增量及安装事务信息 |
| config.json | C13 的可选 CLI 设置；与安装所有权及桌面偏好分开 |

发行标识包含批次/构建身份，不能只用目前重复的产品版本 1.0.0-beta 区分目录。

### 实施内容

- 提供安装预览、安装状态、升级和卸载；激活前核验包清单、运行时版本和 describe，失败保留原激活版本。便携调用继续可用。
- 只增加本工具的稳定 bin 到用户 PATH；保留原条目、顺序、变量表达式与注册表值类型，不用 setx 拼接整个 PATH。重复安装不重复添加。
- 检查同名命令及实际解析路径。不能覆盖别的软件的 puzzle 或擅自改 PATH 顺序夺取命令；冲突时给出绝对路径调用方式。
- 升级写新版本目录，受控切换启动器/记录；运行中版本不被覆盖，不自动删除旧版本。卸载只移除本工具拥有且未被外部修改的内容和自身添加的 PATH 项。
- 使用参数数组和受控路径调用内置 Node，不拼接用户输入为 shell 代码。保留调用 cwd、stdin、stdout/stderr、退出码及中文/空格路径行为。
- 增加 --version 或等价结构化版本入口，明确产品版本、phase、构建身份、API 和在线协议。提示新终端生效；不假定现有 Codex 进程立即获得新的 PATH。

### 验收与交付

仓库外目录及无全局 Node/npm 环境可调用；中文、空格及含特殊字符的参数正确；重复安装、并发安装、升级失败、断点恢复、命令冲突、长 PATH、卸载后其他 PATH 项不受影响。

开发阶段以隔离目录和可注入环境/注册表适配进行反例测试。永久用户 PATH 与新终端发现必须在隔离 Windows 用户/测试环境，或用户明确要求的实际安装环境验证；仅给子进程临时 PATH 不算永久全局安装验收。

## 6. C13：配置查看与统一环境解析

新增拟定入口：

```text
puzzle config show --json
puzzle config path --json
```

### 配置边界

首版重点是只读查看，而非引入庞大配置系统。可选 config.json 使用严格且带 schemaVersion 的结构，首版可配置项仅为 desktopExecutable，用于诊断桌面位置，不自动执行它。未安装/未配置时使用派生默认值并显示 absent，不创建文件。

show 分别返回配置文件原值、实际生效值和来源：用户文件、环境变量、安装记录或内置默认。派生信息包含 CLI/Node 路径及版本、安装/便携模式、技能位置、会话发现目录、支持平台与协议。

- 环境与会话目录解析复用 sessionSecurity 等现有唯一实现，保留已存在环境变量语义；不新增另一份发现目录或 HMAC 存储。
- 安装和诊断复用同一配置读取器。config path 区分“预期配置位置”和“当前是否存在”。
- 相对 desktopExecutable 以配置文件所在目录解析；工程/计划/输出路径仍按调用 cwd 解析。配置文件不改变命令目标。
- 拒绝未知键、损坏编码、重复键及不支持的版本；非法授权键明确拒绝。普通离线领域操作不因可选诊断配置损坏而改写目标或降级权限。
- config set/unset、GUI 偏好、默认工程/会话和可配置高权限开关不纳入本批。

### 验收与交付

便携/安装两种模式输出准确；缺失文件、损坏文件、未知版本、中文路径、环境覆盖均有可定位结果；多次读取零文件变动；现有相对路径及在线实例选择规则不变。明确更新 describe 和使用说明。

## 7. C14：可安装的 PuzzleEditor Skill

新增拟定入口：

```text
puzzle skills list --json
puzzle skills read puzzle-editor --json
puzzle skills install --agent codex --scope user --dry-run --json
puzzle skills install --agent codex --scope user --json
puzzle skills status --agent codex --scope user --json
puzzle skills uninstall --agent codex --scope user --dry-run --json
```

项目级安装使用 --scope project 并明确 --project-root；每次写入显式指定 Agent 和作用域。首轮支持 Codex，其他 Agent 返回未支持说明并提供标准技能内容，不猜测其配置位置。

### 内容与单一维护来源

- 技能源建议放在 agent-skills/puzzle-editor/，含 SKILL.md、agents/openai.yaml 和离线 references；提供清晰的 name/description 与英文界面元数据。
- SKILL.md 保持简短，指导读取 describe → 查询 ID/hash → 外部资产命名 → 领域计划 → 预览 → 提交 → 校验/导出；在线流程使用显式会话和共同历史。
- reference 中的执行/权限指南从 CLI_Distribution_Guide.md 构建复制，与包内 AGENTS.md 同源。命令字段和示例以契约/已验证样例生成或核验，不再手写第二套领域 Schema。
- 安装默认复制而非依赖符号链接；用户级目标为 ~/.agents/skills/puzzle-editor，项目级目标为明确项目的 .agents/skills/puzzle-editor。
- 将安装记录、发行版本和受管文件指纹存到 CLI 管理目录，不修改 Codex 全局配置或其他 Skill。更新仅替换已确认属于本工具且未被用户修改的文件；外部同名技能或用户修改返回冲突。
- Skill 更新与 CLI 激活版本一起检查兼容性；完整内容可通过 CLI 读取，不需要联网。卸载必须明确目标，只移除受管技能，不删其他目录。
- 首版提供离线 Skill 文件安装；公共插件市场分发另行规划，不把“复制成功”报告成“Agent 已识别”。

### 验收与交付

严格校验 frontmatter、元数据、相对链接、版本和文件指纹；覆盖用户/项目安装、冲突、更新、卸载、中文路径及包外安装。

在实际 Codex 中验证技能发现和显式调用，完成虚构工程的只读查询及领域另存流程；验证缺少 assetName 时询问、没有聊天许可时不进入备用 JSON/覆盖/永久删除。记录宿主刷新或重启要求；不承诺所有提示都自动触发 Skill。

## 8. C15：doctor 只读诊断

新增拟定入口：

```text
puzzle doctor --json
puzzle doctor --offline --json
puzzle doctor --online --instance <instanceId> --session <sessionId> --json
puzzle doctor --project Demo.puzzle.json --json
```

默认与 --offline 均只检查本地环境，不访问互联网；--online 必须明确实例/会话，仅执行已有只读连接/状态查询，不提交字段草稿或进行编辑。--project 显式调用共同文件校验，不自动扫描最近工程。

### 诊断项目

| 分类 | 检查内容 |
| --- | --- |
| 运行与发行 | 当前 Node/CLI、启动器实际目标、发行身份、许可证及受管文件指纹 |
| 命令安装 | 用户 PATH 中受管项、当前进程是否已刷新、同名命令遮蔽、安装记录一致性 |
| 配置 | 文件位置/存在性、Schema、来源优先级、声明的桌面路径 |
| Skill | 安装作用域、frontmatter/链接、受管版本/指纹、CLI 兼容性；不能伪报宿主发现 |
| 桌面连接 | 当前用户发现目录/ACL、指定实例响应、在线协议；不输出登记密钥 |
| 可选工程 | UTF-8/JSON、共同结构/领域诊断及文件所有权；不写工程 |

结果复用既有 JSON 信封，data.checks 包含稳定 code、pass/warn/fail/skip、英文 message、相关非敏感证据及处理建议；单项异常不阻止汇总其他独立检查。

没有打开桌面或未安装可选 Skill，在离线模式下为 warn/skip，不使离线 CLI 不可用。用户显式要求的在线连接失败、发行损坏或配置不合法报告 fail。合法诊断命令按健康结果退出 0/3；参数/IO 等保留现有分类，不复用权限拒绝码。

doctor 不自动修改 PATH、删除残留登记、安装 Skill、启动编辑器、覆盖文件或刷新图标缓存。修复建议是供用户/Agent判断的操作，不是已执行结果。

### 验收与交付

健康/无桌面/旧协议/配置损坏/包损坏/命令遮蔽/技能冲突/只读目录均有准确结果；stdout 单 JSON，退出码一致；运行前后设置、技能及工程哈希不变。真实桌面握手、超时和无许可零写入单独验证。

## 9. C16：整体回归、成品验收与配套发行

1. 顺序完成 npm run check、生产构建与相关真实 Electron/CLI 测试，避免并行重建共享 dist。669 项只是当前历史基线，新总数按执行结果报告。
2. 对新管理能力运行真实子进程验收；以完整 ZIP 在仓库外、中文空格目录及无全局 Node/npm 环境验证安装、配置、Skill、doctor。
3. 在隔离安装环境验证新终端直接 puzzle 调用、升级/卸载、Skill 实际发现，以及桌面快捷方式、开始菜单、EXE/安装器和窗口图标。不得以解包文件相同代替真实安装验收。
4. 复验创建/领域编辑/导入/校验/导出、raw/overwrite/permanent 独立权限、文件所有权、预览冲突、在线未保存读取/原子编辑、GUI Undo/CLI Redo、保存/自动保存和关闭保护。
5. 浏览器可操作时执行既有“加载 → 修改 → Undo/Redo → 保存/导出 → 重开”清单，核对 GUI/CLI 运行时数据相等；报告实际操作方式，自动化不冒充手工桌面验收。
6. 生成配套桌面安装器及 CLI ZIP，含安装入口、Skill、指南、真实 describe、许可证和 SHA-256；产物使用新目录，旧包/已发布附件保持原字节。
7. 更新使用、安装/卸载/升级、架构、能力覆盖及状态文档，报告平台、签名和未测范围。Git 提交推送、发布新 Release、更新用户已安装程序按用户届时指令执行。

本轮不宣称“全部历史功能绝不受影响”；以完整检查、受影响功能回归和真实成品证据支持结论。任何仍未完成的实际安装/Skill 发现/图标验收必须列为未完成，不能用“构建成功”代替。

## 10. 批次顺序与完成条件

| 批次 | 前置 | 完成条件 |
| --- | --- | --- |
| C11 | 当前 C10 源码和原图标 | 资源编辑恢复、生产图标路径正确、实际 EXE/安装器/快捷方式检查通过 |
| C12 | 独立 ZIP；C11 不阻塞 CLI 实现 | 用户级稳定命令、可预览安装/升级/卸载、所有权/回滚、永久 PATH 与新终端验收 |
| C13 | C12 安装/发行元数据 | 唯一环境解析器、config show/path、来源可追踪及零副作用 |
| C14 | C12 安装管理、C13 环境解析 | 标准 Skill、离线读取/安装/更新/卸载、单一指南来源、实际 Codex 发现与流程验证 |
| C15 | C12–C14 | 离线/显式在线诊断、结构化结果与准确分级、独立检查汇总和零写入 |
| C16 | C11–C15 | 全量/实际成品回归、配套新包与哈希、文档和未测范围完整 |

建议实施顺序为 C11 → C12 → C13 → C14 → C15 → C16。每批先写技术设计，完成后写报告并更新本文状态、Implementation_Status 和 CLI 使用说明。图标修复可先独立交付；其余配套功能不能只写指南而未实现安装/查询/诊断入口。

## 11. 代码职责及维护约定

| 维护位置 | 职责 |
| --- | --- |
| contracts/automation/ | 管理命令输入/结果/能力元数据；保留领域与最高权限唯一契约 |
| cli/ | 参数、命令路由、结果输出；新命令树复用共同定义而非再写路由名单 |
| platform/node/ | 用户环境、受管路径/安装事务、配置读取、Skill 文件管理；OS 操作可注入以隔离测试 |
| services/automation/ | 保留工程领域编排；诊断工程复用现有读取/校验 |
| scripts/ | 薄安装入口、发行构建、资源检查和成品验收；不复制业务规则 |
| agent-skills/puzzle-editor/ | Skill 源及宿主元数据；参考内容在构建时从唯一指南生成 |
| CLI_Distribution_Guide.md | AGENTS.md 及 Skill 执行参考的唯一维护源 |
| electron/main.ts、桌面构建配置 | 图标生产路径与资源编辑；使用既有原图标 |
| tests/、overview/dev/evidence/ | 隔离安装/配置/技能/诊断反例、真实进程与成品证据 |

以上职责已在各批设计中固定；安装、配置、Skill、doctor 的编排最终位于 services/cliTooling，OS 适配位于 platform/node。公开新增命令以实际 describe 和帮助为准，Windows 实际卸载入口按最终发行指南执行。

## 12. UX 对应与资料依据

本轮管理命令属于外部工具配套能力，不改变 UX_Flow 的编辑操作。C11 涉及桌面资源；C16 复验 UX_Flow §2.1 的保存/导出/校验/消息、§4 的 Stage/Puzzle、§5/§6 的 FSM/演出图及 §7.6 的软删除。Agent 永久删除仍采用已确认的聊天授权；关闭保护继续按现有共享弹窗与 ProjectSession 流程。

Codex 首轮安装使用用户 ~/.agents/skills 或项目 .agents/skills 目录；SKILL.md 含 name/description，references 按需读取，实际发现另做验收。[OpenAI 官方 Skill 文档](https://learn.chatgpt.com/docs/build-skills)

PATH 方案避免 setx 重写整个变量，因为该命令有长度截断及变量展开行为；后续使用能保留原值与类型的用户环境适配。[Microsoft setx 文档](https://learn.microsoft.com/en-us/windows-server/administration/windows-commands/setx)

## 13. 本次计划交付记录

### 实施完成记录

C11–C16 代码、分批设计/报告及最终配套包完成；715 项全量、136 项 ZIP、36 项桌面配套、12 项真实隔离 NSIS、45 项在线回归及真实 Codex Skill 发现通过，浏览器导出与 CLI 数据一致。最终包在 release/cli/C16-final3 和 release/desktop/C16-final，旧包不覆盖；用户实际永久安装、模型自动触发等边界见 [C16 报告](./CLI_C16_Implementation.md)。

### 初始计划交付（历史记录）

- 已核对当前项目目标、CLI 架构、C6–C10 状态、发行及图标问题；参考现有飞书 CLI 的安装/Skill/配置/诊断思路，不引入其云端身份模型。
- 已建立 C11–C16 范围、命令提案、共同维护位置、依赖和验收标准，并同步状态与历史计划入口。
- 本次只修改 3 份开发文档；独立 UTF-8/换行检查、84 个本地链接、6 个批次及关键范围检查均通过，git diff --check 通过；现有 npm run check:encoding 也通过（382 份源码/配置）。未执行功能测试、图标修复、全局安装、Skill 安装、doctor 或重新打包。
