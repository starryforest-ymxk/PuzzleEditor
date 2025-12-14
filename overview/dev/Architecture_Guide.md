# 架构指南（Architecture Guide）

> 本文档描述项目的整体架构设计、分层结构与开发规范，用于指导后续阶段的功能实现。  
> **版本**: 1.1.0 | **更新时间**: 2025-12-14 | **同步至**: Phase 3 完成状态

---

## 1. 项目概览

本项目是一款 **侦探解谜游戏 Web 可视化编辑器**，采用 React + TypeScript 技术栈，遵循以下核心原则：

- **前端主导的资源管线**：编辑器是逻辑定义的唯一来源。
- **软删除保护**：已实现资源只能标记删除，二次确认后才物理删除。
- **多层级可视化**：树（Stage）→ 卡片（PuzzleNode）→ 画布（FSM/Presentation）。
- **隐式持久化**：编辑器内定义的变量/状态默认需要存档。

---

## 2. 目录结构

```
puzzle-editor/
├─ types/              # 领域模型类型定义
│  ├─ identity.ts      # ID/Key 模板字符串类型
│  ├─ common.ts        # ResourceState、ValueSource 等
│  ├─ project.ts       # 项目顶层结构
│  ├─ blackboard.ts    # 黑板资源（变量、事件）
│  ├─ manifest.ts      # 脚本/触发器清单
│  ├─ stage.ts         # 阶段树
│  ├─ puzzleNode.ts    # 解谜节点
│  ├─ stateMachine.ts  # 状态机
│  └─ presentation.ts  # 演出子图
│
├─ store/              # 全局状态管理
│  ├─ context.tsx      # React Context 定义
│  ├─ types.ts         # Store 状态与 Action 定义
│  ├─ reducer.ts       # 主 Reducer（含 Undo/Redo）
│  └─ slices/          # 领域 Reducer 切片
│     ├─ index.ts      # 统一导出
│     ├─ fsmSlice.ts
│     ├─ presentationSlice.ts
│     ├─ nodeParamsSlice.ts
│     ├─ blackboardSlice.ts
│     ├─ navigationSlice.ts
│     ├─ projectSlice.ts
│     └─ uiSlice.ts
│
├─ api/                # 服务层
│  ├─ types.ts         # API 接口定义
│  ├─ service.ts       # 服务实例导出
│  ├─ mockService.ts   # Mock 实现
│  └─ mockData.ts      # 模拟数据
│
├─ components/         # UI 组件
│  ├─ Layout/          # 整体布局（Header, Breadcrumb, Sidebar 等）
│  ├─ Explorer/        # 阶段树/节点浏览
│  ├─ Canvas/          # 画布编辑器（FSM/Presentation）
│  │  └─ Elements/     # 画布元素（StateNode, ConnectionLine 等）
│  ├─ Inspector/       # 属性面板
│  │  ├─ condition/    # 条件编辑器组件
│  │  ├─ localVariable/ # 局部变量子组件
│  │  └─ presentation/  # 演出绑定子组件
│  └─ Blackboard/      # 黑板管理
│
├─ hooks/              # 自定义 Hooks (5 个)
│  ├─ useCanvasNavigation.ts    # 画布平移/缩放
│  ├─ useCuttingLine.ts          # 剪线交互
│  ├─ useGraphInteraction.ts     # 图形节点交互
│  ├─ useKeyboardShortcuts.ts    # 全局快捷键
│  └─ useStateNodeInteraction.ts # 状态节点交互
│
├─ utils/              # 工具函数
│  ├─ constants.ts          # 常量定义
│  ├─ geometry.ts           # 几何计算
│  ├─ debug.ts              # 调试工具
│  ├─ resourceLifecycle.ts  # 软删除状态机
│  ├─ variableScope.ts      # 作用域解析
│  ├─ variableReferences.ts # 变量引用扫描
│  ├─ conditionBuilder.ts   # 条件构造器
│  ├─ presentation.ts        # 演出节点规范化
│  ├─ projectNormalizer.ts  # 项目数据规范化
│  ├─ fsmValidation.ts      # FSM 校验逻辑
│  └─ validation/           # 校验工具
│
└─ overview/           # 设计文档
   ├─ Project_Overview.md
   ├─ UX_Flow.md
   ├─ Task_Breakdown.md
   └─ dev/
      ├─ Domain_Model.md
      ├─ Architecture_Guide.md  # 本文档
      ├─ Interaction_Guide.md   # 交互规范
      └─ Phase1/ Phase2/ Phase3/ # 各阶段文档
```

---

## 3. 分层架构

### 3.1 依赖关系图

```
┌────────────────────────────────────────────────────────────┐
│                    components/ (View)                      │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌─────────────┐  │
│  │ Layout/  │ │ Explorer/│ │Inspector/│ │ Blackboard/ │  │
│  │ 5 files  │ │ 2 files  │ │ 33 files │ │  9 files    │  │
│  └──────────┘ └──────────┘ └──────────┘ └─────────────┘  │
│  ┌──────────────────────────────────────────────────────┐ │
│  │ Canvas/ - 画布层                                      │ │
│  │  ├─ StateMachineCanvas.tsx (FSM 编辑器)              │ │
│  │  ├─ PresentationCanvas.tsx (演出图编辑器)            │ │
│  │  └─ Elements/ - 可复用画布元素                       │ │
│  │     ├─ StateNode.tsx (状态节点)                       │ │
│  │     ├─ ConnectionLine.tsx (连线)                      │ │
│  │     ├─ TransitionsLayer.tsx (转移层)                  │ │
│  │     └─ StatesLayer.tsx (状态层)                       │ │
│  └──────────────────────────────────────────────────────┘ │
└───────────────────────────┬────────────────────────────────┘
                            │ dispatch / useEditorState
┌───────────────────────────▼────────────────────────────────┐
│                    store/ (State)                          │
│  Context + Reducer + 7 Slices，管理全局状态，含 Undo/Redo  │
│  fsmSlice │ presentationSlice │ nodeParamsSlice           │
│  blackboardSlice │ navigationSlice │ projectSlice │ uiSlice│
└───────────────────────────┬────────────────────────────────┘
                            │ 调用 apiService
┌───────────────────────────▼────────────────────────────────┐
│                    api/ (Service)                          │
│        数据 I/O 抽象，Mock/HTTP 可切换                     │
└───────────────────────────┬────────────────────────────────┘
                            │
┌───────────────────────────▼────────────────────────────────┐
│                    types/ (Domain)                         │
│         领域模型定义（9 个类型文件），被所有层依赖          │
└───────────────────────────┬────────────────────────────────┘
                            │
┌───────────────────────────▼────────────────────────────────┐
│             utils/ + hooks/ (Utilities)                    │
│  utils: 几何/校验/作用域/常量/调试等纯函数                 │
│  hooks: 5 个自定义 hooks（画布/交互/快捷键）                │
└────────────────────────────────────────────────────────────┘
```

### 3.2 依赖规则

| 层级 | 可依赖 | 禁止依赖 |
|------|--------|----------|
| `types/` | 无 | 其他任何层 |
| `utils/` | `types/` | `store/`、`api/`、`components/` |
| `hooks/` | `types/`、`utils/` | `store/`、`api/`、`components/` |
| `api/` | `types/` | `store/`、`components/` |
| `store/` | `types/`、`utils/`、`api/` | `components/` |
| `components/` | 所有层 | 不能直接调用 `api/` 数据方法 |

---

## 4. 核心模式

### 4.1 状态管理

- **双 Context 模式**：`StateContext` 与 `DispatchContext` 分离，优化渲染。
- **Undo/Redo**：在主 Reducer 统一处理，采用快照机制。
- **Action 类型**：统一定义于 `store/types.ts`。

### 4.2 领域切片（Slices）

复杂领域逻辑拆分到独立 Slice（共 7 个切片）：

- **fsmSlice**: 状态机、状态、转移的 CRUD
- **presentationSlice**: 演出图、节点、连线的 CRUD
- **nodeParamsSlice**: 节点局部变量管理
- **blackboardSlice**: 全局变量、事件、脚本的 CRUD 与软删除
- **navigationSlice**: 视图切换、面包屑导航
- **projectSlice**: Stage 树、Node 更新
- **uiSlice**: 选择状态、面板大小、消息堆栈

```ts
// store/slices/fsmSlice.ts
export const isFsmAction = (action: Action): action is FsmAction => { ... }
export const fsmReducer = (state: EditorState, action: FsmAction): EditorState => { ... }
```

主 Reducer 通过类型守卫分发：

```ts
if (isFsmAction(action)) return fsmReducer(state, action);
if (isPresentationAction(action)) return presentationReducer(state, action);
if (isNodeParamsAction(action)) return nodeParamsReducer(state, action);
if (isBlackboardAction(action)) return blackboardReducer(state, action);
if (isNavigationAction(action)) return navigationReducer(state, action);
if (isProjectAction(action)) return projectReducer(state, action);
if (isUiAction(action)) return uiReducer(state, action);
```

### 4.3 软删除状态机

资源状态流转：`Draft` → `Implemented` → `MarkedForDelete`

```ts
// utils/resourceLifecycle.ts
resolveDeleteAction(current: ResourceState): DeleteResolution
```

### 4.4 作用域解析

变量引用必须携带作用域信息：

```ts
// utils/variableScope.ts
collectVisibleVariables(state, stageId, nodeId): VisibleVariables
```

---

## 5. 开发规范

### 5.1 类型优先

- 所有新增数据结构必须先在 `types/` 定义。
- 使用带前缀的 ID 类型（如 `stage-*`、`node-*`）。
- 变量引用必须携带 `scope` 字段。

### 5.2 中文注释

- 核心模块必须包含中文文件头注释。
- 关键逻辑段落使用中文注释解释意图，避免 JSX 内嵌长注释。

### 5.3 组件设计

- 组件通过 `useEditorState` 获取状态。
- 组件通过 `useEditorDispatch` + Action 修改状态。
- 禁止组件直接修改状态或调用 API。

### 5.4 工具函数

- 工具函数必须是纯函数。
- 提供完整的 TypeScript 类型标注。
- 在 `utils/` 下按功能域组织。

---

## 6. 扩展指南

### 6.1 添加新的领域实体

1. 在 `types/` 定义类型接口。
2. 更新 `types/project.ts` 的 `ProjectData`。
3. 更新 `store/types.ts` 的 `EditorState` 与 `Action`。
4. 如需独立处理，创建新的 Slice。

### 6.2 添加新的 API 接口

1. 在 `api/types.ts` 扩展 `IApiService`。
2. 在 `api/mockService.ts` 实现 Mock 版本。
3. 在 `store/context.tsx` 添加异步 Action 辅助。

### 6.3 添加新的编辑视图

1. 在 `components/` 创建视图组件。
2. 复用 `hooks/useGraphInteraction.ts` 处理交互。
3. 遵循 [交互规范](./Interaction_Guide.md) 的快捷键约定。

---

## 7. 代码质量与最佳实践

### 7.1 组件拆分原则（Phase 3 改进）

**大型组件拆分**：当组件超过 400 行时，应考虑拆分为子组件：
- **LocalVariableEditor**: 拆分为 `LocalVariableCard` 和 `VariableValueInput`
- **PresentationBindingEditor**: 拆分为 `ScriptBindingSection` 和 `GraphBindingSection`
- 子组件放置在对应的子目录中（`localVariable/`、`presentation/`）

**Canvas 元素组件化**：
- `Canvas/Elements/` 目录包含可复用的画布元素
- `StateNode.tsx`、`ConnectionLine.tsx` 等独立组件
- 每个元素组件添加 `displayName` 以便 React DevTools 调试

### 7.2 样式管理

- **禁止内联样式**：所有样式应提取到 `styles.css`
- **语义化 CSS 类名**：如 `.trigger-editor-container`、`.trigger-card`
- **复用全局样式**：画布上下文菜单、连线手柄等使用全局样式

### 7.3 常量管理

- **统一常量定义**：所有 magic numbers 应定义在 `utils/constants.ts`
- **避免重复定义**：如 `STATE_NODE` 尺寸由 `constants.ts` 统一定义，`geometry.ts` 引入复用
- **导出派生常量**：如 `export const STATE_WIDTH = STATE_NODE.WIDTH`

### 7.4 Hooks 规范

当前项目 Hooks（共 5 个）：
- `useCanvasNavigation`: 画布平移/缩放交互
- `useCuttingLine`: Ctrl+拖拽剪线交互
- `useGraphInteraction`: 通用图形节点交互
- `useKeyboardShortcuts`: 全局快捷键管理
- `useStateNodeInteraction`: 状态节点专用交互

### 7.5 调试支持

- **debug.ts 工具**：提供统一的日志输出函数
- **React.memo displayName**：所有 memo 组件必须添加 `displayName` 属性
- **校验逻辑集中**：FSM 校验统一放置在 `utils/fsmValidation.ts`

---

## 8. 相关文档

- [领域模型](./Domain_Model.md) - 数据结构详细定义
- [交互规范](./Interaction_Guide.md) - 快捷键与交互约定
- [Phase3 代码审查](./Phase3/P3_Code_Review_3.md) - 最新代码质量评估

---

## 9. 消息堆栈（Message Stack）

- Store 持有 `ui.messages: UiMessage[]`，支持 `ADD_MESSAGE` / `CLEAR_MESSAGES`；所有全局提示（加载/导入/校验/保存等）必须写入堆栈，禁止仅输出控制台。
- Header 负责展示 Messages 下拉列表，显示 info / warning / error 三级，按时间倒序，可一键清空。
- 其他模块如 API/加载流程应通过派发消息写入堆栈，保证可追溯。
