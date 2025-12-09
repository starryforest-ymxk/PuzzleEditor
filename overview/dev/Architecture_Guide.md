# 架构指南（Architecture Guide）

> 本文档描述项目的整体架构设计、分层结构和开发规范，指导后续阶段的功能开发。
>
> **版本**: 1.0.0 | **更新时间**: 2025-12-09

---

## 1. 项目概述

本项目是一个**叙事解谜游戏 Web 可视化编辑器**，采用 React + TypeScript 技术栈，遵循以下核心设计原则：

- **前端主导的资源管线**：编辑器是游戏逻辑定义的数据源头
- **软删除保护**：已实现资源只能标记删除，需二次确认才能物理删除
- **多层级可视化**：树形（Stage）→ 卡片（PuzzleNode）→ 画布（FSM/Presentation）
- **隐式持久化**：编辑器中定义的所有变量和状态机状态默认均需存档

---

## 2. 目录结构

```
puzzle-editor/
├── types/              # 领域模型类型定义
│   ├── identity.ts     # ID/Key 模板字符串类型
│   ├── common.ts       # 共享类型（ResourceState, ValueSource 等）
│   ├── project.ts      # 项目顶层结构
│   ├── blackboard.ts   # 黑板资源（变量、事件）
│   ├── manifest.ts     # 脚本/触发器清单
│   ├── stage.ts        # 阶段树结构
│   ├── puzzleNode.ts   # 解谜节点
│   ├── stateMachine.ts # 状态机结构
│   └── presentation.ts # 演出子图结构
│
├── store/              # 全局状态管理
│   ├── context.tsx     # React Context 定义
│   ├── types.ts        # Store 状态类型与 Action 定义
│   ├── reducer.ts      # 主 Reducer（含 Undo/Redo）
│   └── slices/         # 领域 Reducer 切片
│       ├── fsmSlice.ts
│       ├── presentationSlice.ts
│       └── nodeParamsSlice.ts
│
├── api/                # 服务层
│   ├── types.ts        # API 接口定义
│   ├── service.ts      # 服务实例导出
│   ├── mockService.ts  # Mock 实现
│   └── mockData.ts     # 模拟数据
│
├── components/         # UI 组件
│   ├── Layout/         # 整体布局
│   ├── Explorer/       # 阶段树浏览器
│   ├── Canvas/         # 画布编辑器（FSM/Presentation）
│   ├── Inspector/      # 属性面板
│   └── Blackboard/     # 黑板管理（待实现）
│
├── hooks/              # 自定义 Hooks
│   ├── useCanvasNavigation.ts  # 画布平移
│   └── useGraphInteraction.ts  # 图形交互
│
├── utils/              # 工具函数
│   ├── geometry.ts           # 几何计算
│   ├── resourceLifecycle.ts  # 软删除状态机
│   ├── variableScope.ts      # 作用域解析
│   ├── conditionBuilder.ts   # 条件构造器
│   └── presentation.ts       # 演出节点规范化
│
└── overview/           # 设计文档
    ├── Project_Overview.md
    ├── UX_Flow.md
    ├── Task_Breakdown.md
    └── dev/            # 开发文档
        ├── Domain_Model.md
        ├── Architecture_Guide.md  # 本文档
        ├── Interaction_Guide.md   # 交互规范
        ├── Phase2_Guide.md
        └── Phase1/     # 阶段一实现记录
```

---

## 3. 分层架构

### 3.1 依赖关系图

```
┌─────────────────────────────────────────────────────────┐
│                    components/ (View)                    │
│    使用 store hooks，渲染 UI，处理用户交互                │
└───────────────────────────┬─────────────────────────────┘
                            │ dispatch / useEditorState
                            ▼
┌─────────────────────────────────────────────────────────┐
│                     store/ (State)                       │
│   Context + Reducer，管理全局状态，实现 Undo/Redo         │
└───────────────────────────┬─────────────────────────────┘
                            │ 调用 apiService
                            ▼
┌─────────────────────────────────────────────────────────┐
│                      api/ (Service)                      │
│      数据 I/O 抽象，Mock/HTTP 可切换                     │
└─────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────┐
│                     types/ (Domain)                      │
│           领域模型定义，被所有层依赖                      │
└─────────────────────────────────────────────────────────┘

              ▲ 同时被各层依赖 ▲
┌─────────────────────────────────────────────────────────┐
│                 utils/ + hooks/ (Utilities)              │
│        纯函数、通用逻辑，无副作用，可测试                 │
└─────────────────────────────────────────────────────────┘
```

### 3.2 依赖规则

| 层级 | 可依赖 | 禁止依赖 |
|------|--------|----------|
| `types/` | 无 | 其他任何层 |
| `utils/` | `types/` | `store/`, `api/`, `components/` |
| `hooks/` | `types/`, `utils/` | `store/`, `api/`, `components/` |
| `api/` | `types/` | `store/`, `components/` |
| `store/` | `types/`, `utils/`, `api/` | `components/` |
| `components/` | 所有层 | 直接调用 `api/` 数据方法 |

---

## 4. 核心模式

### 4.1 状态管理

- 使用 **双 Context 模式**：`StateContext` 和 `DispatchContext` 分离，优化渲染
- **Undo/Redo** 在主 Reducer 中统一处理，通过快照机制实现
- **Action 类型** 在 `store/types.ts` 统一定义

### 4.2 领域切片（Slices）

复杂领域逻辑拆分到独立 Slice：

```typescript
// store/slices/fsmSlice.ts
export const isFsmAction = (action: Action): action is FsmAction => { ... }
export const fsmReducer = (state: EditorState, action: FsmAction): EditorState => { ... }
```

主 Reducer 通过类型守卫分发：

```typescript
if (isFsmAction(action)) return fsmReducer(state, action);
if (isPresentationAction(action)) return presentationReducer(state, action);
```

### 4.3 软删除状态机

资源状态流转：`Draft` → `Implemented` → `MarkedForDelete`

```typescript
// utils/resourceLifecycle.ts
resolveDeleteAction(current: ResourceState): DeleteResolution
```

### 4.4 作用域解析

变量引用必须携带作用域信息：

```typescript
// utils/variableScope.ts
collectVisibleVariables(state, stageId, nodeId): VisibleVariables
```

---

## 5. 开发规范

### 5.1 类型优先

- 所有新增数据结构必须先在 `types/` 定义
- 使用带前缀的 ID 类型（如 `stage-*`, `node-*`）
- 变量引用必须携带 `scope` 字段

### 5.2 中文注释

- 所有核心模块必须包含中文文件头注释
- 关键逻辑段落使用中文注释说明意图
- 避免在 JSX 内嵌长注释

### 5.3 组件设计

- 组件通过 `useEditorState` 获取状态
- 组件通过 `useEditorDispatch` + Action 修改状态
- 禁止组件直接修改状态或调用 API

### 5.4 工具函数

- 工具函数必须是纯函数
- 提供完整的 TypeScript 类型签名
- 在 `utils/` 下按功能域组织

---

## 6. 扩展指南

### 6.1 添加新的领域实体

1. 在 `types/` 定义类型接口
2. 更新 `types/project.ts` 的 `ProjectData`
3. 更新 `store/types.ts` 的 `EditorState` 和 `Action`
4. 如需独立处理，创建新的 Slice

### 6.2 添加新的 API 接口

1. 在 `api/types.ts` 扩展 `IApiService`
2. 在 `api/mockService.ts` 实现 Mock 版本
3. 在 `store/context.tsx` 添加异步 Action 辅助函数

### 6.3 添加新的编辑视图

1. 在 `components/` 创建视图组件
2. 复用 `hooks/useGraphInteraction.ts` 处理交互
3. 遵循 [交互规范](./Interaction_Guide.md) 的快捷键约定

---

## 7. 相关文档

- [领域模型](./Domain_Model.md) - 数据结构详细定义
- [交互规范](./Interaction_Guide.md) - 快捷键与交互约定
- [阶段二开发指南](./Phase2_Guide.md) - 下一阶段开发任务
