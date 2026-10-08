# PuzzleEditor CLI：外部 Agent 使用说明

更新：2026-10-08。当前已实现 **C1 + C2：只读查询、工程创建、Stage/Puzzle/黑板编辑和离线事务**；API 版本 `1.0.0`。开发计划见 [CLI 开发方案](./CLI_Implementation_Plan.md)，实现和测试见 [C1 报告](./CLI_C1_Implementation.md)、[C2 报告](./CLI_C2_Implementation.md)。

## 1. 构建与启动

在仓库根目录、已安装锁定依赖的环境运行：

```powershell
npm run cli:build
node dist-cli/cli.js --help
node dist-cli/cli.js describe --json
```

首次安装依赖使用 `npm ci`。Node 版本范围沿用 `package.json`：`^20.19.0 || ^22.13.0 || >=24.0.0`。构建产物需要 Node，但不需要打开编辑器；第三方运行依赖已打入 `dist-cli/cli.js`，可以连同同目录 `package.json` 复制到独立目录运行。

当前没有安装全局 `puzzle` 命令。帮助中的 `puzzle` 是命令名称占位，开发阶段以 `node <CLI 绝对路径>/dist-cli/cli.js` 替代。Windows companion 启动器及附带运行时将在 C5 交付。

## 2. 推荐读取流程

先读能力，再查询摘要和目标上下文，最后校验。以下 PowerShell 示例在仓库根目录运行；将路径换成用户授权读取的实际工程：

```powershell
$puzzleFile = 'D:\My Projects\Demo.puzzle.json'
node dist-cli/cli.js describe --operation inspect --json
node dist-cli/cli.js inspect $puzzleFile --json
node dist-cli/cli.js inspect $puzzleFile --view tree --depth 3 --json
node dist-cli/cli.js validate $puzzleFile --json
```

stdout 默认是单个 JSON 结果，`--json` 显式声明同一模式。成功与失败均包含 `apiVersion/ok/command/data/diagnostics`，失败还包含 `error`。调用方同时检查进程退出码和 `ok`；`inspect` 成功表示查询成功，工程内已有业务错误仍会出现在 `diagnostics`，不代表校验通过。

`validate` 默认允许 warning；需要阻断 warning 时加 `--warnings-as-errors`。此时无 error 的工程仍可能有 `data.valid: true`，但整体 `ok: false`、退出码 3，错误码为 `WARNINGS_AS_ERRORS`。

## 3. 完整 JSON 与原文

```powershell
node dist-cli/cli.js json read $puzzleFile --json
node dist-cli/cli.js json read $puzzleFile --raw
```

- `--json` 返回 `data.file`（完整解析对象）、`data.rawText`、`data.parsedAvailable` 和 `data.source`。不会移除文件包装、`editorState` 或未知字段，也不会修复业务错误。
- `--raw` 只向 stdout 输出原始 UTF-8 文本，包括原有 BOM、顺序和空白，不额外追加换行；失败结果写 stderr。它与 `--json` 互斥。
- 出现重复键、不可安全表达的数值时，解析对象会造成信息损失，因此返回 `parsedAvailable: false`、`file: null` 及诊断，完整 `rawText` 仍可取得。不得把 `null` 当作源文件为空。结构化 `inspect/validate` 拒绝这类歧义。
- JSON 语法损坏会使 JSON 模式失败，`--raw` 仍可读取；非法 UTF-8 明确失败。大文件不自动截断或分页，Agent 客户端自身的输出上限不代表文件完整内容。

若要在其他程序中保留原始字节，请直接捕获子进程 stdout 的字节流；某些 shell 的文本重定向可能重新编码。所有读取针对磁盘快照，不包含编辑器尚未保存的内存修改。

## 4. 局部查询与实体定位

`inspect` 默认使用 `summary`。结构化视图经过共用导入器，结果注明 `sourceFormat/importNotices/normalized`；它们是编辑器可理解的视图，完整源文件另用 `json read` 获取。

| `--view` | 可用选项（另均支持 `--expected-hash`） | 返回内容 |
| --- | --- | --- |
| `summary` | 无额外筛选 | 工程元数据、根 Stage、实体计数 |
| `tree` | `--id`、`--depth`、分页 | 指定 Stage 子树或整树的扁平层级、子 Stage 与 Puzzle ID、截断标志 |
| `entities` | `--type`、`--id` 或 `--search`、所属对象、列表分页 | 实体引用、路径、资源状态及完整对象 |
| `fsm` | `--id` 或 `--search`、列表分页 | 列表摘要；指定 ID 时返回完整状态机与所属 Puzzle |
| `presentation` | `--id` 或 `--search`、列表分页 | 演出图列表摘要；指定 ID 时返回完整图 |
| `references` | 必须 `--type` 与 `--id`；可加所属对象、分页 | script/event/variable/presentation 的引用位置 |
| `variables` | `--stage-id`、`--node-id`、分页 | 该上下文的可见变量及真实所属对象；无上下文时为全局变量 |
| `bindings` | `--type`、`--search`、分页 | script/event/presentation 中未标删的资源目录 |

分页参数为 `--offset`（默认 0）、`--limit`（默认 100、最大 1000）；返回 `total/offset/limit/nextOffset`。单实体详情不接受分页选项。树深度默认 16、最大 128；`--depth 0` 只读起点，仍返回子 ID 及截断标记。

可用实体类型：`stage`、`puzzle`、`fsm`、`state`、`transition`、`presentation`、`presentation-node`、`variable`、`event`、`script`。所属对象选项 `--owner-type` 与 `--owner-id` 必须成对传入；所属类型为 `stage/puzzle/fsm/presentation/project`。

```powershell
# 先搜索，再用返回的 ID 精确定位；名称不是唯一键。
node dist-cli/cli.js inspect $puzzleFile --view entities --type puzzle --search Door --json
node dist-cli/cli.js inspect $puzzleFile --view fsm --id FSM_1 --json
node dist-cli/cli.js inspect $puzzleFile --view entities --type state --id STATE_1 --owner-type fsm --owner-id FSM_1 --json
node dist-cli/cli.js inspect $puzzleFile --view presentation --id GRAPH_1 --json
node dist-cli/cli.js inspect $puzzleFile --view variables --node-id NODE_1 --json
node dist-cli/cli.js inspect $puzzleFile --view references --type event --id EVENT_1 --json
node dist-cli/cli.js inspect $puzzleFile --view bindings --type script --search Door --json
```

例中的 ID 仅示意，需替换为查询返回的实际 ID。相同状态/迁移 ID 可出现在不同 FSM；局部变量也需带所属上下文。匹配多个对象时返回 `AMBIGUOUS_ENTITY` 和候选，工具不会取第一个。实体路径及领域诊断路径以规范化后的 `ProjectData` 为基准，不是直接修改原始文件的补丁。

`references` 沿用现有编辑器扫描器，局部变量在演出图中的引用可能是保守候选，返回 `coverage` 标明这一点。`bindings` 返回 `requiresContextValidation: true`，仍需结合脚本分类、参数类型及实际调用作用域校验；C4 完善共享图调用上下文。

## 5. 多次读取保持同一版本

每次文件读取返回 `source.path/sha256/size/modifiedAt`，hash 来自源字节。后续页面或关联查询携带第一次的 hash；源文件已变化时返回 `REVISION_CONFLICT`，重新读上下文再继续，不拼接旧结果。

```powershell
$firstPage = node dist-cli/cli.js inspect $puzzleFile --view entities --limit 20 --json | ConvertFrom-Json
if ($LASTEXITCODE -ne 0) { throw 'Initial query failed.' }
$sourceHash = $firstPage.data.source.sha256
node dist-cli/cli.js inspect $puzzleFile --view entities --offset 20 --limit 20 --expected-hash $sourceHash --json
```

该检查提供版本前提，不持有工程文件锁。完整读取也接受 `--expected-hash`。兼容格式经导入器生成的工程元数据不应当作持久身份；源 hash 与文件内领域 ID 才是跨调用定位依据。

## 6. 诊断与退出码

诊断包含稳定 `code`、`level`、英文 `message`、`retryable`，可定位时另有 `entity/path/pathBasis/location`。`pathBasis` 区分 `source`、`normalized-project` 与 `request`；不能直接把规范化路径应用于磁盘 JSON。修正应依据 code 和实体上下文，不解析英文消息推断规则。

| 退出码 | 含义 | 常见 code |
| --- | --- | --- |
| 0 | 操作符合当前策略 | 无；warning 默认不阻断；编辑仍可能保留旧 error，检查 `remainingErrors` |
| 1 | 内部异常 | `INTERNAL_ERROR` |
| 2 | 参数、命令或计划契约错误 | `INVALID_ARGUMENT`、`DUPLICATE_ARGUMENT`、`INVALID_CONTRACT`、`SOURCE_HASH_REQUIRED`、`COMMAND_NOT_AVAILABLE` |
| 3 | JSON/工程/实体或领域校验失败 | `PROJECT_STRUCTURE_INVALID`、`ENTITY_NOT_FOUND`、`SCOPE_VIOLATION`、`CANDIDATE_VALIDATION_FAILED`、`VALIDATION_FAILED` |
| 4 | 文件快照、回执或目标冲突 | `FILE_CHANGED`、`REVISION_CONFLICT`、`RECEIPT_CONFLICT`、`OUTPUT_EXISTS`、`INPUT_OUTPUT_COLLISION` |
| 5 | 文件/输出 IO 失败 | `IO_ERROR`、`COMMIT_RESULT_UNCERTAIN` |
| 6 | 人工审批失败，后续备用写能力预留 | C2 不产生审批流程 |
| 130 | 进程被中断 | Node 默认信号行为 |

## 7. 命名与权限边界

`describe` 的 `namingContracts` 是创建操作共用的身份片段。新增 Stage（含根）、Puzzle、自动初始 State、Variable、Event、Script 的 `assetName` 均需外部指定；不从显示名称生成、翻译、裁剪空白或自动补后缀。省略已有对象的名称字段时保留原值。普通更新不能注入 ID、资源实现状态、整个对象或任意 JSON 字段。

权限为 `read`、`semantic_write`、`raw_json_write`。C2 注册了 `create/preview/apply/export`；完整 FSM 编辑属于 C3，演出图编辑属于 C4。`json preview/json apply` 仍为 `implemented: false`，调用被拒绝。计划中的 scope 是本次修改范围约束，不是操作系统级沙箱或人工审批。

后续 `json apply` 只是备选入口，最高权限要求用户对每次具体候选、差异及目标直接确认。`--yes/--force`、预览回执、环境变量或 Agent 自写批准都不构成确认。当前没有审批宿主，也不会通过这些参数开放写入；不得因领域命令未实现就由 Agent 越过用户要求直接改源文件。

## 8. 创建、预览、保存新副本和导出

### 8.1 创建工程

空工程只需工程名、根 Stage 资产名和一个尚不存在的 `.puzzle.json` 目标：

```powershell
node dist-cli/cli.js create --name Demo --root-asset-name DemoRoot --out 'D:\My Projects\Demo.puzzle.json' --json
```

批量创建使用 `--plan`。可直接查看已实测的 [创建计划](./evidence/CLI_C2/create-plan.json)：包含三层 Stage、不同层的 Puzzle、三种作用域变量、四类脚本及事件监听器。每个创建声明有唯一 `alias`；引用写作 `{"alias":"door"}` 或 `{"id":"NODE_1"}`，`root` 为根 Stage 的内置别名。创建 Puzzle 还必须传入 `initialState.name/assetName`。

**执行顺序**：先为全部创建声明预留 ID，再按归属依赖创建；之后执行原顺序的非创建命令。声明可以前向引用，不能依靠在 commands 中交错 create/delete 来改变这个顺序。重复或类型错误的 alias、缺失 owner、依赖环均拒绝；内部 ID 由工具分配且同批不复用。不要把查询结果中完整对象直接作为更新字段。

### 8.2 编辑与提交示例

以下示例在仓库根运行。`$puzzleFile`、`$planPath`、回执和新输出应选用独立路径；新目标已存在时会报冲突。计划文件必须为 UTF-8：

```powershell
$puzzleFile = 'D:\My Projects\Demo.puzzle.json'
$created = node dist-cli/cli.js create --name Demo --root-asset-name DemoRoot --plan overview/dev/evidence/CLI_C2/create-plan.json --out $puzzleFile --json | ConvertFrom-Json
if ($LASTEXITCODE -ne 0) { throw 'Creation failed.' }
$doorId = $created.data.aliases.door.id
$snapshot = node dist-cli/cli.js inspect $puzzleFile --json | ConvertFrom-Json
if ($LASTEXITCODE -ne 0) { throw 'Inspection failed.' }

$plan = @{
  apiVersion = '1.0.0'
  sourceHash = $snapshot.data.source.sha256
  scope = @{ puzzles = @(@{ id = $doorId }) }
  commands = @(@{
    op = 'puzzle.update'
    target = @{ id = $doorId }
    changes = @{ name = 'Entry Door'; description = 'Updated through CLI.' }
  })
}
$planPath = 'D:\My Projects\edit-plan.json'
[System.IO.File]::WriteAllText($planPath, ($plan | ConvertTo-Json -Depth 100), [System.Text.UTF8Encoding]::new($false))
node dist-cli/cli.js preview $puzzleFile --plan $planPath --receipt-out 'D:\My Projects\preview.json' --json
if ($LASTEXITCODE -ne 0) { throw 'Preview failed.' }
# 审阅 changes、diagnostics、aliases 与 remainingErrors 后，提交同一份计划。
node dist-cli/cli.js apply $puzzleFile --plan $planPath --receipt 'D:\My Projects\preview.json' --out 'D:\My Projects\Demo-edited.puzzle.json' --json
if ($LASTEXITCODE -ne 0) { throw 'Apply failed.' }
node dist-cli/cli.js validate 'D:\My Projects\Demo-edited.puzzle.json' --json
if ($LASTEXITCODE -ne 0) { throw 'Validation failed.' }
node dist-cli/cli.js export 'D:\My Projects\Demo-edited.puzzle.json' --out 'D:\My Projects\Demo.export.json' --json
```

`--plan -` 可从 stdin 接收计划，最大 16 MiB；预览和提交应传入完全相同的 UTF-8 内容。文件计划与回执均检查重复键、数值精度和嵌套深度。更新省略字段表示保持，绑定用 `null` 清空，列表用 `[]` 清空，`false/0` 是实际值。完整字段以 `describe` 返回的 `planSchema` 为准。

### 8.3 当前领域操作

| 对象 | `op` | 关键规则 |
| --- | --- | --- |
| 工程 | `project.update` | 仅元数据，要求 `scope.project: true` |
| Stage | `stage.create/update/move/reorder` | 禁止移动根和成环；顺序决定初始 Stage；成为初始项会清除解锁配置并在完整差异中体现 |
| Puzzle | `puzzle.create/update/move/reorder` | 创建同时生成 FSM/外部命名初始状态；重排必须完整列出该 Stage 的 Puzzle；移动保持 ID |
| 变量 | `variable.create/update/move/delete/restore` | 显式 `owner`；move 指定 `destination`；值类型精确匹配，无自动转换；移动不自动重绑引用 |
| 事件 | `event.create/update/delete/restore` | 创建为 Draft；Implemented 删除为标删；Marked 可恢复；不支持永久删除已实现资源 |
| 脚本 | `script.create/update/delete/restore` | 四类声明；Lifecycle 明确 Stage/Node/State 目标；声明不实现脚本代码 |

`owner` 为 `{"type":"global"}`、`{"type":"stage","ref":{"id":"STAGE_1"}}` 或 `{"type":"puzzle","ref":{"id":"NODE_1"}}`。创建对象可用 alias 替代 id。scope 可选择整个工程，或 `stages/puzzles` 引用数组加 `globals: ["variable","event","script"]` 的必要子集；Stage 范围包含源快照中的子树及其 Puzzle，新对象继承父范围。移动/重排须同时允许受影响父级，移动不会扩大权限。

Stage 支持解锁触发器、递归条件、监听器、生命周期及已有演出绑定；Puzzle 支持生命周期、监听器和局部变量。绑定中的 `scriptId/eventId/graphId/variableId/targetVariableId` 都使用 `{id}` / `{alias}`，常量 JSON 原样保留。脚本类别、生命周期目标、变量可见范围、参数运算及来源类型由共用校验器检查。

### 8.4 结果和冲突处理

- `preview` 默认不写文件；只有显式 `--receipt-out` 才写回执。它返回完整差异、分配结果和候选指纹，回执不构成人工授权。
- `apply` 重新读取源和计划并重建候选，检查固定时间、ID 和 hash；源、计划或候选变化需重新预览。发布前再次检查输入前提。源文件、计划和回执均不能成为输出目标，路径别名和硬链接也受保护。
- 输出采用同目录临时文件加排他发布；不覆盖源工程或已有不同内容。固定目标已有同一候选字节时，重试返回 `already-applied`，不会重复追加或修改目标时间。
- 结构错误、未知字段和歧义 JSON 拒绝结构化写入。`preview/apply` 只接收完整 `puzzle-project`；其他格式先由 GUI 明确另存。保留原有 editorState，无关 FSM、演出和未传字段不被简化查询覆盖。
- 业务错误可作为已有基线保留，但不允许新增错误；基线按规则、实体、上下文和完整诊断详情比较。若修改使旧错误详情也变化，保守地要求同批修复。检查 `remainingErrors`；导出始终要求 error 清零。局部变量缺名、错误脚本类别和参数运算现在也会在 GUI 校验中被报告。
- `COMMIT_RESULT_UNCERTAIN` 表示发布已发生但无法完成重读确认；检查返回路径与 expectedHash，不要假定零写入，也不要随机换目标重试。

这是一套磁盘副本操作；不锁定第三方编辑器，不修改当前 GUI 会话，也不产生 GUI Undo。Agent 需要重新读取新输出作为后续 source；用户需要在 GUI 打开新文件。

## 9. 维护与验证

```powershell
npm run test:cli
npm run check
npm run build
npm run test:electron
```

`test:cli` 和 `test:run` 会先构建 CLI。直接进入 `npm test` 的 Vitest watch 前需先运行 `npm run cli:build`。新命令的输入/能力从 `contracts/automation/` 扩展，领域校验复用 `utils/validation/`，平台 IO 复用 `platform/node/`；不要为 CLI 重新维护 GUI/引擎格式或另一套命名规则。
