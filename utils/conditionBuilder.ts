/**
 * 条件与参数修改器的抽象模型辅助函数
 * - 提供标准化的 ConditionExpression 构造
 * - 为参数修改器提供默认模板
 */
import { ConditionExpression, TriggerConfig } from '../types/stateMachine';
import { ParameterModifier, VariableScope } from '../types/common';

// ===== ConditionExpression Builders =====

/** 构造布尔字面量 */
export const literalTrue = (): ConditionExpression => ({ type: 'LITERAL', value: true });
export const literalFalse = (): ConditionExpression => ({ type: 'LITERAL', value: false });

/** 构造变量引用节点 */
export const variableRef = (variableId: string, variableScope: VariableScope): ConditionExpression => ({
  type: 'VARIABLE_REF',
  variableId,
  variableScope
});

/** 构造比较表达式，默认右值为 true */
export const comparison = (
  left: ConditionExpression,
  operator: ConditionExpression['operator'] = '==',
  right: ConditionExpression = literalTrue()
): ConditionExpression => ({
  type: 'COMPARISON',
  operator,
  left,
  right
});

/** 构造逻辑与/或 */
export const logicalAnd = (children: ConditionExpression[]): ConditionExpression => ({
  type: 'AND',
  children
});
export const logicalOr = (children: ConditionExpression[]): ConditionExpression => ({
  type: 'OR',
  children
});

/** 构造取反 */
export const logicalNot = (operand: ConditionExpression): ConditionExpression => ({
  type: 'NOT',
  operand
});

/** 构造自定义条件脚本引用 */
export const scriptCondition = (scriptId: string): ConditionExpression => ({
  type: 'SCRIPT_REF',
  scriptId
});

// ===== ParameterModifier Builders =====

export const setToConstant = (
  targetVariableId: string,
  targetScope: VariableScope,
  value: any
): ParameterModifier => ({
  targetVariableId,
  targetScope,
  operation: 'Set',
  source: { type: 'Constant', value }
});

export const copyFromVariable = (
  targetVariableId: string,
  targetScope: VariableScope,
  sourceVariableId: string,
  sourceScope: VariableScope
): ParameterModifier => ({
  targetVariableId,
  targetScope,
  operation: 'CopyFromVar',
  source: { type: 'VariableRef', variableId: sourceVariableId, scope: sourceScope }
});

export const addFromVariable = (
  targetVariableId: string,
  targetScope: VariableScope,
  sourceVariableId: string,
  sourceScope: VariableScope
): ParameterModifier => ({
  targetVariableId,
  targetScope,
  operation: 'Add',
  source: { type: 'VariableRef', variableId: sourceVariableId, scope: sourceScope }
});

export const addConstant = (
  targetVariableId: string,
  targetScope: VariableScope,
  value: number
): ParameterModifier => ({
  targetVariableId,
  targetScope,
  operation: 'Add',
  source: { type: 'Constant', value }
});

export const subtractConstant = (
  targetVariableId: string,
  targetScope: VariableScope,
  value: number
): ParameterModifier => ({
  targetVariableId,
  targetScope,
  operation: 'Subtract',
  source: { type: 'Constant', value }
});

// ===== Trigger helpers（方便 UI 填充默认触发器） =====
export const alwaysTrigger = (): TriggerConfig => ({ type: 'Always' });
export const onEventTrigger = (eventId: string): TriggerConfig => ({ type: 'OnEvent', eventId });
export const customTrigger = (scriptId: string): TriggerConfig => ({ type: 'CustomScript', scriptId });
