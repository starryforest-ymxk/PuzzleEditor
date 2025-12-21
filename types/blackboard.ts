/**
 * types/blackboard.ts
 * 黑板相关类型定义 - 变量、脚本、事件的定义结构
 */

import {
  Entity,
  VariableType,
  VariableScope,
  ResourceState,
  VariableId,
  EventId
} from './common';

// ========== 变量定义 ==========
/**
 * 黑板变量定义
 * 可存在于 Global Blackboard、Stage Local 或 Node Local
 * 注意：ID 由系统生成，不可编辑
 */
export interface VariableDefinition extends Entity {
  id: VariableId;
  assetName?: string;        // 资产名（符合变量命名规则：字母/下划线开头，只含字母数字下划线）
  type: VariableType;
  value: any;           // 变量的当前值
  state: ResourceState;
  scope: VariableScope;      // 定义时的作用域
}

// ========== 事件定义 ==========
/**
 * 事件定义（纯字符串 ID 标识）
 * 用于触发状态转移或驱动监听器响应
 * 注意：ID 由系统生成，不可编辑
 */
export interface EventDefinition extends Entity {
  id: EventId;
  assetName?: string;        // 资产名（符合变量命名规则：字母/下划线开头，只含字母数字下划线）
  state: ResourceState;
}

// ========== 黑板数据结构 ==========
/**
 * 全局黑板数据，包含所有全局定义
 */
export interface BlackboardData {
  globalVariables: Record<VariableId, VariableDefinition>;
  events: Record<EventId, EventDefinition>;
  // 注意：脚本定义在 manifest.ts 中，因为它们还包含参数元数据
}

// ========== 带作用域的局部变量 ==========
/**
 * 带作用域信息的局部变量类型
 * 用于在 Blackboard 面板中显示 Stage/Node 级别的局部变量
 */
export interface LocalVarWithScope extends VariableDefinition {
  /** 作用域类型：Stage 或 Node */
  scopeType: 'Stage' | 'Node';
  /** 作用域名称（Stage/Node 的名称） */
  scopeName: string;
  /** 作用域 ID */
  scopeId: string;
}

