/**
 * types/presentation.ts
 * 演出子图类型定义 - PresentationGraph 结构
 */

import { Entity, Vector2, PresentationGraphId, PresentationNodeId, Side, PresentationBinding } from './common';
import { ConditionExpression } from './stateMachine';

// ========== 演出节点类型 ==========
export type PresentationNodeType = 'PresentationNode' | 'Wait' | 'Branch' | 'Parallel';

// ========== 演出节点 ==========
/**
 * 演出子图中的单个节点
 */
export interface PresentationNode extends Entity {
  id: PresentationNodeId;
  type: PresentationNodeType;
  position: Vector2;        // 画布坐标

  // 统一演出绑定结构（脚本或子图）
  presentation?: PresentationBinding;

  // Wait 类型：等待时间
  duration?: number;

  // 连线关系（后继节点）
  nextIds: PresentationNodeId[];

  // Branch 类型：分支条件
  condition?: ConditionExpression;
}

// ========== 边属性（用于存储连线端点方向） ==========
/**
 * 演出图边的视觉属性
 * 存储连线的起点/终点方向，实现与 FSM 一致的边端点拖拽功能
 */
export interface PresentationEdgeProperties {
  /** 起点方向 */
  fromSide?: Side;
  /** 终点方向 */
  toSide?: Side;
}

// ========== 演出子图 ==========
/**
 * 演出子图，包含串行/分支节点序列
 */
export interface PresentationGraph extends Entity {
  id: PresentationGraphId;
  startNodeId: PresentationNodeId | null;
  nodes: Record<PresentationNodeId, PresentationNode>;

  /**
   * 边的视觉属性存储
   * key 格式: "fromNodeId->toNodeId"
   * 用于存储连线的 fromSide/toSide，实现与 FSM 一致的端点拖拽
   */
  edgeProperties?: Record<string, PresentationEdgeProperties>;

  displayOrder?: number;  // 显示顺序（用于黑板拖拽排序）
}

