/**
 * types/presentation.ts
 * 演出子图类型定义 - PresentationGraph 结构
 */

import {
  Entity,
  Vector2,
  ParameterBinding,
  PresentationGraphId,
  PresentationNodeId,
  ScriptId
} from './common';

// ========== 演出节点类型 ==========
export type PresentationNodeType = 'ScriptCall' | 'Wait' | 'Branch' | 'Parallel';

// ========== 演出节点 ==========
/**
 * 演出子图中的单个节点
 */
export interface PresentationNode extends Entity {
  id: PresentationNodeId;
  type: PresentationNodeType;
  position: Vector2;        // 画布坐标

  // ScriptCall 类型：绑定脚本
  scriptId?: ScriptId;
  parameters?: ParameterBinding[];

  // Wait 类型：等待时间
  duration?: number;

  // 连线关系（后继节点）
  nextIds: PresentationNodeId[];
}

// ========== 演出子图 ==========
/**
 * 演出子图，包含串行/分支节点序列
 */
export interface PresentationGraph extends Entity {
  id: PresentationGraphId;
  startNodeId: PresentationNodeId | null;
  nodes: Record<PresentationNodeId, PresentationNode>;
}
