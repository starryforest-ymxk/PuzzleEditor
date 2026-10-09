# PuzzleEditor CLI 使用指南

使用 CLI 创建、读取、编辑、校验和导出 PuzzleEditor 工程，也可以连接桌面编辑器处理未保存内容。先运行 `puzzle version` 和 `puzzle describe --json`，按实际返回的能力与 JSON Schema 构造命令。升级工具或遇到回执版本不兼容时，重新读取工程并预览，不沿用旧回执。

## 安装、配置、Skill 与诊断

Windows x64 独立包自带 Node，无需另装 Node/npm。PowerShell：`powershell -NoProfile -ExecutionPolicy Bypass -File .\install-cli.ps1 --dry-run` 预览，去掉 --dry-run 安装；默认根为 `%LOCALAPPDATA%/StarryTree/PuzzleEditorCLI`，可用 `--install-root` 指定。安装添加当前用户 PATH，重新打开终端后调用 `puzzle`。升级时对新的完整包执行相同安装命令，核验后切换并保留旧版本；不要单独移动 `bin/puzzle.cmd`。启动器损坏时，使用完整解压包的绝对路径执行修复命令。

```text
puzzle version
puzzle setup status
puzzle setup uninstall --dry-run
puzzle setup recover --install-root <root>
puzzle config path
puzzle config show
puzzle skills list
puzzle skills read puzzle-editor
puzzle skills install --agent codex --scope user --dry-run
puzzle skills install --agent codex --scope user
puzzle skills status --agent codex --scope user
puzzle skills uninstall --agent codex --scope user --dry-run
puzzle skills recover --agent codex --scope user
puzzle doctor --offline
puzzle doctor --project Demo.puzzle.json
puzzle doctor --online --instance <instanceId> --session <sessionId>
```

Windows 全局启动器和其 Node 不能删除自身。实际卸载从外部 PowerShell 入口执行：

```powershell
$entry = (puzzle setup status | ConvertFrom-Json).data.uninstallEntry
powershell -NoProfile -ExecutionPolicy Bypass -File $entry
```

也可以使用原解压包的 `uninstall-cli.ps1`，以 `--install-root` 指定自定义安装位置。若 `setup uninstall` 返回 `EXTERNAL_UNINSTALLER_REQUIRED`，使用结果给出的外部卸载入口和参数；CLI 不能在运行中删除自身。

项目 Skill 使用 `--scope project --project-root <已存在目录>`；安装时显式指定 Agent 和范围。安装器维护文件记录；外部同名 Skill、被用户修改的文件或未知文件会返回冲突，没有强制覆盖参数。安装后如 Skill 未出现在 Codex 列表中，刷新或重启 Codex。安装工具和 Skill 不授予修改工程 JSON、覆盖工程或永久删除资源的权限。

可选 `<安装根>/config.json` 只支持 `{ "schemaVersion": 1, "desktopExecutable": "..." }`，只用于诊断，不执行 EXE。--config > PUZZLE_EDITOR_CLI_CONFIG > 默认位置；PUZZLE_EDITOR_DESKTOP_EXECUTABLE > 文件值，文件内相对路径按配置目录解析。未配置不创建文件，未知字段/授权键拒绝；无 config set/unset，工程命令不加载可选配置。会话位置沿用 PUZZLE_EDITOR_SESSION_DIR。不得保存会话 secret 或长期权限。

doctor 默认离线，只检查配置和文件；在线检查需明确 instance/session。结果 `data.checks` 为 pass/warn/fail/skip，出现 fail 退出 3，否则 0。可选 Skill 未安装不影响 CLI 的独立使用。安装器只向当前用户 PATH 添加稳定 bin 入口，卸载时移除该入口；配置和 Skill 记录保留供单独管理。安装中断使用 `setup recover`，Skill 安装中断使用 `skills recover`；如果报告外部文件发生变化，先核对这些变化，再决定恢复方式。

## 工程读取与领域编辑

便携使用时调用完整解压包内 `puzzle.cmd` 的绝对路径，无需修改 PATH。离线命令无需启动编辑器；session/history 必须连接兼容的桌面实例。相对工程路径以调用者当前工作目录解析。此包支持 Windows x64。

在 PowerShell 中，路径有空格时用 `& 'C:\Tools\PuzzleEditor CLI\puzzle.cmd' describe --json`。下文以 `puzzle.cmd` 代指实际启动器路径。

```text
puzzle.cmd describe --json
puzzle.cmd create --name Demo --root-asset-name DemoRoot --out Demo.puzzle.json --json
puzzle.cmd inspect Demo.puzzle.json --view tree --json
puzzle.cmd validate Demo.puzzle.json --json
puzzle.cmd json read Demo.puzzle.json --raw
```

编辑已有工程先 inspect，取得 source.sha256 和实体 ID，再用 `describe` 的 planSchema 构造有明确 scope/sourceHash 的领域计划。所有新资产的 assetName 必须外部指定；禁止自动翻译、生成、裁剪或补后缀。状态/演出节点用所属 FSM/Graph 加 ID 定位；全局与局部变量使用准确 owner。

```text
puzzle.cmd preview Demo.puzzle.json --plan edit-plan.json --receipt-out preview.json --json
puzzle.cmd apply Demo.puzzle.json --plan edit-plan.json --receipt preview.json --out Demo-edited.puzzle.json --json
puzzle.cmd validate Demo-edited.puzzle.json --json
puzzle.cmd export Demo-edited.puzzle.json --out Demo.export.json --json
```

stdout 为一个 JSON 结果，检查退出码和 ok，不只检查进程启动成功；raw 原文输出例外。errors 阻断导出。已有业务错误可以按基线保留，修改结果中的 remainingErrors 必须向用户说明。源、计划、候选或目标变动后重新读取/预览；不拼接旧版本上下文。

## 桌面会话与在线编辑

CLI 和桌面版必须支持同一在线协议，当前要求协议 2。启动桌面版后执行 `session list`，按用户指定的工程选择明确的 instanceId/sessionId；不能猜第一项或最近窗口。默认自动发现同一 Windows 用户的本地会话，无需配置网络端口。出现协议不兼容时，对齐 CLI 与桌面版本后再连接。

使用 session status 获取 token；session inspect 的查询视图沿用离线 inspect，新增 view=project 读取完整内存工程 JSON。pendingEdits 表示字段草稿尚未提交。把 token 对象存成 UTF-8 文件；计划 sourceHash 使用 token.contentHash。session preview 传 --token/--plan，可 --receipt-out；session apply 传 --plan/--receipt/--request-id。普通计划一次原子提交和一个 GUI Undo 条目，无变化不消耗历史。

变更请求 ID 必须在首次执行前保存，格式为“13 位 Unix 毫秒:UUID”；同 ID 同内容在 10 分钟内返回原结果，不同内容拒绝，容量 256。明确冲突后重新读取和预览；结果未知只能重试原 ID/内容，过期或实例/会话变化时先核对当前内容，不能自动创建 ID 重放。

没有聊天覆盖授权时，apply 不加 --allow-overwrite，改动只进内存并阻止相关自动保存；不能通过模拟 GUI 保存绕过许可。session save 使用最新 --token：--out 只写不存在的新路径；覆盖当前路径须用户在 Agent 聊天中授权，并带 --allow-overwrite/--expected-disk-hash。另存路径相对于 CLI 调用目录解析。不弹选择器；失败保留内存和 dirty，新编辑不被旧保存确认覆盖。

preview/apply/save/undo/redo 先处理有效字段草稿；草稿改变 token 则冲突，无效草稿、拖动、连线、组合输入、弹窗或尚未完成的人工翻译返回 pending/busy。永久删除授权独立，历史边界保持。握手只验证当前用户本地传输，不认证聊天。连接失败不得回退磁盘写入。在线 raw 替换、界面导航及偏好管理未开放。历史操作见下一节。

## 撤销与重做

history list 必须指定 --instance/--session，返回同一 GUI past/future，下一步可执行的条目排在首位，上限 50 条。每条含 entryId、source、summary、requiredCapabilities；快照和元数据不写进工程文件，不跨重启保留。

```text
puzzle.cmd history list --instance <instanceId> --session <sessionId> --json
puzzle.cmd history undo --instance <instanceId> --session <sessionId> --token history-token.json --entry-id <undoEntryId> --request-id <毫秒:UUID>
puzzle.cmd history redo --instance <instanceId> --session <sessionId> --token history-token.json --entry-id <redoEntryId> --request-id <新的毫秒:UUID>
```

先将 list 的 data.token 写成 UTF-8 token 文件；每次只能处理当前方向顶部一条。用 list 的 undoEntryId 或 redoEntryId，不按名称猜，不跳过中间人工操作。token 或条目变化则重新读取；GUI/CLI 共同使用历史，手工新编辑清空 redo，no-op 不消耗条目。

普通 Undo 只改内存。Redo 按实际效果与原操作语义计算能力；实际永久删除仍须 --allow-permanent-delete，成功后形成不可恢复边界。若历史记录要求 raw_json_write，必须已获对应聊天许可再声明 --allow-raw-json-write；这不开放新的在线 JSON 替换入口。旧覆盖声明不批准这次保存。

未声明本次 --allow-overwrite 的 Agent Undo/Redo 总是建立新的自动保存限制，即使目标以前保存过；已有受限目标继续受限。之后通过 session save 在授权范围内保存，或明确新路径另存。空栈、冲突、只读、无效草稿/忙碌均无历史提交。10 分钟幂等和未知结果重试规则与 session apply 相同；Undo 不是磁盘回滚，禁止结果未知时换 ID 再撤销。

## 导入与导出

`import preview/apply` 支持已有 puzzle-project、puzzle-export、raw ProjectData、legacy ExportManifest。它们只创建新 `.puzzle.json`，保留源文件，不合并或修改 GUI 会话。先预览检查 detectedFormat、importNotices、missingAssetNames、remainingErrors、完整候选及差异，再使用同一回执提交：

```text
puzzle.cmd import preview legacy.json --out Converted.puzzle.json --receipt-out import-preview.json --json
puzzle.cmd import apply legacy.json --out Converted.puzzle.json --receipt import-preview.json --json
puzzle.cmd validate Converted.puzzle.json --json
```

需要补齐或修改资产名时，两步均传相同 `--names mapping.json`。映射必须为 `{apiVersion:"1.0.0", sourceHash:"源文件 SHA-256", entries:[{entity:{type:"puzzle",id:"实体 ID"},assetName:"ExternalName"}]}`，具体 JSON Schema 由 describe.importNamesSchema 提供。Stage/Puzzle/Event/Script 用 type+id；State 另带 ownerType=fsm 和 ownerId；Variable 指定 project、stage 或 puzzle owner，只有 project 全局映射不传 ownerId，避免依赖生成的工程 UUID。不得加入其他字段或通用补丁。

所有名称由调用方指定，不自动生成或补后缀。已有未改的缺名可作为旧错误保留并报告，不能当作可导出的有效工程；当前转换器不生成新的命名业务资产。缺失映射字段、未知/重复身份、非法名称或新增错误均拒绝。预览回执固定项目 UUID/时间，并绑定源、映射、目标、转换器版本与候选 hash；输入变化必须重做预览。源未保存的 UI 状态使用共用默认值，无法恢复原布局。

转换是普通领域能力；禁止先未经聊天授权手改源 JSON，再借 import 绕过 raw 权限。它不接收 raw、覆盖或永久删除声明参数，也不让获得一项许可等同于其他许可。

导出使用 `puzzle export <工程文件> --out <新的导出文件>`，结果是供游戏运行时使用的数据，不包含完整编辑器状态。校验存在 error 时不能导出；可编辑工程应保留为 `.puzzle.json`，不能用运行时导出覆盖工程文件。

## 直接 JSON 编辑的聊天授权

直接编写或修改工程 JSON 是备用能力。使用前必须有用户在 Agent 聊天中的明确许可，例如“本次修复允许直接修改 Demo 项目的 JSON，仅限演出图”。普通“修改项目”“使用 CLI”等任务授权不自动包含该权限。Agent 依据用户消息确认项目、任务、目的和范围；不能自动从失败的领域命令降级，也不能改用任意文件工具绕过授权。

已有范围内授权继续有效，不要求每条命令或每份候选再次确认。没有授权、授权被拒绝/撤回、超出范围或含义不清时，在聊天中取得相应许可后再执行。不要把一个任务的授权推定为其他项目或未来任务的永久权限。

获得授权后，先把完整内容写入单独的候选文件，再预览校验并保存到新输出。完整读取包括 fileType/editorVersion/savedAt/project/editorState，不把运行时导出或查询摘要当作完整工程。候选的字段、ID、assetName 和时间均由调用者明确提供；不假设工具会替其填值。若返回 CANDIDATE_NORMALIZATION_REQUIRED，依据 normalizationChanges 修正候选并重新预览。

```text
puzzle.cmd json preview Demo.puzzle.json --candidate candidate.puzzle.json --out Demo-reviewed.puzzle.json --receipt-out raw-preview.json --json
puzzle.cmd json apply Demo.puzzle.json --candidate candidate.puzzle.json --receipt raw-preview.json --out Demo-reviewed.puzzle.json --allow-raw-json-write --json
```

`--allow-raw-json-write` 仅声明调用方已获得聊天授权。CLI 不读取聊天、认证消息或自行批准；回执、环境变量、参数和 Agent 自写“用户同意”都不产生授权。没有桌面审批窗口、批准令牌或 stdin 确认流程。源/候选变化要求重新预览；仍在授权范围内时不重复询问用户。

## 保存、覆盖与资源删除

### 获授权的覆盖保存

覆盖原工程是独立的最高权限能力 `overwrite_project`。必须已有用户在 Agent 聊天中明确授权本项目/任务/文件的覆盖操作；普通编辑、raw 许可或预览回执都不代替它。默认仍另存新文件。获得许可后，用 `--in-place` 代替 `--out`；领域与 raw 两步均指定同一模式，apply 另加 `--allow-overwrite`：

```text
puzzle.cmd preview Demo.puzzle.json --plan edit-plan.json --in-place --receipt-out overwrite-preview.json --json
puzzle.cmd apply Demo.puzzle.json --plan edit-plan.json --receipt overwrite-preview.json --in-place --allow-overwrite --json
```

raw 覆盖的 `json preview/apply` 同样使用 `--in-place`；apply 同时要求 `--allow-raw-json-write --allow-overwrite`。若实际永久移除受保护资源，再加 `--allow-permanent-delete`，三项许可互不替代。in-place 只能覆盖本次源 `.puzzle.json`；import/export 不获得覆盖参数。

覆盖回执绑定源路径、原字节 hash、文件身份和候选。覆盖前保存原文备份并完成校验；结果返回 `backup.path/sha256` 与 `transaction.id/path`。记录在源旁 `.<文件名>.puzzle-transactions/<提交 ID>/`，备份为 `before.puzzle.json`、事务记录为 `record.json`，不会自动清除。相同回执重试会核对输入、权限和备份，已完成则返回 `already-applied`；第三方修改、未知记录或损坏备份会拒绝提交。不要手改事务记录或未经核对用备份覆盖现文件。`COMMIT_RESULT_UNCERTAIN` 表示可能已经写入，应保留输入和回执，核验返回路径与预期 hash，在原授权范围内重试同一命令。

桌面编辑器持有工程时，离线覆盖返回 `PROJECT_OWNED`；即使已获覆盖许可，也应通过 session 命令处理当前内存，或在关闭该工程后重试。无响应或未知所有者同样拒绝覆盖，不手动清除锁或绕过检查。文件协调要求 CLI 与桌面版均支持该能力；其他文件编辑工具不受此协议约束，操作时应避免同时修改同一工程。覆盖模式支持 Windows。

### 资源与文件结果

使用 stage.delete、puzzle.delete 删除层级对象，使用 variable/event/script.purge 永久删除受保护资源。非空 Stage 必须显式 cascade，根不可删除；层级删除包含所属 FSM，范围外仍有所有者则拒绝。共享图与全局资源不随父对象删除。scope 覆盖受影响父级及新初始兄弟；剩余引用须在同一计划中明确修复，不能隐式改绑同 ID 祖先变量。

永久删除 Implemented / MarkedForDelete 资源与 raw 编辑同属最高权限，必须由用户在 Agent 聊天中明确授权对应项目、任务和实体范围；两者不互相授权。已有范围内许可持续有效。Draft 使用普通 delete，Implemented 普通 delete 只标删，Marked 再次普通 delete 拒绝；purge 才是受保护资源永久删除入口。父 Stage/Puzzle 或完整 JSON 候选间接移除也受同一检查。

预览检查 requiredCapabilities、permanentDeletions 和 impacts.deletions。获永久删除许可后，领域 apply 传 --allow-permanent-delete；raw 删除同时传 --allow-raw-json-write 和 --allow-permanent-delete。这些参数只声明已有许可，CLI 不认证聊天；缺声明退出 6，禁止用其他文件工具绕过。回执绑定权限策略及能力要求，不兼容的回执须重新预览。

默认写入只创建明确的新文件；覆盖源工程必须使用上述独立授权模式，其他输入始终受保护。apply 重试可核验已有同字节输出；出现 COMMIT_RESULT_UNCERTAIN 时检查返回路径和 expectedHash，不随机换文件名重试。raw apply 保留候选 UTF-8 原文，不能自动改时间、ID、缩进或字段。校验、资产命名及资源生命周期不因获得 JSON 权限而放宽。

离线写入文件不会同步更新已打开的桌面工程；加载结果前应处理桌面未保存内容。CLI 不执行用户脚本，导出结果需要在游戏运行环境中验证。包内 manifest.json 记录文件 SHA-256，ZIP 外另有哈希文件；Node 和 Zod 许可证位于 licenses。升级时解压到新目录，再运行安装命令。
