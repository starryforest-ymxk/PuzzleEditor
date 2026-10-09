# 桌面会话与历史命令

[返回使用指南](cli-guide.md) · [权限与错误](permissions-errors.md)

每个示例列出一次调用。需要的工程、计划、token、回执和 PowerShell 变量须按[快速入门](quick-start.md)或[完整教程](workflows.md)准备。示例路径按实际包位置替换；高权限示例仅在已有相应聊天授权时执行。

- [history list](#history-list)
- [history undo](#history-undo)
- [history redo](#history-redo)
- [session list](#session-list)
- [session status](#session-status)
- [session inspect](#session-inspect)
- [session validate](#session-validate)
- [session preview](#session-preview)
- [session apply](#session-apply)
- [session save](#session-save)

<a id="history-list"></a>
## history list

读取 GUI/CLI 共用的撤销与重做历史。

```text
puzzle history list --instance <instance> --session <session> [--json] [--help]
```

| 参数 | 类型 / 枚举 | 必填 / 默认 | 含义与限制 |
|---|---|---|---|
| `--instance` | string | 必填 | session list 中用户明确选择的 instanceId，不能猜第一个窗口。 pattern="^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}\|00000000-0000-0000-0000-000000000000\|ffffffff-ffff-ffff-ffff-ffffffffffff)$"; format="uuid" |
| `--session` | integer | 必填 | 对应实例中的 sessionId；必须与 instance 配对。 minimum=0; maximum=9007199254740991 |
| `--json` | boolean | 可选 | 明确请求默认的 JSON 结果信封；与 raw 互斥。 |
| `--help`, `-h` | boolean | 可选 | 显示本命令帮助，不执行命令。 |

前置条件与组合规则：

- 桌面必须运行且协议兼容，使用明确实例/会话；连接失败不能回退磁盘写入。

权限与副作用：`read`。不提交工程写入；preview 可另写回执，在线预览可提交有效字段草稿。

```powershell
puzzle history list --instance $instance --session $session --json
```

结果检查：data.token、data.history.undoEntryId/redoEntryId、history.past/future 和每条 requiredCapabilities。

常见失败与处理：

- INVALID_ARGUMENT / DUPLICATE_ARGUMENT：按语法、参数组合和类型修正；不要重复传同一选项。
- 会话不可用、版本冲突、pending/busy：重新读取状态或处理桌面交互；未知写入结果遵守同 requestId 重试规则。

<a id="history-undo"></a>
## history undo

撤销当前顶部一条历史，只改内存。

```text
puzzle history undo --instance <instance> --session <session> --token <token> --entry-id <entryId> --request-id <requestId> [--allow-overwrite] [--allow-permanent-delete] [--allow-raw-json-write] [--json] [--help]
```

| 参数 | 类型 / 枚举 | 必填 / 默认 | 含义与限制 |
|---|---|---|---|
| `--instance` | string | 必填 | session list 中用户明确选择的 instanceId，不能猜第一个窗口。 pattern="^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}\|00000000-0000-0000-0000-000000000000\|ffffffff-ffff-ffff-ffff-ffffffffffff)$"; format="uuid" |
| `--session` | integer | 必填 | 对应实例中的 sessionId；必须与 instance 配对。 minimum=0; maximum=9007199254740991 |
| `--token` | string | 必填 | 保存最新 data.token 对象的 UTF-8 JSON 文件，不是完整命令结果。 minLength=1 |
| `--entry-id` | string | 必填 | history list 返回的当前方向顶部 undoEntryId/redoEntryId。 pattern="^\\d+:\\d+$" |
| `--request-id` | string | 必填 | 首次执行前保存的 13 位 Unix 毫秒:UUID；结果未知时重用相同 ID 和内容。 pattern="^\\d{13}:[0-9a-f-]{36}$" |
| `--allow-overwrite` | boolean | 可选 | 声明已有本任务的聊天覆盖授权；该参数本身不授予权限。  |
| `--allow-permanent-delete` | boolean | 可选 | 声明已有受保护资源永久删除的聊天授权。  |
| `--allow-raw-json-write` | boolean | 可选 | 声明已有直接修改工程 JSON 的聊天授权。  |
| `--json` | boolean | 可选 | 明确请求默认的 JSON 结果信封；与 raw 互斥。 |
| `--help`, `-h` | boolean | 可选 | 显示本命令帮助，不执行命令。 |

前置条件与组合规则：

- 桌面必须运行且协议兼容，使用明确实例/会话；连接失败不能回退磁盘写入。
- 结果未知时在 10 分钟内仅重试原 requestId 和原内容；超期先核对结果。忙碌/无效草稿先交由用户处理。

权限与副作用：`semantic_write`。操作效果见本条用途；提交必须检查实际 requiredCapabilities，普通编辑许可不包含三项最高权限。

```powershell
puzzle history undo --instance $instance --session $session --token "history-token.json" --entry-id $entryId --request-id $requestId --json
```

结果检查：新的 token 和历史位置；这不是磁盘回滚，也不会跳过人工编辑。

常见失败与处理：

- INVALID_ARGUMENT / DUPLICATE_ARGUMENT：按语法、参数组合和类型修正；不要重复传同一选项。
- 会话不可用、版本冲突、pending/busy：重新读取状态或处理桌面交互；未知写入结果遵守同 requestId 重试规则。
- 退出码 6：缺少能力声明。先确认已有聊天授权及其范围，再声明相应能力；flag 不构成授权。

<a id="history-redo"></a>
## history redo

重做当前顶部一条历史，按实际效果重新检查能力声明。

```text
puzzle history redo --instance <instance> --session <session> --token <token> --entry-id <entryId> --request-id <requestId> [--allow-overwrite] [--allow-permanent-delete] [--allow-raw-json-write] [--json] [--help]
```

| 参数 | 类型 / 枚举 | 必填 / 默认 | 含义与限制 |
|---|---|---|---|
| `--instance` | string | 必填 | session list 中用户明确选择的 instanceId，不能猜第一个窗口。 pattern="^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}\|00000000-0000-0000-0000-000000000000\|ffffffff-ffff-ffff-ffff-ffffffffffff)$"; format="uuid" |
| `--session` | integer | 必填 | 对应实例中的 sessionId；必须与 instance 配对。 minimum=0; maximum=9007199254740991 |
| `--token` | string | 必填 | 保存最新 data.token 对象的 UTF-8 JSON 文件，不是完整命令结果。 minLength=1 |
| `--entry-id` | string | 必填 | history list 返回的当前方向顶部 undoEntryId/redoEntryId。 pattern="^\\d+:\\d+$" |
| `--request-id` | string | 必填 | 首次执行前保存的 13 位 Unix 毫秒:UUID；结果未知时重用相同 ID 和内容。 pattern="^\\d{13}:[0-9a-f-]{36}$" |
| `--allow-overwrite` | boolean | 可选 | 声明已有本任务的聊天覆盖授权；该参数本身不授予权限。  |
| `--allow-permanent-delete` | boolean | 可选 | 声明已有受保护资源永久删除的聊天授权。  |
| `--allow-raw-json-write` | boolean | 可选 | 声明已有直接修改工程 JSON 的聊天授权。  |
| `--json` | boolean | 可选 | 明确请求默认的 JSON 结果信封；与 raw 互斥。 |
| `--help`, `-h` | boolean | 可选 | 显示本命令帮助，不执行命令。 |

前置条件与组合规则：

- 桌面必须运行且协议兼容，使用明确实例/会话；连接失败不能回退磁盘写入。
- 结果未知时在 10 分钟内仅重试原 requestId 和原内容；超期先核对结果。忙碌/无效草稿先交由用户处理。

权限与副作用：`semantic_write`。操作效果见本条用途；提交必须检查实际 requiredCapabilities，普通编辑许可不包含三项最高权限。

```powershell
puzzle history redo --instance $instance --session $session --token "history-token.json" --entry-id $entryId --request-id $requestId --json
```

结果检查：新的 token 和历史位置；永久删除可能建立不可恢复边界。

常见失败与处理：

- INVALID_ARGUMENT / DUPLICATE_ARGUMENT：按语法、参数组合和类型修正；不要重复传同一选项。
- 会话不可用、版本冲突、pending/busy：重新读取状态或处理桌面交互；未知写入结果遵守同 requestId 重试规则。
- 退出码 6：缺少能力声明。先确认已有聊天授权及其范围，再声明相应能力；flag 不构成授权。

<a id="session-list"></a>
## session list

发现同一用户的本地桌面会话，供明确选择目标。

```text
puzzle session list [--json] [--help]
```

| 参数 | 类型 / 枚举 | 必填 / 默认 | 含义与限制 |
|---|---|---|---|
| `--json` | boolean | 可选 | 明确请求默认的 JSON 结果信封；与 raw 互斥。 |
| `--help`, `-h` | boolean | 可选 | 显示本命令帮助，不执行命令。 |

前置条件与组合规则：

- 桌面必须运行且协议兼容，使用明确实例/会话；连接失败不能回退磁盘写入。

权限与副作用：`read`。不提交工程写入；preview 可另写回执，在线预览可提交有效字段草稿。

```powershell
puzzle session list --json
```

结果检查：data 中的实例和会话信息，以及不可用或不兼容状态；不要自动取第一项。

常见失败与处理：

- INVALID_ARGUMENT / DUPLICATE_ARGUMENT：按语法、参数组合和类型修正；不要重复传同一选项。
- 会话不可用、版本冲突、pending/busy：重新读取状态或处理桌面交互；未知写入结果遵守同 requestId 重试规则。

<a id="session-status"></a>
## session status

查询所选会话的最新内存版本和编辑状态。

```text
puzzle session status --instance <instance> --session <session> [--json] [--help]
```

| 参数 | 类型 / 枚举 | 必填 / 默认 | 含义与限制 |
|---|---|---|---|
| `--instance` | string | 必填 | session list 中用户明确选择的 instanceId，不能猜第一个窗口。 pattern="^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}\|00000000-0000-0000-0000-000000000000\|ffffffff-ffff-ffff-ffff-ffffffffffff)$"; format="uuid" |
| `--session` | integer | 必填 | 对应实例中的 sessionId；必须与 instance 配对。 minimum=0; maximum=9007199254740991 |
| `--json` | boolean | 可选 | 明确请求默认的 JSON 结果信封；与 raw 互斥。 |
| `--help`, `-h` | boolean | 可选 | 显示本命令帮助，不执行命令。 |

前置条件与组合规则：

- 桌面必须运行且协议兼容，使用明确实例/会话；连接失败不能回退磁盘写入。

权限与副作用：`read`。不提交工程写入；preview 可另写回执，在线预览可提交有效字段草稿。

```powershell
puzzle session status --instance $instance --session $session --json
```

结果检查：data.token、dirty、pendingEdits、保存限制；token 只在对应实例/会话有效。

常见失败与处理：

- INVALID_ARGUMENT / DUPLICATE_ARGUMENT：按语法、参数组合和类型修正；不要重复传同一选项。
- 会话不可用、版本冲突、pending/busy：重新读取状态或处理桌面交互；未知写入结果遵守同 requestId 重试规则。

<a id="session-inspect"></a>
## session inspect

查询已提交的内存工程；project 视图返回完整内存工程 JSON。

```text
puzzle session inspect [--view <view>] [--type <type>] [--id <id>] [--owner-type <ownerType>] [--owner-id <ownerId>] [--search <search>] [--stage-id <stageId>] [--node-id <nodeId>] [--depth <depth>] [--offset <offset>] [--limit <limit>] --instance <instance> --session <session> [--json] [--help]
```

| 参数 | 类型 / 枚举 | 必填 / 默认 | 含义与限制 |
|---|---|---|---|
| `--view` | "summary" \| "tree" \| "entities" \| "fsm" \| "presentation" \| "references" \| "variables" \| "bindings" \| "project" | 可选；默认 `"summary"` | 查询视图；可用参数因视图而异，见本页视图表。  |
| `--type` | "stage" \| "puzzle" \| "fsm" \| "state" \| "transition" \| "presentation" \| "presentation-node" \| "variable" \| "event" \| "script" | 可选 | 实体或绑定资源类型，不能用显示名称代替。  |
| `--id` | string | 可选 | 准确实体 ID；FSM/演出视图分别使用 FSM/Graph ID。 minLength=1; pattern="\\S" |
| `--owner-type` | "stage" \| "puzzle" \| "fsm" \| "presentation" \| "project" | 可选 | 子实体所属对象类型，必须与 ownerId 一起提供。  |
| `--owner-id` | string | 可选 | 所属对象 ID，避免不同 FSM/Graph/变量域中的同名 ID 混淆。 minLength=1; pattern="\\S" |
| `--search` | string | 可选 | 列表名称/标识搜索，不能与 id 同用。 minLength=1; pattern="\\S" |
| `--stage-id` | string | 可选 | variables 视图的 Stage 上下文 ID。 minLength=1; pattern="\\S" |
| `--node-id` | string | 可选 | variables 视图的 Puzzle 上下文 ID。 minLength=1; pattern="\\S" |
| `--depth` | integer | 可选；默认 `16` | tree 视图的最大遍历深度。 minimum=0; maximum=128 |
| `--offset` | integer | 可选；默认 `0` | 列表分页的起始偏移量；精确实体查询不能分页。 minimum=0; maximum=9007199254740991 |
| `--limit` | integer | 可选；默认 `100` | 每页条目上限；精确实体查询不能分页。 minimum=1; maximum=1000 |
| `--instance` | string | 必填 | session list 中用户明确选择的 instanceId，不能猜第一个窗口。 pattern="^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}\|00000000-0000-0000-0000-000000000000\|ffffffff-ffff-ffff-ffff-ffffffffffff)$"; format="uuid" |
| `--session` | integer | 必填 | 对应实例中的 sessionId；必须与 instance 配对。 minimum=0; maximum=9007199254740991 |
| `--json` | boolean | 可选 | 明确请求默认的 JSON 结果信封；与 raw 互斥。 |
| `--help`, `-h` | boolean | 可选 | 显示本命令帮助，不执行命令。 |

前置条件与组合规则：

- 视图限制在下表列出；owner-type/owner-id 必须成对；id/search 互斥；精确实体不能分页。
- 桌面必须运行且协议兼容，使用明确实例/会话；连接失败不能回退磁盘写入。

权限与副作用：`read`。不提交工程写入；preview 可另写回执，在线预览可提交有效字段草稿。

```powershell
puzzle session inspect --instance $instance --session $session --view project --json
```

结果检查：data 中的查询结果；字段草稿尚未提交时应结合 status 的 pendingEdits 判断。

常见失败与处理：

- INVALID_ARGUMENT / DUPLICATE_ARGUMENT：按语法、参数组合和类型修正；不要重复传同一选项。
- 会话不可用、版本冲突、pending/busy：重新读取状态或处理桌面交互；未知写入结果遵守同 requestId 重试规则。

| view | 允许的查询选项 |
|---|---|
| `project` | 无过滤参数 |
| `summary` | 无过滤参数 |
| `tree` | `--id`、`--depth`、`--offset`、`--limit` |
| `entities` | `--type`、`--id`、`--owner-type`、`--owner-id`、`--search`、`--offset`、`--limit` |
| `fsm` | `--id`、`--search`、`--offset`、`--limit` |
| `presentation` | `--id`、`--search`、`--offset`、`--limit` |
| `references` | `--type`、`--id`、`--owner-type`、`--owner-id`、`--offset`、`--limit` |
| `variables` | `--stage-id`、`--node-id`、`--offset`、`--limit` |
| `bindings` | `--type`、`--search`、`--offset`、`--limit` |

references 要求 type/id；bindings 的 type 只接受 script/event/presentation。默认值由 Schema 注入不表示可以在其他视图显式传入这些选项。

<a id="session-validate"></a>
## session validate

校验所选桌面会话的当前内存工程。

```text
puzzle session validate --instance <instance> --session <session> [--json] [--help]
```

| 参数 | 类型 / 枚举 | 必填 / 默认 | 含义与限制 |
|---|---|---|---|
| `--instance` | string | 必填 | session list 中用户明确选择的 instanceId，不能猜第一个窗口。 pattern="^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}\|00000000-0000-0000-0000-000000000000\|ffffffff-ffff-ffff-ffff-ffffffffffff)$"; format="uuid" |
| `--session` | integer | 必填 | 对应实例中的 sessionId；必须与 instance 配对。 minimum=0; maximum=9007199254740991 |
| `--json` | boolean | 可选 | 明确请求默认的 JSON 结果信封；与 raw 互斥。 |
| `--help`, `-h` | boolean | 可选 | 显示本命令帮助，不执行命令。 |

前置条件与组合规则：

- 桌面必须运行且协议兼容，使用明确实例/会话；连接失败不能回退磁盘写入。

权限与副作用：`read`。不提交工程写入；preview 可另写回执，在线预览可提交有效字段草稿。

```powershell
puzzle session validate --instance $instance --session $session --json
```

结果检查：诊断和错误/警告计数；不代表已保存到磁盘。

常见失败与处理：

- INVALID_ARGUMENT / DUPLICATE_ARGUMENT：按语法、参数组合和类型修正；不要重复传同一选项。
- 会话不可用、版本冲突、pending/busy：重新读取状态或处理桌面交互；未知写入结果遵守同 requestId 重试规则。

<a id="session-preview"></a>
## session preview

处理可提交草稿并预览指定内存 token 上的计划。

```text
puzzle session preview --instance <instance> --session <session> --token <token> --plan <plan> [--receipt-out <receiptOut>] [--json] [--help]
```

| 参数 | 类型 / 枚举 | 必填 / 默认 | 含义与限制 |
|---|---|---|---|
| `--instance` | string | 必填 | session list 中用户明确选择的 instanceId，不能猜第一个窗口。 pattern="^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}\|00000000-0000-0000-0000-000000000000\|ffffffff-ffff-ffff-ffff-ffffffffffff)$"; format="uuid" |
| `--session` | integer | 必填 | 对应实例中的 sessionId；必须与 instance 配对。 minimum=0; maximum=9007199254740991 |
| `--token` | string | 必填 | 保存最新 data.token 对象的 UTF-8 JSON 文件，不是完整命令结果。 minLength=1 |
| `--plan` | string | 必填 | UTF-8 领域计划文件；离线 create/preview/apply 可用 - 从 stdin 读取。 minLength=1 |
| `--receipt-out` | string | 可选 | 把预览回执写入指定的新文件，不是工程输出。 minLength=1 |
| `--json` | boolean | 可选 | 明确请求默认的 JSON 结果信封；与 raw 互斥。 |
| `--help`, `-h` | boolean | 可选 | 显示本命令帮助，不执行命令。 |

前置条件与组合规则：

- 桌面必须运行且协议兼容，使用明确实例/会话；连接失败不能回退磁盘写入。

权限与副作用：`read`。不提交工程写入；preview 可另写回执，在线预览可提交有效字段草稿。

```powershell
puzzle session preview --instance $instance --session $session --token "token.json" --plan "edit-plan.json" --receipt-out "preview.json" --json
```

结果检查：候选变化、能力要求及 session receipt；草稿改变 token 时返回冲突。

常见失败与处理：

- INVALID_ARGUMENT / DUPLICATE_ARGUMENT：按语法、参数组合和类型修正；不要重复传同一选项。
- 会话不可用、版本冲突、pending/busy：重新读取状态或处理桌面交互；未知写入结果遵守同 requestId 重试规则。

<a id="session-apply"></a>
## session apply

把预览计划作为一次原子事务应用到内存，产生一个共享 Undo 条目。

```text
puzzle session apply --instance <instance> --session <session> --plan <plan> --receipt <receipt> --request-id <requestId> [--allow-overwrite] [--allow-permanent-delete] [--json] [--help]
```

| 参数 | 类型 / 枚举 | 必填 / 默认 | 含义与限制 |
|---|---|---|---|
| `--instance` | string | 必填 | session list 中用户明确选择的 instanceId，不能猜第一个窗口。 pattern="^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}\|00000000-0000-0000-0000-000000000000\|ffffffff-ffff-ffff-ffff-ffffffffffff)$"; format="uuid" |
| `--session` | integer | 必填 | 对应实例中的 sessionId；必须与 instance 配对。 minimum=0; maximum=9007199254740991 |
| `--plan` | string | 必填 | UTF-8 领域计划文件；离线 create/preview/apply 可用 - 从 stdin 读取。 minLength=1 |
| `--receipt` | string | 必填 | 同一次预览的回执文件；使用 --receipt-out 保存的文件。 minLength=1 |
| `--request-id` | string | 必填 | 首次执行前保存的 13 位 Unix 毫秒:UUID；结果未知时重用相同 ID 和内容。 pattern="^\\d{13}:[0-9a-f-]{36}$" |
| `--allow-overwrite` | boolean | 可选 | 声明已有本任务的聊天覆盖授权；该参数本身不授予权限。  |
| `--allow-permanent-delete` | boolean | 可选 | 声明已有受保护资源永久删除的聊天授权。  |
| `--json` | boolean | 可选 | 明确请求默认的 JSON 结果信封；与 raw 互斥。 |
| `--help`, `-h` | boolean | 可选 | 显示本命令帮助，不执行命令。 |

前置条件与组合规则：

- 桌面必须运行且协议兼容，使用明确实例/会话；连接失败不能回退磁盘写入。
- 结果未知时在 10 分钟内仅重试原 requestId 和原内容；超期先核对结果。忙碌/无效草稿先交由用户处理。

权限与副作用：`semantic_write`。操作效果见本条用途；提交必须检查实际 requiredCapabilities，普通编辑许可不包含三项最高权限。

```powershell
puzzle session apply --instance $instance --session $session --plan "edit-plan.json" --receipt "preview.json" --request-id $requestId --json
```

结果检查：更新后的 token、变更和保存限制；没有覆盖声明时暂停相关自动保存。

常见失败与处理：

- INVALID_ARGUMENT / DUPLICATE_ARGUMENT：按语法、参数组合和类型修正；不要重复传同一选项。
- 会话不可用、版本冲突、pending/busy：重新读取状态或处理桌面交互；未知写入结果遵守同 requestId 重试规则。
- 退出码 6：缺少能力声明。先确认已有聊天授权及其范围，再声明相应能力；flag 不构成授权。

<a id="session-save"></a>
## session save

保存匹配 token 的内存内容，默认显式另存新路径。

```text
puzzle session save --instance <instance> --session <session> --token <token> --request-id <requestId> [--out <out>] [--expected-disk-hash <expectedDiskHash>] [--allow-overwrite] [--json] [--help]
```

| 参数 | 类型 / 枚举 | 必填 / 默认 | 含义与限制 |
|---|---|---|---|
| `--instance` | string | 必填 | session list 中用户明确选择的 instanceId，不能猜第一个窗口。 pattern="^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}\|00000000-0000-0000-0000-000000000000\|ffffffff-ffff-ffff-ffff-ffffffffffff)$"; format="uuid" |
| `--session` | integer | 必填 | 对应实例中的 sessionId；必须与 instance 配对。 minimum=0; maximum=9007199254740991 |
| `--token` | string | 必填 | 保存最新 data.token 对象的 UTF-8 JSON 文件，不是完整命令结果。 minLength=1 |
| `--request-id` | string | 必填 | 首次执行前保存的 13 位 Unix 毫秒:UUID；结果未知时重用相同 ID 和内容。 pattern="^\\d{13}:[0-9a-f-]{36}$" |
| `--out` | string | 可选 | 明确的输出路径；默认只允许创建不存在的新文件。 minLength=1 |
| `--expected-disk-hash` | string | 可选 | 覆盖保存的磁盘原文 SHA-256；从当前磁盘 json read 取得，不是 token.contentHash。 pattern="^[a-f0-9]{64}$" |
| `--allow-overwrite` | boolean | 可选 | 声明已有本任务的聊天覆盖授权；该参数本身不授予权限。  |
| `--json` | boolean | 可选 | 明确请求默认的 JSON 结果信封；与 raw 互斥。 |
| `--help`, `-h` | boolean | 可选 | 显示本命令帮助，不执行命令。 |

前置条件与组合规则：

- 桌面必须运行且协议兼容，使用明确实例/会话；连接失败不能回退磁盘写入。
- 结果未知时在 10 分钟内仅重试原 requestId 和原内容；超期先核对结果。忙碌/无效草稿先交由用户处理。
- out 创建新文件；省略 out 是覆盖当前文件，必须带 allow-overwrite 和 expected-disk-hash。两种模式都需要最新 token 和 request-id。

权限与副作用：`semantic_write`。操作效果见本条用途；提交必须检查实际 requiredCapabilities，普通编辑许可不包含三项最高权限。

```powershell
puzzle session save --instance $instance --session $session --token "token.json" --request-id $requestId --out "Session-saved.puzzle.json" --json
```

结果检查：保存路径及 token/dirty 状态；失败保留内存；最新编辑不会被旧保存确认清除。

常见失败与处理：

- INVALID_ARGUMENT / DUPLICATE_ARGUMENT：按语法、参数组合和类型修正；不要重复传同一选项。
- 会话不可用、版本冲突、pending/busy：重新读取状态或处理桌面交互；未知写入结果遵守同 requestId 重试规则。
- 退出码 6：缺少能力声明。先确认已有聊天授权及其范围，再声明相应能力；flag 不构成授权。
