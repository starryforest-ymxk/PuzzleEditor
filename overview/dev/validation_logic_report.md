# 导出前校验逻辑分析报告 (Pre-Export Validation Logic Report)

## 1. 概述
当前项目的导出前校验逻辑已基本实现，覆盖了 `Task_Breakdown.md` 中 [P5-T01] 的主要要求。逻辑入口位于 `useProjectActions.ts` 中的 `exportProjectData` 函数，它在执行导出前调用 `validateProject`。

## 2. 校验流程
调用链路：
`Header.tsx` (UI Trigger) -> `useProjectActions.ts` -> `validateProject` (`utils/validation/validator.ts`)

`validateProject` 聚合了以下四个维度的校验：

### 2.1 命名规范 (`validateNames.ts`)
- 检查资源名称是否为空（Warning）。
- 检查同作用域下名称是否重复（Error）。

### 2.2 结构完整性 (`validateStructure.ts`)
- **Stage Tree**: 根节点需标记为 Initial；非 Initial Stage 必须有解锁条件 (UnlockTriggers)。
- **FSM**: 
  - PuzzleNode 必须关联 FSM。
  - FSM 必须设置 Initial State。
  - State 若无法到达 (Unreachable) 则报 Warning。
  - Transition 必须至少包含一个 Trigger，否则报 Error（死路）。
- **Presentation Graph**:
  - 图若有节点，必须设置 Start Node。
  - 检查悬空连线和不可达节点。

### 2.3 引用完整性 (`validateReferences.ts`)
- **核心功能**: 检查所有引用（Script, Event, Presentation Graph）指向的资源是否存在。
- **软删除检查**: 显式检查引用的资源状态是否为 `MarkedForDelete`，若引用了已删除资源，会产生 Error。
  - 覆盖范围：Trigger, Condition, EventListener, Presentation Binding, Stage/Node Lifecycle。

### 2.4 变量引用校验 (`validateVariables.ts`) // 重点逻辑
- **作用域检查**: 验证 Global, StageLocal, NodeLocal 变量是否在当前上下文中有效。
- **软删除检查**: 引用已删除变量会报错。
- **Presentation Graph 上下文推导**: 
  - 这是一个复杂的实现。由于演出图可以被多个位置复用，校验器会收集该图的所有“使用上下文” (Contexts)。
  - 对图中的 Local Variable 引用，要求在**所有**使用该图的上下文中都必须存在且有效。
  - 若演出图完全未被使用（Orphaned），则报 Warning。

## 3. 结论
当前实现已包含以下 P5-T01 要求：
- [x] 引用的 Script/Variable/Event 是否存在且未处于 MarkedForDelete。
- [x] PuzzleNode 的 FSM 是否有初始状态。
- [x] 存在自指或死循环但没有任何退出路径时给出警告（部分实现：检查了无 Trigger 的死连线）。
- [x] 参数修改是否在可见作用域内操作变量。

待优化/确认点：
- **"条件中变量类型是否与比较操作兼容"**: `validateVariables.ts` 似乎主要关注变量存在性和作用域，需确认 `checkParameterModifiers` 或条件检查中是否包含严格的类型兼容性判断（例如 ModifyParameter 中已检查 Add/Sub 必须是数字）。
- 类型检查在 `fsmValidation.ts` (CheckParameterModifiers) 中有体现，`validateVariables.ts` 中也有类似逻辑。

总体而言，导出校验逻辑结构清晰，模块化程度高，符合架构设计。
