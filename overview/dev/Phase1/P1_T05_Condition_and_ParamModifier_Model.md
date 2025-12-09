# P1-T05 条件构造器与参数修改器抽象模型（落地）

> 目标：统一条件表达式与参数修改器的 JSON 结构，支持变量比较、自定义条件脚本、AND/OR/NOT 组合，以及参数修改的可复用抽象（作用域化变量引用）。

## 1. 条件表达式（ConditionExpression）

- 结构：`type` ∈ `AND | OR | NOT | COMPARISON | LITERAL | VARIABLE_REF | SCRIPT_REF`
- 字段：
  - `children?: ConditionExpression[]`（AND/OR）
  - `operand?: ConditionExpression`（NOT）
  - `left?` / `right?` + `operator?: == != > < >= <=`（COMPARISON）
  - `value?: any`（LITERAL）
  - `variableId?: string` + `variableScope?: VariableScope`（VARIABLE_REF，必须携带 scope）
  - `scriptId?: string`（SCRIPT_REF，自定义条件脚本）
- 作用域要求：凡引用变量必须带 `variableScope`（Global / StageLocal / NodeLocal / Temporary）。

## 2. 参数修改器（ParameterModifier）

- 结构：`{ targetVariableId, targetScope, operation, source }`
  - `operation` ∈ `Set | Add | Subtract | CopyFromVar`
  - `source`：`{ type: 'Constant', value } | { type: 'VariableRef', variableId, scope }`
- 用法：用于 Transition/事件监听/演出绑定时对变量赋值/累加/减法或从其他变量复制。

## 3. 代码落地

- `utils/conditionBuilder.ts`
  - 快速构造器：`literalTrue/False`, `variableRef`, `comparison`, `logicalAnd/Or/Not`, `scriptCondition`
  - 参数修改器模板：`setToConstant`, `copyFromVariable`, `addFromVariable`, `addConstant`, `subtractConstant`
  - 触发器默认值：`alwaysTrigger/onEventTrigger/customTrigger`
- `types/common.ts`：ParameterModifier 的 `operation` 增加 `CopyFromVar`，匹配“从变量复制”语义。
- `components/Inspector/ConditionEditor.tsx`
  - UI 支持 `SCRIPT_REF` 与 `VARIABLE_REF` 的作用域选择（Global/StageLocal/NodeLocal/Temporary）。
  - NOT 使用 `operand` 字段；默认值防御空节点。

## 4. 后续工作

- 校验：在导出/验证流程中检查 ConditionExpression 的变量是否带 scope，阻断引用被标记删除的变量/脚本。
- UI：ConditionEditor 需接入变量/脚本选择器而非自由文本；参数修改器的编辑器尚未实现，需要按同一抽象渲染操作类型与 source。
- 数据：等全局/Stage 变量接入 store 后，作用域选择器应使用真实列表并自动过滤可见变量。
