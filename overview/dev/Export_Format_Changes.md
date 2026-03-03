# Export 文件格式变更说明（供后端对接）

> **版本**: 1.0.0 | **日期**: 2026-03-04  
> **文件类型**: `.export.json`（`fileType: "puzzle-export"`）

---

## 1. 变更概述

导出流程新增了**数据规范化层**，在写出 `.export.json` 之前对所有数据执行清洗。  
变更目标：

- **移除编辑器 UI 专用字段**，后端不再需要处理这些字段
- **保留 `displayOrder` 字段**，编辑器中用于拖拽排序，导出后同样保留
- **保证所有值的类型严格匹配声明类型**（boolean 不会出现空字符串、number 不会出现字符串等）
- 不改变数据结构本身，仅做字段删减和值类型修正

---

## 2. 已移除的字段（后端不再需要解析）

### 2.1 画布坐标 `position`

以下类型的 `position: { x: number, y: number }` 字段已移除（仅用于编辑器画布布局）：

| 类型 | 原字段 |
|------|--------|
| `State`（状态机状态节点） | `position: Vector2` |
| `PresentationNode`（演出图节点） | `position: Vector2` |

### 2.2 连线方向字段

| 类型 | 移除字段 | 说明 |
|------|---------|------|
| `Transition` | `fromSide?: Side`, `toSide?: Side` | 状态转移连线的端口方向（top/right/bottom/left），纯视觉属性 |
| `PresentationGraph` | `edgeProperties?: Record<string, PresentationEdgeProperties>` | 演出图连线端点方向，纯视觉属性 |

### 2.3 阶段树展开状态

| 类型 | 移除字段 | 说明 |
|------|---------|------|
| `StageNode` | `isExpanded?: boolean` | 阶段树 UI 展开/折叠状态 |

### 2.4 ParameterBinding 前端辅助字段

`ParameterBinding`（出现在 `PresentationBinding.parameters` 中）移除以下 2 个字段：

| 移除字段 | 类型 | 说明 |
|---------|------|------|
| `id` | `string` | 前端渲染用的临时 ID |
| `kind` | `'Variable' \| 'Temporary'` | 前端区分参数来源类型 |

**保留字段**：`paramName`、`source`、`tempVariable`、`description`

---

## 3. 值类型保证

导出文件中所有值类型现在严格满足以下约束：

### 3.1 VariableDefinition.value

根据变量声明的 `type` 字段，`value` 的类型 **严格保证** 如下：

| `type` 值 | `value` 的 JSON 类型 | 默认值 | 说明 |
|-----------|---------------------|--------|------|
| `"boolean"` | `boolean` | `false` | 不会出现 `""`、`"true"` 等字符串 |
| `"integer"` | `number`（整数） | `0` | 不会出现 `"123"` 等字符串，NaN → `0` |
| `"float"` | `number` | `0` | 不会出现 `"1.5"` 等字符串，NaN → `0` |
| `"string"` | `string` | `""` | `null`/`undefined` → `""` |

此规则适用于所有位置的变量定义（全局变量、Stage 局部变量、Node 局部变量）。

### 3.2 ValueSource 常量值

出现在 `ParameterModifier.source`、`ParameterBinding.source`、`ConditionExpression.left/right` 中的 `ValueSource`：

```json
{ "type": "Constant", "value": <any> }
```

当能推断出目标类型时，`value` 按上述 3.1 规则修正。推断来源：
- `ParameterModifier` → 查找 `targetVariableId` 的变量类型
- `ParameterBinding` → 使用 `tempVariable.type`
- `ConditionExpression.Comparison` → 从对侧 `VariableRef` 查找类型

当无法推断类型时，`value` 保持原值不修改。

### 3.3 ConditionExpression

| 子类型 | 保证 |
|--------|------|
| `Literal` | `value` 一定是 `boolean`（`true` 或 `false`），不会是 `undefined`/`null` |
| `Comparison` | `operator` 一定存在（缺失时默认 `"=="`），`left`/`right` 常量值按 3.2 规则规范化 |
| `And` / `Or` | `children` 数组递归规范化 |
| `Not` | `operand` 递归规范化 |
| `ScriptRef` | 不做修改，`scriptId` 保持原样 |

### 3.4 数值字段

| 字段 | 位置 | 保证 |
|------|------|------|
| `priority` | `Transition` | 一定是 `number`（非负整数），NaN/缺失 → `0` |
| `duration` | `PresentationNode`（Wait 类型） | 一定是 `number`（正数），NaN/缺失 → `1` |

---

## 4. 保留的字段说明

以下字段**继续保留**在导出数据中：

| 字段 | 类型 | 保留理由 |
|------|------|---------|
| `state` | `ResourceState`（`'Draft' \| 'Implemented' \| 'MarkedForDelete'`） | 引擎端需要感知资源生命周期状态 |
| `displayOrder` | 多个类型（`VariableDefinition`、`EventDefinition`、`ScriptDefinition`、`StateMachine`、`PresentationGraph`、`PuzzleNode`） | 编辑器内拖拽排序用，保留于导出数据中 |
| `tempVariable` | `ParameterBinding` 内 | 运行时需要知道临时参数的类型元数据 |
| `assetName` | 各 Entity | 资产标识符，引擎端使用 |

---

## 5. 导出文件顶层结构（不变）

```jsonc
{
  "fileType": "puzzle-export",
  "manifestVersion": "1.0.0",
  "exportedAt": "2026-03-04T12:00:00.000Z",
  "projectName": "MyProject",
  "projectVersion": "0.1.0",
  "data": {
    "blackboard": { /* BlackboardData */ },
    "scripts": { /* ScriptsManifest */ },
    "stageTree": { /* StageTreeData */ },
    "nodes": { /* Record<PuzzleNodeId, PuzzleNode> */ },
    "stateMachines": { /* Record<StateMachineId, StateMachine> */ },
    "presentationGraphs": { /* Record<PresentationGraphId, PresentationGraph> */ }
  }
}
```

---

## 6. 各模块导出后的精确字段列表

### 6.1 BlackboardData

```jsonc
{
  "globalVariables": {
    "<VariableId>": {
      "id": "string",
      "name": "string",
      "description": "string?",
      "assetName": "string?",
      "type": "'boolean' | 'integer' | 'float' | 'string'",
      "value": "按 type 严格匹配的值",
      "state": "'Draft' | 'Implemented' | 'MarkedForDelete'",
      "scope": "'Global'",
      "displayOrder": "number?"
    }
  },
  "events": {
    "<EventId>": {
      "id": "string",
      "name": "string",
      "description": "string?",
      "assetName": "string?",
      "state": "'Draft' | 'Implemented' | 'MarkedForDelete'",
      "displayOrder": "number?"
    }
  }
}
```

### 6.2 ScriptsManifest

```jsonc
{
  "version": "string",
  "scripts": {
    "<ScriptId>": {
      "id": "string",
      "name": "string",
      "description": "string?",
      "assetName": "string?",
      "category": "'Performance' | 'Lifecycle' | 'Condition' | 'Trigger'",
      "lifecycleType": "'Stage' | 'Node' | 'State'?",  // 仅 Lifecycle 类型
      "state": "'Draft' | 'Implemented' | 'MarkedForDelete'",
      "displayOrder": "number?"
    }
  }
}
```

### 6.3 StageTreeData

```jsonc
{
  "rootId": "string",
  "stages": {
    "<StageId>": {
      "id": "string",
      "name": "string",
      "description": "string?",
      "assetName": "string?",
      "parentId": "string | null",
      "childrenIds": ["string"],
      "isInitial": "boolean?",
      "localVariables": { /* 同 6.1 中 VariableDefinition，scope 为 'StageLocal' */ },
      "unlockTriggers": [/* TriggerConfig[] */],
      "unlockCondition": { /* ConditionExpression? - 已递归规范化 */ },
      "lifecycleScriptId": "string?",
      "onEnterPresentation": { /* PresentationBinding? - 已规范化 */ },
      "onExitPresentation": { /* PresentationBinding? - 已规范化 */ },
      "eventListeners": [/* EventListener[] - 已规范化 */]
      // ❌ 已移除: isExpanded
    }
  }
}
```

### 6.4 PuzzleNode

```jsonc
{
  "<PuzzleNodeId>": {
    "id": "string",
    "name": "string",
    "description": "string?",
    "assetName": "string?",
    "stageId": "string",
    "stateMachineId": "string",
    "localVariables": { /* 同 VariableDefinition，scope 为 'NodeLocal' */ },
    "lifecycleScriptId": "string?",
    "eventListeners": [/* EventListener[] - 已规范化 */],
    "displayOrder": "number?"
  }
}
```

### 6.5 StateMachine

```jsonc
{
  "<StateMachineId>": {
    "id": "string",
    "initialStateId": "string | null",
    "displayOrder": "number?",
    "states": {
      "<StateId>": {
        "id": "string",
        "name": "string",
        "description": "string?",
        "assetName": "string?",
        "lifecycleScriptId": "string?",
        "eventListeners": [/* EventListener[] - 已规范化 */]
        // ❌ 已移除: position
      }
    },
    "transitions": {
      "<TransitionId>": {
        "id": "string",
        "name": "string",
        "description": "string?",
        "fromStateId": "string",
        "toStateId": "string",
        "priority": "number (≥0 整数，保证)",
        "triggers": [/* TriggerConfig[] */],
        "condition": { /* ConditionExpression? - 已递归规范化 */ },
        "presentation": { /* PresentationBinding? - 已规范化 */ },
        "invokeEventIds": ["string?"],
        "parameterModifiers": [
          {
            "targetVariableId": "string",
            "targetScope": "'Global' | 'StageLocal' | 'NodeLocal' | 'Temporary'",
            "operation": "'Set' | 'Add' | 'Subtract' | 'Multiply' | 'Divide' | 'Toggle'",
            "source": { /* ValueSource - 已规范化 */ }
          }
        ]
        // ❌ 已移除: fromSide, toSide
      }
    }
  }
}
```

### 6.6 PresentationGraph

```jsonc
{
  "<PresentationGraphId>": {
    "id": "string",
    "name": "string",
    "description": "string?",
    "startNodeId": "string | null",
    "displayOrder": "number?",
    // ❌ 已移除: edgeProperties
    "nodes": {
      "<PresentationNodeId>": {
        "id": "string",
        "name": "string",
        "description": "string?",
        "type": "'PresentationNode' | 'Wait' | 'Branch' | 'Parallel'",
        "presentation": { /* PresentationBinding? - 已规范化 */ },
        "duration": "number? (仅 Wait 类型，保证 >0)",
        "nextIds": ["string"],
        "condition": { /* ConditionExpression? (仅 Branch) - 已递归规范化 */ }
        // ❌ 已移除: position
      }
    }
  }
}
```

---

## 7. 子结构参考

### ValueSource

```jsonc
// 常量值 - value 类型由上下文决定（见 3.2）
{ "type": "Constant", "value": "<按目标类型规范化>" }

// 变量引用
{ "type": "VariableRef", "variableId": "string", "scope": "'Global' | 'StageLocal' | 'NodeLocal' | 'Temporary'" }
```

### PresentationBinding

```jsonc
// 脚本绑定
{
  "type": "Script",
  "scriptId": "string",
  "parameters": [
    {
      "paramName": "string",
      "source": { /* ValueSource */ },
      "description": "string?",
      "tempVariable": {          // 可选，仅临时参数
        "id": "string",
        "name": "string",
        "type": "'boolean' | 'integer' | 'float' | 'string'",
        "description": "string?"
      }
      // ❌ 已移除: id, kind
    }
  ]
}

// 子图绑定
{ "type": "Graph", "graphId": "string" }
```

### EventListener

```jsonc
{
  "eventId": "string",
  "action":
    { "type": "InvokeScript" }
    // 或
    {
      "type": "ModifyParameter",
      "modifiers": [/* ParameterModifier[] - source 已规范化 */]
    }
}
```

### TriggerConfig（不变，无需规范化）

```jsonc
{ "type": "Always" }
{ "type": "OnEvent", "eventId": "string" }
{ "type": "CustomScript", "scriptId": "string" }
{ "type": "HandledByScript" }
```

### ConditionExpression

```jsonc
{ "type": "Literal", "value": true }                    // boolean 保证
{ "type": "Comparison", "operator": "==", "left": {/*ValueSource*/}, "right": {/*ValueSource*/} }
{ "type": "And", "children": [/*ConditionExpression[]*/] }
{ "type": "Or", "children": [/*ConditionExpression[]*/] }
{ "type": "Not", "operand": {/*ConditionExpression*/} }
{ "type": "ScriptRef", "scriptId": "string" }
```
