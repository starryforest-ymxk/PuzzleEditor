
import { ID, Entity, Vector2 } from './common';

export type PresentationNodeType = 'ScriptCall' | 'Wait' | 'Branch' | 'Parallel';

export interface PresentationNode extends Entity {
  type: PresentationNodeType;
  position: Vector2;
  
  // 如果是 ScriptCall
  scriptId?: ID; // 引用 Manifest 中的定义
  parameters?: Record<string, any>; // 实参
  
  // 连线关系 (Presentation Graph 通常是线性的或简单分支)
  nextIds: ID[]; 
}

export interface PresentationGraph extends Entity {
  startNodeId: ID | null;
  nodes: Record<ID, PresentationNode>;
}
