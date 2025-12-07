
import { ID, Entity } from './common';

export type VariableType = 'boolean' | 'integer' | 'float' | 'string';

export interface BlackboardVariable extends Entity {
  type: VariableType;
  defaultValue: any;
  currentValue?: any; // 运行时或调试时使用
  isGlobal: boolean; // 区分全局黑板变量还是节点局部变量
}

export type BlackboardDefinition = Record<ID, BlackboardVariable>;
