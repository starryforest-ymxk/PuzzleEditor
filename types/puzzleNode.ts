
import { ID, Entity } from './common';
import { BlackboardVariable } from './blackboard';

export interface PuzzleNode extends Entity {
  stageId: ID; // 所属 Stage
  
  // 核心逻辑组件
  stateMachineId: ID; // 关联的状态机 ID
  
  // 演出流组件 (一个节点可能有多个演出片段，如 "PlayCutscene_A", "ResetAnimation")
  presentationGraphIds: ID[]; 
  
  // 局部变量/参数
  localBlackboard: Record<ID, BlackboardVariable>;
}
