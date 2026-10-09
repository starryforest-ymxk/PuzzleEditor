import type { ParameterModifier, VariableType } from '../types/common';

/** 声明值与 Temporary 常量严格按类型存储，不在校验时隐式转换 false、0 或字符串。 */
export function variableValueMatches(type: VariableType, value: unknown): boolean {
  if (type === 'integer') return typeof value === 'number' && Number.isSafeInteger(value);
  if (type === 'float') return typeof value === 'number' && Number.isFinite(value);
  return typeof value === type;
}

/** UI 选项与离线校验共用转换规则，防止两种入口允许不同的参数运算。 */
export function modifierOperations(type?: VariableType): ParameterModifier['operation'][] {
  if (type === 'boolean') return ['Set', 'Toggle'];
  if (type === 'integer' || type === 'float')
    return ['Set', 'Add', 'Subtract', 'Multiply', 'Divide'];
  return ['Set'];
}

export function modifierSourceTypes(type?: VariableType): VariableType[] {
  if (type === 'boolean') return ['boolean'];
  if (type === 'integer' || type === 'float') return ['integer', 'float'];
  return ['string', 'integer', 'float', 'boolean'];
}

/** JSON 常量仅接受四种标量；数值可按编辑器现有规则在 integer/float 间使用。 */
export function constantVariableType(value: unknown): VariableType | undefined {
  if (typeof value === 'boolean' || typeof value === 'string')
    return typeof value as 'boolean' | 'string';
  if (typeof value === 'number' && Number.isFinite(value))
    return Number.isInteger(value) ? 'integer' : 'float';
  return undefined;
}
