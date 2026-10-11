已使用本机 PuzzleEditor CLI 完成创建、读取、领域编辑、预览、应用、校验和导出。项目名称、层级、资产名及 description 均符合规格；Unlock Door 由 Unlock 事件触发，Closed 保持初始状态。

文件均位于当前目录：

- [source.puzzle.json](<D:/Temp/PuzzleEditor Codex 自动发现 2026-10-11 146a10bd-3b39-4d27-920d-3f80d1b38133/source.puzzle.json>)：原始工程，SHA-256 确认未改变。
- [edited.puzzle.json](<D:/Temp/PuzzleEditor Codex 自动发现 2026-10-11 146a10bd-3b39-4d27-920d-3f80d1b38133/edited.puzzle.json>)：编辑后工程。
- [runtime.export.json](<D:/Temp/PuzzleEditor Codex 自动发现 2026-10-11 146a10bd-3b39-4d27-920d-3f80d1b38133/runtime.export.json>)：运行时导出。

源工程和编辑后工程均校验通过：**0 错误、0 警告**。领域计划、预览回执和结果记录也已保留。

遇到的问题：首次创建的 scope 引用待创建 Room 时，CLI 报 `ENTITY_NOT_FOUND`；改用本次虚构工程的整体 scope 后成功。全过程未直接修改完整工程 JSON、覆盖工程或删除资源。