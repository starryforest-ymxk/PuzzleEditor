# P2-T01 项目加载与内存模型构建 - 设计与落实记录

## 1. 任务目标与范围
- **Task**: [P2-T01] 从 JSON Manifest 加载项目，归一化为内部统一模型并注入 Store，处理版本兼容（缺失字段填默认）、加载错误状态。
- **Scope**: 逻辑层与数据模型，预留接口。
- **参考文档**: Project_Overview、UX_Flow（系统级加载需可感知状态）、Domain_Model、Architecture_Guide、Phase2_Guide。

## 2. 设计思路
- **数据归一化管线**：新增 `utils/projectNormalizer.ts`，接受 `ExportManifest | ProjectData` + 可选 `ManifestData`，填充缺失字段、校准类型（黑板、Stage、Node、FSM、Presentation 节点参数/时长），返回适配 Store 的 `project` 与脚本/触发器清单。
- **Store 承载**：
  - `EditorState.project` 持有完整项目（含黑板、脚本/触发器 manifest），Undo/Redo 快照包含这些数据。
  - 新增 `manifest` 视图数据（脚本/触发器数组）供 UI 使用。
  - `ui` 增加 `errorMessage`，初始化/错误时更新。
- **加载流程**：
  - `loadProjectData` 并行获取项目与 manifest，manifest 失败不阻断项目加载。
  - 通过归一化结果派发 `INIT_SUCCESS`；异常派发 `INIT_ERROR`。
  - 同步写入全局消息堆栈（`ADD_MESSAGE`），成功用 info，manifest 失败用 warning，异常用 error，供顶栏 Messages 查看/清空。
- **兼容策略**：
  - 支持 `ExportManifest`（含 `manifestVersion`）或旧式 `ProjectData`。
  - 元信息、黑板、Stage/Node/FSM/Presentation 缺失字段填默认值；ScriptCall/Wait 参数按类型裁剪。
  - 如果项目内未携带脚本/触发器，落回额外 manifest 响应。

## 3. 具体改动
- **新增** `utils/projectNormalizer.ts`：集中归一化逻辑与默认填充，输出 `{ project, scripts, triggers }`。
- **store/types.ts**：补充 `manifest` 视图数据、`ui.errorMessage`，`project` 增含脚本/触发器清单，初始 meta/黑板默认值完善；`INIT_ERROR` Action。
- **store/reducer.ts**：初始化时写入完整 project+manifest，错误状态处理；保持 Undo/Redo 快照完整。
- **store/context.tsx**：加载流程改为并行拉取、归一化、错误派发；重写注释中文化。
- **api/mockData.ts**：新增 `MOCK_SCRIPTS_MANIFEST`/`MOCK_TRIGGERS_MANIFEST` 便于直接挂载到项目。
- **api/mockService.ts**：`loadProject` 返回标准 `ExportManifest`（包含 manifestVersion/exportedAt、项目元信息、脚本/触发器 manifest、黑板）。
- **杂项**：保持中文注释，未做 UI 变更。

## 4. 测试与验证
- 本地未跑自动化/构建（仅逻辑改动）；归一化逻辑通过静态检查梳理：
  - 缺失 meta/id/时间戳 → 默认生成。
  - 缺失黑板/事件/变量 → 默认空对象。
  - Stage/Node/FSM/Presentation 缺失字段 → 默认 children/localVariables/eventListeners/parameters/duration 等。
  - Manifest 兼容：项目内置 map 优先，外部 manifest 作为兜底。

## 5. 后续建议
- 在 UI 顶栏/状态区展示 `ui.errorMessage` 与加载进度。
- 扩展归一化校验（如 ID 前缀、引用存在性）并串联到 P2-T08 导出前的轻量校验。
- 为归一化添加单元测试覆盖典型缺失字段/旧版数据样例。
