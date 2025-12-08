/**
 * types/puzzleNode.ts
 * 关卡节点类型定义 - PuzzleNode 实体结构
 */

import {
  Entity,
  EventListener,
  StageId,
  StateMachineId,
  PuzzleNodeId,
  VariableId,
  ScriptId
} from './common';
import { VariableDefinition } from './blackboard';

// ========== 解谜节点 ==========
/**
 * 解谜节点实体，承载在 Stage 中
 * 包含内部状态机和局部变量
 */
export interface PuzzleNode extends Entity {
  id: PuzzleNodeId;
  stageId: StageId;              // 所属 Stage

  // 核心逻辑组件
  stateMachineId: StateMachineId;       // 关联的状态机 ID

  // 局部变量 (Node Local)
  localVariables: Record<VariableId, VariableDefinition>;

  // 生命周期脚本
  onCreateScriptId?: ScriptId;    // 节点创建时执行
  onDestroyScriptId?: ScriptId;   // 节点销毁时执行

  // 事件监听
  eventListeners: EventListener[];
}
