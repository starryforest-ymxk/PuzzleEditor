# P1_Code_Review3：阶段一基座一致性检查

> 目标：验证当前代码是否满足阶段一核心目标——搭好整体骨架、统一数据结构与交互规范；结论：仍有结构性缺口需先行修复。

## 主要问题（仍未满足阶段一要求）

1. **数据模型与加载/保存管线未统一** （已修复）  
   - `types/project.ts` 将 `scripts` 作为 `ProjectData` 一部分并定义了 `ExportManifest`（含 `manifestVersion`），但 `store/types.ts`/`EditorState` 将脚本/触发器拆到 `manifest`，`project` 不含 `scripts`。  
   - `api/types.ts` 的 `IApiService` 只收发 `ProjectData`，`loadProjectData` 也忽略了 `projectData.scripts`，改为额外 `loadManifest`。当前无法从单一来源 round-trip 序列化出符合 `ExportManifest` 的结果（缺版本字段，触发器无版本）。

2. **Action 类型存在冲突与遗留**（已修复）  
   - 已合并为唯一 `INIT_SUCCESS` 形态（含 ScriptsManifest/TriggersManifest）。

3. **软删除覆盖面不足（Stage Local 缺口）**（已修复）  
   - 已新增 `SOFT_DELETE_STAGE_VARIABLE/APPLY_DELETE_STAGE_VARIABLE`，Reducer 支持 Stage Local 变量 Draft→Implemented→MarkedForDelete 流程。

4. **演出参数绑定的作用域支持不完整**（已修复）  
   - `PresentationNodeInspector` 现使用 `collectVisibleVariables` 根据图引用推断的 Stage/Node 作用域收集变量并过滤 MarkedForDelete，参数绑定可选 Stage/Node/Global 变量。

## 建议修复顺序

1. **统一数据模型与 IO**：决定单一数据源（建议 `ProjectData` 即含 `scripts`，`ExportManifest` 负责版本封装），同步 `store/types.ts`、`api/types.ts`、`loadProjectData` 与 Mock 返回结构，保证导入/导出无损。  
2. **清理 Action 类型**：合并/删除旧版 `INIT_SUCCESS` 形态，保持唯一 payload。  
3. **补齐 Stage Local 软删除**：新增 Stage Local 变量的软删除/应用删除 action 与 reducer 处理，复用 `resourceLifecycle`。  
4. **完善演出参数作用域**：在演出参数编辑中使用 `collectVisibleVariables`（过滤 MarkedForDelete），覆盖 Global/Stage/Node，并保留 Temporary 入口。
