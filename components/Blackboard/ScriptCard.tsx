/**
 * components/Blackboard/ScriptCard.tsx
 * 脚本卡片组件 - 用于显示单个脚本的信息
 */

import React from 'react';
import { ScriptDefinition } from '../../types/manifest';
import { ScriptCategory } from '../../types/common';
import { StateBadge } from './StateBadge';

// ========== 脚本类型颜色 ==========
const categoryColors: Record<ScriptCategory, string> = {
    Performance: '#c586c0',  // 紫色
    Lifecycle: '#4fc1ff',    // 蓝色
    Condition: '#dcdcaa',    // 黄色
    Trigger: '#ce9178'       // 橙色
};

// ========== 组件 Props ==========

interface ScriptCardProps {
    /** 脚本定义数据 */
    script: ScriptDefinition;
    /** 是否被选中 */
    isSelected: boolean;
    /** 点击卡片的回调 */
    onClick: () => void;
    /** 引用数量（可选） */
    referenceCount?: number;
}

// ========== 组件 ==========

/**
 * 脚本卡片组件
 * 显示脚本的名称、Key、分类和描述
 */
export const ScriptCard: React.FC<ScriptCardProps> = ({
    script,
    isSelected,
    onClick,
    referenceCount
}) => {
    const isDeleted = script.state === 'MarkedForDelete';
    const lifecycleSuffix = script.category === 'Lifecycle' && script.lifecycleType ? ` (${script.lifecycleType})` : '';
    const categoryColor = categoryColors[script.category] || '#c586c0';

    return (
        <div
            onClick={onClick}
            className={`overview-card ${isSelected ? 'selected' : ''}`}
            style={{
                opacity: isDeleted ? 0.5 : 1,
                cursor: 'pointer',
                marginBottom: '8px',
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

            {/* 分类和引用数量 */}
            <div style={{ fontSize: '11px', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                <div>
                    <span style={{ color: 'var(--text-secondary)' }}>Category: </span>
                    <span style={{ color: categoryColor }}>{script.category}{lifecycleSuffix}</span>
                </div>
                {referenceCount !== undefined && (
                    <div>
                        <span style={{ color: 'var(--text-secondary)' }}>Refs: </span>
                        <span style={{ color: referenceCount > 0 ? '#60a5fa' : 'var(--text-dim)' }}>
                            {referenceCount}
                        </span>
                    </div>
                )}
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
