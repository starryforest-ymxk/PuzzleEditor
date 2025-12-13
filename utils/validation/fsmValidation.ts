/**
 * utils/validation/fsmValidation.ts
 * FSM 校验工具 - 检测节点/连线中引用已删除资源的问题
 * 用于在画布上显示错误标记，实现局部即时校验
 * 
 * 注意：此文件已从 utils/fsmValidation.ts 迁移到 utils/validation/ 目录
 * 原位置保留兼容性重导出
 */

import type { State, Transition, ConditionExpression, TriggerConfig } from '../../types/stateMachine';
import type { ParameterModifier, EventListener, PresentationBinding, ValueSource, ResourceState } from '../../types/common';
import type { EditorState } from '../../store/types';

// ========== 校验结果类型 ==========

/** 
 * FSM 校验问题（保留原有类型定义以兼容现有代码）
 * 注：新代码建议使用 types.ts 中的通用 ValidationIssue
 */
export interface FsmValidationIssue {
  type: 'error' | 'warning';
  message: string;
  /** 引用的资源类型 */
  resourceType: 'script' | 'event' | 'variable' | 'graph';
  /** 引用的资源 ID */
  resourceId: string;
}

/** @deprecated 使用 FsmValidationIssue 或 types.ts 中的 ValidationIssue */
export type ValidationIssue = FsmValidationIssue;

/** 状态节点校验结果 */
export interface StateValidation {
  hasError: boolean;
  issues: FsmValidationIssue[];
}

/** 转移连线校验结果 */
export interface TransitionValidation {
  hasError: boolean;
  issues: FsmValidationIssue[];
}

// ========== 资源状态检查工具 ==========

/**
 * 检查脚本是否为已删除状态
 */
function isScriptMarkedForDelete(state: EditorState, scriptId: string | undefined): boolean {
  if (!scriptId) return false;
  const scripts = state.project.scripts?.scripts || {};
  const script = scripts[scriptId];
  return script?.state === 'MarkedForDelete';
}

/**
 * 检查事件是否为已删除状态
 */
function isEventMarkedForDelete(state: EditorState, eventId: string | undefined): boolean {
  if (!eventId) return false;
  const events = state.project.blackboard?.events || {};
  const event = events[eventId];
  return event?.state === 'MarkedForDelete';
}

/**
 * 检查变量是否为已删除状态
 * 需要根据作用域检查不同位置的变量
 */
function isVariableMarkedForDelete(
  state: EditorState,
  variableId: string | undefined,
  scope: string | undefined,
  nodeId?: string
): boolean {
  if (!variableId) return false;

  // 全局变量
  if (scope === 'Global') {
    const globalVars = state.project.blackboard?.globalVariables || {};
    const variable = globalVars[variableId];
    return variable?.state === 'MarkedForDelete';
  }

  // 节点局部变量
  if (scope === 'NodeLocal' && nodeId) {
    const node = state.project.nodes[nodeId];
    const variable = node?.localVariables?.[variableId];
    return variable?.state === 'MarkedForDelete';
  }

  // Stage 局部变量
  if (scope === 'StageLocal') {
    const stages = state.project.stageTree?.stages || {};
    for (const stage of Object.values(stages)) {
      const variable = stage.localVariables?.[variableId];
      if (variable) {
        return variable.state === 'MarkedForDelete';
      }
    }
  }

  return false;
}

/**
 * 检查演出图是否为已删除状态
 * 注：当前演出图没有软删除状态，返回 false
 */
function isGraphMarkedForDelete(state: EditorState, graphId: string | undefined): boolean {
  if (!graphId) return false;
  // 当前演出图没有 state 字段，暂时返回 false
  // 未来可扩展支持演出图的软删除
  return false;
}

// ========== 递归检查条件表达式 ==========

/**
 * 检查条件表达式中的资源引用
 */
function checkConditionExpression(
  condition: ConditionExpression | undefined,
  state: EditorState,
  nodeId: string,
  issues: ValidationIssue[]
): void {
  if (!condition) return;

  // 检查脚本引用
  if (condition.type === 'SCRIPT_REF' && condition.scriptId) {
    if (isScriptMarkedForDelete(state, condition.scriptId)) {
      issues.push({
        type: 'error',
        message: `Condition references deleted script: ${condition.scriptId}`,
        resourceType: 'script',
        resourceId: condition.scriptId
      });
    }
  }

  // 检查变量引用
  if (condition.type === 'VARIABLE_REF' && condition.variableId) {
    if (isVariableMarkedForDelete(state, condition.variableId, condition.variableScope, nodeId)) {
      issues.push({
        type: 'error',
        message: `Condition references deleted variable: ${condition.variableId}`,
        resourceType: 'variable',
        resourceId: condition.variableId
      });
    }
  }

  // 检查比较表达式的左右操作数
  if (condition.type === 'COMPARISON') {
    checkConditionExpression(condition.left, state, nodeId, issues);
    checkConditionExpression(condition.right, state, nodeId, issues);
  }

  // 递归检查逻辑组合的子节点
  if ((condition.type === 'AND' || condition.type === 'OR') && condition.children) {
    condition.children.forEach(child => checkConditionExpression(child, state, nodeId, issues));
  }

  // 检查 NOT 操作数
  if (condition.type === 'NOT' && condition.operand) {
    checkConditionExpression(condition.operand, state, nodeId, issues);
  }
}

// ========== 检查参数修改器 ==========

/**
 * 检查参数修改器中的变量引用
 */
function checkParameterModifiers(
  modifiers: ParameterModifier[] | undefined,
  state: EditorState,
  nodeId: string,
  issues: ValidationIssue[]
): void {
  if (!modifiers) return;

  modifiers.forEach(modifier => {
    // 检查目标变量
    if (isVariableMarkedForDelete(state, modifier.targetVariableId, modifier.targetScope, nodeId)) {
      issues.push({
        type: 'error',
        message: `Modifier targets deleted variable: ${modifier.targetVariableId}`,
        resourceType: 'variable',
        resourceId: modifier.targetVariableId
      });
    }

    // 检查来源变量（如果来源是变量引用）
    if (modifier.source?.type === 'VariableRef') {
      const source = modifier.source as { type: 'VariableRef'; variableId: string; scope: string };
      if (isVariableMarkedForDelete(state, source.variableId, source.scope, nodeId)) {
        issues.push({
          type: 'error',
          message: `Modifier source references deleted variable: ${source.variableId}`,
          resourceType: 'variable',
          resourceId: source.variableId
        });
      }
    }
  });
}

// ========== 检查事件监听器 ==========

/**
 * 检查事件监听器中的资源引用
 */
function checkEventListeners(
  listeners: EventListener[] | undefined,
  state: EditorState,
  nodeId: string,
  issues: ValidationIssue[]
): void {
  if (!listeners) return;

  listeners.forEach(listener => {
    // 检查事件引用
    if (isEventMarkedForDelete(state, listener.eventId)) {
      issues.push({
        type: 'error',
        message: `Listener references deleted event: ${listener.eventId}`,
        resourceType: 'event',
        resourceId: listener.eventId
      });
    }

    // InvokeScript 类型现在不再携带 scriptId，脚本引用来自对象的 lifecycleScriptId
    // 无需额外校验

    // 检查动作中的参数修改器（ModifyParameter）
    if (listener.action?.type === 'ModifyParameter') {
      checkParameterModifiers(listener.action.modifiers, state, nodeId, issues);
    }
  });
}

// ========== 检查演出绑定 ==========

/**
 * 检查演出绑定中的资源引用
 */
function checkPresentationBinding(
  binding: PresentationBinding | undefined,
  state: EditorState,
  nodeId: string,
  issues: ValidationIssue[]
): void {
  if (!binding) return;

  if (binding.type === 'Script' && binding.scriptId) {
    if (isScriptMarkedForDelete(state, binding.scriptId)) {
      issues.push({
        type: 'error',
        message: `Presentation references deleted script: ${binding.scriptId}`,
        resourceType: 'script',
        resourceId: binding.scriptId
      });
    }

    // 检查参数绑定中的变量引用
    binding.parameters?.forEach(param => {
      if (param.source?.type === 'VariableRef') {
        const source = param.source as { type: 'VariableRef'; variableId: string; scope: string };
        if (isVariableMarkedForDelete(state, source.variableId, source.scope, nodeId)) {
          issues.push({
            type: 'error',
            message: `Presentation parameter references deleted variable: ${source.variableId}`,
            resourceType: 'variable',
            resourceId: source.variableId
          });
        }
      }
    });
  }

  if (binding.type === 'Graph' && binding.graphId) {
    if (isGraphMarkedForDelete(state, binding.graphId)) {
      issues.push({
        type: 'error',
        message: `Presentation references deleted graph: ${binding.graphId}`,
        resourceType: 'graph',
        resourceId: binding.graphId
      });
    }
  }
}

// ========== 检查触发器 ==========

/**
 * 检查触发器中的资源引用
 */
function checkTriggers(
  triggers: TriggerConfig[] | undefined,
  state: EditorState,
  issues: ValidationIssue[]
): void {
  if (!triggers) return;

  triggers.forEach(trigger => {
    if (trigger.type === 'OnEvent') {
      const eventTrigger = trigger as { type: 'OnEvent'; eventId: string };
      if (isEventMarkedForDelete(state, eventTrigger.eventId)) {
        issues.push({
          type: 'error',
          message: `Trigger references deleted event: ${eventTrigger.eventId}`,
          resourceType: 'event',
          resourceId: eventTrigger.eventId
        });
      }
    }

    if (trigger.type === 'CustomScript') {
      const scriptTrigger = trigger as { type: 'CustomScript'; scriptId: string };
      if (isScriptMarkedForDelete(state, scriptTrigger.scriptId)) {
        issues.push({
          type: 'error',
          message: `Trigger references deleted script: ${scriptTrigger.scriptId}`,
          resourceType: 'script',
          resourceId: scriptTrigger.scriptId
        });
      }
    }
  });
}

// ========== 状态节点校验 ==========

/**
 * 检查状态节点中引用已删除资源的问题
 * @param stateNode 状态节点
 * @param editorState 编辑器状态
 * @param nodeId 所属 PuzzleNode ID（用于局部变量查找）
 */
export function checkStateValidation(
  stateNode: State,
  editorState: EditorState,
  nodeId: string
): StateValidation {
  const issues: ValidationIssue[] = [];

  // 检查生命周期脚本
  if (isScriptMarkedForDelete(editorState, stateNode.lifecycleScriptId)) {
    issues.push({
      type: 'error',
      message: `Lifecycle script is deleted: ${stateNode.lifecycleScriptId}`,
      resourceType: 'script',
      resourceId: stateNode.lifecycleScriptId!
    });
  }

  // 检查事件监听器
  checkEventListeners(stateNode.eventListeners, editorState, nodeId, issues);

  // 检查演出绑定
  checkPresentationBinding(stateNode.presentation, editorState, nodeId, issues);

  return {
    hasError: issues.length > 0,
    issues
  };
}

// ========== 转移连线校验 ==========

/**
 * 检查转移连线中引用已删除资源的问题
 * @param transition 转移连线
 * @param editorState 编辑器状态
 * @param nodeId 所属 PuzzleNode ID（用于局部变量查找）
 */
export function checkTransitionValidation(
  transition: Transition,
  editorState: EditorState,
  nodeId: string
): TransitionValidation {
  const issues: ValidationIssue[] = [];

  // 检查触发器
  checkTriggers(transition.triggers, editorState, issues);

  // 检查条件表达式
  checkConditionExpression(transition.condition, editorState, nodeId, issues);

  // 检查参数修改器
  checkParameterModifiers(transition.parameterModifiers, editorState, nodeId, issues);

  // 检查演出绑定
  checkPresentationBinding(transition.presentation, editorState, nodeId, issues);

  return {
    hasError: issues.length > 0,
    issues
  };
}

// ========== 批量校验 ==========

/**
 * 批量校验状态机中所有节点和连线
 * 返回校验结果映射表
 */
export function validateStateMachine(
  fsmId: string,
  editorState: EditorState,
  nodeId: string
): {
  states: Record<string, StateValidation>;
  transitions: Record<string, TransitionValidation>;
  hasInitialState: boolean;
} {
  const fsm = editorState.project.stateMachines[fsmId];
  if (!fsm) {
    return { states: {}, transitions: {}, hasInitialState: false };
  }

  const stateResults: Record<string, StateValidation> = {};
  const transitionResults: Record<string, TransitionValidation> = {};

  // 校验所有状态节点
  Object.values(fsm.states).forEach(state => {
    stateResults[state.id] = checkStateValidation(state, editorState, nodeId);
  });

  // 校验所有转移连线
  Object.values(fsm.transitions).forEach(trans => {
    transitionResults[trans.id] = checkTransitionValidation(trans, editorState, nodeId);
  });

  // 检查是否有初始状态
  const hasInitialState = !!fsm.initialStateId && !!fsm.states[fsm.initialStateId];

  return {
    states: stateResults,
    transitions: transitionResults,
    hasInitialState
  };
}
