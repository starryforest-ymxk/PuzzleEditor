/**
 * 资源生命周期与软删除状态机工具
 * - 定义 Draft → Implemented → MarkedForDelete 的有限状态机
 * - 提供删除动作的处理规则（Draft/MarkedForDelete 物理删除，Implemented 软删除）
 * - 提供状态更新的合法性校验，防止非法跳转
 */

import { ResourceState } from '../types/common';

// 允许的状态跳转表
const ALLOWED_TRANSITIONS: Record<ResourceState, ResourceState[]> = {
  Draft: ['Draft', 'Implemented', 'MarkedForDelete'],
  Implemented: ['Implemented', 'MarkedForDelete'],
  MarkedForDelete: ['MarkedForDelete']
};

export type DeleteResolution = {
  nextState: ResourceState;
  shouldRemove: boolean; // true 表示可直接物理删除
};

/**
 * 校验资源状态跳转是否合法
 */
export const canTransitionResourceState = (from: ResourceState, to: ResourceState): boolean => {
  const allowed = ALLOWED_TRANSITIONS[from] || [];
  return allowed.includes(to);
};

/**
 * 计算删除操作后的状态变化：
 * - Draft       -> 直接删除
 * - Implemented -> 标记删除（软删除）
 * - Marked      -> 直接删除（应用删除）
 */
export const resolveDeleteAction = (current: ResourceState): DeleteResolution => {
  if (current === 'Draft' || current === 'MarkedForDelete') {
    return { nextState: current, shouldRemove: true };
  }
  // Implemented -> 标记删除
  return { nextState: 'MarkedForDelete', shouldRemove: false };
};

/**
 * 合法化 state 变更：如果目标状态不被允许，则保持原状态
 */
export const normalizeResourceStateUpdate = (current: ResourceState, next?: ResourceState): ResourceState => {
  if (!next) return current;
  return canTransitionResourceState(current, next) ? next : current;
};
