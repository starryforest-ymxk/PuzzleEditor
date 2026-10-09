# 权限、错误与恢复

[返回使用指南](cli-guide.md) · [共用数据结构](data-structures.md)

## 退出码与诊断

| 退出码 | 含义 | 处理 |
|---|---|---|
| 0 | 成功 | 仍检查 diagnostics 和 remainingErrors，成功不总等于没有旧错误 |
| 1 | 内部错误 | 保留命令和诊断，停止盲重试并报告 |
| 2 | 输入错误 | 检查位置参数、类型、互斥选项、必填字段与重复参数 |
| 3 | 校验失败 | 按 diagnostics 的 code/path/operationIndex 修复；doctor 有 fail 也用此码 |
| 4 | 冲突 | 重读源、token 或安装状态；重新预览，不覆盖第三方修改 |
| 5 | I/O 失败 | 检查路径、访问权限、磁盘和返回的提交状态 |
| 6 | 缺少能力声明 | 先核对聊天授权范围，不能把补 flag 当成自动获得授权 |
| 130 | 中断 | 核对是否已经提交，遵循同回执或同 requestId 的恢复规则 |

每次检查进程退出码、ok、diagnostics 和 error。pathBasis=request 定位请求或计划，工程路径定位业务内容。结果未知时先核验返回的 expectedHash、输出路径和事务记录，不能随机换目标重试。

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
