# 共用数据结构

[返回使用指南](cli-guide.md) · [领域示例](workflows.md#domain-examples)

## 文件与编辑计划

`.puzzle.json` 是完整工程，包含 fileType、editorVersion、savedAt、project 和可选 editorState。运行时导出不是可编辑工程；先用 import 转换。完整只读通过 json read 或 session inspect --view project 获取。

领域计划包含 apiVersion、scope、commands；修改已有工程必须加 sourceHash，新建工程禁止提供 sourceHash。commands 最多 10000 项。计划是受限操作列表，编写计划不属于直接修改完整工程 JSON。

| 值 | 来源和用途 |
|---|---|
| 离线 sourceHash / expectedHash | inspect 或 json read 的 data.source.sha256，绑定源文件原始 UTF-8 字节 |
| 在线 sourceHash | session status 的 data.token.contentHash，绑定内存内容 |
| token | 完整保存 data.token 对象，含 instanceId/sessionId/contentEpoch/contentHash |
| expectedDiskHash | 当前磁盘文件 json read 返回的 SHA-256，用于获授权覆盖保存 |
| receipt | preview 生成的原始回执对象；用 receipt-out 落盘，不能把整个结果信封作为回执 |
| requestId | 13 位 Unix 毫秒加冒号加 UUID；提交前保存，未知结果重试必须保持原 ID/内容 |

## scope 和身份

scope 可声明 project=true，或 stages、puzzles、presentations 引用数组及 globals（variable/event/script）类别。修改必须落在声明范围内；层级移动/删除可能影响原父级、新父级及初始兄弟。正式工程优先精确范围；教学样本使用完整工程范围以独立展示操作。

| 结构 | 写法 | 含义 |
|---|---|---|
| 现有引用 | `{"id":"room"}` | 指向查询确认的 ID |
| 同计划引用 | `{"alias":"newRoom"}` | 指向该计划创建的新实体；alias 不能跨计划使用 |
| 新工程根引用 | `{"alias":"root"}` | create 计划可引用自动创建的根 Stage；已有工程使用根 ID |
| FSM 引用 | `{"id":"door-fsm"}` 或 `{"puzzle":{"id":"door"}}` | FSM 本身或其所属 Puzzle |
| 全局变量归属 | `{"type":"global"}` | 领域操作中的全局变量 owner |
| Stage/Puzzle 归属 | `{"type":"stage","ref":{"id":"room"}}` | type 可为 stage 或 puzzle，ref 指所属实体 |

状态和迁移 ID 必须结合 FSM；图节点结合 Graph；变量结合 owner。不同归属可能有相同局部 ID。import 名称映射中的全局 ownerType 是 project，与领域 owner.type=global 是不同契约，不混用。

创建时明确提供所有需要的 assetName，包括根 Stage、Puzzle 连带初始状态及命名资源。格式遵循 describe.namingSchemas；不自动翻译、去空白或补后缀。图、图节点及迁移没有 assetName 字段，不能自行添加未知字段。

## 修改语义

changes 中省略字段表示保留；显式空数组替换为无条目；数组整体替换，不是追加。只有 Schema 接受 null 的字段才可用 null 清除，例如条件、演出绑定及生命周期脚本引用。对象更新按具体白名单处理，不提供任意 JSON Pointer 修改。

## 条件、触发器和监听器

条件递归由以下变体组成，字段严格匹配，不能混合未知字段：

| type | 字段 | 含义 |
|---|---|---|
| And / Or | children：至少一个条件 | 全部满足 / 任一满足 |
| Not | operand：一个条件 | 取反 |
| Literal | value：boolean | 固定真值 |
| Comparison | operator、left、right | operator 为 ==、!=、>、<、>=、<=；两端是 ValueSource，类型须可比较 |
| ScriptRef | scriptId：Ref | 引用 Condition 脚本 |

触发器 type 为 Always、HandledByScript、OnEvent（eventId: Ref）或 CustomScript（scriptId: Ref，Trigger 分类）。监听器包含 eventId 和 action；action 是 `{"type":"InvokeScript"}` 或 `{"type":"ModifyParameter","modifiers":[...]}`。InvokeScript 变体没有 scriptId 字段，不能凭名字猜测扩展。

## 值、变量修改和演出参数

ValueSource 为 `{"type":"Constant","value":...}` 或 `{"type":"VariableRef","variableId":{"id":"draft"},"scope":"Global"}`。scope 可为 Global、StageLocal、NodeLocal，仍须在调用上下文可见。

ParameterModifier 包含 targetVariableId、targetScope、operation、source。Set 赋值；Add/Subtract/Multiply/Divide 用于数值；Toggle 用于布尔。CLI 会校验变量类型和来源兼容性；integer 值必须为整数。

PresentationBinding 为 `{"type":"Graph","graphId":Ref}`，或 `{"type":"Script","scriptId":Ref,"parameters":[...]}`。Script 必须属于 Performance。

普通参数包含 paramName、source、可选 description。Temporary 参数还包含 kind="Temporary" 与 tempVariable（name、type、可选 description）；source 仍然必需。这些临时声明是演出参数，不是可任意移动的黑板资源。

## 演出图和资源生命周期

图节点 type 为 PresentationNode、Wait、Branch、Parallel。Wait 使用非负 duration；Branch 使用 condition；PresentationNode 使用演出绑定。连线由 graph、from、slot 定位：普通/Wait 为 next，Branch 为 true/false，Parallel 为非负顺序索引。style 包含 fromSide/toSide，可选 top/right/bottom/left 或 null。不直接替换 nextIds；不允许跨图连接。

变量、事件、脚本的 Draft 可以普通删除；Implemented 普通删除变为 MarkedForDelete；restore 恢复为 Implemented；purge 永久移除受保护资源。CLI 不提供把 Draft 标为 Implemented 的领域操作，这个状态由外部资源实现流程同步。不能为了演练而在真实工程中直接改状态 JSON。

## 结果与诊断

通常 stdout 是一个对象：apiVersion、ok、command、data、diagnostics，以及失败时的 error。必须同时检查进程退出码与 ok。diagnostics 包含 level、code、message 和可选 path/pathBasis/operationIndex；request 路径定位输入计划，工程路径定位数据问题。

--raw 是原文输出例外。原始 JSON 有重复键或无法无损表达的数字时，json read 仍能读取原文，但结构化编辑可能拒绝。已有业务错误可按基线保留，不代表结果可导出；remainingErrors 必须报告，export 遇到 error 会阻断。
