# 工程文件命令

[返回使用指南](cli-guide.md) · [权限与错误](permissions-errors.md)

每个示例列出一次调用。需要的工程、计划、token、回执和 PowerShell 变量须按[快速入门](quick-start.md)或[完整教程](workflows.md)准备。示例路径按实际包位置替换；高权限示例仅在已有相应聊天授权时执行。

- [import preview](#import-preview)
- [import apply](#import-apply)
- [describe](#describe)
- [inspect](#inspect)
- [validate](#validate)
- [json read](#json-read)
- [create](#create)
- [preview](#preview)
- [apply](#apply)
- [export](#export)
- [json preview](#json-preview)
- [json apply](#json-apply)

<a id="import-preview"></a>
## import preview

识别兼容格式并预览转换为完整的新工程。

```text
puzzle import preview <path> --out <out> [--names <names>] [--expected-hash <expectedHash>] [--receipt-out <receiptOut>] [--json] [--help]
```

| 参数 | 类型 / 枚举 | 必填 / 默认 | 含义与限制 |
|---|---|---|---|
| `<path>` | string | 必填 | 源文件路径，相对当前工作目录解析。 minLength=1; pattern="\\S" |
| `--out` | string | 必填 | 明确的输出路径；默认只允许创建不存在的新文件。 minLength=1; pattern="\\S" |
| `--names` | string | 可选 | 导入的外部资产名映射 JSON；预览和应用必须使用同一份。 minLength=1; pattern="\\S" |
| `--expected-hash` | string | 可选 | 源文件原始字节的 SHA-256，来自 inspect/json read 的 data.source.sha256。 pattern="^[a-f0-9]{64}$" |
| `--receipt-out` | string | 可选 | 把预览回执写入指定的新文件，不是工程输出。 minLength=1; pattern="\\S" |
| `--json` | boolean | 可选 | 明确请求默认的 JSON 结果信封；与 raw 互斥。 |
| `--help`, `-h` | boolean | 可选 | 显示本命令帮助，不执行命令。 |

前置条件与组合规则：

- 源、计划/候选/映射、输出模式变动后重做预览；不要手工修改回执。已有业务错误可能保留，必须检查 remainingErrors。

权限与副作用：`read`。不提交工程写入；preview 可另写回执，在线预览可提交有效字段草稿。

```powershell
puzzle import preview "Demo.export.json" --out "Converted.puzzle.json" --receipt-out "import-preview.json" --json
```

结果检查：detectedFormat、candidate、missingAssetNames、importNotices、remainingErrors、receipt。

常见失败与处理：

- INVALID_ARGUMENT / DUPLICATE_ARGUMENT：按语法、参数组合和类型修正；不要重复传同一选项。
- REVISION_CONFLICT / 回执冲突：重读并重新预览；校验错误按 diagnostics 修正；已有输出应核验而不是换名字盲重试。

<a id="import-apply"></a>
## import apply

按同一源、映射和回执执行转换，只创建新工程。

```text
puzzle import apply <path> --out <out> [--names <names>] [--expected-hash <expectedHash>] --receipt <receipt> [--json] [--help]
```

| 参数 | 类型 / 枚举 | 必填 / 默认 | 含义与限制 |
|---|---|---|---|
| `<path>` | string | 必填 | 源文件路径，相对当前工作目录解析。 minLength=1; pattern="\\S" |
| `--out` | string | 必填 | 明确的输出路径；默认只允许创建不存在的新文件。 minLength=1; pattern="\\S" |
| `--names` | string | 可选 | 导入的外部资产名映射 JSON；预览和应用必须使用同一份。 minLength=1; pattern="\\S" |
| `--expected-hash` | string | 可选 | 源文件原始字节的 SHA-256，来自 inspect/json read 的 data.source.sha256。 pattern="^[a-f0-9]{64}$" |
| `--receipt` | string | 必填 | 同一次预览的回执文件；使用 --receipt-out 保存的文件。 minLength=1; pattern="\\S" |
| `--json` | boolean | 可选 | 明确请求默认的 JSON 结果信封；与 raw 互斥。 |
| `--help`, `-h` | boolean | 可选 | 显示本命令帮助，不执行命令。 |

前置条件与组合规则：

- 源、计划/候选/映射、输出模式变动后重做预览；不要手工修改回执。已有业务错误可能保留，必须检查 remainingErrors。

权限与副作用：`semantic_write`。操作效果见本条用途；提交必须检查实际 requiredCapabilities，普通编辑许可不包含三项最高权限。

```powershell
puzzle import apply "Demo.export.json" --out "Converted.puzzle.json" --receipt "import-preview.json" --json
```

结果检查：转换后输出路径/hash、remainingErrors；不改变源文件或 GUI 会话。

常见失败与处理：

- INVALID_ARGUMENT / DUPLICATE_ARGUMENT：按语法、参数组合和类型修正；不要重复传同一选项。
- REVISION_CONFLICT / 回执冲突：重读并重新预览；校验错误按 diagnostics 修正；已有输出应核验而不是换名字盲重试。

<a id="describe"></a>
## describe

发现当前支持的命令、领域计划及权限契约。

```text
puzzle describe [--operation <operation>] [--json] [--help]
```

| 参数 | 类型 / 枚举 | 必填 / 默认 | 含义与限制 |
|---|---|---|---|
| `--operation` | string | 可选 | 只返回指定完整命令名称的能力条目，例如 "session save"；其余共用 Schema 仍返回。 minLength=1; pattern="\\S" |
| `--json` | boolean | 可选 | 明确请求默认的 JSON 结果信封；与 raw 互斥。 |
| `--help`, `-h` | boolean | 可选 | 显示本命令帮助，不执行命令。 |

权限与副作用：`read`。不提交工程写入；preview 可另写回执，在线预览可提交有效字段草稿。

```powershell
puzzle describe --json
```

结果检查：data.capabilities、planSchema、resultSchema、importNamesSchema、exitCodes。

常见失败与处理：

- INVALID_ARGUMENT / DUPLICATE_ARGUMENT：按语法、参数组合和类型修正；不要重复传同一选项。

<a id="inspect"></a>
## inspect

读取规范化工程上下文并查询实体或引用，不保存。

```text
puzzle inspect <path> [--expected-hash <expectedHash>] [--view <view>] [--type <type>] [--id <id>] [--owner-type <ownerType>] [--owner-id <ownerId>] [--search <search>] [--stage-id <stageId>] [--node-id <nodeId>] [--depth <depth>] [--offset <offset>] [--limit <limit>] [--json] [--help]
```

| 参数 | 类型 / 枚举 | 必填 / 默认 | 含义与限制 |
|---|---|---|---|
| `<path>` | string | 必填 | 源文件路径，相对当前工作目录解析。 minLength=1; pattern="\\S" |
| `--expected-hash` | string | 可选 | 源文件原始字节的 SHA-256，来自 inspect/json read 的 data.source.sha256。 pattern="^[a-f0-9]{64}$" |
| `--view` | "summary" \| "tree" \| "entities" \| "fsm" \| "presentation" \| "references" \| "variables" \| "bindings" | 可选；默认 `"summary"` | 查询视图；可用参数因视图而异，见本页视图表。  |
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
| `--json` | boolean | 可选 | 明确请求默认的 JSON 结果信封；与 raw 互斥。 |
| `--help`, `-h` | boolean | 可选 | 显示本命令帮助，不执行命令。 |

前置条件与组合规则：

- 视图限制在下表列出；owner-type/owner-id 必须成对；id/search 互斥；精确实体不能分页。

权限与副作用：`read`。不提交工程写入；preview 可另写回执，在线预览可提交有效字段草稿。

```powershell
puzzle inspect "Demo.puzzle.json" --view tree --json
```

结果检查：data.source.sha256、sourceFormat、importNotices、view 和 result；同时检查 diagnostics。

常见失败与处理：

- INVALID_ARGUMENT / DUPLICATE_ARGUMENT：按语法、参数组合和类型修正；不要重复传同一选项。
- REVISION_CONFLICT / 回执冲突：重读并重新预览；校验错误按 diagnostics 修正；已有输出应核验而不是换名字盲重试。

| view | 允许的查询选项 |
|---|---|
| `summary` | 无过滤参数 |
| `tree` | `--id`、`--depth`、`--offset`、`--limit` |
| `entities` | `--type`、`--id`、`--owner-type`、`--owner-id`、`--search`、`--offset`、`--limit` |
| `fsm` | `--id`、`--search`、`--offset`、`--limit` |
| `presentation` | `--id`、`--search`、`--offset`、`--limit` |
| `references` | `--type`、`--id`、`--owner-type`、`--owner-id`、`--offset`、`--limit` |
| `variables` | `--stage-id`、`--node-id`、`--offset`、`--limit` |
| `bindings` | `--type`、`--search`、`--offset`、`--limit` |

references 要求 type/id；bindings 的 type 只接受 script/event/presentation。默认值由 Schema 注入不表示可以在其他视图显式传入这些选项。

<a id="validate"></a>
## validate

检查工程结构和业务规则，不写入文件。

```text
puzzle validate <path> [--expected-hash <expectedHash>] [--warnings-as-errors] [--json] [--help]
```

| 参数 | 类型 / 枚举 | 必填 / 默认 | 含义与限制 |
|---|---|---|---|
| `<path>` | string | 必填 | 源文件路径，相对当前工作目录解析。 minLength=1; pattern="\\S" |
| `--expected-hash` | string | 可选 | 源文件原始字节的 SHA-256，来自 inspect/json read 的 data.source.sha256。 pattern="^[a-f0-9]{64}$" |
| `--warnings-as-errors` | boolean | 可选；默认 `false` | 校验遇到 warning 也使用失败退出码。  |
| `--json` | boolean | 可选 | 明确请求默认的 JSON 结果信封；与 raw 互斥。 |
| `--help`, `-h` | boolean | 可选 | 显示本命令帮助，不执行命令。 |

权限与副作用：`read`。不提交工程写入；preview 可另写回执，在线预览可提交有效字段草稿。

```powershell
puzzle validate "Demo.puzzle.json" --json
```

结果检查：diagnostics 的 level/code/path 及校验计数；退出码 3 表示校验失败。

常见失败与处理：

- INVALID_ARGUMENT / DUPLICATE_ARGUMENT：按语法、参数组合和类型修正；不要重复传同一选项。
- REVISION_CONFLICT / 回执冲突：重读并重新预览；校验错误按 diagnostics 修正；已有输出应核验而不是换名字盲重试。

<a id="json-read"></a>
## json read

读取完整工程包装和原始文本；含 fileType/editorVersion/savedAt/project/editorState。

```text
puzzle json read <path> [--expected-hash <expectedHash>] [--raw] [--json] [--help]
```

| 参数 | 类型 / 枚举 | 必填 / 默认 | 含义与限制 |
|---|---|---|---|
| `<path>` | string | 必填 | 源文件路径，相对当前工作目录解析。 minLength=1; pattern="\\S" |
| `--expected-hash` | string | 可选 | 源文件原始字节的 SHA-256，来自 inspect/json read 的 data.source.sha256。 pattern="^[a-f0-9]{64}$" |
| `--raw` | boolean | 可选；默认 `false` | 只输出原始 UTF-8 文本，不输出 JSON 信封；与 --json 互斥。  |
| `--json` | boolean | 可选 | 明确请求默认的 JSON 结果信封；与 raw 互斥。 |
| `--help`, `-h` | boolean | 可选 | 显示本命令帮助，不执行命令。 |

权限与副作用：`read`。不提交工程写入；preview 可另写回执，在线预览可提交有效字段草稿。

```powershell
puzzle json read "Demo.puzzle.json" --raw
```

结果检查：data.file、rawText、parsedAvailable 和 source；--raw 时 stdout 只有原文。

常见失败与处理：

- INVALID_ARGUMENT / DUPLICATE_ARGUMENT：按语法、参数组合和类型修正；不要重复传同一选项。
- REVISION_CONFLICT / 回执冲突：重读并重新预览；校验错误按 diagnostics 修正；已有输出应核验而不是换名字盲重试。

<a id="create"></a>
## create

以指定工程名和根资产名创建新工程，可附领域计划。

```text
puzzle create --name <name> --root-asset-name <rootAssetName> --out <out> [--description <description>] [--plan <plan>] [--json] [--help]
```

| 参数 | 类型 / 枚举 | 必填 / 默认 | 含义与限制 |
|---|---|---|---|
| `--name` | string | 必填 | 显示名称；skills read 的位置参数固定为 puzzle-editor。 minLength=1; pattern="\\S" |
| `--root-asset-name` | string | 必填 | 外部指定的根 Stage 资产名，不自动生成或转换。 minLength=1; pattern="^[a-zA-Z_][a-zA-Z0-9_]*$"; pattern="^(?![\\s\\S]*\\s)" |
| `--out` | string | 必填 | 明确的输出路径；默认只允许创建不存在的新文件。 minLength=1; pattern="\\S" |
| `--description` | string | 可选 | 新工程的说明文字。  |
| `--plan` | string | 可选 | UTF-8 领域计划文件；离线 create/preview/apply 可用 - 从 stdin 读取。 minLength=1; pattern="\\S" |
| `--json` | boolean | 可选 | 明确请求默认的 JSON 结果信封；与 raw 互斥。 |
| `--help`, `-h` | boolean | 可选 | 显示本命令帮助，不执行命令。 |

权限与副作用：`semantic_write`。操作效果见本条用途；提交必须检查实际 requiredCapabilities，普通编辑许可不包含三项最高权限。

```powershell
puzzle create --name "Demo" --root-asset-name DemoRoot --out "Demo.puzzle.json" --json
```

结果检查：data 中的输出路径、hash、分配的实体和 remainingErrors；输出应再 validate。

常见失败与处理：

- INVALID_ARGUMENT / DUPLICATE_ARGUMENT：按语法、参数组合和类型修正；不要重复传同一选项。
- REVISION_CONFLICT / 回执冲突：重读并重新预览；校验错误按 diagnostics 修正；已有输出应核验而不是换名字盲重试。

<a id="preview"></a>
## preview

校验领域计划，计算候选、变化和权限要求，不写工程。

```text
puzzle preview <path> --plan <plan> [--receipt-out <receiptOut>] [--expected-hash <expectedHash>] [--in-place] [--json] [--help]
```

| 参数 | 类型 / 枚举 | 必填 / 默认 | 含义与限制 |
|---|---|---|---|
| `<path>` | string | 必填 | 源文件路径，相对当前工作目录解析。 minLength=1; pattern="\\S" |
| `--plan` | string | 必填 | UTF-8 领域计划文件；离线 create/preview/apply 可用 - 从 stdin 读取。 minLength=1; pattern="\\S" |
| `--receipt-out` | string | 可选 | 把预览回执写入指定的新文件，不是工程输出。 minLength=1; pattern="\\S" |
| `--expected-hash` | string | 可选 | 源文件原始字节的 SHA-256，来自 inspect/json read 的 data.source.sha256。 pattern="^[a-f0-9]{64}$" |
| `--in-place` | boolean | 可选 | 覆盖本次源工程；预览和提交须使用相同模式，不能与 out 同用。  |
| `--json` | boolean | 可选 | 明确请求默认的 JSON 结果信封；与 raw 互斥。 |
| `--help`, `-h` | boolean | 可选 | 显示本命令帮助，不执行命令。 |

前置条件与组合规则：

- 源、计划/候选/映射、输出模式变动后重做预览；不要手工修改回执。已有业务错误可能保留，必须检查 remainingErrors。

权限与副作用：`read`。不提交工程写入；preview 可另写回执，在线预览可提交有效字段草稿。

```powershell
puzzle preview "Demo.puzzle.json" --plan "edit-plan.json" --receipt-out "preview.json" --json
```

结果检查：data.receipt、changes、impacts、remainingErrors；receipt-out 保存可用于 apply 的回执。

常见失败与处理：

- INVALID_ARGUMENT / DUPLICATE_ARGUMENT：按语法、参数组合和类型修正；不要重复传同一选项。
- REVISION_CONFLICT / 回执冲突：重读并重新预览；校验错误按 diagnostics 修正；已有输出应核验而不是换名字盲重试。

<a id="apply"></a>
## apply

依据同一次预览原子应用领域计划，默认另存新文件。

```text
puzzle apply <path> --plan <plan> --receipt <receipt> [--out <out>] [--in-place] [--allow-overwrite] [--allow-permanent-delete] [--expected-hash <expectedHash>] [--json] [--help]
```

| 参数 | 类型 / 枚举 | 必填 / 默认 | 含义与限制 |
|---|---|---|---|
| `<path>` | string | 必填 | 源文件路径，相对当前工作目录解析。 minLength=1; pattern="\\S" |
| `--plan` | string | 必填 | UTF-8 领域计划文件；离线 create/preview/apply 可用 - 从 stdin 读取。 minLength=1; pattern="\\S" |
| `--receipt` | string | 必填 | 同一次预览的回执文件；使用 --receipt-out 保存的文件。 minLength=1; pattern="\\S" |
| `--out` | string | 可选 | 明确的输出路径；默认只允许创建不存在的新文件。 minLength=1; pattern="\\S" |
| `--in-place` | boolean | 可选 | 覆盖本次源工程；预览和提交须使用相同模式，不能与 out 同用。  |
| `--allow-overwrite` | boolean | 可选 | 声明已有本任务的聊天覆盖授权；该参数本身不授予权限。  |
| `--allow-permanent-delete` | boolean | 可选 | 声明已有受保护资源永久删除的聊天授权。  |
| `--expected-hash` | string | 可选 | 源文件原始字节的 SHA-256，来自 inspect/json read 的 data.source.sha256。 pattern="^[a-f0-9]{64}$" |
| `--json` | boolean | 可选 | 明确请求默认的 JSON 结果信封；与 raw 互斥。 |
| `--help`, `-h` | boolean | 可选 | 显示本命令帮助，不执行命令。 |

前置条件与组合规则：

- out 与 in-place 必须且只能选择一种；覆盖另需已有聊天授权和提交声明。
- 源、计划/候选/映射、输出模式变动后重做预览；不要手工修改回执。已有业务错误可能保留，必须检查 remainingErrors。

权限与副作用：`semantic_write`。操作效果见本条用途；提交必须检查实际 requiredCapabilities，普通编辑许可不包含三项最高权限。

```powershell
puzzle apply "Demo.puzzle.json" --plan "edit-plan.json" --receipt "preview.json" --out "Demo-edited.puzzle.json" --json
```

结果检查：输出路径和 hash、changes、remainingErrors；覆盖时另有 backup 和 transaction。

常见失败与处理：

- INVALID_ARGUMENT / DUPLICATE_ARGUMENT：按语法、参数组合和类型修正；不要重复传同一选项。
- REVISION_CONFLICT / 回执冲突：重读并重新预览；校验错误按 diagnostics 修正；已有输出应核验而不是换名字盲重试。
- 退出码 6：缺少能力声明。先确认已有聊天授权及其范围，再声明相应能力；flag 不构成授权。

<a id="export"></a>
## export

校验并导出游戏运行时数据，不保留完整编辑器状态。

```text
puzzle export <path> --out <out> [--expected-hash <expectedHash>] [--json] [--help]
```

| 参数 | 类型 / 枚举 | 必填 / 默认 | 含义与限制 |
|---|---|---|---|
| `<path>` | string | 必填 | 源文件路径，相对当前工作目录解析。 minLength=1; pattern="\\S" |
| `--out` | string | 必填 | 明确的输出路径；默认只允许创建不存在的新文件。 minLength=1; pattern="\\S" |
| `--expected-hash` | string | 可选 | 源文件原始字节的 SHA-256，来自 inspect/json read 的 data.source.sha256。 pattern="^[a-f0-9]{64}$" |
| `--json` | boolean | 可选 | 明确请求默认的 JSON 结果信封；与 raw 互斥。 |
| `--help`, `-h` | boolean | 可选 | 显示本命令帮助，不执行命令。 |

权限与副作用：`semantic_write`。操作效果见本条用途；提交必须检查实际 requiredCapabilities，普通编辑许可不包含三项最高权限。

```powershell
puzzle export "Demo-edited.puzzle.json" --out "Demo.export.json" --json
```

结果检查：data 的输出路径/hash 和源文件指纹；errors 阻止导出。

常见失败与处理：

- INVALID_ARGUMENT / DUPLICATE_ARGUMENT：按语法、参数组合和类型修正；不要重复传同一选项。
- REVISION_CONFLICT / 回执冲突：重读并重新预览；校验错误按 diagnostics 修正；已有输出应核验而不是换名字盲重试。

<a id="json-preview"></a>
## json preview

检查获授权后准备的完整候选原文，预览差异及所需能力。

```text
puzzle json preview <path> --candidate <candidate> [--out <out>] [--in-place] [--expected-hash <expectedHash>] [--receipt-out <receiptOut>] [--json] [--help]
```

| 参数 | 类型 / 枚举 | 必填 / 默认 | 含义与限制 |
|---|---|---|---|
| `<path>` | string | 必填 | 源文件路径，相对当前工作目录解析。 minLength=1; pattern="\\S" |
| `--candidate` | string | 必填 | 获授权后准备的完整工程 JSON 候选文件，不是领域计划或运行时导出。 minLength=1; pattern="\\S" |
| `--out` | string | 可选 | 明确的输出路径；默认只允许创建不存在的新文件。 minLength=1; pattern="\\S" |
| `--in-place` | boolean | 可选 | 覆盖本次源工程；预览和提交须使用相同模式，不能与 out 同用。  |
| `--expected-hash` | string | 可选 | 源文件原始字节的 SHA-256，来自 inspect/json read 的 data.source.sha256。 pattern="^[a-f0-9]{64}$" |
| `--receipt-out` | string | 可选 | 把预览回执写入指定的新文件，不是工程输出。 minLength=1; pattern="\\S" |
| `--json` | boolean | 可选 | 明确请求默认的 JSON 结果信封；与 raw 互斥。 |
| `--help`, `-h` | boolean | 可选 | 显示本命令帮助，不执行命令。 |

前置条件与组合规则：

- out 与 in-place 必须且只能选择一种；覆盖另需已有聊天授权和提交声明。
- 准备候选之前即须取得范围内的聊天 JSON 编辑许可；预览不会授予许可，不能把领域失败自动降级为 raw。
- 源、计划/候选/映射、输出模式变动后重做预览；不要手工修改回执。已有业务错误可能保留，必须检查 remainingErrors。

权限与副作用：`read`。不提交工程写入；preview 可另写回执，在线预览可提交有效字段草稿。

```powershell
puzzle json preview "Demo.puzzle.json" --candidate "candidate.puzzle.json" --out "Reviewed.puzzle.json" --receipt-out "raw-preview.json" --json
```

结果检查：data.receipt、output、changes、impacts、remainingErrors；候选须已符合保存格式。

常见失败与处理：

- INVALID_ARGUMENT / DUPLICATE_ARGUMENT：按语法、参数组合和类型修正；不要重复传同一选项。
- REVISION_CONFLICT / 回执冲突：重读并重新预览；校验错误按 diagnostics 修正；已有输出应核验而不是换名字盲重试。

<a id="json-apply"></a>
## json apply

在已有聊天授权下按回执写入完整候选，保留候选原字节。

```text
puzzle json apply <path> --candidate <candidate> [--out <out>] [--in-place] [--expected-hash <expectedHash>] --receipt <receipt> [--allow-raw-json-write] [--allow-permanent-delete] [--allow-overwrite] [--json] [--help]
```

| 参数 | 类型 / 枚举 | 必填 / 默认 | 含义与限制 |
|---|---|---|---|
| `<path>` | string | 必填 | 源文件路径，相对当前工作目录解析。 minLength=1; pattern="\\S" |
| `--candidate` | string | 必填 | 获授权后准备的完整工程 JSON 候选文件，不是领域计划或运行时导出。 minLength=1; pattern="\\S" |
| `--out` | string | 可选 | 明确的输出路径；默认只允许创建不存在的新文件。 minLength=1; pattern="\\S" |
| `--in-place` | boolean | 可选 | 覆盖本次源工程；预览和提交须使用相同模式，不能与 out 同用。  |
| `--expected-hash` | string | 可选 | 源文件原始字节的 SHA-256，来自 inspect/json read 的 data.source.sha256。 pattern="^[a-f0-9]{64}$" |
| `--receipt` | string | 必填 | 同一次预览的回执文件；使用 --receipt-out 保存的文件。 minLength=1; pattern="\\S" |
| `--allow-raw-json-write` | boolean | 可选；默认 `false` | 声明已有直接修改工程 JSON 的聊天授权。  |
| `--allow-permanent-delete` | boolean | 可选 | 声明已有受保护资源永久删除的聊天授权。  |
| `--allow-overwrite` | boolean | 可选 | 声明已有本任务的聊天覆盖授权；该参数本身不授予权限。  |
| `--json` | boolean | 可选 | 明确请求默认的 JSON 结果信封；与 raw 互斥。 |
| `--help`, `-h` | boolean | 可选 | 显示本命令帮助，不执行命令。 |

前置条件与组合规则：

- out 与 in-place 必须且只能选择一种；覆盖另需已有聊天授权和提交声明。
- 准备候选之前即须取得范围内的聊天 JSON 编辑许可；预览不会授予许可，不能把领域失败自动降级为 raw。
- 源、计划/候选/映射、输出模式变动后重做预览；不要手工修改回执。已有业务错误可能保留，必须检查 remainingErrors。

权限与副作用：`raw_json_write`。操作效果见本条用途；提交必须检查实际 requiredCapabilities，普通编辑许可不包含三项最高权限。

```powershell
puzzle json apply "Demo.puzzle.json" --candidate "candidate.puzzle.json" --out "Reviewed.puzzle.json" --receipt "raw-preview.json" --allow-raw-json-write --json
```

结果检查：目标文件指纹、变化和权限信息；覆盖模式返回备份/事务位置。

常见失败与处理：

- INVALID_ARGUMENT / DUPLICATE_ARGUMENT：按语法、参数组合和类型修正；不要重复传同一选项。
- REVISION_CONFLICT / 回执冲突：重读并重新预览；校验错误按 diagnostics 修正；已有输出应核验而不是换名字盲重试。
- 退出码 6：缺少能力声明。先确认已有聊天授权及其范围，再声明相应能力；flag 不构成授权。
