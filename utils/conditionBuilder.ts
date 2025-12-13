/**
 * 条件与参数修改器的抽象模型辅助函数
 * - 统一 ConditionExpression 的构造与判定
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

/** 构造比较表达式，默认右值为空字符串避免自动填充 0 */
export const comparison = (
  left: ConditionExpression,
  operator: ConditionExpression['operator'] = '==',
  right: ConditionExpression = { type: 'LITERAL', value: '' }
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

// ===== Condition Builder Helpers =====

/** 判断是否为逻辑组类型（可包含子条件） */
export const isGroupType = (type: ConditionExpression['type']): boolean =>
  type === 'AND' || type === 'OR' || type === 'NOT';

/** 判断是否为叶子条件类型（不可包含子条件） */
export const isLeafType = (type: ConditionExpression['type']): boolean =>
  type === 'COMPARISON' || type === 'VARIABLE_REF' || type === 'SCRIPT_REF' || type === 'LITERAL';

/** 创建一个空的逻辑组 */
export const createGroup = (type: 'AND' | 'OR' | 'NOT' = 'AND'): ConditionExpression => {
  // NOT 组仅允许 1 个子节点，初始时 operand 置为 undefined
  if (type === 'NOT') {
    return { type: 'NOT', operand: undefined };
  }
  return { type, children: [] };
};

/** 创建一个默认的比较条件 */
export const createComparison = (): ConditionExpression => ({
  type: 'COMPARISON',
  operator: '==',
  left: { type: 'VARIABLE_REF', variableId: '', variableScope: 'NodeLocal' as VariableScope },
  right: { type: 'LITERAL', value: '' }
});

/** 创建一个脚本条件引用 */
export const createScriptRef = (): ConditionExpression => ({
  type: 'SCRIPT_REF',
  scriptId: ''
});

/** 获取组内子条件数量 */
export const getChildCount = (condition: ConditionExpression): number => {
  if (condition.type === 'NOT') {
    return condition.operand ? 1 : 0;
  }
  if (condition.type === 'AND' || condition.type === 'OR') {
    return condition.children?.length || 0;
  }
  return 0;
};

/** 判断是否可以向组内添加子条件（NOT 组最多 1 个） */
export const canAddChild = (condition: ConditionExpression): boolean => {
  if (condition.type === 'NOT') {
    return !condition.operand;
  }
  if (condition.type === 'AND' || condition.type === 'OR') {
    return true; // AND/OR 可无限添加
  }
  return false; // 非组类型不可添加
};

/** 获取组的子条件数组（统一接口） */
export const getChildren = (condition: ConditionExpression): ConditionExpression[] => {
  if (condition.type === 'NOT') {
    return condition.operand ? [condition.operand] : [];
  }
  if (condition.type === 'AND' || condition.type === 'OR') {
    return condition.children || [];
  }
  return [];
};

/** 设定组的子条件（统一接口） */
export const setChildren = (condition: ConditionExpression, children: ConditionExpression[]): ConditionExpression => {
  if (condition.type === 'NOT') {
    // 仅取第一个子节点，其余忽略
    return { ...condition, operand: children[0] };
  }
  if (condition.type === 'AND' || condition.type === 'OR') {
    return { ...condition, children };
  }
  return condition;
};

/** 判断组是否为空（未配置子条件） */
export const isEmptyGroup = (condition: ConditionExpression): boolean => {
  if (!isGroupType(condition.type)) return false;
  return getChildCount(condition) === 0;
};

// ===== Trigger helpers（方便 UI 填充默认触发器） =====
export const alwaysTrigger = (): TriggerConfig => ({ type: 'Always' });
export const onEventTrigger = (eventId: string): TriggerConfig => ({ type: 'OnEvent', eventId });
export const customTrigger = (scriptId: string): TriggerConfig => ({ type: 'CustomScript', scriptId });
