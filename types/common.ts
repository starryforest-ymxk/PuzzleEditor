/**
 * types/common.ts
 * 通用基础类型定义 - 包含所有模块共享的类型
 */
import {
  ProjectId,
  StageId,
  PuzzleNodeId,
  StateMachineId,
  StateId,
  TransitionId,
  PresentationGraphId,
  PresentationNodeId,
  ScriptId,
  ScriptKey,
  TriggerId,
  TriggerKey,
  VariableId,
  VariableKey,
  EventId,
  EventKey,
  IdRef,
  KeyRef,
  StableRef
} from './identity';

export {
  ProjectId,
  StageId,
  PuzzleNodeId,
  StateMachineId,
  StateId,
  TransitionId,
  PresentationGraphId,
  PresentationNodeId,
  ScriptId,
  ScriptKey,
  TriggerId,
  TriggerKey,
  VariableId,
  VariableKey,
  EventId,
  EventKey,
  IdRef,
  KeyRef,
  StableRef
};

// ========== 基础 ID 类型 ==========
export type ID = string;

// ========== 几何类型 ==========
export type Side = 'top' | 'right' | 'bottom' | 'left';

export interface Vector2 {
  x: number;
  y: number;
}

export interface Dimensions {
  width: number;
  height: number;
}

// ========== 资源生命周期状态 ==========
/**
 * 资源状态枚举，控制软删除行为
 * - Draft: 草稿状态，可自由修改和删除
 * - Implemented: 已实现，只能标记删除
 * - MarkedForDelete: 已标记删除，禁止新引用，需"应用删除"才能物理移除
 */
export type ResourceState = 'Draft' | 'Implemented' | 'MarkedForDelete';

// ========== 变量类型与作用域 ==========
/**
 * 变量数据类型
 */
export type VariableType = 'boolean' | 'integer' | 'float' | 'string' | 'enum';

/**
 * 变量作用域
 * - Global: 全局可见
 * - StageLocal: Stage 及其子结构可见
 * - NodeLocal: 仅 PuzzleNode 内部可见
 * - Temporary: 仅在参数传递时存在
 */
export type VariableScope = 'Global' | 'StageLocal' | 'NodeLocal' | 'Temporary';

// ========== 脚本分类 ==========
/**
 * 脚本分类枚举
 * - Performance: 演出脚本（播放动画、声音等）
 * - Lifecycle: 生命周期脚本（OnEnter/OnExit 等）
 * - Condition: 自定义条件脚本（返回 bool）
 * - Trigger: 自定义触发器脚本（驱动状态转移）
 */
export type ScriptCategory = 'Performance' | 'Lifecycle' | 'Condition' | 'Trigger';

// ========== 基础实体接口 ==========
/**
 * 所有可识别实体的基础接口
 */
export interface Entity {
  id: ID;
  name: string;
  description?: string;
}

// ========== 参数值来源 ==========
/**
 * 参数值的来源类型
 * - Constant: 常量值
 * - VariableRef: 变量引用
 */
export type ValueSource =
  | { type: 'Constant'; value: any }
  | { type: 'VariableRef'; variableId: VariableId; scope: VariableScope };

// ========== 参数修改器 ==========
/**
 * 用于事件响应或状态转移时修改参数
 */
export interface ParameterModifier {
  targetVariableId: VariableId;
  targetScope: VariableScope;
  operation: 'Set' | 'Add' | 'Subtract' | 'CopyFromVar';
  source: ValueSource;
}

// ========== 参数绑定 ==========
/**
 * 演出脚本调用时的参数传递配置
 */
export interface ParameterBinding {
  paramName: string;     // 目标脚本的参数名
  source: ValueSource;   // 值来源
}

// ========== 演出绑定 ==========
/**
 * 绑定演出对象（脚本或子图）
 */
export type PresentationBinding =
  | { type: 'Script'; scriptId: ScriptId; parameters: ParameterBinding[] }
  | { type: 'Graph'; graphId: PresentationGraphId };

// ========== 事件动作 ==========
/**
 * 事件触发后执行的动作类型
 */
export type EventAction =
  | { type: 'InvokeScript'; scriptId: ScriptId; parameters?: ParameterBinding[] }
  | { type: 'ModifyParameter'; modifier: ParameterModifier };

// ========== 事件监听器 ==========
/**
 * 事件监听配置，绑定到 Stage/State/PuzzleNode
 */
export interface EventListener {
  eventId: EventId;
  action: EventAction;
}
