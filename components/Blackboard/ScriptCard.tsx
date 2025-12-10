/**
 * components/Blackboard/ScriptCard.tsx
 * 脚本卡片组件 - 用于显示单个脚本的信息
 */

import React from 'react';
import { ScriptDefinition } from '../../types/manifest';
import { StateBadge } from './StateBadge';

// ========== 组件 Props ==========

interface ScriptCardProps {
    /** 脚本定义数据 */
    script: ScriptDefinition;
    /** 是否被选中 */
    isSelected: boolean;
    /** 点击卡片的回调 */
    onClick: () => void;
}

// ========== 组件 ==========

/**
 * 脚本卡片组件
 * 显示脚本的名称、Key、分类和描述
 */
export const ScriptCard: React.FC<ScriptCardProps> = ({
    script,
    isSelected,
    onClick
}) => {
    const isDeleted = script.state === 'MarkedForDelete';

    return (
        <div
            onClick={onClick}
            className={`overview-card ${isSelected ? 'selected' : ''}`}
            style={{
                opacity: isDeleted ? 0.5 : 1,
                cursor: 'pointer',
                marginBottom: '8px',
                height: 'auto',
                padding: '12px'
            }}
        >
            {/* 头部：名称 + 状态徽章 */}
            <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                marginBottom: '8px'
            }}>
                <span style={{
                    fontWeight: 600,
                    fontSize: '13px',
                    color: 'var(--text-primary)'
                }}>
                    {script.name}
                </span>
                <StateBadge state={script.state} />
            </div>

            {/* Key */}
            <div style={{
                fontSize: '10px',
                color: 'var(--text-dim)',
                fontFamily: 'monospace',
                marginBottom: '6px'
            }}>
                {script.key}
            </div>

            {/* 分类 */}
            <div style={{ fontSize: '11px' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Category: </span>
                <span style={{ color: 'var(--accent-color)' }}>{script.category}</span>
            </div>

            {/* 描述（可选） */}
            {script.description && (
                <div style={{
                    marginTop: '8px',
                    fontSize: '11px',
                    color: 'var(--text-secondary)',
                    fontStyle: 'italic'
                }}>
                    {script.description}
                </div>
            )}
        </div>
    );
};

export default ScriptCard;
