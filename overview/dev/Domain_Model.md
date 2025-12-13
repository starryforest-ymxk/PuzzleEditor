# 领域模型（Domain Model）
> 本文档描述项目的核心数据结构与类型定义，需与 `types/*` 代码保持同步。  
> **版本**: 1.0.0 | **更新时间**: 2025-12-09 | **相关任务**: P1-T01, P1-T02

---

## 1. 基础概览

### 1.1 资源分类

| 分类 | 说明 | 示例 |
|------|------|------|
| **基础资源（不可实例化）** | 全局定义，被各处引用 | Script、Trigger、Event、Global Variable |
| **结构实体（可实例化）** | 在项目中可多次创建 | Stage、PuzzleNode、State、Transition |
| **复合结构** | 嵌套的数据结构 | StateMachine、PresentationGraph、ConditionExpression |
| **枚举数据集合** | 类型标识符 | ResourceState、VariableScope、ScriptCategory |

### 1.2 模型关系图
```mermaid
graph TB
    subgraph Project
        Meta[ProjectMeta]
        BB[Blackboard]
        Scripts[ScriptsManifest]
        Triggers[TriggersManifest]
        Tree[StageTree]
    end
    
    subgraph StageTree
        Stage1[Stage]
        Stage2[Stage]
        Stage1 --> Stage2
    end
    
    subgraph Stage
        LocalVars[LocalVariables]
        Nodes[PuzzleNodes]
    end
    
    subgraph PuzzleNode
        FSM[StateMachine]
        NodeVars[LocalVariables]
    end
    
    subgraph StateMachine
        States[States]
        Trans[Transitions]
    end
    
    BB --> |引用| Stage
    Scripts --> |引用| FSM
    Triggers --> |引用| Trans
```

---

## 2. ID/Key 与引用规则

- **ID 前缀（内部强约束）**
  - `proj-*` 项目，`stage-*` 阶段，`node-*` 解谜节点
  - `fsm-*` 状态机，`state-*` 状态，`trans-*` 转移
  - `pres-*` 演出图，`pnode-*` 演出节点
  - `script-*` 脚本；触发器/事件/变量推荐 `trigger-*` / `event-*` / `var-*`
- **Key（稳定标识，需唯一）**：脚本、触发器、变量、事件都携带 `key`，用于外部或跨版本兼容。
- **引用方式**：项目内部统一使用 `id` 字段；变量引用必须携带 `scope`（Global | StageLocal | NodeLocal | Temporary）。如需兼容 key，可在 API 层引入 `StableRef = {id}|{key}` 再解析为 `id`。

---

## 3. 顶层 JSON Manifest 结构

```json
{
  "manifestVersion": "1.0.0",
  "exportedAt": "2025-12-09T00:00:00.000Z",
  "project": {
    "meta": { "...": "..." },
    "blackboard": { "globalVariables": {}, "events": {} },
    "scripts": { "version": "1.0.0", "scripts": {} },
    "triggers": { "triggers": {} },
    "stageTree": { "rootId": "stage-root", "stages": {} },
    "nodes": {},
    "stateMachines": {},
    "presentationGraphs": {}
  }
}
```

---

## 4. 主要类型摘要（与代码同步）

```ts
// 通用基础
type ResourceState = 'Draft' | 'Implemented' | 'MarkedForDelete';
type VariableType = 'boolean' | 'integer' | 'float' | 'string' | 'enum';
type VariableScope = 'Global' | 'StageLocal' | 'NodeLocal' | 'Temporary';
type ScriptCategory = 'Performance' | 'Lifecycle' | 'Condition' | 'Trigger';

interface Entity { id: string; name: string; description?: string; }

type ValueSource =
  | { type: 'Constant'; value: any }
  | { type: 'VariableRef'; variableId: string; scope: VariableScope };

interface ParameterModifier {
  targetVariableId: string;
  targetScope: VariableScope;
  operation: 'Set' | 'Add' | 'Subtract';
  source: ValueSource;
}

interface ParameterBinding {
  paramName: string;
  source: ValueSource;
  id?: string;                       // 前端渲染辅助 ID
  kind?: 'Variable' | 'Temporary';   // 参数来源类型
  tempVariable?: {                   // 临时参数元数据，仅当 kind === 'Temporary'
    id: string;
    name: string;
    type: VariableType;
    description?: string;
  };
}

type PresentationBinding =
  | { type: 'Script'; scriptId: string; parameters: ParameterBinding[] }
  | { type: 'Graph'; graphId: string };

type EventAction =
  | { type: 'InvokeScript'; scriptId: string; parameters?: ParameterBinding[] }
  | { type: 'ModifyParameter'; modifier: ParameterModifier };

interface EventListener { eventId: string; action: EventAction; }
```

### 4.1 基础资源
```ts
interface VariableDefinition extends Entity {
  id: string;
  key: string;
  type: VariableType;
  defaultValue: any;
  enumOptions?: string[];
  state: ResourceState;
  scope: VariableScope;
}

interface EventDefinition extends Entity { id: string; key: string; state: ResourceState; }

interface ScriptParameterDefinition {
  name: string;
  type: VariableType | 'asset' | 'nodeReference';
  required: boolean;
  defaultValue?: any;
  options?: string[];
}

interface ScriptDefinition extends Entity {
  id: string;
  key: string;
  category: ScriptCategory;
  parameters: ScriptParameterDefinition[];
  state: ResourceState;
}
```

### 4.2 阶段树
```ts
interface StageNode extends Entity {
  id: string;               // stage-*
  parentId: string | null;  // stage-*
  childrenIds: string[];    // stage-*
  isInitial?: boolean;      // 每个父级的首个子节点应标记为 true
  localVariables: Record<string, VariableDefinition>;
  unlockCondition?: ConditionExpression;
  lifecycleScriptId?: string;  // script-*
  onEnterPresentation?: PresentationBinding;
  onExitPresentation?: PresentationBinding;
  eventListeners: EventListener[];
  isExpanded?: boolean;        // UI 展开状态（持久化）
}

interface StageTreeData { rootId: string; stages: Record<string, StageNode>; }
```

### 4.3 解谜节点
```ts
interface PuzzleNode extends Entity {
  id: string;              // node-*
  stageId: string;         // stage-*
  stateMachineId: string;  // fsm-*
  localVariables: Record<string, VariableDefinition>;
  onCreateScriptId?: string;
  onDestroyScriptId?: string;
  eventListeners: EventListener[];
}
```

### 4.4 状态机
```ts
interface StateMachine {
  id: string;                      // fsm-*
  initialStateId: string | null;   // state-*
  states: Record<string, State>;
  transitions: Record<string, Transition>;
}

interface State extends Entity {
  id: string;                // state-*
  position: { x: number; y: number };
  lifecycleScriptId?: ScriptId; // 统一的生命周期脚本（含进入/退出回调，由脚本内部处理）
  // onEnterScriptId / onExitScriptId 旧字段仅保留兼容，当前实现不再区分
  onEnterScriptId?: ScriptId;
  onExitScriptId?: ScriptId;
  eventListeners: EventListener[];
}

interface TriggerConfig {
  type: 'Always' | 'OnEvent' | 'CustomScript';
  eventId?: string;    // event-*
  scriptId?: string;   // script-*（自定义触发脚本）
}

interface Transition extends Entity {
  id: string;                 // trans-*
  fromStateId: string;        // state-*
  toStateId: string;          // state-*
  fromSide?: 'top' | 'right' | 'bottom' | 'left';
  toSide?: 'top' | 'right' | 'bottom' | 'left';
  priority: number;
  triggers: TriggerConfig[];
  condition?: ConditionExpression;
  presentation?: PresentationBinding;
  parameterModifiers: ParameterModifier[];
}
```

### 4.5 条件表达式
```ts
interface ConditionExpression {
  type: 'AND' | 'OR' | 'NOT' | 'COMPARISON' | 'LITERAL' | 'VARIABLE_REF' | 'SCRIPT_REF';
  children?: ConditionExpression[];
  operand?: ConditionExpression;
  operator?: '==' | '!=' | '>' | '<' | '>=' | '<=';
  left?: ConditionExpression;
  right?: ConditionExpression;
  value?: any;
  variableId?: string;
  variableScope?: VariableScope;
  scriptId?: string; // 自定义条件脚本
}
```

### 4.6 演出子图
```ts
type PresentationNodeType = 'ScriptCall' | 'Wait' | 'Branch' | 'Parallel';

interface PresentationNode extends Entity {
  id: string;                  // pnode-*
  type: PresentationNodeType;
  position: { x: number; y: number };
  scriptId?: string;
  parameters?: ParameterBinding[];
  duration?: number;
  nextIds: string[];           // pnode-*
}

interface PresentationGraph extends Entity {
  id: string;                        // pres-*
  startNodeId: string | null;        // pnode-*
  nodes: Record<string, PresentationNode>;
}
```

### 4.7 项目数据
```ts
interface ProjectMeta {
  id: ProjectId;
  name: string;
  description?: string;
  version: string;
  createdAt: string;  // ISO8601
  updatedAt: string;  // ISO8601
}

interface ProjectData {
  meta: ProjectMeta;
  blackboard: BlackboardData;
  scripts: ScriptsManifest;
  triggers: TriggersManifest;  // 触发器清单
  stageTree: StageTreeData;
  nodes: Record<PuzzleNodeId, PuzzleNode>;
  stateMachines: Record<StateMachineId, StateMachine>;
  presentationGraphs: Record<PresentationGraphId, PresentationGraph>;
}

interface ExportManifest {
  manifestVersion: '1.0.0';
  exportedAt: string;  // ISO8601
  project: ProjectData;
}
```

---

## 5. 唯一性与引用约束

- **全局唯一**：Script / Trigger / Event，`globalVariables` 的 key/ID。
- **局部唯一**：
  - Stage Local Variable：同一 Stage 内 key 不重复
  - Node Local Variable：同一 PuzzleNode 内 key 不重复
  - State / Transition：限定在所属 StateMachine 内唯一
  - PresentationNode：限定在所属 PresentationGraph 内唯一
- **引用必须携带作用域**：凡是 `variableId` 引用，需带 `variableScope`，禁止通过名称解析。

---

## 6. UI 消息堆栈模型

- **UiMessage**
  - `id: string`（唯一标识）
  - `level: 'info' | 'warning' | 'error'`
  - `text: string`（可读提示）
  - `timestamp: ISO8601 string`
- **存储位置**：`ui.messages: UiMessage[]`，所有全局提示（加载/导入/校验/保存等）都需写入；支持清空。
- **展示**：顶栏 `Messages` 下拉列表，按时间倒序显示，可一键清空。

---

## 7. 与现代表达的对齐要求

- 所有模型已在 `types/identity.ts` 定义模板字符型 ID/Key；文档中的 ID 前缀与代码一致。
- `ProjectData` 使用 `nodes`（非 puzzleNodes）字段；黑板脚本清单为 `scripts`（`ScriptsManifest`）。
- 所有引用字段均使用 `id`，`key` 仅作稳定标识或外部兼容，不参与运行时解析。
