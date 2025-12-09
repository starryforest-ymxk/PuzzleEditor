# P1-T07 演出体系与参数传递模型设计（对齐现代码）

> 目标：统一演出子图（PresentationGraph）与演出绑定（PresentationBinding）的结构，以及参数传递的来源/作用域规则。

## 1. 演出子图（PresentationGraph）

- 结构：`{ id, name, description?, startNodeId, nodes }`
- 节点：`PresentationNode`
  - `id: pnode-*`
  - `type: ScriptCall | Wait | Branch | Parallel`
  - `position: {x,y}`（画布坐标）
  - `scriptId?: script-*`（仅 ScriptCall）
  - `parameters?: ParameterBinding[]`（仅 ScriptCall）
  - `duration?: number`（仅 Wait）
  - `nextIds: PresentationNodeId[]`（后继连接）

## 2. 演出绑定（PresentationBinding）

- 两种形态：
  - `{ type: 'Script'; scriptId; parameters: ParameterBinding[] }` —— 直接调用脚本
  - `{ type: 'Graph'; graphId }` —— 触发一个演出子图
- 绑定位置：Stage onEnter/onExit、State onEnter/onExit、Transition（执行时）等。

## 3. 参数传递模型（ParameterBinding）

- 结构：`{ paramName, source }`
- `source`：
  - `Constant`：`{ type: 'Constant'; value }`
  - `VariableRef`：`{ type: 'VariableRef'; variableId; scope }`
- 作用域要求：变量引用必须带 `scope`（Global / StageLocal / NodeLocal / Temporary）。Temporary 可在绑定 UI 中即时创建，不落入持久化。

## 4. 现有类型对齐

- `types/presentation.ts` 已定义 Graph/Node 结构；`types/common.ts` 已定义 `ParameterBinding` 与 `PresentationBinding`。
- `types/common.ts` 的 `ValueSource` 已支持 Constant / VariableRef（带 scope）。
- `types/stateMachine.ts` 的 Transition/State 通过 `presentation?: PresentationBinding` 绑定演出。

## 5. 后续工作建议

- UI：演出子图编辑器需实现节点/连线编辑与参数配置；演出绑定选择器需可选脚本或子图，参数绑定需支持变量选择（作用域过滤）与临时参数创建。
- 校验：导出前检查 `graphId`/`scriptId` 存在且未被标记删除；参数绑定引用的变量/作用域合法。
- 复用：参数绑定与条件/参数修改器共享的作用域解析逻辑可复用 `utils/variableScope`。可考虑在 `utils/conditionBuilder` 中补充演出绑定模板（可选）。
