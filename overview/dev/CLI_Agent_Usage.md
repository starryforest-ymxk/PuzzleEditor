# PuzzleEditor CLI：外部 Agent 使用说明

首次使用可以先看 [CLI 入门指南](./CLI_Quick_Start.md)，包含独立包启动、创建、领域计划另存、桌面会话与 Agent 提示示例。

更新：2026-10-09。当前 C1–C16 开发及隔离成品验收已完成，见 [C16 报告](./CLI_C16_Implementation.md)；全局安装、只读配置、Skill 与 doctor 用法以 [发行指南](./CLI_Distribution_Guide.md)为单一维护来源。API 1.0.0，phase C16，policy C10，转换器 C7.1，在线协议 2。当前用户的实际安装、PATH 和 Skill 未改变。

当前 **36 个命令入口、47 种领域操作**；在线 session/history 首轮支持 Windows 桌面。完整差异见 [覆盖核对](./CLI_Coverage_Audit.md)。

在 [C6–C10 下一阶段计划](./CLI_Next_Development_Plan.md)中，C6–C10 已完成，正式配套发行和本批验证见 C10 报告。面板、导航、用户偏好不增加对应命令；请勿把后续计划的命令或参数当作可用接口。

## 1. 构建与启动

在仓库根目录、已安装锁定依赖的环境运行：

```powershell
npm run cli:build
node dist-cli/cli.js --help
node dist-cli/cli.js describe --json
```

首次安装依赖使用 `npm ci`。Node 版本范围沿用 `package.json`：`^20.19.0 || ^22.13.0 || >=24.0.0`。构建产物需要 Node，离线命令不需要打开编辑器；第三方运行依赖已打入 `dist-cli/cli.js`，可以连同同目录 `package.json` 复制到独立目录运行。

当前没有安装全局 `puzzle` 命令。帮助中的 `puzzle` 是命令名称占位，开发阶段以 `node <CLI 绝对路径>/dist-cli/cli.js` 替代。Windows x64 companion ZIP 解压后通过包内 `puzzle.cmd` 的绝对路径运行，无需全局 Node、源码或 npm，不会修改 PATH。相对工程路径仍以调用方当前目录解析。离线命令无需打开编辑器；session/history 需要运行 C10 配套桌面程序（协议 2），旧 C9 协议 1 不兼容。旧 C5–C8 ZIP 保留当时能力，以 `describe` 核对版本。

```powershell
& 'C:\Tools\PuzzleEditor CLI\puzzle.cmd' describe --json
```

包内 `AGENTS.md` 从 [发行包 Agent 指南](./CLI_Distribution_Guide.md) 原样复制；后续维护这份源文档，不手工维护第二份发行说明。构建和验证命令见 §9。

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

若要在其他程序中保留原始字节，请直接捕获子进程 stdout 的字节流；某些 shell 的文本重定向可能重新编码。本节离线读取针对磁盘快照；尚未保存的内存内容由 §8.11 的 session inspect 读取。

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

`references` 使用 GUI/CLI 共用领域索引，返回准确局部所有者、归一化字段路径与共享图调用上下文；孤立图局部引用不冒充任意已声明资源。`bindings` 仍是资源目录，返回 `requiresContextValidation: true`；具体绑定必须通过参数、脚本类别及所有调用上下文的共同校验。

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
| 3 | JSON/工程/实体或领域校验失败 | `PROJECT_STRUCTURE_INVALID`、`ENTITY_NOT_FOUND`、`SCOPE_VIOLATION`、`CANDIDATE_VALIDATION_FAILED`、`CANDIDATE_NORMALIZATION_REQUIRED`、`VALIDATION_FAILED` |
| 4 | 文件快照、回执或目标冲突 | `FILE_CHANGED`、`REVISION_CONFLICT`、`RECEIPT_CONFLICT`、`OUTPUT_EXISTS`、`INPUT_OUTPUT_COLLISION` |
| 5 | 文件/输出 IO 失败 | `IO_ERROR`、`COMMIT_RESULT_UNCERTAIN` |
| 6 | 缺少实际操作所需的聊天授权声明 | `RAW_JSON_AUTHORIZATION_REQUIRED`、`PERMANENT_DELETE_AUTHORIZATION_REQUIRED`；不读取或认证聊天 |
| 130 | 进程被中断 | Node 默认信号行为 |

## 7. 命名与权限边界

`describe` 的 `namingContracts` 是创建操作共用的身份片段。新增 Stage（含根）、Puzzle、自动初始 State、Variable、Event、Script 的 `assetName` 均需外部指定；不从显示名称生成、翻译、裁剪空白或自动补后缀。省略已有对象的名称字段时保留原值。普通更新不能注入 ID、资源实现状态、整个对象或任意 JSON 字段。

能力描述保留入口的 `read`、`semantic_write`、`raw_json_write` 分类，另由 `authorizationCapabilities` 统一发现最高权限能力。当前累计 47 种领域操作，预览返回实际 `requiredCapabilities` 和 `permanentDeletions`；`apply` 的永久删除要求是按候选实际效果判定的条件能力。计划中的 scope 是本次领域修改范围约束，不是操作系统级沙箱或人工审批。聊天许可范围由 Agent 核对，CLI 不解析自然语言范围。

`json apply` 是备选入口。授权由用户在 Agent 聊天中明确给出；Agent 确认项目、任务和范围后才能直接编写/修改 JSON，包括准备候选。已有范围内授权继续有效，不要求每次候选或命令重复确认；无授权、超范围、拒绝或撤回时先停下相应写入。普通 CLI 使用授权不自动包含该权限，领域命令失败也不能自动降级或改用文件工具绕过。`--allow-raw-json-write` 是已实现的显式启用声明；参数及回执均不证明聊天许可，CLI 不读取聊天记录，也不依赖应用内审批窗口/宿主。完整规则见 [CLI 方案 §1.2](./CLI_Implementation_Plan.md#12-用户已明确的要求完整-json-可读直接编辑须先获聊天授权)。

覆盖保存、永久删除 Implemented / MarkedForDelete 资源与 raw 编辑同属最高权限，均要求聊天明确授权，组合操作按实际涉及能力核对；共同规范见 [CLI 方案 §1.3](./CLI_Implementation_Plan.md#13-下一阶段最高权限扩展用户已确认)。`permanent_resource_delete` / `--allow-permanent-delete` 与 `overwrite_project` / `--allow-overwrite` 均已开放。raw 候选删除受保护资源并覆盖时须同时具备 raw、permanent 和 overwrite 许可，不能借更换入口绕过权限。

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
# 审阅 changes、impacts、diagnostics、aliases 与 remainingErrors 后，提交同一份计划。
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
| Stage | `stage.create/update/move/reorder/delete` | 根保护；非空删除显式 cascade；初始项与解锁规范化进入完整差异 |
| Puzzle | `puzzle.create/update/move/reorder/delete` | 创建含外部命名初始状态；删除关联 FSM；范围外仍有 FSM 所有者则拒绝 |
| 变量 | `variable.create/update/move/delete/restore/purge` | 显式 owner；move 指定 destination；不自动转换类型或重绑引用；purge 须最高权限 |
| 事件 | `event.create/update/delete/restore/purge` | Draft 普通删除，Implemented 普通删除为标删；purge 只处理已实现或标删 |
| 脚本 | `script.create/update/delete/restore/purge` | 四类声明；Lifecycle 指定 Stage/Node/State；purge 须最高权限，不实现脚本代码 |
| 状态 | `state.create/update/delete` | 必须指定 FSM；创建必须外部 name/assetName/position；删除初始项/关联边需明确处理 |
| FSM | `fsm.setInitial/update` | setInitial 指定现存 state；update 只接受 displayOrder |
| 迁移 | `transition.create/update/delete/redirect` | 必须指定 FSM；端点是同 FSM 状态；priority 为非负整数；redirect 保留效果 |

`owner` 为 `{"type":"global"}`、`{"type":"stage","ref":{"id":"STAGE_1"}}` 或 `{"type":"puzzle","ref":{"id":"NODE_1"}}`。创建对象可用 alias 替代 id。scope 可选择整个工程，或 `stages/puzzles` 引用数组加 `globals: ["variable","event","script"]` 的必要子集；Stage 范围包含源快照中的子树及其 Puzzle，新对象继承父范围。移动/重排须同时允许受影响父级，移动不会扩大权限。C4 增加独立的 `scope.presentations` 数组，见 §8.6。

Stage 支持解锁触发器、递归条件、监听器、生命周期及已有演出绑定；Puzzle 支持生命周期、监听器和局部变量。绑定中的 `scriptId/eventId/graphId/variableId/targetVariableId` 都使用 `{id}` / `{alias}`，常量 JSON 原样保留。脚本类别、生命周期目标、变量可见范围、参数运算及来源类型由共用校验器检查。

### 8.4 结果和冲突处理

- `preview` 默认不写文件；只有显式 `--receipt-out` 才写回执。它返回完整差异、分配结果、候选指纹及实际所需能力，回执不构成人工授权。当前三类回执均绑定 `policyVersion: C10` 和 `requiredCapabilities`；旧回执须重新预览。
- `apply` 重新读取源和计划并重建候选，检查固定时间、ID 和 hash；源、计划或候选变化需重新预览。发布前再次检查输入前提。源文件、计划和回执均不能成为输出目标，路径别名和硬链接也受保护。
- 默认输出采用同目录临时文件加排他发布；不覆盖源工程或已有不同内容。固定目标已有同一候选字节时，重试返回 `already-applied`，不会重复追加或修改目标时间。C8 的授权覆盖另见 §8.10。
- 结构错误、未知字段和歧义 JSON 拒绝结构化写入。`preview/apply` 只接收完整 `puzzle-project`；其他格式先使用 §8.9 的 `import preview/apply` 转换。保留原有 editorState，无关 FSM、演出和未传字段不被简化查询覆盖。
- 业务错误可作为已有基线保留，但不允许新增错误；基线按规则、实体、上下文和完整诊断详情比较。若修改使旧错误详情也变化，保守地要求同批修复。检查 `remainingErrors`；导出始终要求 error 清零。局部变量缺名、错误脚本类别和参数运算现在也会在 GUI 校验中被报告。
- `COMMIT_RESULT_UNCERTAIN` 表示发布已发生但无法完成重读确认；检查返回路径与 expectedHash，不要假定零写入，也不要随机换目标重试。

这是一套磁盘副本操作；不锁定第三方编辑器，不修改当前 GUI 会话，也不产生 GUI Undo。Agent 需要重新读取新输出作为后续 source；用户需要在 GUI 打开新文件。

### 8.5 完整 FSM 编辑（C3）

直接可用的 [C3 创建计划](./evidence/CLI_C3/creation-plan.json) 包含多层 Stage、三状态/三迁移的正常—失败—重试流程、四类触发器、递归条件、状态生命周期与事件监听、三种变量范围、演出及 Temporary 参数：

```powershell
node dist-cli/cli.js create --name 'FSM Demo' --root-asset-name DemoRoot --plan overview/dev/evidence/CLI_C3/creation-plan.json --out 'D:\My Projects\FSM-demo.puzzle.json' --json
```

每条 FSM 操作必须传 `fsm: {"id":"FSM_1"}` 或 `fsm: {"puzzle":{"id":"NODE_1"}}`；新 Puzzle 使用 `{"puzzle":{"alias":"door"}}`。权限取该 FSM 的唯一 Puzzle owner；孤立或共享 FSM 暂不接受领域修改。已有 `idle/go` 等局部 ID 必须连同 FSM 指定，不能假设它们全局唯一。引用新状态/迁移时使用同批 alias，回执中的分配记录包含 `fsmId`。

`puzzle.create.initialState` 可增加 `alias: "locked"`，供本批边端点或 setInitial 引用；仍必须提供 `name/assetName`，alias 不保存进项目。新建声明统一先分配、再按依赖创建；非创建命令随后按原顺序执行。可以先声明边，再声明端点和 Puzzle。

以下是现有工程计划的 `commands` 示例；外层仍必须包含 §8.2 的 `sourceHash/scope/apiVersion`。先查询真实 Puzzle 与状态 ID，不直接套用示例 ID：

```json
[
  {
    "op": "state.create", "alias": "done", "fsm": {"puzzle":{"id":"NODE_1"}},
    "data": {"name":"Done", "assetName":"DoorDone", "position":{"x":600,"y":200}}
  },
  {
    "op": "transition.create", "alias": "finish", "fsm": {"puzzle":{"id":"NODE_1"}},
    "from": {"id":"STATE_1"}, "to": {"alias":"done"},
    "data": {
      "name":"Finish", "priority":10, "triggers":[{"type":"HandledByScript"}],
      "condition":{"type":"Literal","value":false},
      "parameterModifiers":[], "invokeEventIds":[]
    }
  }
]
```

- State update 支持 name、assetName、description、position、lifecycleScriptId、eventListeners。状态演出目前不在文件模型中，演出放在 Transition 上。
- Transition update 支持 name、description、priority、triggers、condition、presentation、invokeEventIds、parameterModifiers、fromSide/toSide；改变端点用 redirect，同时明确 from/to。未传的效果和端口保留；端口、condition、presentation 可用 null 清空。
- 空 triggers 是 error；Always/OnEvent/CustomScript/HandledByScript 均支持。递归条件包括 And/Or/Not/Comparison/Literal/ScriptRef；ValueSource 为 Constant 或携带 scope 的 VariableRef。绑定的资源 ID 必须写成 `{id}`/`{alias}`，不是裸字符串。
- 演出支持现有 Script/Graph；Script parameters 包含显式 paramName/source。Temporary 还须 `kind: "Temporary"` 和 `tempVariable: {name,type,description?}`；来源可为常量或变量。常量必须匹配声明类型，变量必须在当前上下文可见且类型匹配。示例内的 false/0 都是有效值。
- priority 只接受非负安全整数，防止现有导出器将负数或小数归零/截断；坐标支持有限负数/小数。自环及不同 ID 的同端点多条边合法；不承诺同优先级执行顺序。
- `state.delete` 拒绝最后一个状态；删除当前初始状态需 `replacementInitialState: {id|alias}`，或先 setInitial。若传 replacement，它必须用于当前初始项且不同于被删状态。有入边/出边时需 `deleteTransitions: true`，或先逐条 delete/redirect。preview 完整列出连带删除，CLI 不会自动选择替代状态。
- 不能在 changes 写内部 ID、stateMachineId、states/transitions 或任意扩展字段。失败不创建候选项目；修复计划后重新 preview/apply，不用 JSON 写入降级绕过领域检查。

### 8.6 演出图编辑与影响预览（C4）

可执行 [C4 创建计划](./evidence/CLI_C4/creation-plan.json) 含四类节点、三级共享子图、Branch True/False、Parallel 有序出口、脚本与 Temporary 参数：

```powershell
node dist-cli/cli.js create --name 'Presentation Demo' --root-asset-name DemoRoot --plan overview/dev/evidence/CLI_C4/creation-plan.json --out 'D:\My Projects\presentation-demo.puzzle.json' --json
```

图相关操作一律传 `graph: {id|alias}`。通过 `scope.presentations: [{id:"GRAPH_1"}]` 单独授权已有图，或 `[{alias:"newGraph"}]` 授权本计划创建的图；`scope.project: true` 允许全部图。Stage/Puzzle 的范围不自动包含其绑定的图。图内节点 ID 必须连同 graph 定位，不能跨图使用节点 alias；分配记录会返回 graphId。图与演出节点当前没有 assetName 字段，不要为它们传入该字段。

| 对象 | 公开命令与字段 |
| --- | --- |
| 图 | `presentation.create` 的 data 为 name/description?/displayOrder?；update 的 changes 为同一元数据子集；setStart 用 node；delete 要先解除直接绑定 |
| 节点 | `presentationNode.create` 必填 name/type/position；update 支持 name/description/type/position/duration/condition/presentation；delete 可传 replacementStart/deleteEdges |
| 连线 | `presentationEdge.connect/redirect` 传 from/slot/to；disconnect 传 from/slot；update 传 from/slot/style；style 只支持 fromSide/toSide |

slot 规则：Branch 用 `"true"` / `"false"`，Wait 和 PresentationNode 用 `"next"`，Parallel 用整数索引。Parallel connect 插入指定位置、disconnect 删除该位置、redirect 原位换目标；Branch 断开保留空槽，False 不会前移。一个源节点不允许重复连接同一目标，因为当前视觉属性由端点对定位。图内部环允许但会报告循环警告，需自行验证运行时终止。

例如，以下 commands 先断开 True，再接到另一已有节点，并只调整 False 的目标侧方向；外层必须带 apiVersion/sourceHash/scope，ID 应先从 inspect 获取：

```json
[
  {"op":"presentationEdge.disconnect","graph":{"id":"GRAPH_1"},"from":{"id":"PNODE_1"},"slot":"true"},
  {"op":"presentationEdge.connect","graph":{"id":"GRAPH_1"},"from":{"id":"PNODE_1"},"slot":"true","to":{"id":"PNODE_5"}},
  {"op":"presentationEdge.update","graph":{"id":"GRAPH_1"},"from":{"id":"PNODE_1"},"slot":"false","style":{"toSide":"left"}}
]
```

只换目标时优先用 redirect，它会保留旧边未指定的 fromSide/toSide。style 中 null 清空指定端点方向。节点 changes 省略保留原字段；清空 condition/presentation/duration 用 null。类型变更前须明确清除不兼容字段/连线，命令不会自动丢弃它们。新建 Wait 省略 duration 默认 1，与 GUI 一致；时长不得为负数。

删除节点存在关联边时必须先断开，或明确 `deleteEdges: true`；删除当前入口且还有其他节点时须传 `replacementStart`。删除最后一个节点后为空图且入口 null；不能清空非空图的入口。删除图前显式更新 Stage/Transition/图节点的 presentation 解除绑定，相应调用者须另有自身 scope。

预览结果的 `impacts.resources` 给出资源修改前后引用，`impacts.graphs` 给出共享状态、直接绑定与传播后的所有根调用上下文；调用者不会被自动修改。`inspect --view presentation --id GRAPH_3` 返回 callingContexts 与 directReferences。菱形调用每根绑定只保留一条代表图路径，全部直接绑定另行完整返回；递归调用会给警告并终止分析。

局部变量按每个根调用的真实 Stage/Puzzle 及最近祖先解析；同 ID 资源通过 ownerType/ownerId 区分。孤立图使用局部变量会报错，不把它算作所有同 ID 局部资源的引用。嵌套条件、脚本类别、参数重复名、Temporary 类型和作用域错误会阻断新增候选。普通 Constant 支持 JSON 原样保留；GUI 显示只读常量值，领域参数修改仍通过 CLI。

### 8.7 备用完整 JSON 编辑（C5）

先完成只读调查，再核对 §7 的聊天授权；没有许可时不要开始直接编写候选。候选是完整 `puzzle-project` 文件，包括包装、project 和存在时的 editorState；本版只接收文件路径，不接收候选 stdin。新资产名和 ID 由调用者明确写入，工具不自动分配或补名。

以下示例假定用户已授权本次直接 JSON 编辑，并已在该范围内准备 `candidate.puzzle.json`。源、候选、回执和输出分别使用不同路径：

```powershell
$puzzleFile = 'D:\My Projects\Demo.puzzle.json'
$candidate = 'D:\My Projects\candidate.puzzle.json'
$receipt = 'D:\My Projects\raw-preview.json'
$reviewed = 'D:\My Projects\Demo-reviewed.puzzle.json'
node dist-cli/cli.js json preview $puzzleFile --candidate $candidate --out $reviewed --receipt-out $receipt --json
if ($LASTEXITCODE -ne 0) { throw 'Raw preview failed.' }
# 核对完整 changes、impacts、diagnostics 和 remainingErrors，仍在既有聊天授权范围内才提交。
node dist-cli/cli.js json apply $puzzleFile --candidate $candidate --receipt $receipt --out $reviewed --allow-raw-json-write --json
if ($LASTEXITCODE -ne 0) { throw 'Raw apply failed.' }
node dist-cli/cli.js validate $reviewed --json
```

- `json preview` 默认不写文件；显式 receipt-out 只写回执。完整差异包含元数据、编辑状态和所有领域数据，impacts 与领域预览共用。可加 `--expected-hash` 固定源快照。
- 源和候选必须是当前导入器可理解的完整工程；结构损坏、未来未知字段、重复键、不安全数值和非法 UTF-8 拒绝写入。完整只读能力仍可保留未知字段和原文。
- 若导入器需要补默认值、迁移或修正候选，返回 `CANDIDATE_NORMALIZATION_REQUIRED` 以及 `data.normalizationChanges/importNotices`；按差异显式修正候选，再用新回执路径预览。工具不将规范化后的对象偷偷写盘。
- 新建或修改 assetName 使用同一严格契约；旧的未改缺名可作为基线保留。所有业务错误按共同基线判断，错误数量未增加不等于没有新增错误，具体诊断身份也必须一致。
- 新资源只准 Draft；不能声称脚本已实现或将已实现/标删资源退回 Draft。C6 对受保护资源的实际移除统一要求永久删除权限，包括父对象删除；改 ID 若相当于删除旧资源并新建受保护资源，仍被新建状态规则拒绝。变量跨所属搬移只在身份可以唯一对应时认可。
- 回执绑定源、候选的规范路径/字节 SHA-256 及新输出路径；它是内容一致性记录，不是批准令牌。换源、换候选或换输出都须重新预览。内容变化仍在用户授权范围内时，不再反复问用户。
- apply 缺少启用参数返回 6；`--yes/--force/--approved` 均不能替代。通过后只交付候选的原始 UTF-8 字节，包括 BOM、缩进、换行和时间字段。输出排他创建，同字节重试返回 `already-applied`；源/候选/回执及其路径别名/硬链接受保护。

实际完整候选、预览/拒绝/提交记录、GUI 保存和等效领域编辑见 [C5 证据](./CLI_C5_Implementation.md)。跨进程工具不能验证聊天许可真实性；Agent 必须遵守用户消息，不能把成功执行本身当作授权证明。

### 8.8 层级删除与资源永久删除（C6）

删除使用实体 ID，不按名称批量匹配。以下是 `commands` 片段，外层仍须带当前 `apiVersion/sourceHash/scope`；示例 ID 必须换成 inspect 返回的实际值：

```json
[
  {"op":"stage.delete","target":{"id":"STAGE_2"},"cascade":true},
  {"op":"puzzle.delete","target":{"id":"NODE_9"}},
  {"op":"variable.purge","target":{"id":"VAR_1"},"owner":{"type":"global"}},
  {"op":"event.purge","target":{"id":"EVENT_1"}},
  {"op":"script.purge","target":{"id":"SCRIPT_1"}}
]
```

五行是独立操作示例，不要对已包含在 Stage 子树中的 Node 再重复删除。先按实际需求选择操作，再预览：

- 根 Stage 不可删除。存在子 Stage、Puzzle 或局部变量时，必须明确 `cascade: true`。删除含所属 FSM、内部状态/迁移及局部变量；`impacts.deletions` 完整列出被移除实体。共享演出图和全局资源保留。
- scope 须包含被删除子树/Puzzle、受影响父 Stage 及规范化的新初始兄弟 Stage。FSM 若仍被范围外 Puzzle 使用，返回 `FSM_SHARED_OUTSIDE_DELETION` 和外部所有者，整批拒绝。
- 剩余引用须在同一计划内显式修复并具有相应 scope；不自动解绑，也不能让局部变量删除后悄悄改绑同 ID 祖先。末步失败不会发布前面步骤。
- Draft 用普通 delete；Implemented 普通 delete 为 MarkedForDelete；对 MarkedForDelete 再用普通 delete 会拒绝。`purge` 可直接处理 Implemented 或 MarkedForDelete，Draft purge 拒绝；无需先伪造状态。
- Stage/Puzzle 级联包含受保护局部资源时同样需要永久删除许可。只读预览无需执行声明；先检查 `requiredCapabilities/permanentDeletions/changes/impacts`，再核对有效聊天授权。

以下提交仅适用于用户已在聊天中明确授权本次永久删除的范围：

```powershell
node dist-cli/cli.js apply $puzzleFile --plan $planPath --receipt $receipt --out $reviewed --allow-permanent-delete --json
# raw 候选永久删除受保护资源时，两项聊天许可及声明缺一不可。
node dist-cli/cli.js json apply $puzzleFile --candidate $candidate --receipt $receipt --out $reviewed --allow-raw-json-write --allow-permanent-delete --json
```

缺声明返回退出码 6，data 列出 requiredCapabilities/missingCapabilities；已知 purge 入口会在读取工程/回执前拒绝，隐式级联在构建候选后、发布前拒绝。声明和回执均不证明聊天许可。所有输出仍为新文件，CLI 不改当前 GUI；GUI 通过同一删除内核执行普通删除时可撤销，实际永久移除受保护资源时清空 past/future，形成历史边界。

实测计划、预览与 GUI/CLI 对照见 [C6 实施报告](./CLI_C6_Implementation.md)。

### 8.9 兼容格式导入与转换（C7）

四种输入均沿用 GUI 的共同导入器：完整 puzzle-project、运行时 puzzle-export、raw ProjectData、legacy ExportManifest。先读取源和 SHA-256，再转换到明确的新文件；不会合并当前工程或修改 GUI 内存。

```powershell
node dist-cli/cli.js json read 'D:\My Projects\Legacy.json' --json
node dist-cli/cli.js import preview 'D:\My Projects\Legacy.json' --out 'D:\My Projects\Converted.puzzle.json' --receipt-out 'D:\My Projects\import-preview.json' --json
node dist-cli/cli.js import apply 'D:\My Projects\Legacy.json' --out 'D:\My Projects\Converted.puzzle.json' --receipt 'D:\My Projects\import-preview.json' --json
node dist-cli/cli.js validate 'D:\My Projects\Converted.puzzle.json' --json
```

需要补齐或修改资产名时，preview 和 apply 都传入相同的 `--names <mapping.json>`。严格映射示例：

```json
{
  "apiVersion": "1.0.0",
  "sourceHash": "替换为源文件的64位SHA-256",
  "entries": [
    { "entity": { "type": "puzzle", "id": "door" }, "assetName": "ExternalDoor" },
    { "entity": { "type": "state", "id": "idle", "ownerType": "fsm", "ownerId": "door-fsm" }, "assetName": "ExternalIdle" },
    { "entity": { "type": "variable", "id": "flag", "ownerType": "project" }, "assetName": "ExternalFlag" }
  ]
}
```

映射的 type 只允许 stage/puzzle/state/variable/event/script；State 要求 FSM owner，局部变量要求 stage/puzzle ownerId，全局变量用 ownerType=project 且不传 ownerId，避免依赖运行时文件尚未生成的项目 UUID。缺字段、未知或重复身份、空白/非法资产名、源 hash 不符、新增重名错误均拒绝。不接受 JSON Pointer、通用属性补丁或资源状态修改。

结果包含 detectedFormat、importNotices、migrated、editorStateDefaulted、missingAssetNames、nameChanges、remainingErrors、完整 candidateFile/candidateHash 和 changes。未修改的旧缺名可作为已有业务错误保留，仍需修复后才能导出；当前转换器不新增命名业务资产。源中已有 ID、资源状态、0/false 和引用保留，辅助参数 ID、缺省坐标及 UI 默认值由共同规则补齐并说明，原文件缺失的布局无法还原。

回执 kind 为 import-preview，固定新项目 ID 和时间，绑定源与名称映射的规范路径/hash、目标、C7.1 转换器、C10 权限策略及候选 hash。apply 重读输入并重建，源/映射/回执/目标变化则拒绝；同回执同字节重试返回 already-applied。两步都接受 --expected-hash；preview 只有显式 receipt-out 才写回执，新工程只在 apply 发布。已有目标、输入别名及硬链接受保护。下列 C7 历史回执用于理解结构，不能直接交给当前 apply。

转换本身是普通领域能力，但不能先未经聊天授权手改源 JSON，再通过 import 绕过 raw 规则；它不接受 raw/overwrite/purge 启用参数。实际示例见 [外部名称映射](./evidence/CLI_C7/Names-map.json)、[转换回执](./evidence/CLI_C7/Names-receipt.json)与 [C7 报告](./CLI_C7_Implementation.md)。

### 8.10 获授权的原地覆盖与工程所有权（C8）

两步使用 `--in-place`，apply 加 `--allow-overwrite`；与 `--out` 严格互斥，只覆盖该源 `.puzzle.json`。示例以本次已取得用户聊天覆盖许可为前提：

```powershell
node dist-cli/cli.js preview Demo.puzzle.json --plan plan.json --in-place --receipt-out overwrite-preview.json
node dist-cli/cli.js apply Demo.puzzle.json --plan plan.json --receipt overwrite-preview.json --in-place --allow-overwrite
```

raw 覆盖的 json preview/apply 同样使用 in-place，apply 同时需要 raw 和 overwrite；受保护资源永久删除另需 permanent。领域与 raw 共用 `platform/node/projectOverwrite.ts`，先锁定规范路径/文件身份、核对回执，再保存并重读原文备份，临时文件 fsync 后校验、替换、重读并记录完成。回执模式不可互换，旧 C6/C7 回执需要重新预览。

成功返回 `backup.path/sha256` 与 `transaction.id/path`。源旁 `.<文件名>.puzzle-transactions/<提交 ID>/` 保存 `before.puzzle.json` 与 `record.json`，不自动清理。重试使用同一回执、计划/候选和权限；已知后态返回 already-applied，不重复修改时间或实体。第三方修改、损坏/未知记录、丢失备份均拒绝。COMMIT_RESULT_UNCERTAIN 表示替换可能已经完成，应按返回路径/预期 hash 核验，再于原授权范围内重试；不要改记录或无条件回滚。

兼容 C8 桌面打开工程期间，CLI apply 返回 PROJECT_OWNED；预览和读取仍可执行，但读到的是磁盘数据。桌面取得候选失败会保留旧内容、路径、历史和所有权，取消关闭不释放，切换成功或实际退出后释放。锁由 Windows OS 句柄持有，不删除未知或无响应所有者的锁。旧桌面需要升级，任意第三方程序不受此协调协议约束。在线协作使用 C10 配套 session 命令，历史使用 history 命令，其他平台暂不支持 in-place。具体命令与恢复约定也随包收录于 [发行包指南](./CLI_Distribution_Guide.md)。

### 8.11 当前桌面会话（C9）

当前提供 `session list/status/inspect/validate/preview/apply/save`，仅 Windows。使用 C10 配套 CLI/桌面包，协议 2；旧 C9 协议 1 不兼容，C8 未提供在线桥。开发先运行 `npm run cli:build`，桌面使用 `npm run electron:dev`。

```powershell
node dist-cli/cli.js session list --json
node dist-cli/cli.js session status --instance '<明确选择的 instanceId>' --session 1 --json
node dist-cli/cli.js session inspect --instance '<instanceId>' --session 1 --view project --json
node dist-cli/cli.js session validate --instance '<instanceId>' --session 1 --json
```

list 列出每个可连接或不可连接登记。必须根据项目 ID/路径及用户指定目标选择实例；不自动选择第一项/最近窗口。不响应和协议不兼容都不能当成离线，不能连接失败后改写磁盘。所有 session 命令都使用当前 Store，`inspect --view project` 返回完整工程封装与 editorState 的只读快照；其他 inspect 视图与离线查询共用实现。未提交字段通过 pendingEdits 标识。

将 status/inspect 的 `data.token` 写到 UTF-8 `token.json`，其中含 instanceId/sessionId/contentEpoch/contentHash。计划仍按 describe.planSchema 编写，但 sourceHash 取 **token.contentHash**，不是磁盘 SHA-256。预览回执写入明确新文件：

```powershell
node dist-cli/cli.js session preview --instance '<instanceId>' --session 1 --token token.json --plan plan.json --receipt-out online-preview.json

# 首次调用前生成并保留此 ID；重试必须沿用相同变量和值。
$requestId = '{0}:{1}' -f [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds(), [Guid]::NewGuid().ToString('D')
node dist-cli/cli.js session apply --instance '<instanceId>' --session 1 --plan plan.json --receipt online-preview.json --request-id $requestId
```

apply 重新核对计划、候选、权限和 token，默认只改内存。普通批次一个 GUI Undo 条目；无变化不新增历史或清空 redo；永久删除仍需独立 `--allow-permanent-delete` 并形成历史边界。切换/重载不能复用旧实例/会话，Undo/Redo 即使恢复相同内容也会使旧 epoch 失效。

preview/apply/save 先检查未结束的拖动、连线、输入法组合、弹窗和人工异步翻译；有效字段使用关闭保护的共同屏障提交。若人工草稿推进版本，返回 SESSION_CONFLICT，重读后重预览。无效草稿返回 PENDING_EDITS，不强制丢弃输入。

**自动保存权限**：未声明本次聊天覆盖许可的 apply 会阻止包含这些改动的自动保存，保持用户偏好值不变；状态通过 savePolicy 返回。已有排队保存同样检查限制。只有用户本人 GUI 保存、获授权的显式覆盖保存或另存新文件能确认相应内容；一次授权不放行未来批次。Agent 不能模拟 GUI Save 来规避聊天授权。如果用户已授权本次覆盖，可在 apply 添加 `--allow-overwrite`，使本批内容按原有自动保存偏好处理；已有较早受限内容仍需显式保存。

```powershell
# 使用提交后新读取的 token；新输出必须不存在，无需覆盖声明。
node dist-cli/cli.js session save --instance '<instanceId>' --session 1 --token latest-token.json --request-id '<时间戳:UUID>' --out NewCopy.puzzle.json

# 仅在已有对应聊天授权时使用。磁盘 hash 可由 json read <当前路径> 获取。
node dist-cli/cli.js session save --instance '<instanceId>' --session 1 --token latest-token.json --request-id '<新的时间戳:UUID>' --allow-overwrite --expected-disk-hash '<当前磁盘 SHA-256>'
```

相对 out 以 CLI 调用目录解析；在线无路径保存不会弹文件选择器。写盘失败返回失败及当前 dirty/savePolicy，保留已完成的内存编辑；不能把失败误报为全部没发生。保存只确认捕获版本，新编辑继续 dirty。在线保存复用 GUI 队列与 C8 所有权；离线 in-place 的备份事务仍是单独文件流程。

requestId 的格式是 `13 位 Unix 毫秒:UUID`。结果在同实例中缓存 10 分钟、最多 256 个未过期请求，包含失败结果；同 ID 换计划/声明/目标被拒绝。收到明确的未提交冲突或 busy 后，处理原因、重读/重预览，再创建新请求；原 ID 重试仍返回原结果。SESSION_RESULT_UNKNOWN 表示可能已经提交，只能以相同 ID 和内容查询结果；过期、重启、切换后先检查当前内容，禁止自动换 ID 重放。

访问边界通过当前 SID 的受限登记和管道 ACL、拒绝 Network SID、双向 HMAC、主框架和操作白名单核验。管理员/同用户进程不由此隔离；握手不证明用户在聊天中的许可。没有远程 TCP、在线 raw JSON 替换或 UI 控制指令。

### 8.12 共享 GUI 历史（C10）

history list 必须指定 --instance/--session，返回同一 GUI past/future，下一步可执行的条目排在首位，上限 50 条。每条含 entryId、source、summary、requiredCapabilities；快照和元数据不写进工程文件，不跨重启保留。

```text
node dist-cli/cli.js history list --instance <instanceId> --session <sessionId> --json
node dist-cli/cli.js history undo --instance <instanceId> --session <sessionId> --token history-token.json --entry-id <undoEntryId> --request-id <毫秒:UUID>
node dist-cli/cli.js history redo --instance <instanceId> --session <sessionId> --token history-token.json --entry-id <redoEntryId> --request-id <新的毫秒:UUID>
```

先将 list 的 data.token 写成 UTF-8 token 文件；每次只能处理当前方向顶部一条。用 list 的 undoEntryId 或 redoEntryId，不按名称猜，不跳过中间人工操作。token 或条目变化则重新读取；GUI/CLI 共同使用历史，手工新编辑清空 redo，no-op 不消耗条目。

普通 Undo 只改内存。Redo 按实际效果与原操作语义计算能力；实际永久删除仍须 --allow-permanent-delete，成功后形成不可恢复边界。若历史记录要求 raw_json_write，必须已获对应聊天许可再声明 --allow-raw-json-write；这不开放新的在线 JSON 替换入口。旧覆盖声明不批准这次保存。

未声明本次 --allow-overwrite 的 Agent Undo/Redo 总是建立新的自动保存限制，即使目标以前保存过；已有受限目标继续受限。之后通过 session save 在授权范围内保存，或明确新路径另存。空栈、冲突、只读、无效草稿/忙碌均无历史提交。10 分钟幂等和未知结果重试规则与 session apply 相同；Undo 不是磁盘回滚，禁止结果未知时换 ID 再撤销。

## 9. 维护与验证

```powershell
npm run test:cli
npm run check
npm run build
npm run test:electron
npm run test:electron:online
# 发行构建：
npm run cli:package
npm run test:cli:package -- release/cli/C10/PuzzleEditor-CLI-1.0.0-beta-win-x64.zip
```

`test:cli` 和 `test:run` 会先构建 CLI。这些构建/验证命令须顺序运行，不能边重建 dist-cli 边运行 CLI 子进程测试。直接进入 `npm test` 的 Vitest watch 前需先运行 `npm run cli:build`。新命令的输入/能力从 `contracts/automation/` 扩展，领域校验复用 `utils/validation/`，平台 IO 复用 `platform/node/`；不要为 CLI 重新维护 GUI/引擎格式或另一套命名规则。

`cli:package` 从实际构建能力表读取 phase，默认在 `release/cli/<phase>/`（当前 C10）创建新的目录、ZIP 和 SHA-256 文件；已有输出拒绝覆盖。重打可传新的 release 子目录，例如 `npm run cli:package -- release/cli/C10-next`。清单和包验证也使用实际 phase，不重复硬编码批次。运行时版本、下载来源和 SHA-256 唯一维护在 `cli/runtime-lock.json`；更新锁文件后须重验独立包。验证脚本从 ZIP 解压到仓库外中文空格路径，PATH 仅保留系统目录，使用真实启动器执行创建/领域写入/raw 写入/兼容转换/失败/重试/校验/导出，C8 增加覆盖权限、原文备份和两类覆盖重试检查，具体数量见本批报告。可追加第二个参数保存 JSON 验证报告。
