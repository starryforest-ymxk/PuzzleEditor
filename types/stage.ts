
import { ID, Entity } from './common';

export interface StageNode extends Entity {
  parentId: ID | null;
  childrenIds: ID[]; // 显式存储子节点ID，维护树状结构
  
  // 逻辑钩子
  unlockConditionId?: ID; // 引用一个 Condition
  entryScriptIds: ID[]; // 进入该阶段时执行的脚本序列
  exitScriptIds: ID[]; // 退出该阶段时执行的脚本序列
  
  // 视图状态
  isExpanded?: boolean;
}

// 扁平化存储结构
export type StageTreeData = Record<ID, StageNode>;
