# P1-T08 应用分层与模块边界设计（对齐现结构）

> 目标：明确前端分层、允许的依赖方向和模块边界，指导后续功能实现与重构。

## 1. 分层与职责

- **View 层（components/）**
  - 纯展示和交互，使用 props/store 数据，不直接持久化或改写业务数据格式。
  - 依赖方向：可依赖 store hooks、UI 工具（hooks/utils）、类型定义；禁止直接访问 API。

- **State 层（store/）**
  - 全局数据管理（Context + Reducer + Slice），实现 Undo/Redo、Selection。
  - 依赖方向：可依赖 types、utils；禁止依赖组件与 API 具体实现。
  - 对外暴露 dispatch/hook，状态结构与领域模型一致。

- **Service 层（api/）**
  - 数据加载/保存的抽象接口与实现（Mock/HTTP 可切换）。
  - 依赖方向：可依赖 types；禁止依赖 store/组件。
  - 通过 `api/service.ts` 向上提供实例，供 State 层/上层调用。

- **Domain Types（types/）**
  - 领域模型、枚举与复合结构（Stage/Node/FSM/Presentation/Blackboard 等）。
  - 被各层依赖，不反向依赖其他层。

- **Utilities（utils/、hooks/）**
  - 纯函数/通用逻辑（几何、条件构造、作用域、演出规范化等），无副作用。
  - 可被各层依赖，禁止反向依赖组件或 API。

## 2. 依赖方向（允许的箭头）

```
types ──▶ utils ──▶ store ──▶ components
   ▲          ▲         ▲
   │          │         │
   └──────────┴─────────┘
             api
```

- `api` 仅依赖 `types`；`store` 仅通过 `api/service.ts` 获取数据，不直接依赖具体实现。
- `components` 通过 hooks 访问 store，或通过 props 接收数据，禁止直接调用 `api`。
- `utils/hooks` 不依赖 `components`，保持可复用/可测试。

## 3. 模块边界细化

- **store/slices/**：每个领域（FSM/Presentation/NodeParams）独立 reducer，禁止在 slice 内直接调用 API。
- **api/mockData.ts**：仅提供数据样本，不嵌入 UI 逻辑。后续可替换为 HTTP 实现，保持 `IApiService` 不变。
- **components/Inspector/**：仅组合编辑 UI，业务规则（如软删除、状态机合法性）应在 store/校验层或 utils 中处理。
- **utils/**：共性逻辑沉淀（resourceLifecycle、variableScope、conditionBuilder、presentation 规范化），组件/Reducer 通过工具统一规则。

## 4. 未来演进与校验

- 可在 CI 中增加依赖分析（如使用 lint 规则）防止跨层引用，但当前以约定和文档约束为主。
- 导出/校验模块（后续 P5）应位于独立 service/validator 目录，依赖 types/utils，不依赖组件。
- 当引入异步数据流（如保存/校验），优先在 store 侧封装异步 action（thunk-like）并调用 `apiService`。
