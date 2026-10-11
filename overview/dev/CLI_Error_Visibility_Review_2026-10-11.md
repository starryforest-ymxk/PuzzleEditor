# Skill 与 CLI 报错可见性核查

## 范围与结论

核查当前已安装的 PuzzleEditor Skill、CLI 帮助和在线协议实现。此任务仅确认能力，不修改软件、Skill 或工程数据。

Skill 可指导 Agent 调用 CLI 读取工程校验诊断、CLI 操作失败以及安装/连接诊断。当前没有读取桌面 Message Stack、弹窗消息历史、渲染进程控制台或 Electron 运行日志的接口，也没有错误消息订阅能力。

## 支持范围

| 来源                             | 读取方式                                                                   | 说明                                                                                     |
| -------------------------------- | -------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| 磁盘工程的结构与领域校验         | `puzzle validate <path> --json`                                            | 返回 `data.valid/errors/warnings`、`diagnostics`；校验失败退出码为 3                     |
| 桌面内存工程的领域校验           | `puzzle session validate --instance <instance> --session <session> --json` | 返回 `data.result.valid` 和诊断；读取已进入 Store 的未保存内容，不提交尚未完成的表单草稿 |
| 编辑或保存等 CLI 请求失败        | 对应命令结果                                                               | 检查 `ok`、`error.code/message/retryable`、`diagnostics` 与退出码                        |
| 安装、Skill 完整性与显式会话连接 | `puzzle doctor`                                                            | 环境与连接诊断，不读取桌面消息列表                                                       |
| 顶栏消息堆栈                     | 当前不支持                                                                 | UI 读取 `state.ui.messages`，在线协议没有对应查询                                        |
| 弹窗、JS 控制台与 Electron 日志  | 当前不支持                                                                 | 需要另外的 UI 检查或日志工具；不会因安装 Skill 自动变为可读                              |

诊断包含 `code`、`level`、`message`、`retryable`，按规则和定位条件可另有 `entity`、`path`、`pathBasis`、`location`、`operationIndex`。同一校验器同时用于 GUI 和 CLI，但重新计算校验结果不等于读取 GUI 已显示的消息历史。在线校验请求成功时可能仍有 error 诊断，不能只依据 `ok` 或退出码判断工程有效。

## 实现依据

- 已安装 Skill `C:\Users\吴迪\.agents\skills\puzzle-editor\SKILL.md` 要求 Agent 检查诊断与剩余错误，并明确选择桌面实例/会话。
- [在线应用服务](../../services/onlineSession.ts)的 `inspect/validate` 调用统一 `validateProject`，响应只包含会话元数据、查询结果与领域诊断。
- [诊断转换](../../services/automation/diagnostics.ts)将 GUI 校验规则转为机器可定位的诊断。
- [在线请求契约](../../contracts/automation/sessionSchemas.ts)未登记消息、日志或控制台查询。
- [消息堆栈面板](../../components/Layout/MessageStackPanel.tsx)直接读取 UI 状态；[项目会话服务](../../services/projectSession.ts)将加载、保存、导出等提示写入该列表。

## 本次验证

1. 已安装 CLI 的 `validate --help`、`session validate --help`、`doctor --help`均可正常读取，参数与现有契约一致。
2. 使用安装在 `D:\Tools\PuzzleEditorCLI` 的 CLI，只读校验仓库测试样本 `tests/fixtures/imports/legacy-88477b7.export.json`：返回 `ok=false`、`valid=false`、19 errors、0 warnings，CLI 退出码 3。实际诊断包含资产名缺失、触发器事件引用缺失、生命周期脚本复用等，可定位实体与字段路径。
3. 校验前后测试样本 SHA-256 一致。未打开、修改或校验当前用户业务工程。
4. 在线校验可见性依据现有源码、契约和安装帮助核查；本次没有执行桌面会话校验，不把帮助检查作为在线实测。

此任务没有 GUI 或业务逻辑变更，无新增 UX_Flow 交互，无需重复完整构建与浏览器回归。完整读取软件报错的后续缺口是消息堆栈和运行日志的只读接口。

## 当前桌面消息栈实读

用户随后要求获取当前打开的 PuzzleEditor 消息栈。通过 computer-use 的 Windows 窗口截图与可访问性文本读取当前唯一的 Puzzle Editor 窗口，工程名为 BubbleHorror。CLI 仍无消息栈查询接口，本次结果来自桌面 UI。

消息时间均为 18:41:29，当前总计 4 条：1 info、3 warning、0 error。

| 等级    | 原文或定位                                                             | 内容                                                                         |
| ------- | ---------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| info    | `Project "BubbleHorror" restored.`                                     | 工程已恢复                                                                   |
| warning | `stateMachines[FSM_5].transitions[TRANS_7].presentation.parameters[0]` | `Restored parameter editor identity/source kind without changing its value.` |
| warning | `stateMachines[FSM_6].transitions[TRANS_8].presentation.parameters[0]` | 同上                                                                         |
| warning | `stateMachines[FSM_7].transitions[TRANS_9].presentation.parameters[0]` | 同上                                                                         |

读取时恢复了原先最小化的窗口；消息面板原本已打开。为读取 info，临时打开 info 筛选并在结束时恢复原状态。未清空消息，未编辑、保存或校验工程。消息栈中 error 为零仅说明这次读取时没有 error 消息，不代表工程已通过全部校验。

## 三条参数警告的原因与归责

### 核查结论

三条警告来自 CLI 领域参数构造、候选序列化和桌面导入提示之间的不一致。原始 AI 计划遵守了 CLI 契约；不能将缺少 `id/kind` 归因于调用方没有按规范填写。这两个字段属于编辑器辅助信息，应该由工具内部统一生成。

当前工程磁盘 SHA-256 为 `cf11b7ac6075de9bcb5d5a367c2cb7bfbc9ab756c8e00272cbfc0f20cd36af11`，与保存的 CLI apply 结果一致。三处 `SourceKey` 分别为厨房水槽的 `sink`、二楼洗衣机的 `washer`、马桶的 `toilet`；绑定均属于 Performance `BH_CloseBubbleSource`。原始 248 项领域计划中三处参数都包含 `paramName/source/description`，未直接编写完整工程文件。

### 原因链

1. [CLI 计划契约](../../contracts/automation/planSchemas.ts)的普通参数为严格对象，只允许 `paramName/source/description`，没有 `id` 或 `kind`。用户或 Agent 不能通过补这两个字段绕过问题。
2. [领域绑定构造](../../store/commands/automation/bindings.ts)转换了参数来源和资源引用，但未为普通参数补齐辅助 `id/kind`。
3. [候选构建](../../services/automation/domainCandidate.ts)先序列化未补齐的执行结果为 `content`，再通过导入得到规范化后的 `project` 并校验。文件写入服务发布的是之前的 `content`，因此规范化补齐结果没有进入最终落盘文件。
4. [桌面导入规范化](../../utils/projectNormalizer.ts)遇到缺少 `id/kind` 的参数时，补齐 `import-param-1` 和 `Variable`，保留 `paramName/source/value` 并产生导入提示。
5. [桌面项目会话](../../services/projectSession.ts)把所有导入提示写为 warning；CLI 则将其放入独立的 `data.importNotices`，`warnings` 和 `--warnings-as-errors` 只依据领域诊断。因此 CLI 的 0 warning 与桌面消息栈的 3 warning 可以同时出现。

### 实测证据

- 使用当前已安装 CLI，只读重放 `RepairBackups/PuzzleProjectCreation_20261011` 中原始 seed 与原始 plan 的 preview：退出码 0、`ok=true`、`remainingErrors=0`、空 diagnostics。没有新增回执或项目文件。
- 在内存中的原计划为第一处普通参数添加 `id=import-param-1`、`kind=Variable`，通过 stdin 进行只读 preview：退出码 2、`INVALID_CONTRACT`，明确返回 `Unrecognized keys: "id", "kind"`，定位 `/commands/177/data/presentation/parameters/0`。未修改原计划文件。
- 只读运行当前工程 `validate --warnings-as-errors`：`valid=true`、0 errors、0 warnings，同时包含与桌面完全对应的三条 importNotices。
- 当前工程内容与最初 apply 结果的指纹一致；原始计划的三个常量与磁盘文件的三个常量一致。

BubbleHorror 工程文档中“这不是警告”的表述不够准确，应理解为“不是领域校验 warning，属于被桌面显示为 warning 的导入提示”。本次未修改该工程、原始计划、桌面程序或 CLI，也未把只读诊断任务扩展为修复。

后续修复应在共享领域层生成一致的辅助元数据，确保预览、校验、落盘与重新打开使用一致的候选形态；导入提示应按实际严重程度分类，并增加领域计划输出重新打开后无需补齐的回归检查。保持普通参数的公开输入契约兼容，不要求 Agent 手填编辑器辅助字段。

## 后续修复状态

上述问题已在本轮源码中修复：参数补齐共用规则、文件最终候选重新序列化、GUI/CLI 提示等级一致。816 项完整检查、50 项真实 Electron 在线及原始 248 项领域计划的浏览器验证通过；新文件重开没有参数恢复提示。已安装版本和原业务工程未改写，原根因描述对应修复前行为。完整证据与交付边界见 [修复报告](./CLI_Parameter_Consistency_Fix_2026-10-11.md)。
