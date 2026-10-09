# PuzzleEditor CLI：发行包 Agent 指南

本文件是发行包 `AGENTS.md` 的唯一维护来源，打包时原样复制。当前 API 1.0.0 / C10，权限策略 C10，转换器 C7.1；22 个命令入口、47 种领域操作和完整 JSON 只读/备用编辑均通过 `describe` 的契约发现。旧版包保留其原始指南和能力，升级后须重新检查 describe；C6–C9 回执需要重新预览。

## 启动与基本流程

Windows x64 解压后使用包内 `puzzle.cmd` 的绝对路径；启动器使用包内 `runtime/node.exe`，不要求安装 Node、npm 或源码，也不会修改 PATH。离线命令无需启动编辑器；session/history 必须连接兼容的桌面实例。相对工程路径以调用者当前工作目录解析。`app/cli.js` 是独立 Node 入口，其他系统需自备符合软件要求的 Node；此 ZIP 仅验证 Windows x64。

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

## 在线编辑当前桌面工程（C9/C10）

使用同批 C10 CLI 与桌面构建，在线协议为 2。C8 没有在线能力；C9 协议 1 会明确返回不兼容，不能混用。执行 session list，按用户目标选明确 instanceId/sessionId；不能猜第一项或最近窗口。

使用 session status 获取 token；session inspect 的查询视图沿用离线 inspect，新增 view=project 读取完整内存工程 JSON。pendingEdits 表示字段草稿尚未提交。把 token 对象存成 UTF-8 文件；计划 sourceHash 使用 token.contentHash。session preview 传 --token/--plan，可 --receipt-out；session apply 传 --plan/--receipt/--request-id。普通计划一次原子提交和一个 GUI Undo 条目，无变化不消耗历史。

变更请求 ID 必须在首次执行前保存，格式为“13 位 Unix 毫秒:UUID”；同 ID 同内容在 10 分钟内返回原结果，不同内容拒绝，容量 256。明确冲突后重新读取和预览；结果未知只能重试原 ID/内容，过期或实例/会话变化时先核对当前内容，不能自动创建 ID 重放。

没有聊天覆盖授权时，apply 不加 --allow-overwrite，改动只进内存并阻止相关自动保存；不能通过模拟 GUI 保存绕过许可。session save 使用最新 --token：--out 只写不存在的新路径；覆盖当前路径须用户在 Agent 聊天中授权，并带 --allow-overwrite/--expected-disk-hash。另存路径相对于 CLI 调用目录解析。不弹选择器；失败保留内存和 dirty，新编辑不被旧保存确认覆盖。

preview/apply/save/undo/redo 先处理有效字段草稿；草稿改变 token 则冲突，无效草稿、拖动、连线、组合输入、弹窗或尚未完成的人工翻译返回 pending/busy。永久删除授权独立，历史边界保持。握手只验证当前用户本地传输，不认证聊天。连接失败不得回退磁盘写入。在线 raw 替换、界面导航及偏好管理未开放。历史操作见下一节。

## 当前会话的历史（C10）

history list 必须指定 --instance/--session，返回同一 GUI past/future，下一步可执行的条目排在首位，上限 50 条。每条含 entryId、source、summary、requiredCapabilities；快照和元数据不写进工程文件，不跨重启保留。

```text
puzzle.cmd history list --instance <instanceId> --session <sessionId> --json
puzzle.cmd history undo --instance <instanceId> --session <sessionId> --token history-token.json --entry-id <undoEntryId> --request-id <毫秒:UUID>
puzzle.cmd history redo --instance <instanceId> --session <sessionId> --token history-token.json --entry-id <redoEntryId> --request-id <新的毫秒:UUID>
```

先将 list 的 data.token 写成 UTF-8 token 文件；每次只能处理当前方向顶部一条。用 list 的 undoEntryId 或 redoEntryId，不按名称猜，不跳过中间人工操作。token 或条目变化则重新读取；GUI/CLI 共同使用历史，手工新编辑清空 redo，no-op 不消耗条目。

普通 Undo 只改内存。Redo 按实际效果与原操作语义计算能力；实际永久删除仍须 --allow-permanent-delete，成功后形成不可恢复边界。若历史记录要求 raw_json_write，必须已获对应聊天许可再声明 --allow-raw-json-write；这不开放新的在线 JSON 替换入口。旧覆盖声明不批准这次保存。

未声明本次 --allow-overwrite 的 Agent Undo/Redo 总是建立新的自动保存限制，即使目标以前保存过；已有受限目标继续受限。之后通过 session save 在授权范围内保存，或明确新路径另存。空栈、冲突、只读、无效草稿/忙碌均无历史提交。10 分钟幂等和未知结果重试规则与 session apply 相同；Undo 不是磁盘回滚，禁止结果未知时换 ID 再撤销。

## 兼容文件转换为完整工程（C7）

`import preview/apply` 支持已有 puzzle-project、puzzle-export、raw ProjectData、legacy ExportManifest。它们只创建新 `.puzzle.json`，保留源文件，不合并或修改 GUI 会话。先预览检查 detectedFormat、importNotices、missingAssetNames、remainingErrors、完整候选及差异，再使用同一回执提交：

```text
puzzle.cmd import preview legacy.json --out Converted.puzzle.json --receipt-out import-preview.json --json
puzzle.cmd import apply legacy.json --out Converted.puzzle.json --receipt import-preview.json --json
puzzle.cmd validate Converted.puzzle.json --json
```

需要补齐或修改资产名时，两步均传相同 `--names mapping.json`。映射必须为 `{apiVersion:"1.0.0", sourceHash:"源文件 SHA-256", entries:[{entity:{type:"puzzle",id:"实体 ID"},assetName:"ExternalName"}]}`，具体 JSON Schema 由 describe.importNamesSchema 提供。Stage/Puzzle/Event/Script 用 type+id；State 另带 ownerType=fsm 和 ownerId；Variable 指定 project、stage 或 puzzle owner，只有 project 全局映射不传 ownerId，避免依赖生成的工程 UUID。不得加入其他字段或通用补丁。

所有名称由调用方指定，不自动生成或补后缀。已有未改的缺名可作为旧错误保留并报告，不能当作可导出的有效工程；当前转换器不生成新的命名业务资产。缺失映射字段、未知/重复身份、非法名称或新增错误均拒绝。预览回执固定项目 UUID/时间，并绑定源、映射、目标、转换器版本与候选 hash；输入变化必须重做预览。源未保存的 UI 状态使用共用默认值，无法恢复原布局。

转换是普通领域能力；禁止先未经聊天授权手改源 JSON，再借 import 绕过 raw 权限。它不接收 raw、覆盖或永久删除声明参数，也不让获得一项许可等同于其他许可。

## 直接 JSON 编辑的聊天授权

直接编写或修改工程 JSON 是备用能力。使用前必须有用户在 Agent 聊天中的明确许可，例如“本次修复允许直接修改 Demo 项目的 JSON，仅限演出图”。普通“修改项目”“使用 CLI”等任务授权不自动包含该权限。Agent 依据用户消息确认项目、任务、目的和范围；不能自动从失败的领域命令降级，也不能改用任意文件工具绕过授权。

已有范围内授权继续有效，不要求每条命令或每份候选再次确认。没有授权、授权被拒绝/撤回、超出范围或含义不清时，在聊天中取得相应许可后再执行。不要把一个任务的授权推定为其他项目或未来任务的永久权限。

获得授权后，先把完整内容写入单独的候选文件，再预览校验并保存到新输出。完整读取包括 fileType/editorVersion/savedAt/project/editorState，不把运行时导出或查询摘要当作完整工程。候选的字段、ID、assetName 和时间均由调用者明确提供；不假设工具会替其填值。若返回 CANDIDATE_NORMALIZATION_REQUIRED，依据 normalizationChanges 修正候选并重新预览。

```text
puzzle.cmd json preview Demo.puzzle.json --candidate candidate.puzzle.json --out Demo-reviewed.puzzle.json --receipt-out raw-preview.json --json
puzzle.cmd json apply Demo.puzzle.json --candidate candidate.puzzle.json --receipt raw-preview.json --out Demo-reviewed.puzzle.json --allow-raw-json-write --json
```

`--allow-raw-json-write` 仅声明调用方已获得聊天授权。CLI 不读取聊天、认证消息或自行批准；回执、环境变量、参数和 Agent 自写“用户同意”都不产生授权。没有桌面审批窗口、批准令牌或 stdin 确认流程。源/候选变化要求重新预览；仍在授权范围内时不重复询问用户。

## 交付与边界

### 获授权的覆盖保存（C8，Windows）

覆盖原工程是独立的最高权限能力 `overwrite_project`。必须已有用户在 Agent 聊天中明确授权本项目/任务/文件的覆盖操作；普通编辑、raw 许可或预览回执都不代替它。默认仍另存新文件。获得许可后，用 `--in-place` 代替 `--out`；领域与 raw 两步均指定同一模式，apply 另加 `--allow-overwrite`：

```text
puzzle.cmd preview Demo.puzzle.json --plan edit-plan.json --in-place --receipt-out overwrite-preview.json --json
puzzle.cmd apply Demo.puzzle.json --plan edit-plan.json --receipt overwrite-preview.json --in-place --allow-overwrite --json
```

raw 覆盖的 `json preview/apply` 同样使用 `--in-place`；apply 同时要求 `--allow-raw-json-write --allow-overwrite`。若实际永久移除受保护资源，再加 `--allow-permanent-delete`，三项许可互不替代。in-place 只能覆盖本次源 `.puzzle.json`；import/export 不获得覆盖参数。

覆盖回执固定规范源路径、原字节 hash、文件身份和候选。提交先取得跨进程所有权，再核验原文备份，完整临时文件 fsync/核验后才替换；返回 `backup.path/sha256` 与 `transaction.id/path`。记录在源旁 `.<文件名>.puzzle-transactions/<提交 ID>/`，备份为 `before.puzzle.json`、阶段记录为 `record.json`。不自动删除或覆盖备份。相同回执重试重新核对输入、能力、原文备份和候选，已知后态返回 `already-applied`；第三方修改、未知记录或损坏备份拒绝。不能手改事务记录强行通过或无条件用备份覆盖现文件。`COMMIT_RESULT_UNCERTAIN` 表示可能已经写入，应保留输入/回执并核验返回路径和预期 hash，在原授权范围内重试同一命令。

兼容 C8 桌面持有工程时返回 `PROJECT_OWNED`，即使已获覆盖许可也不能绕过其未保存内存；关闭该工程后重试。C10 配套构建可显式使用 session 命令处理内存；旧 C8 ZIP 不含该能力。Windows 路径/文件身份由 OS named pipe 句柄共同持有，退出后由 OS 释放，不删除“过期 PID 锁”。无响应/未知所有者也拒绝。旧桌面必须升级为 C8 或后续兼容构建；任意第三方文件工具不受本协议约束，不能保证最后校验到替换之间完全没有外部写入。C8 未开放其他平台的 in-place；另存能力保持。

### 资源与文件结果

C6 增加 stage.delete、puzzle.delete 与 variable/event/script.purge。非空 Stage 显式 cascade，根不可删除；层级删除包含所属 FSM，范围外仍有所有者则拒绝。共享图与全局资源不随父对象删除。scope 覆盖受影响父级及新初始兄弟；剩余引用须同批明确修复，不能隐式改绑同 ID 祖先变量。

永久删除 Implemented / MarkedForDelete 资源与 raw 编辑同属最高权限，必须由用户在 Agent 聊天中明确授权对应项目、任务和实体范围；两者不互相授权。已有范围内许可持续有效。Draft 使用普通 delete，Implemented 普通 delete 只标删，Marked 再次普通 delete 拒绝；purge 才是受保护资源永久删除入口。父 Stage/Puzzle 或完整 JSON 候选间接移除也受同一检查。

预览检查 requiredCapabilities、permanentDeletions 和 impacts.deletions。获永久删除许可后，领域 apply 传 --allow-permanent-delete；raw 删除同时传 --allow-raw-json-write 和 --allow-permanent-delete。这些参数只声明已有许可，CLI 不认证聊天；缺声明退出 6，禁止用其他文件工具绕过。回执绑定 C10 策略与能力要求，旧回执须重新预览。

默认写入只创建明确的新文件；覆盖源工程必须使用上述独立授权模式，其他输入始终受保护。apply 重试可核验已有同字节输出；出现 COMMIT_RESULT_UNCERTAIN 时检查返回路径和 expectedHash，不随机换文件名重试。raw apply 保留候选 UTF-8 原文，不能自动改时间、ID、缩进或字段。校验、资产命名及资源生命周期不因获得 JSON 权限而放宽。

文件结果不代表 GUI 内存已经更新或可撤销，加载新文件时仍应遵循现有未保存保护。CLI 不执行用户脚本，不证明 Unity 玩法正确。包内 manifest.json 记录文件 SHA-256，ZIP 外另有哈希文件；Node 和 Zod 许可证位于 licenses。升级时解压到新目录，不覆盖正在使用的发行目录或工程文件。
