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
export const getStateColor = (state: ResourceState): { bg: string; color: string } => {
    switch (state) {
        case 'Draft':
            return { bg: 'rgba(249,115,22,0.15)', color: 'var(--accent-warning)' };
        case 'Implemented':
            return { bg: 'rgba(34,197,94,0.15)', color: 'var(--accent-success)' };
        case 'MarkedForDelete':
            return { bg: 'rgba(239,68,68,0.15)', color: 'var(--accent-error)' };
        default:
            return { bg: 'var(--panel-bg)', color: 'var(--text-secondary)' };
    }
};

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
        <span style={{
            fontSize: '9px',
            padding: '2px 6px',
            borderRadius: 'var(--radius-sm)',
            textTransform: 'uppercase',
            fontWeight: 600,
            background: styles.bg,
            color: styles.color,
            border: `1px solid ${styles.color}`,
            letterSpacing: '0.5px'
        }}>
            {state === 'MarkedForDelete' ? 'DELETED' : state.toUpperCase()}
        </span>
    );
};

export default StateBadge;
