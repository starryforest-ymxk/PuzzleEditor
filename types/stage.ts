/**
 * types/stage.ts
 * 阶段树类型定义 - Stage 节点结构
 */

import {
  Entity,
  EventListener,
  PresentationBinding,
  StageId,
  VariableId,
  ScriptId
} from './common';
import { VariableDefinition } from './blackboard';
import { ConditionExpression, TriggerConfig } from './stateMachine';

// ========== 阶段节点 ==========
/**
 * 阶段树中的单个阶段节点
 */
export interface StageNode extends Entity {
  id: StageId;
  parentId: StageId | null;
  childrenIds: StageId[];      // 子阶段ID列表
  isInitial?: boolean;         // 是否为父节点下的初始阶段

  // 局部变量 (Stage Local)
  localVariables: Record<VariableId, VariableDefinition>;

  // 解锁触发器（可选，支持多个）
  unlockTriggers?: TriggerConfig[];

  // 解锁条件（可选）
  unlockCondition?: ConditionExpression;

  // 生命周期脚本
  lifecycleScriptId?: ScriptId;

  // 演出绑定
  onEnterPresentation?: PresentationBinding;
  onExitPresentation?: PresentationBinding;

  // 事件监听
  eventListeners: EventListener[];

  // 视图状态（UI 用）
  isExpanded?: boolean;
}

// ========== 阶段树数据结构 ==========
/**
 * 扁平化存储的阶段树
 */
export interface StageTreeData {
  rootId: StageId;
  stages: Record<StageId, StageNode>;
}
