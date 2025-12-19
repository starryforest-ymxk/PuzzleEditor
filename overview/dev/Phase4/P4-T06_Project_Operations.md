# P4-T06 项目级操作与多工程支持

## 完成时间
2025-12-19

## 实现内容

### 1. Store 层扩展
- 在 `EditorState.ui` 中添加 `isDirty` 状态
- 新增 Actions: `UPDATE_PROJECT_META`, `RESET_PROJECT`, `MARK_CLEAN`
- 创建 `projectMetaSlice.ts` 处理项目元信息 Actions
- 更新 `reducer.ts` 使所有数据修改操作自动设置 `isDirty = true`

### 2. Utils 层
- 创建 `projectFactory.ts`，提供 `createEmptyProject()` 工厂函数

### 3. UI 组件
- `NewProjectDialog.tsx` - 新建工程弹窗
- `ProjectSettingsDialog.tsx` - 元信息编辑弹窗  
- `ConfirmSaveDialog.tsx` - 切换确认弹窗

### 4. Header 更新
- 添加 **NEW** 按钮
- 添加 **SETTINGS** 齿轮图标按钮
- 项目名旁显示 `*` 脏状态标记
- 导出后自动调用 `MARK_CLEAN`

## 验证结果
- ✅ 新建工程流程正常
- ✅ 元信息编辑（名称/版本/描述）正常
- ✅ 脏状态标记正确显示和清除
- ✅ 切换工程时确认弹窗正常
