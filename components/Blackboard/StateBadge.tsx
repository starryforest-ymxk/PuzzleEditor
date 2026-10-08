import { Badge } from '../shared/Badge';
import { resourceStateColor as getStateColor } from '../shared/uiTokens';
/**
 * components/Blackboard/StateBadge.tsx
 * 资源状态徽章组件 - 用于显示 Draft/Implemented/MarkedForDelete 状态
 */

import React from 'react';
import { ResourceState } from '../../types/common';

// ========== 工具函数 ==========

/**
 * 根据资源状态返回对应的颜色配置
 */
export { resourceStateColor as getStateColor } from '../shared/uiTokens';

// ========== 组件 Props ==========

interface StateBadgeProps {
  state: ResourceState;
}

// ========== 组件 ==========

/**
 * 状态徽章组件
 * 用于显示资源的当前状态（Draft/Implemented/MarkedForDelete）
 */
export const StateBadge: React.FC<StateBadgeProps> = ({ state }) => {
  const styles = getStateColor(state);

  return (
    <Badge
      text={state === 'MarkedForDelete' ? 'DELETED' : state.toUpperCase()}
      color={styles.color}
      background={styles.bg}
      compact
    />
  );
};

export default StateBadge;
