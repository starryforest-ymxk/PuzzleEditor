# P1-T06 事件与触发器模型设计（落地）

> 目标：统一 Event/Trigger 的数据结构，明确监听与触发的组合方式，保证触发器参数完备（OnEvent 必须 eventId，CustomScript 必须 scriptId）。

## 1. Event 定义

- 结构：`{ id, key, name, description?, state }`
- 唯一性：`id/key` 全局唯一，`state` 采用 Draft/Implemented/MarkedForDelete（软删除规则同 P1-T03）。
- 作用域：事件可被 Stage / State / PuzzleNode / Transition 监听。

## 2. Trigger 类型（TriggerConfig）

- 联合类型（已落地到代码）：
  - `Always`：每帧检查
  - `OnEvent`：必须携带 `eventId`
  - `CustomScript`：必须携带 `scriptId`
- 用法：Transition.triggers（数组，任一触发即有效）；后续可复用到 Stage/State 监听。

## 3. EventListener 行为

- 结构：`{ eventId, action }`；`action` 可调用脚本或参数修改器。
- 对于 MarkedForDelete 事件，需要在校验/导出阶段阻断并提示。

## 4. 代码落地

- `types/stateMachine.ts`：TriggerConfig 改为区分联合（Always / OnEvent{eventId} / CustomScript{scriptId}），消除“缺失参数”的隐患。
- 触发器默认构造可使用 `utils/conditionBuilder.ts` 中的 `alwaysTrigger/onEventTrigger/customTrigger`。

## 5. 后续工作

- UI：触发器编辑器（Transition Inspector）需改为编辑触发器数组（选择类型并填充 event/script），并标注 MarkedForDelete 事件。
- 校验：导出/即时校验应检查 OnEvent 引用的事件存在且未标记删除；CustomScript 指向的脚本同理。
- 数据：在 Blackboard 接入后，将事件列表提供给触发器选择器，并按 state 分类显示警示。
