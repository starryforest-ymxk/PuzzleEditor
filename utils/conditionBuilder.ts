/**
 * 条件与参数修改器的抽象模型辅助函数
 * - 统一 ConditionExpression 的构造与判定
 * - 为参数修改器提供默认模板
 */
import { ConditionExpression, TriggerConfig } from '../types/stateMachine';
import { ParameterModifier, VariableScope } from '../types/common';

// ===== ConditionExpression Builders =====

// ===== ConditionExpression Builders =====

/** 构造布尔字面量（仅支持 boolean） */
// ===== ConditionExpression Builders =====

/** 构造布尔字面量（仅支持 boolean） */
export const literalTrue = (): ConditionExpression => ({ type: 'Literal', value: true });
export const literalFalse = (): ConditionExpression => ({ type: 'Literal', value: false });

/** 
 * 构造比较表达式
 * 左右操作数现在直接使用 ValueSource
 */
export const comparison = (
  left: ConditionExpression['left'] = { type: 'VariableRef', variableId: '', scope: 'NodeLocal' },
  operator: ConditionExpression['operator'] = '==',
  right: ConditionExpression['right'] = { type: 'Constant', value: '' }
): ConditionExpression => ({
  type: 'Comparison',
  operator,
  left,
  right
});

/** 构造逻辑与/或 */
export const logicalAnd = (children: ConditionExpression[]): ConditionExpression => ({
  type: 'And',
  children
});
export const logicalOr = (children: ConditionExpression[]): ConditionExpression => ({
  type: 'Or',
  children
});

/** 构造取反 */
export const logicalNot = (operand: ConditionExpression): ConditionExpression => ({
  type: 'Not',
  operand
});

/** 构造自定义条件脚本引用 */
export const scriptCondition = (scriptId: string): ConditionExpression => ({
  type: 'ScriptRef',
  scriptId
});

// ===== Condition Builder Helpers =====

/** 判断是否为逻辑组类型（可包含子条件） */
export const isGroupType = (type: ConditionExpression['type']): boolean =>
  type === 'And' || type === 'Or' || type === 'Not';

/** 判断是否为叶子条件类型（不可包含子条件） */
export const isLeafType = (type: ConditionExpression['type']): boolean =>
  type === 'Comparison' || type === 'ScriptRef' || type === 'Literal';

/** 创建一个空的逻辑组 */
export const createGroup = (type: 'And' | 'Or' | 'Not' = 'And'): ConditionExpression => {
  // not  组仅允许 1 个子节点，初始时 operand 置为 undefined
  if (type === 'Not') {
    return { type: 'Not', operand: undefined };
  }
  return { type, children: [] };
};

/** 创建一个默认的比较条件 */
export const createComparison = (): ConditionExpression => ({
  type: 'Comparison',
  operator: '==',
  left: { type: 'VariableRef', variableId: '', scope: 'NodeLocal' },
  right: { type: 'Constant', value: '' }
});

/** 创建一个脚本条件引用 */
export const createScriptRef = (): ConditionExpression => ({
  type: 'ScriptRef',
  scriptId: ''
});

/** 获取组内子条件数量 */
export const getChildCount = (condition: ConditionExpression): number => {
  if (condition.type === 'Not') {
    return condition.operand ? 1 : 0;
  }
  if (condition.type === 'And' || condition.type === 'Or') {
    return condition.children?.length || 0;
  }
  return 0;
};

/** 判断是否可以向组内添加子条件（NOT 组最多 1 个） */
export const canAddChild = (condition: ConditionExpression): boolean => {
  if (condition.type === 'Not') {
    return !condition.operand;
  }
  if (condition.type === 'And' || condition.type === 'Or') {
    return true; // And/Or 可无限添加
  }
  return false; // 非组类型不可添加
};

/** 获取组的子条件数组（统一接口） */
export const getChildren = (condition: ConditionExpression): ConditionExpression[] => {
  if (condition.type === 'Not') {
    return condition.operand ? [condition.operand] : [];
  }
  if (condition.type === 'And' || condition.type === 'Or') {
    return condition.children || [];
  }
  return [];
};

/** 设定组的子条件（统一接口） */
export const setChildren = (condition: ConditionExpression, children: ConditionExpression[]): ConditionExpression => {
  if (condition.type === 'Not') {
    // 仅取第一个子节点，其余忽略
    return { ...condition, operand: children[0] };
  }
  if (condition.type === 'And' || condition.type === 'Or') {
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
