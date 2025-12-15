# P4-T02 阶段树编辑实现报告

## 任务目标
实现阶段树的完整编辑功能，包括 Stage 的增删改、拖拽调整层级顺序，以及 Stage Inspector 的完整编辑能力。

## 实现内容

### Store 层更新 (`store/slices/projectSlice.ts`)
新增 8 个 Actions：
- Stage CRUD: `ADD_STAGE`, `DELETE_STAGE`, `UPDATE_STAGE`, `REORDER_STAGE`, `MOVE_STAGE`
- Stage Local Variable: `ADD_STAGE_VARIABLE`, `UPDATE_STAGE_VARIABLE`, `DELETE_STAGE_VARIABLE`

### 工具函数 (`utils/stageTreeUtils.ts`)
新建 Stage 树操作工具函数：
- `generateStageId()` - 生成唯一 Stage ID
- `getDescendantStageIds()` - 获取所有后代 Stage
- `getStageNodeIds()` - 获取 Stage 下的 PuzzleNode
- `hasStageContent()` - 检查 Stage 是否有子内容
- `createDefaultStage()` - 创建默认新 Stage
- `canMoveStage()` - 验证是否可以移动 Stage

### StageExplorer 组件增强
- **右键上下文菜单**：Create Child Stage / Create Sibling Stage / Rename / Delete
- **双击内联重命名**：双击 Stage 名称进入编辑模式
- **HTML5 拖拽排序**：支持同级重排和跨级移动
- **删除确认弹窗**：有子内容时显示确认弹窗

### StageInspector 组件增强
- **可编辑字段**：Name 和 Description 可直接编辑
- **Local Variables 编辑**：启用添加、修改、删除局部变量功能
- **删除按钮**：Header 区域添加删除 Stage 按钮

### CSS 样式更新
新增拖拽指示器和菜单危险项相关样式。

## 技术决策
- **拖拽排序**：采用 HTML5 原生 Drag and Drop API，轻量无额外依赖
- **Action 设计**：使用 `UPDATE_STAGE` 单条更新替代整树更新，提高性能
- **删除逻辑**：递归删除子 Stage 及其关联的 PuzzleNode 和 StateMachine

## 验证结果
- ✅ TypeScript 编译通过
- ✅ 右键菜单显示正常
- ✅ 创建子/同级 Stage 功能正常
- ✅ 双击内联重命名功能正常
- ✅ Inspector 编辑功能正常
- ✅ 拖拽排序功能已实现

## 后续计划
- P4-T03: PuzzleNode 实体级编辑
- P4-T04: PresentationGraph 编辑器完善
