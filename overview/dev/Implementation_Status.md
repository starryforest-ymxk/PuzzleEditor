# 项目实现状态（Implementation Status）

> **版本**: 1.0.0-beta | **更新时间**: 2026-10-09 | **最近完成范围**: CLI 对外指南、Skill 和命令帮助已清理开发记录，新的本地 ZIP 与 D:\Tools\PuzzleEditorCLI、用户级 Skill 已同步更新；715 项回归、136 项独立包检查、doctor 与 Codex 发现通过。原桌面图标修复已获用户确认，GitHub C16.1 交付记录保留。

---

## 1. 总体进度

### CLI 对外文档与本机 Skill 更新（2026-10-09）

- 对外文档按当前功能组织，移除开发阶段、历史产物和内部报告内容；命令帮助同步清理批次标号。完整指南和 README 分别使用单一源文档，打包仅包含明确需要的 Skill 文件。
- 保留一个 PuzzleEditor Skill 入口，按工程读取/领域编辑、桌面会话、导入导出和授权场景定位指南；飞书的多业务模型不直接套为本项目的 Skill 数量。
- 39 文件/715 测试、136 项独立 ZIP 检查通过。新包位于 `release/cli/public-guide-2026-10-09`，已受管升级本地 CLI 与用户 Skill，doctor 与同用户 Codex 元数据发现通过。后续按用户要求纳入 Git 交付并重新执行安装，两者返回 changed=false、doctor 通过；不创建标签或更新 GitHub Release。细节与验证边界见[完成报告](./CLI_Public_Distribution_2026-10-09.md)。

### C16.1 重新交付与真实 CLI 安装（2026-10-09）

- 用户删除原 GitHub Release/远端标签后，本轮采用新标签 `v1.0.0-beta-c16.1`，交付图标修复源码、证据、最新桌面安装器及同一已验收 CLI ZIP，未强制修改历史标签。
- 先询问安装位置，按用户“D:\Tools 下新建目录”安装到 `D:\Tools\PuzzleEditorCLI`。真实用户 PATH 追加、版本/安装记录、doctor 与全局命令创建/校验/导出通过；重新打开终端或 Codex 后使用 `puzzle`。
- 后续按用户明确要求，通过 CLI 的独立受管入口安装 `C:\Users\吴迪\.agents\skills\puzzle-editor`。预览、安装、状态与指纹校验通过，doctor 的 SKILL/COMMAND_PATH 均 pass。同用户 Codex app-server 只读 `skills/list` 发现已启用的用户级 Skill；未修改 Codex 配置或测试模型自动调用。离线工程操作无额外必需配置，在线操作需先运行兼容桌面版并选择明确会话。
- 详情及实际发布结果的位置见[最新发行记录](./Release_C16_1_2026-10-09.md)。此前用户修改的回归项目夹具保留，不混入图标修复提交。

### C16 后续桌面图标修复（2026-10-09）

- 快捷方式改用原始 ICO 的独立指纹文件名，并通过统一 NSIS 安装后钩子更新保留的旧快捷方式及通知 Shell 刷新；尊重升级时用户删除的快捷方式，不改原图或编辑器运行逻辑。
- 715 项回归、36 项新成品/原 CLI 配套、20 项中文与空格路径真实 NSIS 检查通过。实际用户安装已经修复，原目录及卸载注册表正确，偏好和 EXE/ASAR 哈希保持；用户明确确认桌面显示恢复正常。
- 新本地安装包位于 `release/desktop/C16-iconfix`，修复验收阶段未替换旧发布包或推送；后续 C16.1 交付见上节。实施、参数处理失误的恢复、证据及验证边界见[图标修复报告](./Desktop_Icon_Fix_2026-10-09.md)。下面“用户安装未更改”仅代表各历史批次当时状态。

### C11–C16 Git 交付与 C16 Release（2026-10-09）

- 按用户要求提交推送 C11–C16 源码、测试、证据及开发文档到 origin/main，标签 v1.0.0-beta-c16，产品版本仍为 1.0.0-beta，Release 为 prerelease。
- 发布前 404 份源码和四项最终产物与 C16 验收快照一致，复用实际成品回归的安装器与 ZIP；对外包新增 C16 文件名，旧 C10 标签及附件保留。
- 发布包含桌面安装器、CLI ZIP、入门指南、发行清单和 SHA-256；用法及发布步骤见 [入门](./CLI_Quick_Start.md)、[发行记录](./Release_C16_2026-10-09.md)。当前用户实际安装、PATH 和 Skill 未改，未清理中间包或临时目录。

### CLI 配套功能与图标修复完成（C11–C16，2026-10-09）

- 新一轮目标为不依赖 npm 的全局命令、可安装的 Skill、配置查看及 doctor；保留现有独立 ZIP/内置 Node 和 C10 的工程权限规则。首轮验证 Windows x64 与 Codex。
- C11 优先修复此前跳过 EXE 资源编辑导致的默认 Electron 图标，原 ICO/PNG 保持；随后 C12 全局安装、C13 配置查看、C14 Skill、C15 doctor、C16 回归与配套发行。
- **C11–C16 开发及隔离成品验收完成**；phase C16、36 个入口/47 种领域操作，policy C10/converter C7.1/online 2 不变。全量 39 文件/715 用例（配套工具 46）、UTF-8 404、格式 306、UI 110 及类型/lint/守卫通过；Electron 11 项会话、7 场景/32 断言关闭、21 项所有权、45 项在线重新通过。
- 最终 CLI ZIP 136 项、配套桌面 36 项、独立真实 NSIS 安装/升级/卸载 12 项通过；Codex 在隔离项目发现并启用 Skill。浏览器修改/Undo/Redo/保存/导出/重开校验 0/0、Console 无 warn/error，GUI/CLI 导出相等；原图标保持，最终 EXE/安装器及真实测试快捷方式使用原图标。
- 最终产物为 release/cli/C16-final3 与 release/desktop/C16-final。受管 Windows CMD 不自删除，实际卸载使用返回的外部 PowerShell 入口。当前用户 PATH、Skill、已有安装及已发布 C10 包保持；本节为开发验收记录，后续 Git/Release 交付见上节。真实用户安装和模型自动触发未测试，具体证据与边界见 [C16 报告](./CLI_C16_Implementation.md)、[验收快照](./evidence/CLI_C16/manifest.json)、[入门](./CLI_Quick_Start.md)。

### C3–C10 Git 交付与 C10 Release（2026-10-09）

- 本次交付包含 C3–C10 源码、真实回归、证据、开发文档及对应已跟踪 Electron 编译产物；远端为 origin/main，发行标签为 `v1.0.0-beta-c10`，产品版本保持 1.0.0-beta。
- 382 份源码与 C10 验收快照一致，重新编译的 22 份运行文件与已测试 ASAR 相同；复用已验收的 NSIS 和独立 CLI ZIP。Release 包含 CLI 入门指南与 SHA-256/发行清单，旧产物保留。
- 具体发布步骤、核验与边界见 [发行记录](./Release_2026-10-09.md)；用法见 [CLI 入门](./CLI_Quick_Start.md)和 [完整使用说明](./CLI_Agent_Usage.md)。下方各批报告保留完成当时的提交状态。

### CLI C10 完成（2026-10-09）

- 新增 history list/undo/redo；当前 **22 个入口 / 47 种领域操作**，phase/policy C10、converter C7.1，在线协议 2。C9 旧协议 1 明确拒绝，需使用 C10 配套 CLI/桌面。
- GUI/Agent 共用 50 条历史和唯一恢复入口，稳定 entryId、来源、摘要及实际所需权限不写入工程。只操作顶部一条，token/entryId/requestId 保护并发及断线重试；永久删除仍清空历史。
- Agent 历史操作重新计算权限；保存后的恢复分配新的自动保存限制，旧保存许可不能批准后续 Agent 改动。普通 Undo 只恢复内存；只读、输入草稿、忙碌、选择修复及 GUI 主动保存沿用原共同规则。
- 全量 **38 文件 / 669 用例**通过，新增 21 项服务、6 项真实 CLI 测试；UTF-8 382、格式 291、UI 110、类型/lint/反例门禁和生产构建通过。Electron **11 项文件会话 + 7 场景 / 32 断言关闭 + 21 项所有权**、**45 项在线**全部通过。
- 实际 CLI ZIP 在仓库外中文空格目录、无全局 Node 环境 **80 项**通过；实际桌面 ASAR/EXE 与该 ZIP 配套 **34 项**通过，包括未保存人工修改、在线编辑、GUI Undo/CLI Redo、授权覆盖、关闭保存及重启。浏览器人工改名/Undo/Redo/校验/保存/导出/重开通过，0 Errors / 0 Warnings，GUI/CLI 运行时数据相等。
- **C1–C10 已完成**；当前产物位于 `release/cli/C10/` 和 `release/desktop/C10/`，旧包保留。Git 未提交推送，测试未使用业务工程；实际交付文件、哈希和未测范围见 [完成报告](./CLI_C10_Implementation.md)、[技术设计](./CLI_C10_Design.md)、[使用说明](./CLI_Agent_Usage.md)和 [验收快照](./evidence/CLI_C10/manifest.json)。

### CLI C9 完成（2026-10-09，历史批次记录）

- 新增 session list/status/inspect/validate/preview/apply/save；当前 phase/policy C9、converter C7.1，**19 个入口 / 47 种领域操作**。明确实例/会话，读取未保存快照及完整工程 JSON，连接失败不回退离线写入。
- 共用领域候选与原 Store/ProjectSession；单调 token、字段/手势屏障、一次原子历史、10 分钟同 ID 重试。普通批次可 GUI Undo/Redo，永久删除仍形成历史边界。
- 默认 Agent 修改阻止自动覆盖且保持偏好；新路径另存、获聊天许可的覆盖或 GUI 主动保存只认可捕获内容。覆盖仍需独立声明及磁盘 hash，失败保留 dirty；未来任务重新受限。
- Windows 当前用户 ACL、拒绝 Network SID、HMAC 和 Electron 主框架校验接入；真实并发发现的 StrictMode 登记及临时文件消失竞态已修复，并补权限反例和压力回归。
- **36 文件 / 642 用例**、UTF-8 378、格式 287、UI 110、类型/lint/拦截和生产构建通过。原 Electron **11 项 + 7 场景 / 32 断言 + 21 项所有权**、C9 双实例真实桌面 **33 项**通过；含真实断线重试及等待 61 秒确认无许可自动保存零覆盖。浏览器人工改名/Undo/Redo/校验通过，0 Errors / 0 Warnings。
- **C1–C9 已完成；C10 CLI 历史与配套发行待实施。** 本批未重打 ZIP/安装器，现存 C8 包保持原内容；未提交推送 Git，未操作业务工程。见 [完成报告](./CLI_C9_Implementation.md)、[技术设计](./CLI_C9_Design.md)、[使用说明](./CLI_Agent_Usage.md)和 [验收快照](./evidence/CLI_C9/manifest.json)。

### CLI C8 完成（2026-10-09，历史批次记录）

- 领域与 raw preview/apply 开放 `--in-place`，apply 必须显式 `--allow-overwrite`；raw/overwrite/permanent 三项最高权限独立，用户许可仍来自 Agent 聊天，不新增应用审批窗。当前 phase/policy C8、converter C7.1，12 个入口 / 47 种领域操作；旧回执重新预览。
- 共用 Node 文件层实现路径和文件身份所有权、原文备份、持久提交记录、fsync/替换/回读、同回执已知结果重试。第三方变化、未知记录、损坏备份及未知所有者均拒绝；替换后失败报告结果待核验。
- 桌面在提交 Store 前取得候选所有权；失败保留旧内容、路径、dirty、历史和锁，成功才转移。新建、另存、导出、自动保存和实际窗口销毁复用相同所有权维护入口。
- **33 文件 / 609 项回归**通过，新增 C8 18 项真实 CLI、10 项磁盘故障/别名、5 项 Session 生命周期测试；UTF-8 360、格式 269、UI 110、类型/lint/故意错误拦截均通过。
- Electron **11 项会话 + 7 场景 / 32 断言 + 21 项双实例所有权**，独立 C8 CLI ZIP **80 项检查**，实际 ASAR 桌面目录版 **22 项检查**通过。浏览器实际打开覆盖结果、查看 FSM、保存、导出，0 Errors / 0 Warnings；GUI/CLI 运行时数据一致，备份逐字节正确。
- C8 桌面目录版在 `release/desktop/C8/win-unpacked/`；因签名工具压缩包需要本机未具备的符号链接权限，本次通过构建选项跳过 EXE 资源编辑/签名，未改系统权限。未构建 NSIS 安装器。C8 仅验证 Windows，旧桌面不在所有权保证内。
- **C1–C8 已完成；C9 在线会话、C10 CLI Undo/Redo 待实施。** 未提交推送 Git，未操作用户业务工程。见 [完成报告](./CLI_C8_Implementation.md)、[技术设计](./CLI_C8_Design.md)、[使用说明](./CLI_Agent_Usage.md)和 [验收快照](./evidence/CLI_C8/manifest.json)。

### CLI C7 完成（2026-10-09，历史批次记录）

- 新增 `import preview/apply`，支持 puzzle-project、puzzle-export、raw ProjectData、legacy ExportManifest 转新完整工程；累计 **12 个入口 / 47 种领域操作**，CLI phase C7，转换器 C7.1，权限策略保持 C6。
- 严格实体身份→assetName 外部映射，状态/局部变量区分 owner，全局变量不依赖生成的项目 ID；拒绝通用字段修改、缺项、重复目标、非法名和新增错误，旧缺名按既有错误报告且阻断运行时导出。
- GUI/CLI 共用导入与序列化、可注入 UUID/时间上下文及编辑状态默认；回执固定源/映射/目标/版本/候选 hash，提交重建并核对，源原文、资源状态、引用和 0/false 保留。排他发布、别名/硬链接保护、幂等与并发测试通过。
- 浏览器实测发现并修正共用导出器把合法 Wait=0 改为 1 的旧问题；新增直接值断言，GUI 运行时导出与 CLI 导出完全一致。实际打开外部命名转换工程，Asset Name 正确、资源状态保持、0 Errors / 0 Warnings，页面无 warn/error。
- 全量 **31 文件 / 576 用例**通过（C7 新增 59）；UTF-8 351、格式 260、UI 110、类型/lint/故意错误拦截、生产构建，以及 Electron **11 项 + 7 场景 / 32 断言**通过。另目录 C7 Windows x64 ZIP **55 项独立环境检查**通过，旧包保留。
- **C1–C7 已完成，C8–C10 待实施**；未提交推送 Git、未重打 GUI 安装包、未测试 Unity 玩法或其他平台。见 [完成报告](./CLI_C7_Implementation.md)、[技术设计](./CLI_C7_Design.md)、[使用说明](./CLI_Agent_Usage.md)和 [验收快照](./evidence/CLI_C7/manifest.json)。

### CLI C6 完成（2026-10-09，历史批次记录）

- 新增 stage.delete、puzzle.delete 和 variable/event/script.purge，累计 **47 种领域操作**；根/显式级联/scope/共享 FSM 所有者保护，完整删除预览和引用校验齐备。
- raw、overwrite、permanent 三项同等级独立能力由共同契约维护；C6 仅开放 raw/permanent。按实际差异识别父级及 raw 间接永久删除，缺声明退出 6，组合操作须全部许可。用户许可仍在 Agent 聊天中，CLI 不认证聊天或增加软件审批。
- GUI/CLI 共用纯删除内核，普通删除可撤销；实际永久移除受保护资源清空 past/future。统一 Dialog 明示删除数量和历史边界，共享图及全局资源保留；拒绝残余引用和局部同 ID 隐式改绑。
- 全量 **29 文件 / 517 用例**通过（C6 新增 50）；UTF-8 344、格式 253、UI 110、生产构建、Electron **11 项 + 7 场景 / 32 断言**通过。真实浏览器验证取消、Stage/Puzzle 删除、普通 Undo/Redo、永久历史边界、共享 FSM 拒绝；三组 GUI/CLI 工程数据对照一致、零诊断，源文件保持。
- 修复发行脚本硬编码旧批次的问题，能力表驱动目录/清单；另目录 C6 Windows x64 ZIP **41 项独立环境检查**通过，旧 C5 包保留。GUI 安装包未重打，未执行 Unity 玩法或跨机器测试。
- **C6 已完成，C7–C10 待实施**；未提交推送 Git。见 [完成报告](./CLI_C6_Implementation.md)、[技术设计](./CLI_C6_Design.md)、[使用说明](./CLI_Agent_Usage.md)与 [验收快照](./evidence/CLI_C6/manifest.json)。


### CLI C6–C10 开发计划确定（2026-10-09，历史文档记录）

- 用户确定下一阶段纳入 Stage 子树/Puzzle 与 FSM 删除、兼容格式导入转换、在线内容修改及 Undo/Redo；覆盖保存和永久删除已实现/标删资源也纳入，但与直接 JSON 编辑同属需要聊天明确授权的最高权限。
- 顺序为 C6 共同权限及删除、C7 导入转换、C8 覆盖保存与工程所有权、C9 在线事务与保存、C10 CLI 历史和配套发行验收。每批先设计再实施，详见 [下一阶段开发计划](./CLI_Next_Development_Plan.md)；授权规范统一在 [CLI 方案 §1.3](./CLI_Implementation_Plan.md#13-下一阶段最高权限扩展用户已确认)。
- 继续要求 assetName 外部指定；暂不增加面板、导航、用户偏好命令，不新增软件内 AI 或 MCP。计划覆盖级联永久删除、自动保存权限、未提交字段、版本冲突和共享历史等边界。
- 本次只更新开发文档，C6–C10 均未实施，当前 CLI 能力和 C5 包保持。历史测试结果不作为本次新增功能通过的证据；未提交推送、未重新打包。
- 文档校验通过：7 份 UTF-8 文档、132 个本地链接、10 个章节锚点及 git diff 检查；336 份源码/配置与 C5 验收清单哈希一致，没有新增源码。本次未重跑功能测试。

### CLI 功能覆盖核对（2026-10-09，仅文档）

- 复核实际 describe：C5、10 个命令入口、42 种领域操作；336 份源码/配置与 C5 验收快照一致，本次未重复运行全量测试。
- C1–C5 的离线首版范围已完成，但尚未逐项覆盖 GUI：缺 Stage/Puzzle 删除和兼容格式转换命令；原地保存、GUI 会话/Undo、永久删除受保护资源等是明确限制。完整 JSON 备用入口不等于常规领域能力全部齐备。
- 差异与下一批优先项记录在 [CLI 功能覆盖核对](./CLI_Coverage_Audit.md)，并同步使用说明；没有新增功能，C5 历史报告和证据清单保持不变。

### CLI C5 完成，离线首版 C1–C5 交付（2026-10-09）

- 开放 `json preview/apply`：完整候选、全文件差异、跨资源 impacts、共同错误基线与命名/生命周期检查；需要规范化时返回修正差异，提交只保存已预览的原始 UTF-8 字节。
- 授权由用户在 Agent 聊天框中明确给出，Agent 核对项目/任务/范围，范围内无需逐条重问。CLI 的 `--allow-raw-json-write` 仅为启用声明，缺少时返回 6；CLI 不认证聊天，无应用审批弹窗或批准令牌。
- 源/候选/回执的路径与 SHA-256、输出路径绑定，拒绝旧回执、别名/硬链接冲突和已有不同目标；同字节重试及并发发布可核验。只创建新输出，所有资产名由外部提供。
- 交付 `release/cli/C5/` 内 Windows x64 独立 ZIP，含固定官方 Node 运行时、`puzzle.cmd`、Agent 指南、许可证和清单；仓库外中文空格目录、PATH 无全局 Node 的 **41 项检查**通过。
- 新增 **50 项 C5 子进程测试**；完整 **27 文件 / 467 项测试**、UTF-8 336 文件、格式 245 文件、UI 110 文件、生产构建、Electron **11 项文件会话 + 7 场景 / 32 断言**通过。浏览器打开 raw 输出，核对 FSM/分支并行/脚本参数，手改 Wait 后保存与导出，0 错误/0 警告；GUI 与 CLI 等效编辑的运行时数据完全一致，源文件和候选字节核验通过。
- **C1–C5 已完成**。C3–C5 尚在工作区，未提交推送；未重打 GUI 安装包、未接在线桥/MCP、未执行 Unity 玩法测试。见 [C5 实施报告](./CLI_C5_Implementation.md)、[技术设计](./CLI_C5_Design.md)、[使用说明](./CLI_Agent_Usage.md)和 [发行包 Agent 指南](./CLI_Distribution_Guide.md)。

### C5 授权规则澄清（2026-10-09，历史文档记录）

- 用户明确：直接 JSON 编辑的许可由用户在 Agent 聊天框中授予；Agent 仅在授权项目/任务/范围内执行，已有范围内授权无需逐条重问。
- 移除早期方案中的桌面审阅弹窗、审批宿主及一次性批准凭据要求。CLI 拟提供显式启用声明并保留校验、回执和排他另存；不宣称能够验证聊天许可的真实性。
- 当时同步 CLI 实施计划、总体接口方案、Agent 使用说明和架构指南，仅修改文档，随后 C5 已完成（见上方）。详细规则以 [CLI 方案 §1.2](./CLI_Implementation_Plan.md#12-用户已明确的要求完整-json-可读直接编辑须先获聊天授权) 为准。C1–C4 的完成报告及证据保留为当时快照，其中早期 C5 审批设想不作为当前要求。

### CLI C4 完成（2026-10-09，历史验收记录）

- 新增 11 种演出图/节点/连线领域命令，累计 42 种；显式图范围、局部节点归属、入口/关联边删除保护，完整 JSON 备用写入仍未开放。
- GUI/CLI 共用连线规则，修复 Branch True/False 移位、改接丢失边样式及无变化手势产生历史的问题；共用图/节点工厂。
- 引用列表、黑板计数、CLI 查询和影响预览采用统一字段遍历与调用上下文；补齐递归条件脚本、事件派发、真实局部变量所有者和共享图参数校验；Inspector 正确展示普通 JSON 常量。
- 全量 **26 文件 / 417 用例**通过，C4 **42 项 CLI 子进程 + 11 项领域/画布回归**；前端构建、Electron **11 项**和 **7 场景 / 32 断言**通过。浏览器分支断开/撤销、三级子图导航、参数展示、Wait 编辑、保存/导出实测通过，0 错误/0 警告；GUI 与 CLI 等效修改的导出载荷完全一致。
- C4 验收时 **C1–C4 已完成，C5 待实施**；当前以顶部 C5 记录为准。C3/C4 当批未另行提交、推送或打包；Unity 玩法未测。见 [C4 实施报告](./CLI_C4_Implementation.md)、[技术设计](./CLI_C4_Design.md)和 [使用说明](./CLI_Agent_Usage.md)。

### CLI C3 完成（2026-10-08，历史验收记录）

- 先将 C1/C2 提交推送到 `origin/main`：`511701b`。随后新增 9 种 FSM 操作，累计 31 种领域操作：状态/迁移增删改、初始项、布局/顺序、端点重定向及完整触发器、递归条件、参数修改、事件与演出绑定。
- 外部 assetName、唯一 Puzzle owner/scope、局部 ID 和 alias 的 FSM 归属、前向 alias、初始/最后状态和关联边删除保护均已接入原事务；所有输出仍为新文件。普通计划不开放通用 JSON 修改，备用写入审批留在 C5。
- GUI/CLI/初始模板共用状态及迁移工厂；画布、Inspector、工程校验共用参数运算兼容规则；Temporary 的常量/变量来源及类型检查补齐；优先级契约拒绝会在导出时被截断的负数/小数。
- 全量 **24 文件 / 364 用例**通过（含 C3 54 项），前端构建、Electron **11 项**与关闭 **7 场景 / 32 断言**通过。浏览器直接打开三状态/三迁移工程、核对绑定、手工修改、保存/导出；校验 **0 错误 / 0 警告**，GUI 与 CLI 导出载荷完全一致，Console 无 warn/error。
- 详见 [C3 实施报告](./CLI_C3_Implementation.md)及 [Agent 使用说明](./CLI_Agent_Usage.md)。C3 验收时 C4–C5 待实施；C3 保留为工作区改动，未再次提交/推送或打包 release；没有执行 Unity 玩法验证。

### CLI C2 完成（2026-10-08，历史验收记录）

- 实现 `create/preview/apply/export` 和 22 种受限领域操作：工程属性、Stage/Puzzle 创建/属性/移动/重排、三种作用域变量和事件/脚本声明/更新/删除/恢复。新增 assetName 全部外部必填，包括根和自动初始状态；支持前向 alias、明确 scope 与增量字段保留。
- 候选隔离、完整差异、旧错误基线、源/计划/候选指纹、固定 ID/时间回执重建和排他新文件发布已接通。防止已有目标覆盖、源/计划/回执别名碰撞、旧回执及同批 ID 复用；相同回执和字节输出支持确认重试。
- 共用校验补齐局部变量命名、脚本类别/目标、参数运算/来源类型与字典自身条目检查；GUI 与 CLI 使用同一套规则。旧工程的这些既有问题现在会在校验中报告。
- 全量检查 **23 文件 / 310 用例**通过，含 **41 项 C2 子进程测试**；前端构建、Electron **11 项**文件会话与 **7 场景 / 32 断言**关闭回归通过。浏览器打开 CLI 文件、逐层检查、改名保存、校验及导出通过，GUI/CLI 导出除时间戳外一致。
- 详见 [C2 实施报告](./CLI_C2_Implementation.md)及 [Agent 使用说明](./CLI_Agent_Usage.md)。C2 验收时 C3–C5 待实施；随后 C1/C2 已推送 `511701b`，当前以顶部 C5 记录为准。当批完整 JSON 读取可用，备用 JSON 写入尚未开放。

### CLI C1 完成（2026-10-08，历史验收记录）

- 实现独立 Node 的 `describe/inspect/validate/json read`；8 种查询视图支持所属实体定位、分页和源 SHA-256 前提。完整 JSON 包含包装、编辑状态、未知字段和原文；歧义/危险数值只返回无损原文并给诊断，损坏 JSON 仍可原文读取。
- 严格契约、JSON Schema、能力/权限表与外部 assetName 必填片段进入共用入口；所有后续写命令明确不可用。领域规则直接产生稳定诊断，GUI 继续使用相同规则。独立 Node IO 同时供 Electron 使用，GUI 导出改用纯准备函数。
- 全量 `npm run check` **22 文件 / 271 用例**通过，含 45 项 C1 测试和既有 226 项；前端构建、Electron 文件会话 **11 项**及关闭保护 **7 场景 / 32 断言**通过。CLI 复制出仓库、无源码/node_modules 的普通 Node 验证通过。
- 浏览器实际验证缺名导出阻断、补名后 0 Errors / 0 Warnings、成功导出和项目下载；下载项目经 CLI 校验零错误零警告。详见 [C1 实施报告](./CLI_C1_Implementation.md)与 [Agent 使用说明](./CLI_Agent_Usage.md)。
- C1 验收时 C2–C5 待实施；当前 C5 状态见上方。C1 时保留的共享图上下文限制已在 C4 处理。C1 当批未创建 release、提交或推送 Git，后已随 C2 提交。

### AI 自动化接口开发建议（2026-10-08，方案阶段记录）

- 新增 [CLI 首版开发建议](./CLI_Implementation_Plan.md)：明确离线首版、七组常规命令与独立 JSON 能力、共用模块、契约/诊断、回执与排他写入、C1–C5 实施及 Windows companion 交付。记录 GUI 导出/平台依赖、旧创建模板和 Electron 编译根目录的适配点；在线桥/MCP 后续独立处理。此节保留方案阶段记录，最新实施状态以上方 C5 为准。
- 更新 [外部 Agent 工程编写与编辑接口开发建议](./AI_Automation_Development_Plan.md)：按用户要求仅提供外部接口，首选统一领域服务与 CLI；桌面会话桥、MCP 按需追加，后续补参数化模板/布局与场景验证。明确第一版 A1+A2、机器诊断、局部范围、事务及并发规则，不开发软件内 AI 调用或聊天界面。
- 方案阶段记录了 assetName 外部必填和完整 JSON 读取要求；早期将最高权限备用编辑理解成逐次审阅批准，该理解已被上方 2026-10-09 用户聊天授权澄清取代。C1 验收完整只读，C2–C4 落实命名输入，C5 验收聊天授权约定下的备用编辑。首版仍另存新目标，原地覆盖及在线工程协调后续实施。
- 方案形成时尚无新增 CLI、MCP 和在线事务；随后 C1 已交付只读 CLI。现有文件监听仍仅同步资源状态，不能作为 Agent 外部整份工程修改的实时合并机制。
- 方案补充直接生成整份工程与领域 CLI 的对比：区分存储结构构造与业务操作，说明现有导入校验、局部编辑、在线撤销及玩法验证的能力边界；CLI 仅包装 JSON 写入不等于获得事务和领域保护。
- 补充复杂工程编辑设计：ID 定位与分层查询、计划文件批量操作、Stage/Puzzle 移动后的作用域、FSM 迁移效果归属、演出图 True/False 槽位和共享图影响、增量保留及布局边界。示例仅为接口草案，尚不能执行。

### Windows release 打包和提交交付（2026-10-08）

- 沿用 `1.0.0-beta`，生成 `release/2026-10-08/` 内的 Windows x64 NSIS 安装包，保留旧产物。全量 226 用例、Electron 11 项和 7 个关闭场景通过；新增发布程序冒烟脚本及复跑说明。
- 实际 ASAR 打包程序两次启动 / 17 项检查通过，覆盖恢复、编辑、取消关闭、保存退出及重启恢复；安装包提取的程序/ASAR 与该产物 SHA-256 一致，15 个构建文件与源码生成物一致。编码 283 文件、格式 174 文件通过。
- 安装包仍未签名；安装/卸载/升级和跨机器验收未执行。修复、测试与规范随源码提交，产物留在本地忽略目录，详见 [发布记录](./Release_2026-10-08.md)。

### 剩余六类 UI 重复维护统一完成（2026-10-08）

- 菜单、表单控件、语义配色、提示/资源预览、标题/卡片及图节点/边标签均迁入唯一维护入口；80 个表单控件接入共享规格，保留密度、业务事件与画布几何。菜单及选择器的外部点击/Escape/焦点返回共用 Hook。
- 建立 [UI 规范](./UI_Standards.md)，在 AGENTS 与架构指南登记。`check:ui` 加入全量检查，10 个错误 UI 探针和 2 个合法探针确认规则生效；全部 UI 纳入格式门禁。扫描 103 个组件，19 组重复候选降为 4 组纯布局，重复装饰规格为 0。
- 全量 **19 文件 / 226 用例**、生产构建、真实 Electron **11 项**和 **7 个关闭场景 / 32 断言**通过。UTF-8 282 文件、格式 173 文件、UI 所属检查 110 文件通过；既有 500 kB 构建告警保留。
- 浏览器在独立回归夹具核对黑板/检查器、两种图画布、Stage/Node/概览菜单、变量搜索、24px 参数/false、脚本和图摘要/跳转，未见 Console warn/error。规范仍需审查补充，不能保证静态规则穷举一切近似重复。详见 [实施报告](./UI_Consistency_Implementation.md)。

### 内部弹窗统一及 UI 重复维护排查完成（2026-10-08）

- 未保存、删除、新建、项目设置、偏好五种弹窗统一共享外壳、标题、按钮、表单与偏好开关；Portal/弹窗栈统一 Escape、Tab、busy 和焦点恢复。叠加保存确认取消后保留新建草稿；短窗口内容滚动、按钮可见。
- 偏好读写异常反馈、busy 解除及失败重试补齐；持久化成功后才同步运行设置。系统文件选择器和原生关闭兜底保留平台实现。
- 全量质量检查 **218 个用例**通过；新增 12 个弹窗行为场景。真实 Electron 原 **11 项**及 **7 个关闭场景 / 32 项断言**通过，生产构建通过。最终 UTF-8 范围 271 文件，格式范围 96 文件。
- 浏览器直接验证实际新建/设置/未保存叠加，隔离夹具验证完整偏好和引用删除确认；包含小窗口、取消、快捷键、焦点及重开值核对。偏好夹具 IPC 为模拟，安装包和 X/Alt+F4 人工验收不计为通过。
- 当时扫描 97 个组件文件，19 组机械重复候选归纳六类后续项；这些项已在下一轮全部收敛，见上方最新状态。原始排查保留于 [统一与排查报告](./Dialog_Unification_and_UI_Style_Audit.md)。

### 未保存项目的关闭保护完成（2026-10-08）

- Electron 原生窗口关闭及应用退出接入同一项目会话：未保存时提供 `Save & Close`、`Discard & Close`、`Cancel`；干净或空会话直接关闭。保存失败、取消文件选择、保存途中新增内容均不能默默关闭。
- 复用已有保存队列与版本确认；主进程校验请求 ID 和窗口来源，重复关闭合并，取消 app.quit 后清除退出意图。补齐后台窗口未触发 blur 时的 Inspector 草稿提交。
- 全量检查通过：17 个测试文件 / **206 个用例**；格式范围 85 文件。原 11 项 Electron 文件链路和新增 **7 个真实关闭场景（32 项断言）**通过；生产页面截图核对三按钮和提示可见。
- 已尝试使用桌面工具手动检查；同步用户输入后测试窗口关闭，未完成独立的 X / Alt+F4 手动验收，不把这部分记为通过。真实 `BrowserWindow.close()`、`app.quit()`、写盘与销毁先后关系由隔离自动化验证。详见 [关闭保护设计及报告](./Window_Close_Protection.md)。

### 手工功能测试指南（2026-10-08）

- [编辑器手工功能测试清单](./Manual_Functional_Test_Guide.md) 包含当前源码 Electron 启动、独立副本准备、10 项完整流程、22 项模块/异常检查、通过标准及问题记录模板；M20/M21/M22 分别为关闭确认、弹窗统一与六类 UI 规范复测。
- 清单明确浏览器下载与桌面落盘的差别、输入框外 Undo/Redo、已知缩放/引用范围缺口，以及需要专项环境的验证。清单供后续执行，不能把未填写的项目记为通过。

### 第六批性能与回归工作完成（2026-10-08）

- 新增 `npm run bench`：真实 BubbleHorror 示例和中/大型固定夹具，React 生产模式下分别测首次值、预热 p50/p95/max、组件同步提交、加载/序列化/校验、DOM 与 50 条历史的 GC 后 JS 堆。保留旧 Hook 对照及原始 JSON，可用相同夹具和测量入口复跑。
- 引用统计改为 `utils/blackboardReferences.ts` 一次按实体汇总，由 `useBlackboardData` 按不可变 project 身份缓存；Inspector 详细查询、导航和业务语义保持。大型项目 Blackboard 挂载 p50 **302.6 → 17.0 ms**、内容编辑 **276.0 → 6.3 ms**，首次挂载 **285.0 → 16.8 ms**；在本机已测规模内达到本批预算，不代表端到端延迟或 FPS。
- 全量 `npm run check`、生产构建通过；16 个测试文件 / **187 个用例**，格式覆盖 80 文件；真实 Electron **11 项**通过。构建仍有主 JS 超过 500 kB 的既有告警。
- 浏览器实际完成大工程筛选、四类引用抽查和导航，小工程创建/重排、删除标记与恢复、条件编辑、引用随 Undo/Redo 更新、FSM/演出拖动、取消项目切换、保存重开与运行时导出再导入。最终校验 0 Errors / 0 Warnings，临时布尔 false 保留，无页面 warn/error。
- 第五批原验收中的独立画布缩放仍未闭环；多节点整体撤销、原生关闭保护、CI、安装包/引擎联调仍待后续处理。真实示例本身的 7 条业务 error 未修改，不算校验通过。完整方法、证据和未覆盖范围见 [Architecture_Repair_Batch6.md](./Architecture_Repair_Batch6.md)。

### 第五批主体修复完成，缩放验收待补齐（2026-10-07）

- Blackboard 拆出工具栏、四页签、数据/操作与重排 Hook；PresentationCanvas 拆出交互协调、命令、节点/边/手柄与几何；ConditionEditor 拆出递归组合、组操作和布局。固定样式迁入目标组件 CSS 与主题变量。
- 项目诊断契约归入 types，FSM/演出图校验只接收 ProjectData；引用/诊断导航归入 Store 应用层。移除无调用的 api/旧 Electron Hook，IPC 封装迁到 platform，导出经 ProjectSession/ProjectPlatform，网络翻译归入 services。
- 修复作用域 ID 含连字符时排序失效、筛选状态重复维护、生命周期菜单悬停后点击收起、连线后目标节点继续漂移等问题。
- `npm run check`、生产构建与真实 Electron 11 项检查通过；14 个文件 / 180 个用例，格式覆盖 72 文件，lint/依赖失败探针扩至 10 项。此前批次结果与源码均保留。
- 浏览器实测筛选、排序、声明/引用导航、创建与撤销、框选多拖、连线/端点/删除、Not 条件及保存/导出/重开；Temporary false 与图端点完整保留。相同基线的黑板/画布前后截图字节一致；控制台无 warn/error，孤立测试 Branch 的 1 条业务 warning 符合预期。
- 设计、证据和覆盖边界见 [Architecture_Repair_Batch5.md](./Architecture_Repair_Batch5.md)。本节保留当批结果，第六批最新进展见上节；独立画布缩放核实为现有功能缺口，多节点拖动仍逐节点撤销，原生关闭保护及安装包/引擎联调待后续处理。

### 第四批修复完成（2026-10-07）

- 安装匹配 React 19 的类型包，前端及 Electron 均通过 strict；收紧 JSON/编辑值、Inspector 更新、画布节点、Action 和引用接口，变量作用域收集直接接收 ProjectData。
- 建立 `npm run check`，涵盖类型、lint、UTF-8、渐进格式、反向拦截和回归测试；错误 Action/载荷、漏配策略及非法编码等反例已验证会失败。当批格式覆盖 14 个配置/工具/新增文件，不代表现有所有组件完成排版统一。
- 修复条件 Hook、依赖数组、废弃字段访问和名称草稿同步。Provider 与 Context 分离，并在开发热更新期间保留 Context 身份，避免模块刷新时会话丢失。
- 11 个测试文件 / 154 个用例、生产构建、真实 Electron 11 项检查通过。浏览器实际验证局部/全局变量、Temporary 参数、FSM 搜索与拖拽、优先级/Wait 编辑、Undo/Redo、Context 热更新、下载和重开；最终工程为 0 error / 0 warning，修复后复测无新增 warn/error。
- 完整设计、工具版本、范围、证据与截图见 [Architecture_Repair_Batch4.md](./Architecture_Repair_Batch4.md)。本节保留第四批结果；组件与依赖整理的最新状态以上方第五批为准。

### 第三批修复完成（2026-10-07）

- 导入入口拆为明确封装识别、结构校验、有依据的旧格式迁移、辅助字段恢复、业务校验及候选提交；未知/损坏文件给出字段路径，保留旧项目、路径、历史、导航、dirty 和问题列表。
- 当前工程、运行时导出、原始 ProjectData、旧 ExportManifest 与真实历史条件 AST 纳入兼容和往返测试。运行时/历史导入要求另存，保留 ID、引用、顺序和参数语义；不把 meta.version 当作格式版本。
- 业务问题允许加载修复；诊断导航可定位 FSM、演出图、黑板及局部变量拥有者。增加 Project → Validate Project 和 Recheck，导出刷新问题列表并保留 error 阻断规则。
- 修复导入后节点点击产生虚假 dirty、Breadcrumb 同名 ID key 冲突，以及乱序阶段映射绕过深度限制、已删除演出节点诊断误选等边界问题。
- 9 个测试文件 / 140 个用例通过，前端与 Electron 类型检查、Vite 构建通过；真实 Electron 11 项检查验证另存副本重开及源文件不变。浏览器实际完成拒绝损坏导入、定位修复、重新校验、下载/重开、真实旧格式导入，最终重载后的检查无新增 warn/error。
- 设计、兼容来源、实际验收及截图见 [Architecture_Repair_Batch3.md](./Architecture_Repair_Batch3.md)。本节保留第三批结果；最新类型、检查与模块状态以上方完成记录为准。原生选择器没有手动操作，原生关闭确认仍待处理。

### 第二批修复完成（2026-10-07）

- 保存、新建、打开、最近项目、启动恢复、项目设置和自动保存使用每个 Provider 唯一的会话协调器。候选准备失败或取消保留原项目；成功提交时一次更新内容、路径、UI、历史和保存基线。
- Save & Continue 等待真实保存结果，失败/取消/保存期间新编辑都不会继续替换。浏览器下载保留 dirty，并使用 Download Copy 提示；项目设置保存完整内存内容。
- 同一队列协调写入顺序；自动保存周期不随持续编辑重启。原生写入采用临时文件替换与排他新建；候选读取不提前切换监听，自身写入用指纹过滤。
- 7 个测试文件 / 84 个用例通过，前端及 Electron 类型检查、Vite 构建通过；`npm run test:electron` 通过真实创建、编辑保存、重开、设置保存、失败保护和文件监听等 8 项验收。测试使用隔离目录，没有写入用户项目或偏好。
- 浏览器验证下载、取消/放弃切换、新建保护、设置完整下载与重开、解析错误保留原项目；最终重载后的检查无新增 warn/error。
- 完整设计与边界见 [Architecture_Repair_Batch2.md](./Architecture_Repair_Batch2.md)。本节保留第二批交付结果；导入边界和后续验证以上方第三批为准。原生关闭确认尚未接入；原生选择器未手动操作。

### 第一批修复完成（2026-10-07）

- 所有 Action 的领域、历史和只读策略集中管理；演出图级 CRUD、边属性、排序等内容操作统一进入版本与历史。只读模式也拒绝 Undo/Redo。
- 保存基线与编辑版本分离；保存后 Undo 为 dirty，Redo 回到已保存版本为 clean。保存期间继续编辑不会被旧保存确认清除 dirty，旧会话和旧路径结果被忽略。
- 同值操作不消耗历史；永久删除与外部资源同步形成历史边界；历史恢复同时清理失效选择和导航。
- Store Hook 增加显式返回类型，并修复因此暴露的 6 处类型问题；`stageDrag.ts` 已转换为 UTF-8。完整 React 类型、strict、lint 仍属于第四批。
- 新增 Vitest 入口，4 个文件 / 58 个用例通过；前端及 Electron 类型检查、Vite 构建通过。浏览器实际验证图 CRUD、保存后的 Undo/Redo、阶段拖入层级、下载并重新打开；完整重载后的复测无新增 warn/error。
- 完整设计、检查及限制见 [Architecture_Repair_Batch1.md](./Architecture_Repair_Batch1.md)。本节保留第一批交付结果；保存/切换与 Electron 验证的后续进展以上方第二批为准。以下审查与熟悉项目记录为修复前基线。

### 修复计划（2026-10-07）

- 已编写 [Architecture_Repair_Plan.md](./Architecture_Repair_Plan.md)，建议按六批实施：状态一致性 → 保存与切换 → 导入边界 → 类型与自动检查 → 模块及组件整理 → 性能测量与完整验收。
- 关键行为测试从第一批开始；每批都有明确的修改范围、技术方向和验收条件。
- 第一至四批完成；第五批主体完成但缩放验收未闭环；第六批性能测量、引用统计优化及已实现功能回归完成。具体剩余范围见最新批次记录，不能笼统认为全部产品功能已经完成。

### 架构与规范审查（2026-10-07）

- 目录与领域划分清楚，现有架构具备维护基础；跨模块约束和自动检查尚不完整。
- 独立场景确认：演出图级增删改未进入撤销历史，也未标记未保存；保存后的 Undo/Redo 同样未更新未保存标记。
- 保存确认回调未等待保存成功，Project 菜单的加载入口也没有统一复用切换前保护流程。
- 默认类型检查通过，但前端缺失 React 类型声明，当前 Store 访问 Hook 推断为 `any`；临时严格检查失败，大量诊断为类型缺失的连锁结果。
- 179 个 TypeScript 源文件中，`utils/stageDrag.ts` 未使用 UTF-8；规范检查和关键行为回归尚需建立。
- 完整证据、验证边界及改进顺序见 [Architecture_Review_2026-10-07.md](./Architecture_Review_2026-10-07.md)。本节保留修复前结论；首批已关闭的状态、撤销和编码问题以上方完成记录为准。

### 修复前核对（2026-10-07）：项目熟悉与现状确认

本次完成项目概览、UX 流程、领域模型、开发状态及关键代码的阅读，并核对当前 `main` 分支（HEAD：`73e5538`）。未修改业务代码；本节记录当前实现和验证边界。后文保留历史记录，其中与本节冲突的旧统计、旧待办不能作为当前完成度依据。

#### 当前架构与主要能力

- 编辑器核心为 React 19 + TypeScript + Vite 前端；现有 Electron 主进程、preload 与 IPC 服务承担本地项目读写、原生对话框、偏好和文件监听。浏览器环境保留文件选择与下载路径。
- 核心领域链路为 Stage Tree → PuzzleNode → FSM；Blackboard 管理全局变量、事件与四类脚本；PresentationGraph 管理脚本调用、等待、分支与并行节点的定义。
- 业务数据集中于 `ProjectData`，Stage、PuzzleNode、FSM、演出图通过 ID 关联；显示名称与用于引擎对接的 `assetName` 分离。当前 ID 类型为 `string`，新建资源使用 `resourceIdGenerator` 的类型前缀加计数格式，不能沿用旧文档的模板字符串强约束描述。
- Store 使用状态/派发双 Context 与 Reducer；当前有 9 个领域切片，包含 `projectMetaSlice` 与 `runtimeSlice`。撤销历史上限为 50 条。
- Stage 与 Node 的局部变量编辑、引用追踪均已有实现；Stage 变量可见性沿父级链收集。Branch 节点已有条件与 TRUE/FALSE 路径配置；Parallel 的专用 Inspector 当前为说明区域。
- `.puzzle.json` 保存完整项目及编辑器 UI 状态；`.export.json` 导出运行时数据。`useProjectActions` 在导出前调用六组工程校验，error 阻止导出，warning 写入消息堆栈后允许继续。
- `normalizeForExport` 深拷贝后清除画布位置、端口方向、阶段展开及参数绑定辅助字段，并规范化变量与常量值。当前实现保留 `displayOrder` 和参数绑定 `description`，与 [Export_Format_Changes.md](./Export_Format_Changes.md) 一致；下方 2026-03-04 历史摘要的相关剥离说明已不准确。
- 自动保存、上次项目恢复与外部文件变化监听均已有代码；外部同步用于资源状态合并，并非整个项目内容的自动重载。
- 仓库示例 `overview/example_project/BubbleHorror.puzzle.json` 可解析，包含 8 个 Stage、17 个 PuzzleNode / FSM、40 个 State、25 个 Transition、2 个演出图、28 个脚本、4 个全局变量与 8 个事件；该统计不代表示例已通过完整工程校验或引擎验证。

#### 本次验证与尚未验证的范围

- 前端：`node_modules/.bin/tsc.cmd --noEmit --pretty false`，退出码 0。
- Electron：`node_modules/.bin/tsc.cmd -p electron/tsconfig.json --noEmit --pretty false`，退出码 0。根 `tsconfig.json` 尚未启用 `strict`，Electron 配置已启用；旧文档的“TypeScript 严格模式”不能理解为整个仓库均已开启。
- 启动 Vite 并在浏览器检查编辑器空态、三栏布局、Editor/Blackboard 切换、Variables/Graphs 页签及项目菜单；检查期间未捕获到页面 warn/error 日志。
- 本次未进行项目创建或导入、复杂图编辑、保存/导出实际文件、Electron 原生窗口、打包、Unity 联调或大工程性能回归。代码入口存在不等于这些链路均已验收。
- `package.json` 当前没有自动化测试或 lint 脚本；Phase 5 的可靠性、性能和交付工作仍需按具体任务验证，不能据旧文档的阶段百分比推定全部完成。

### 最近更新（2026-03-04）

✅ **导出数据规范化（Export Data Normalization）**
- 新增 `utils/exportNormalizer.ts`，在导出前对数据深拷贝 + 清洗
- 值类型规范化：boolean/integer/float/string 值按声明类型强制修正
- 剥离 UI 专用字段：`isExpanded`、`displayOrder`、`position`（State/PresentationNode）、`fromSide`/`toSide`、`edgeProperties`
- 剥离 ParameterBinding 前端辅助字段：`id`、`kind`、`description`
- ConditionExpression 递归规范化（Literal.value 确保为 boolean、Comparison 补齐 operator）
- 数值字段规范化：`Transition.priority` 确保非负整数、`PresentationNode.duration` 确保正数
- 导出入口 `useProjectActions.ts` 已集成 `normalizeForExport()`
- 设计文档：`overview/dev/ExportNormalizer_Design.md`

### 历史更新（2026-02-23）

✅ **Preferences 自动保存功能（新增）**
- 在 Preferences 面板新增 `Auto Save` 开关与 `Interval (minutes)` 输入（默认 1 分钟）
- 新增全局自动保存调度 Hook（仅 Electron 生效，且仅在 `isDirty=true` 时触发）
- 偏好设置持久化新增 `autoSave` 字段，并兼容旧版 `preferences.json` 的默认值合并
- `Confirm Save` 流程统一改为调用 `saveProject`（不再误调用导出）


### 已完成阶段

✅ **Phase 1: 基础框架与数据浏览**（完成度: 100%）
- 视图切换（Editor ↔ Blackboard）
- Undo/Redo 历史管理
- 多画布导航（FSM/Presentation）

✅ **Phase 3: FSM 完整编辑功能**（完成度: 100%）
- 状态节点 CRUD
- 连线创建与编辑
- 触发器配置
- 条件表达式编辑器
- 参数修改器
- 演出绑定与参数传递
- 画布交互优化（框选、剪线、拖拽）

✅ **Phase 4: Stage 级别编辑与 Electron 集成**（完成度: 100%）
- [x] 黑板资源全功能编辑（变量/脚本/事件）
- [x] Stage 阶段树编辑（创建/删除/重命名/拖拽/局部变量）
- [x] PresentationGraph 编辑器基础功能集成
- [x] Electron 双进程架构与本地 I/O
- [x] v1.0.0-alpha 版本打包与发布

---

## 2. 代码库统计

### 2.1 目录结构（文件数量）

```
types/              9 个类型定义文件
store/
  ├─ slices/        7 个 Slice + 1 个索引文件
  └─ 核心文件        3 个（context, reducer, types）
api/                4 个文件
components/
  ├─ Layout/        5 个文件
  ├─ Explorer/      2 个文件
  ├─ Canvas/        ~8 个文件
  │  └─ Elements/   7 个文件
  ├─ Inspector/     ~32 个文件（合并 ConfirmDialog 后减少 1 个）
  │  ├─ condition/  多个子组件（已移除重复 ConfirmDialog）
  │  ├─ localVariable/  2 个文件
  │  └─ presentation/   2 个文件
  └─ Blackboard/    9 个文件
hooks/              4 个自定义 Hooks（合并 useKeyboardShortcuts 后减少 1 个）
utils/              13+ 个工具文件（新增 referenceNavigation、resourceFilters）
```

### 2.2 核心模块行数估算

| 模块 | 主要文件 | 行数范围 |
|------|---------|---------|
| StateMachineCanvas | StateMachineCanvas.tsx | ~520 行 |
| LocalVariableEditor | 主文件 + 2 个子组件 | ~400 行（已拆分） |
| PresentationBindingEditor | 主文件 + 2 个子组件 | ~450 行（已拆分） |
| ConditionEditor | 多层嵌套组件 | ~300 行 |
| Inspector 总计 | 33 个文件 | ~3000+ 行 |

---

## 3. 技术栈与工具

### 3.1 核心技术

- **框架**: React 18+ with TypeScript
- **状态管理**: Context API + Reducer（类 Redux 架构）
- **构建工具**: Vite
- **样式**: 全局 CSS（styles.css）

### 3.2 开发工具

- **调试**: `utils/debug.ts` 统一日志工具
- **校验**: `utils/validation/` 目录集中校验逻辑
- **常量**: `utils/constants.ts` 统一常量定义

### 3.3 代码质量工具

- 前端与 Electron TypeScript strict；ESLint 基本正确性、显式 any、Hook 与基础导入边界。
- Vitest + jsdom + React DOM：当前 187 个回归；另有真实 Electron 文件链路冒烟和生产模式性能基准。
- Prettier 渐进格式、UTF-8 检查与反向拦截测试；提交前执行 `npm run check`，构建与 Electron 冒烟单独执行。

---

## 4. 已实现核心功能清单

### 4.1 数据模型

? 完整的类型定义系统：
- ID 模板字符串类型（`stage-*`、`node-*` 等）
- 软删除状态机（Draft → Implemented → MarkedForDelete）
- 变量作用域系统（Global/StageLocal/NodeLocal/Temporary）
- 条件表达式 AST
- 演出绑定机制

### 4.2 状态管理

? 7 个领域 Slice：
- **fsmSlice**: 状态机 CRUD
- **presentationSlice**: 演出图 CRUD
- **nodeParamsSlice**: 节点局部变量
- **blackboardSlice**: 全局资源管理
- **navigationSlice**: 导航与视图
- **projectSlice**: Stage 树与 Node 更新
- **uiSlice**: 选择、消息、面板

? Undo/Redo 机制：
- 基于快照的历史管理
- 支持多级撤销/重做

### 4.3 UI 组件

? 布局系统：
- 三栏布局（Explorer + Canvas + Inspector）
- 可调整面板大小
- 响应式设计

? 画布编辑器：
- FSM 画布（状态节点、连线、框选、剪线）
- Presentation 画布（基础实现，修正节点吸附）
- 画布平移导航；独立缩放尚未实现
- 上下文菜单

? Inspector 面板：
- 33 个专用编辑器组件
- 条件表达式可视化编辑
- 参数绑定与修改器配置
- 触发器编辑
- 统一的删除保护逻辑与样式 (Refined)
- 智能属性面板 (Inspector Fallback: FSM & Presentation Node)
- PuzzleNode 快捷键删除修复 (Fixed Action Type & Simplified Confirmation Dialog - Fixed Redux State Retention)
- 智能属性面板 (Inspector Fallback Mechanism)
- PuzzleNode 快捷键删除修复 (Fixed Action Type & Added Confirmation Dialog)

? Blackboard 管理：
- 全局变量/事件/脚本浏览
- 按状态/类型筛选
- 按状态/类型筛选
- 快捷键删除支持 (Presentation Graphs now deletable in Blackboard view)
- 软删除确认流程
- 资源拖拽排序（Drag-and-Drop Reordering）

### 4.4 交互功能

? 快捷键系统：
- Ctrl+Z / Ctrl+Y (Undo/Redo)
- Delete (删除选中元素)
- Ctrl+拖拽 (剪线模式)
- 双击/Backspace (导航返回)

? 画布交互：
- 单击选中
- 拖拽移动
- 框选多选
- 连线创建（拖拽端点）

? 校验与提示：
- FSM 拓扑校验（环检测、孤岛检测）
- 变量引用检查
- 全局消息堆栈（info/warning/error）

---

## 4.5 代码复用重构（P1/P2）

✅ **P1-1: 提取 navigateToReference 工具函数**
- 新增 `utils/referenceNavigation.ts`，集中处理 6 种 targetType 的引用导航逻辑
- 替换了 5 个 Inspector 文件中 ~392 行重复的 switch-case 代码：
  - VariableInspector、ScriptInspector、EventInspector、PresentationGraphInspector、LocalVariableEditor
- 每个文件的 `handleReferenceClick` 从 50-120 行缩减为 2-3 行

✅ **P1-2: 合并重复 ConfirmDialog 组件**
- 删除 `components/Inspector/condition/ConfirmDialog.tsx`（104 行）
- ConditionEditor 改用共享的 `components/Inspector/ConfirmDialog.tsx`
- 从 `condition/index.ts` 中移除无用的 re-export

✅ **P2-1: 合并键盘快捷键 Hook**
- 删除 `hooks/useKeyboardShortcuts.ts`（98 行）
- StateMachineCanvas 改用 `hooks/useGraphKeyboardShortcuts.ts`（参数适配）
- 两个 Hook 功能完全重叠：Escape 清除多选、Ctrl 切线模式、Shift 连线键

✅ **P2-2: 提取 MarkedForDelete 过滤工具函数**
- 新增 `utils/resourceFilters.ts`，导出 `filterActiveResources<T>()` 和 `filterActiveOrSelected<T>()`
- 替换了 9 个文件共 10 处的内联 `.filter(v => v.state !== 'MarkedForDelete')` 调用

---

## 5. 已知限制与待完善项

### 5.1 待完善功能

**Stage 局部变量**：已支持 Stage 与 Node 的声明、作用域选择及引用导航，不再作为未实现项。

? **Stage Inspector 滚动记忆**:
- 已修复 Stage Inspector 切换时不保留滚动位置的问题（与 PuzzleNode Inspector 行为一致）

**PresentationGraph 编辑器**：基础画布及 Branch 条件/分支已有实现；Parallel 专用 Inspector 仍需完善。独立画布缩放与多节点整体撤销待补齐。

**自动化测试（第六批更新）**:
- 当前 187 个回归覆盖 Store、会话、导入、诊断/引用导航、变量作用域、图交互/几何、条件与引用统计；另有 11 项 Electron 实际链路检查。
- CI 尚未接入；性能基准手动运行，不将机器相关毫秒阈值作为普通单测断言。

? **高级校验**:
- 跨资源循环引用检测
- 变量类型兼容性检查

### 5.3 性能测量与后续边界

- 第六批已测至单 FSM 300 状态、单演出图 160 节点、全工程 1,824 状态；批量引用统计解决本轮黑板超预算问题，尚无依据强制引入虚拟化或更换 Store。
- 已测 50 次位置修改后的 GC 堆趋势；混合大对象编辑、长期会话与更大规模仍需独立测量。
- 独立画布缩放先补齐功能再测性能；主 JS 包体告警、整窗绘制/FPS 和安装包冷启动尚未关闭。

---

## 6. 文档同步状态

? **已同步文档**:
- `Architecture_Guide.md` - 反映 7 个 Slice 和最新组件结构
- `Domain_Model.md` - 包含完整的 Store 状态结构
- `Implementation_Status.md` - 本文档

? **保持更新的文档**:
- `Phase3/P3_Code_Review_3.md` - 最新代码审查结果
- `UX_Flow.md` - 用户交互流程规范

?? **可能过时的文档**:
- `Phase2_Guide.md` - 部分内容可能与当前实现有差异

---

## 7. 下一步计划

当前架构与规范修复顺序以 [Architecture_Repair_Plan.md](./Architecture_Repair_Plan.md) 为准。以下保留历史阶段待办，实施前需核对当前源码及最新审查结果。

### Phase 4 优先级排序

1. **Stage 局部变量支持**: 扩展 LocalVariableEditor
2. **PresentationGraph 编辑器**: 完善节点类型支持
3. **单元测试基础设施**: 添加 Vitest + React Testing Library
4. **高级校验**: 跨资源引用检测

---

## 8. 贡献指南

### 添加新功能前

1. 阅读 `Architecture_Guide.md` 了解分层规则
2. 阅读 `Domain_Model.md` 了解数据模型
3. 检查 `UX_Flow.md` 确认交互规范

### 代码规范

- 所有重要代码必须包含中文注释
- 组件超过 400 行需考虑拆分
- 禁止内联样式，使用全局 CSS
- React.memo 组件必须添加 displayName
- 新增工具函数必须放在 `utils/` 下

### 提交前检查

- [ ] TypeScript 编译无错误
- [ ] 核心逻辑包含中文注释
- [ ] 更新相关文档（如修改了类型或架构）
- [ ] 测试 Undo/Redo 功能
- [ ] 检查浏览器控制台无错误

---

**文档维护**: 本文档应在每个 Phase 完成后更新，确保反映最新的项目状态。
