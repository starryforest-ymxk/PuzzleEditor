/**
 * types/stateMachine.ts
 * 状态机类型定义 - FSM 结构（State, Transition, Condition）
 */

import {
  Entity,
  Vector2,
  Side,
  VariableScope,
  EventListener,
  PresentationBinding,
  ParameterModifier,
  StateMachineId,
  StateId,
  TransitionId,
  EventId,
  ScriptId,
  VariableId
} from './common';

// ========== 状态节点 ==========
/**
 * 状态机中的状态节点
 */
export interface State extends Entity {
  id: StateId;
  position: Vector2;        // 画布坐标

  // 生命周期脚本（统一入口，不再区分 OnEnter/OnExit）
  lifecycleScriptId?: ScriptId;

  // 事件监听
  eventListeners: EventListener[];
}

// ========== 触发器配置 ==========
/**
 * 状态转移的触发器配置
 * - Always: 每帧检查
 * - OnEvent: 特定事件触发（必须携带 eventId）
 * - CustomScript: 自定义触发脚本（必须携带 scriptId）
 */
export type TriggerConfig =
  | { type: 'Always' }
  | { type: 'OnEvent'; eventId: EventId }
  | { type: 'CustomScript'; scriptId: ScriptId };

// ========== 条件表达式 ==========
/**
 * 条件表达式AST 结构
 * 支持变量比较、逻辑组合和自定义脚本
 */
export interface ConditionExpression {
  type: 'AND' | 'OR' | 'NOT' | 'COMPARISON' | 'LITERAL' | 'VARIABLE_REF' | 'SCRIPT_REF';

  // 逻辑组合 (AND/OR)
  children?: ConditionExpression[];

  // 逻辑取反 (NOT)
  operand?: ConditionExpression;

  // 比较表达式 (COMPARISON)
  operator?: '==' | '!=' | '>' | '<' | '>=' | '<=';
  left?: ConditionExpression;
  right?: ConditionExpression;

  // 字面值 (LITERAL)
  value?: any;

  // 变量引用 (VARIABLE_REF)
  variableId?: VariableId;
  variableScope?: VariableScope;    // 明确变量作用域

  // 脚本引用 (SCRIPT_REF) - 自定义条件脚本
  scriptId?: ScriptId;
}

// ========== 状态转移 ==========
/**
 * 状态之间的转移连线
 */
export interface Transition extends Entity {
  id: TransitionId;
  fromStateId: StateId;
  toStateId: StateId;

  // 连线端口位置
  fromSide?: Side;
  toSide?: Side;

  // 优先级（同时满足条件时的执行顺序）
  priority: number;

  // 触发器（可多个，任一触发即生效）
  triggers: TriggerConfig[];

  // 条件表达式（可选）
  condition?: ConditionExpression;

  // 演出绑定（转移时执行）
  presentation?: PresentationBinding;

  // 参数修改器（转移时修改参数）
  parameterModifiers: ParameterModifier[];
}

// ========== 状态机 ==========
/**
 * 有限状态机，包含状态和转移
 */
export interface StateMachine {
  id: StateMachineId;
  initialStateId: StateId | null;
  states: Record<StateId, State>;
  transitions: Record<TransitionId, Transition>;
}
