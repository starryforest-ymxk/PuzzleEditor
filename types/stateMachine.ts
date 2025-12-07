
import { ID, Entity, Vector2, Side } from './common';

export interface State extends Entity {
  position: Vector2; // 画布坐标
  
  // 状态内的行为
  onEnterScriptIds: ID[];
  onExitScriptIds: ID[];
  onUpdateScriptIds: ID[];
  
  transitionIds: ID[]; // 从该状态出发的连线
}

export interface Transition extends Entity {
  fromStateId: ID;
  toStateId: ID;
  
  // 明确记录连线的端口位置
  fromSide?: Side;
  toSide?: Side;
  
  condition: ConditionExpression; // 转移条件
  priority: number; // 优先级
  triggerId?: ID;
}

// 条件表达式结构 (简易版 AST)
export interface ConditionExpression {
  type: 'AND' | 'OR' | 'NOT' | 'COMPARISON' | 'LITERAL' | 'VARIABLE_REF';
  operator?: '==' | '!=' | '>' | '<' | '>=' | '<=';
  left?: ConditionExpression;
  right?: ConditionExpression;
  value?: any; // for literal
  variableId?: ID; // for variable ref
}

export interface StateMachine {
  id: ID;
  states: Record<ID, State>;
  transitions: Record<ID, Transition>;
  initialStateId: ID | null;
}