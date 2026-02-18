# P4 删除流程统一重构报告

## 日期：2026-02-19

## 1. 目标

将各 Inspector 组件中分散的本地删除逻辑统一收敛到 `hooks/useDeleteHandler.ts`，使所有删除入口共享同一套**状态检查 → 引用检查 → 确认弹窗 → 派发 Action**的流程，消除行为分叉与代码冗余。

## 2. 本次修改内容

### 2.1 修复 `deleteEvent` Bug（useDeleteHandler.ts）

| 场景 | 修复前行为 | 修复后行为 |
|---|---|---|
| Implemented + 无引用 | 推送两条消息（"Marked for delete" **和** "Deleted"） | 仅推送 "Marked for delete" |
| Draft + 无引用 | **无任何操作**（函数直接 fall-through） | 派发 `APPLY_DELETE_EVENT` 并推送 "Deleted" |

### 2.2 改进 `deletePresentationGraph`（useDeleteHandler.ts）

旧逻辑：无论有无引用，总是弹出确认对话框。

新逻辑三阶段判断：
1. **有外部引用** → 弹窗确认，展示引用列表
2. **无外部引用 + 图内包含节点** → 弹窗确认，提示节点数量
3. **无引用 + 无节点** → 直接删除，推送消息

### 2.3 统一 EventInspector（EventInspector.tsx）

**移除内容：**
- 本地 `ConfirmMode` 类型
- 本地 `confirmDialog` useState 状态
- `applyDeleteAction()` 函数
- `handleConfirmDelete()` 函数
- `confirmButtonLabel` 计算
- `referenceLocations` 计算
- `ConfirmDialog` 组件导入和渲染

**新增内容：**
- `import { useDeleteHandler } from '../../hooks/useDeleteHandler'`
- `const { deleteEvent } = useDeleteHandler()`
- `handleDelete()` 简化为调用 `deleteEvent(eventId)`

**保留不变：**
- `handleRestore()`（恢复操作不属于删除流程）
- `getDeleteTooltip()`（按钮提示文案）
- 引用列表展示（references section）
- 所有编辑功能

### 2.4 统一 PresentationGraphInspector（PresentationGraphInspector.tsx）

**移除内容：**
- `useState` 导入（组件不再有 state）
- `MessageLevel` 类型导入
- `ConfirmDialog` 导入
- 本地 `confirmDialog` useState 状态
- `pushMessage()` 函数
- `applyDelete()` 函数
- `handleConfirmDelete()` 函数
- `ConfirmDialog` 组件渲染

**新增内容：**
- `import { useDeleteHandler } from '../../hooks/useDeleteHandler'`
- `const { deletePresentationGraph } = useDeleteHandler()`
- `handleDelete()` 简化为调用 `deletePresentationGraph(graphId)`
- `handleDelete()` 保留「编辑中图不允许删除」的安全检查

**保留不变：**
- 引用列表展示
- 所有编辑功能
- 按钮 disabled 状态（编辑中不可删除）

## 3. LocalVariableEditor 说明

`LocalVariableEditor` 作为通用子组件，支持 Node 和 Stage 两种 owner，且接受外部传入的 `onDeleteVariable` 回调。其删除派发路径（`DELETE_NODE_PARAM` / 自定义回调）与全局资源删除（`APPLY_DELETE_EVENT` 等）本质不同，因此**有意保持其独立的本地确认逻辑**，不纳入本次统一。

## 4. 统一后的删除流程总览

| 资源类型 | Inspector 删除入口 | 实际处理函数 | 确认弹窗 |
|---|---|---|---|
| Stage | StageOverview | `useDeleteHandler.deleteStage` | GlobalConfirmDialog |
| PuzzleNode | NodeExplorer / StageOverview / NodeInspector / 键盘 | `useDeleteHandler.deleteNode` | GlobalConfirmDialog |
| GlobalVariable | VariableInspector / 键盘 | `useDeleteHandler.deleteGlobalVariable` | GlobalConfirmDialog |
| Script | ScriptInspector / 键盘 | `useDeleteHandler.deleteScript` | GlobalConfirmDialog |
| Event | **EventInspector** / 键盘 | `useDeleteHandler.deleteEvent` | GlobalConfirmDialog |
| PresentationGraph | **PresentationGraphInspector** / 键盘 | `useDeleteHandler.deletePresentationGraph` | GlobalConfirmDialog |
| LocalVariable (Node/Stage) | LocalVariableEditor | 组件内部 `applyDeleteAction` | 本地 ConfirmDialog |

## 5. 编译验证

- `tsc --noEmit` 零错误通过
- IDE 静态检查三个修改文件均无错误

## 6. 后续待处理（P1/P2）

- **P1**: 提取 `handleReferenceClick` 导航逻辑为公共 util，消除 4 个 Inspector 中的重复 switch-case
- **P1**: 合并 `Inspector/ConfirmDialog.tsx` 和 `condition/ConfirmDialog.tsx` 两个确认对话框组件
- **P2**: 合并 `useKeyboardShortcuts` 和 `useGraphKeyboardShortcuts` 两个快捷键 Hook
- **P2**: 统一 MarkedForDelete 资源过滤工具函数
