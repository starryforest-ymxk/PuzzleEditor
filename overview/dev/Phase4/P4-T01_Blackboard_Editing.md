# P4-T01 黑板资源全功能编辑（变量/脚本/事件）完成报告

## 1. 任务目标
实现黑板（Blackboard）视图中全局变量、脚本、事件的完整编辑功能，包括创建、属性修改和软删除。

## 2. 实现内容

### 2.1 Store 更新 (`store/slices/blackboardSlice.ts`)
- 新增 Actions：
  - `ADD_GLOBAL_VARIABLE`, `UPDATE_GLOBAL_VARIABLE`
  - `ADD_EVENT`, `UPDATE_EVENT`
  - `ADD_SCRIPT`, `UPDATE_SCRIPT`
- 更新 Reducer 以处理上述 Actions，支持数据的不可变更新。

### 2.2 黑板面板 (`components/Blackboard/BlackboardPanel.tsx`)
- 新增创建按钮：
  - Variables 页签：`+ New Variable`
  - Events 页签：`+ New Event`
  - Scripts 页签：`+ New Script`（带下拉菜单选择脚本类型）
- 实现创建逻辑：生成唯一 ID，使用默认值初始化资源，并自动选中新创建的资源。

### 2.3 属性检查器 (`components/Inspector/`)
- **VariableInspector**:
  - 支持编辑 Name, Key, Type, Default Value, Description。
  - 处理类型切换时的默认值重置逻辑。
  - 仅允许编辑 Global Variable（Local Variable 保持只读）。
  - 标题栏新增删除按钮（支持软删除状态流转）。
- **ScriptInspector**:
  - 支持编辑 Name, Key, Category, Description。
  - 标题栏新增删除按钮。
- **EventInspector**:
  - 支持编辑 Name, Key, Description。
  - 标题栏新增删除按钮。

## 3. 技术决策
- **创建流程**：采用“点击即创建”模式，生成默认资源后直接在 Inspector 中编辑，避免了复杂的模态弹窗，保持交互流畅。
- **编辑模式**：Inspector 中的输入框使用 `onChange` 实时 dispatch 更新，配合 React 的受控组件模式。
- **删除逻辑**：复用 `utils/resourceLifecycle.ts` 中的 `resolveDeleteAction` 逻辑，通过 `SOFT_DELETE_*` action 统一处理 Draft/Implemented/MarkedForDelete 状态流转。

## 4. 验证与测试
- **创建测试**：
  - 点击 `+ New Variable`，列表出现新变量，Inspector 显示并可编辑。
  - 点击 `+ New Event`，列表出现新事件。
  - 点击 `+ New Script` -> 选择 `Condition Script`，列表出现新脚本且分类正确。
- **编辑测试**：
  - 修改变量名，列表实时更新。
  - 修改变量类型（如 boolean -> integer），默认值输入框类型随之改变。
  - 修改脚本分类，颜色和标签随之改变。
- **删除测试**：
  - 对 Draft 状态资源点击删除 -> 直接消失。
  - 对 Implemented 状态资源点击删除 -> 状态变为 MarkedForDelete，卡片变灰。
  - 对 MarkedForDelete 状态资源点击删除 -> 直接消失。

## 5. 后续计划
- 实现 Stage/Node 局部变量的编辑功能（可能需要新的 Action 或在 StageInspector 中处理）。
- 完善引用追踪（References）显示。

## 6. 新增修复（2025-12-14）
- 修复黑板引用跳转：点击引用后会携带 `contextId` 与正确的 `stageId`，FSM/PRESENTATION 目标会在跳转时直接进入选中态，Inspector 不再提示缺少上下文。
- 统一 `LocalVariableEditor.tsx` 文件编码为 UTF-8，确保中文注释正常展示。 
