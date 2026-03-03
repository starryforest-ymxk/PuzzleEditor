# 导出数据规范化设计文档（Export Data Normalization）

> **版本**: 1.0.0 | **创建时间**: 2026-03-04

---

## 1. 目标

在导出前插入一个数据清洗步骤，确保导出的 JSON 中所有值类型正确、UI 专用字段被剥离，产出标准的运行时数据文件。

**核心思路**：在 `useProjectActions.ts` 构建 `ExportBundle` 之前，对 `project` 数据执行深拷贝 + 规范化，新增工具函数 `normalizeForExport()`，不影响编辑器内存中的原始数据。

---

## 2. 新建模块 `utils/exportNormalizer.ts`

核心导出规范化模块，包含以下函数：

| 函数 | 职责 |
|------|------|
| `normalizeForExport(project)` | 主入口，深拷贝数据后依次调用子规范化器，返回 `ExportBundle['data']` |
| `normalizeVariableValue(type, value)` | 按 VariableType 修正值类型（复用 `variableValidation.ts` 中已有的 `normalizeValueByType`） |
| `normalizeValueSource(source, targetType?)` | 规范化 `ValueSource` 中的常量值；若能推断目标类型则按类型修正，否则保守处理 |
| `normalizeConditionExpression(expr)` | 递归处理条件表达式：Literal 确保 value 为 boolean；Comparison 确保 operator/left/right 存在且常量值类型正确 |
| `normalizeParameterModifier(modifier, allVariables)` | 查找目标变量类型，按类型修正 `source.value` |
| `normalizeParameterBinding(binding)` | 修正 `source.value`（若有 `tempVariable.type` 可推断类型）；剥离 `id`、`kind` |
| `normalizePresentationBinding(binding)` | 递归规范化内部 `parameters` 数组 |
| `normalizeEventListener(listener, allVariables)` | 若 action 为 ModifyParameter，递归规范化 modifiers |
| `stripUIFields(obj, fieldsToRemove)` | 通用工具，从对象上删除指定字段 |

---

## 3. 值类型规范化覆盖范围

| 数据路径 | 值字段 | 规范化策略 |
|----------|--------|-----------|
| `VariableDefinition.value`（全局 + Stage/Node 局部） | `value: any` | 按 `type` 字段调用 `normalizeValueByType` |
| `ValueSource { type: 'Constant' }` 的 `value` | `value: any` | 若可推断目标类型（ParameterModifier 中查变量、ConditionExpression 中查左/右 VariableRef、ParameterBinding 中查 tempVariable.type），按类型修正；否则保持原值 |
| `ConditionExpression { type: 'Literal' }` 的 `value` | `value?: boolean` | 强制转为 boolean，`undefined`/`null` → `false` |
| `Transition.priority` | `priority: number` | `parseInt` 或默认 `0`，确保非 NaN 且 ≥ 0 |
| `PresentationNode.duration` (Wait) | `duration?: number` | `parseFloat` 或默认 `1`，确保非 NaN 且 > 0 |

---

## 4. 剥离 UI 专用字段

| 字段 | 所在类型 | 原因 |
|------|---------|------|
| `isExpanded` | `StageNode` | 树展开状态，纯 UI |
| `position` | `State`、`PresentationNode` | 画布坐标（用户确认不保留） |
| `fromSide` / `toSide` | `Transition` | 连线端口方向，纯视觉 |
| `edgeProperties` | `PresentationGraph` | 连线端点方向，纯视觉 |
| `id` | `ParameterBinding` | 前端渲染辅助 ID |
| `kind` | `ParameterBinding` | 前端区分参数来源类型 |

---

## 5. 变量查找索引

规范化过程中需要一个 **变量索引**（`Record<VariableId, VariableDefinition>`）来查找变量类型，以便正确规范化 `ValueSource` 的常量值。索引来源：

- `blackboard.globalVariables`
- 所有 `StageNode.localVariables`
- 所有 `PuzzleNode.localVariables`

---

## 6. 递归处理策略

数据遍历顺序：

1. **构建变量索引** → 先规范化所有变量的 `value`
2. **`blackboard`** → 规范化每个 `VariableDefinition` 的 `value`
3. **`scripts`** → 保留原样
4. **`stageTree`** → 遍历每个 `StageNode`：
   - 剥离 `isExpanded`（StageNode 类型无 `displayOrder` 字段，不需剥离）
   - 规范化 `localVariables`、`unlockCondition`、`onEnterPresentation` / `onExitPresentation`、`eventListeners`
5. **`nodes`** → 遍历每个 `PuzzleNode`：
   - 规范化 `localVariables`、`eventListeners`
6. **`stateMachines`** → 遍历每个 `StateMachine`：
   - 遍历 States：剥离 `position`，规范化 `eventListeners`
   - 遍历 Transitions：剥离 `fromSide` / `toSide`，规范化 `condition`、`presentation`、`parameterModifiers`、`priority`
7. **`presentationGraphs`** → 遍历每个 `PresentationGraph`：
   - 剥离 `edgeProperties`
   - 遍历 Nodes：剥离 `position`，规范化 `presentation`、`condition`、`duration`

---

## 7. 导出流程修改

在 `useProjectActions.ts` 中，将原来直接引用 `project` 数据：

```typescript
// 修改前
data: {
    blackboard: project.blackboard,
    scripts: project.scripts,
    stageTree: project.stageTree,
    nodes: project.nodes,
    stateMachines: project.stateMachines,
    presentationGraphs: project.presentationGraphs
}

// 修改后
data: normalizeForExport(project)
```

---

## 8. 设计决策

| 决策 | 理由 |
|------|------|
| 导出时深拷贝 + 清洗，不修改 Store 数据 | 避免影响编辑器内存状态 |
| 保留 `state`（ResourceState）字段 | 引擎端有对应的 `ResourceState` 枚举映射，需感知资源状态 |
| 不保留 `position`（State / PresentationNode） | 用户确认不保留 |
| 不移除 MarkedForDelete 资源 | 这是校验阶段的职责（若有 error 直接阻止导出） |
| ValueSource 常量值规范化采用"尽力推断"策略 | 能查到目标变量类型时按类型修正，查不到时保持原值 |
| 规范化在 `validateProject` 之后执行 | 校验和规范化职责分离：校验报告问题，规范化修正数据格式 |

---

## 9. 验证清单

- [ ] 所有 boolean 值必须是 `true` / `false`，不是字符串
- [ ] 所有 integer / float 值必须是 `number` 类型，不是字符串
- [ ] 不存在 `isExpanded`、`position`（State / PresentationNode）、`fromSide` / `toSide`、`edgeProperties` 字段
- [ ] `ParameterBinding` 中不存在 `id`、`kind`
- [ ] `ConditionExpression.Literal.value` 一定是 boolean
- [ ] `Transition.priority` 一定是有效整数
- [ ] `PresentationNode.duration` (Wait) 一定是有效正数
- [ ] 对比导出前后的校验结果应一致（规范化不掩盖校验问题）
