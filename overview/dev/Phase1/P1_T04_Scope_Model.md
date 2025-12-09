# P1-T04 作用域模型设计（Global / Stage Local / Node Local / Temporary）

> 目标：明确变量的声明位置、可见范围与持久化策略；对引用携带 scope 的要求；对新增/删除操作的约束。UX_Flow 当前未对作用域细节给出额外交互，主要为数据/校验规则设计。

## 1. 作用域定义与声明位置

- `Global`：工程唯一，全局可见。声明于黑板（后续接入 store.project.blackboard）。
- `StageLocal`：仅在该 Stage 及其子结构可见。声明保存在 StageNode.localVariables。
- `NodeLocal`：仅在所属 PuzzleNode 内的 FSM/演出子图可见。声明保存在 PuzzleNode.localVariables。
- `Temporary`：临时参数，仅存在于参数绑定过程中（运行时或绑定 UI 中生成，不进入持久化 JSON）。

## 2. 可见性与解析规则

- 变量引用必须同时携带 `variableId` 与 `variableScope`，禁止基于名称解析。
- 可见集合（在 node 上下文）：Global ∪ 当前 Stage 的 StageLocal ∪ 当前 NodeLocal（Temporary 在绑定 UI 内部生成）。
- Stage 解析链：若仅有 nodeId，则先定位 node.stageId，再取 StageLocal；未提供 stageId 且无 nodeId 时，视为仅 Global。

## 3. JSON 表达（与代码一致）

- `PuzzleNode.localVariables: Record<VariableId, VariableDefinition>`（scope 固定 `NodeLocal`）
- `StageNode.localVariables: Record<VariableId, VariableDefinition>`（scope 固定 `StageLocal`）
- `Blackboard.globalVariables: Record<VariableId, VariableDefinition>`（scope 固定 `Global`）
- `ValueSource.VariableRef` 必须包含 `variableId` 与 `scope`

## 4. 操作约束

- 新增局部变量时强制写入对应 scope（避免错误作用域）。
- 删除/状态变更遵循 P1-T03 软删除状态机（Draft/Implemented/MarkedForDelete），并在后续校验/导出时阻断对 MarkedForDelete 的引用。
- Temporary 变量不落库，仅在参数映射 UI 中生成、引用。

## 5. 代码落地

- `utils/variableScope.ts`
  - `withScope(variable, scope)`：新增变量时强制作用域。
  - `collectVisibleVariables(state, stageId?, nodeId?)`：按 Global/Stage/Node 维度收集当前可见变量（Global 暂为空，占位，待黑板接入 store）。
- `store/slices/nodeParamsSlice.ts`
  - `ADD_NODE_PARAM` 时自动将 scope 归一为 `NodeLocal`。
  - 软删除逻辑已复用 P1-T03（Implemented -> MarkedForDelete；Draft/Marked -> 物理删除）。

## 6. 后续工作

- 将全局黑板接入 store.project，完善 `collectVisibleVariables` 的 Global 部分。
- 在 Stage Local 变量增删/编辑 reducer 中同样接入 `withScope` 与软删除逻辑。
- UI/校验层：变量选择器按 scope 分组，引用 MarkedForDelete 变量时标红提示；导出前校验阻断未清理引用。
