# PuzzleEditor CLI 入门

本指南对应 C16 CLI / C16.1 桌面图标修订，Windows x64，在线协议 2。CLI 可以独立创建、读取、编辑、校验和导出工程；连接兼容桌面程序后也可以编辑未保存的内容并共用 Undo/Redo。

## 1. 下载并启动

从 [C16.1 Release](https://github.com/starryforest-ymxk/PuzzleEditor/releases/tag/v1.0.0-beta-c16.1) 下载 [CLI ZIP](https://github.com/starryforest-ymxk/PuzzleEditor/releases/download/v1.0.0-beta-c16.1/PuzzleEditor-CLI-1.0.0-beta-C16-win-x64.zip) 和 [桌面安装器](https://github.com/starryforest-ymxk/PuzzleEditor/releases/download/v1.0.0-beta-c16.1/PuzzleEditor-Setup-1.0.0-beta-C16.1-win-x64.exe)。此前 GitHub Release 已被用户删除，本轮重新发布当前版本。解压 ZIP 到独立目录，包内包含 puzzle.cmd、Node、许可证、能力表、AGENTS.md、安装入口与 Skill，无需 Node/npm。

本地验收包位于 release/cli/C16-final3 和 release/desktop/C16-iconfix；中间候选 C16、C16-final、C16-final2 不作为交付包。源与附件核验见 [发行记录](https://github.com/starryforest-ymxk/PuzzleEditor/blob/v1.0.0-beta-c16.1/overview/dev/Release_C16_1_2026-10-09.md)。

在 PowerShell 中设置启动器路径。下面的路径是示例，请改为自己的解压位置：

```powershell
$cli = 'E:\Tools\PuzzleEditor-CLI-1.0.0-beta-win-x64\puzzle.cmd'
& $cli describe --json
```

返回的 `data.phase` 应为 `C16`；describe 提供全部 36 个命令及 JSON Schema。不要单独移动 puzzle.cmd 或包内运行时。路径有空格时，保留引号和前面的 `&`。

若需要全局命令，在解压目录执行：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\install-cli.ps1 --dry-run
powershell -NoProfile -ExecutionPolicy Bypass -File .\install-cli.ps1
```

自定义安装目录可在两条安装命令后增加 `--install-root 'D:\Tools\PuzzleEditorCLI'`。当前 CLI 通过自己的安装记录和卸载入口管理，尚未注册到 Windows“已安装的应用”列表。

重新打开终端或 Codex 后执行 puzzle version、puzzle config show、puzzle doctor --offline。Codex Skill 安装先预览 `puzzle skills install --agent codex --scope user --dry-run`，去掉 --dry-run 安装。项目级用 --scope project --project-root；查看/卸载与恢复见 [唯一发行指南](https://github.com/starryforest-ymxk/PuzzleEditor/blob/v1.0.0-beta-c16.1/overview/dev/CLI_Distribution_Guide.md)。全局安装不授权任何工程覆盖或 JSON 编辑。

## 2. 创建、读取和导出

使用一个新的练习目录；下面的目标文件应尚未存在。`assetName` 必须由调用方明确指定，这里根 Stage 使用 `DemoRoot`：

```powershell
$work = 'E:\PuzzleProjects\CLI-Demo'
New-Item -ItemType Directory -Path $work -Force | Out-Null
$project = Join-Path $work 'Demo.puzzle.json'

& $cli create --name Demo --root-asset-name DemoRoot --out $project --json
& $cli inspect $project --view tree --json
& $cli validate $project --json
& $cli json read $project --raw
& $cli export $project --out (Join-Path $work 'Demo.export.json') --json
```

`.puzzle.json` 是完整工程，`.export.json` 是供运行时使用的导出。离线读取对应磁盘文件，尚未保存的桌面修改应通过下一节的 session 读取。

除 `json read --raw` 外，结果为 JSON；检查退出码 `$LASTEXITCODE` 和 `ok`。存在校验 error 时不能导出。命令失败后先读诊断，不盲目重复创建或覆盖。

## 3. 通过领域计划编辑工程

编辑流程是 **读取 ID 和版本 → 编写领域计划 → preview → apply 另存 → validate**。下面只改根 Stage 的显示名称和描述，保留资产名以及其他内容；写的是命令计划，不是直接编写整份工程 JSON。

```powershell
$info = & $cli inspect $project --view tree --json | ConvertFrom-Json
if ($LASTEXITCODE -ne 0 -or -not $info.ok) { throw 'Inspect failed.' }
$rootId = $info.data.result.rootId

$plan = @{
  apiVersion = '1.0.0'
  sourceHash = $info.data.source.sha256
  scope = @{ stages = @(@{ id = $rootId }) }
  commands = @(@{
    op = 'stage.update'
    target = @{ id = $rootId }
    changes = @{ name = 'Entry Stage'; description = 'Edited through CLI.' }
  })
}
$planPath = Join-Path $work 'edit-plan.json'
$receipt = Join-Path $work 'preview.json'
$edited = Join-Path $work 'Demo-edited.puzzle.json'
[IO.File]::WriteAllText($planPath, ($plan | ConvertTo-Json -Depth 20), [Text.UTF8Encoding]::new($false))

& $cli preview $project --plan $planPath --receipt-out $receipt --json
if ($LASTEXITCODE -ne 0) { throw 'Preview failed.' }
& $cli apply $project --plan $planPath --receipt $receipt --out $edited --json
if ($LASTEXITCODE -ne 0) { throw 'Apply failed.' }
& $cli validate $edited --json
```

默认创建新文件，原工程保留。源文件或计划变化后必须重新读取和预览。复杂 Stage、Puzzle、FSM、演出图及资源操作均通过 describe 的计划契约发现，也可以让 Agent 编写这些领域计划。

## 4. 读取正在打开的桌面工程

安装并运行同一 Release 的桌面版，再执行：

```powershell
& $cli session list --json
```

从结果中按工程名称/路径选择目标窗口的 `instanceId` 与 `sessionId`，不要默认选第一项。替换下面的实例和会话值：

```powershell
& $cli session status --instance '<instanceId>' --session 1 --json
& $cli session inspect --instance '<instanceId>' --session 1 --view project --json
& $cli session validate --instance '<instanceId>' --session 1 --json
& $cli history list --instance '<instanceId>' --session 1 --json
```

在线修改使用 session preview/apply；历史 undo/redo 还要求最新 token、顶部 entryId 和 requestId。普通 apply/undo/redo 先修改内存，未获得覆盖许可时阻止相关自动保存。具体 token、回执、保存及重试例子见 [完整使用说明](https://github.com/starryforest-ymxk/PuzzleEditor/blob/v1.0.0-beta-c16/overview/dev/CLI_Agent_Usage.md)。

C9 协议 1 和 C10 协议 2 不能混用。工程被桌面占用时，离线覆盖会拒绝；需要修改当前未保存内容时使用 session。

## 5. 交给外部 Agent 使用

把 CLI 的绝对路径、工程路径和修改目标告诉 Agent，并要求先读包内 AGENTS.md。例如：

> 请使用 `E:\Tools\PuzzleEditor-CLI-1.0.0-beta-win-x64\puzzle.cmd` 编辑 `E:\PuzzleProjects\Demo.puzzle.json`。先阅读 CLI 包内 AGENTS.md 和 describe，使用领域命令预览、修改并另存新工程，完成后校验和导出。所有新资产名按我提供的列表填写；缺少名称时先询问。

若需要直接修改当前桌面工程，再明确指定窗口/工程，并要求通过 session 操作。

**直接编写工程 JSON、覆盖已有工程、永久删除已实现或标删资源，分别需要用户在 Agent 聊天中明确授权。** `--allow-raw-json-write`、`--allow-overwrite`、`--allow-permanent-delete` 只声明已有许可，三项许可不能互相替代。普通“帮我修改项目”不自动授予这些权限。

包内 AGENTS.md 是 Agent 的执行规范；本指南提供入门步骤，完整能力和参数以实际 describe 为准。
