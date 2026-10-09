# PuzzleEditor CLI 使用指南

通过 CLI 创建、读取、编辑、校验及导出 PuzzleEditor 工程，或连接桌面编辑器处理未保存内容。先执行 `puzzle version` 和 `puzzle describe --json`，以实际工具支持的契约为准。

## 按任务选择参考

| 任务 | 参考 |
|---|---|
| 首次使用、完整文件编辑示例 | [快速入门](cli-reference/quick-start.md) |
| 安装、升级、配置、Skill、诊断 | [14 条环境与工具命令](cli-reference/commands-tooling.md) |
| 读取、创建、编辑、导入、导出、JSON 备用操作 | [12 条文件命令](cli-reference/commands-files.md) |
| 连接桌面、在线保存、撤销重做 | [10 条会话与历史命令](cli-reference/commands-session.md) |
| 工程、Stage、Puzzle | [11 种层级操作](cli-reference/operations-hierarchy.md) |
| 变量、事件、脚本 | [16 种资源操作](cli-reference/operations-resources.md) |
| 状态、迁移、初始状态 | [9 种 FSM 操作](cli-reference/operations-fsm.md) |
| 演出图、节点、连接 | [11 种演出操作](cli-reference/operations-presentation.md) |
| scope、alias、owner、条件、参数与返回结果 | [共用数据结构](cli-reference/data-structures.md) |
| 嵌套工程、FSM、演出图、在线编辑、导入 | [完整场景教程](cli-reference/workflows.md) |
| 聊天授权、退出码、冲突、恢复 | [权限与错误处理](cli-reference/permissions-errors.md) |

## 通用流程

已有工程先 inspect，取得真实实体 ID、归属及源 hash；构造限定 scope 的领域计划，preview 检查差异和所需权限，再用同一回执 apply 到明确的新文件，最后 validate 和按需 export。创建时必须明确提供所有需要的 assetName，不能自动生成或翻译。

直接修改工程 JSON、覆盖工程、永久删除受保护资源分别需要用户在 Agent 聊天中的明确许可；有效许可在已授权范围内持续有效，不重复要求确认。命令 flag、回执或安装 Skill 都不产生该许可。详细规则集中在权限页。

相对路径按调用者当前工作目录解析；中文或空格路径正确加引号。写入 JSON 使用 UTF-8；不要依赖 Windows PowerShell 默认输出编码。stdout 通常是单个 JSON 对象，必须检查退出码及 ok；json read --raw 是原文输出例外。

离线操作不更新已打开的内存工程；未保存内容使用明确的 session。在线连接失败不能回退磁盘写入；在线原始 JSON 替换、界面导航、面板及用户偏好命令未开放。CLI 不执行游戏脚本，玩法正确性仍需在游戏环境验证。
