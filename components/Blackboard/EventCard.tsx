/**
 * components/Blackboard/EventCard.tsx
 * 事件卡片组件 - 用于显示单个事件的信息
 */

import React from 'react';
import { Zap } from 'lucide-react';
import { EventDefinition } from '../../types/blackboard';
import { StateBadge } from './StateBadge';

// ========== 组件 Props ==========

interface EventCardProps {
    /** 事件定义数据 */
    event: EventDefinition;
    /** 是否被选中 */
    isSelected: boolean;
    /** 点击卡片的回调 */
    onClick: () => void;
    /** 引用数量（可选） */
    referenceCount?: number;
}

// ========== 组件 ==========

/**
 * 事件卡片组件
 * 显示事件的名称、Key 和描述，带闪电图标
 */
export const EventCard: React.FC<EventCardProps> = ({
    event,
    isSelected,
    onClick,
    referenceCount
}) => {
    const isDeleted = event.state === 'MarkedForDelete';

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
            {/* 头部：图标 + 名称 + 状态徽章 */}
            <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                marginBottom: '8px'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Zap size={14} style={{ color: 'var(--accent-warning)' }} />
                    <span style={{
                        fontWeight: 600,
                        fontSize: '13px',
                        color: 'var(--text-primary)'
                    }}>
                        {event.name}
                    </span>
                </div>
                <StateBadge state={event.state} />
            </div>

            {/* Key 和引用数量 */}
            <div style={{
                fontSize: '10px',
                color: 'var(--text-dim)',
                fontFamily: 'monospace',
                display: 'flex',
                gap: '12px',
                alignItems: 'center'
            }}>
                <span>{event.key}</span>
                {referenceCount !== undefined && (
                    <span style={{
                        fontFamily: 'Inter, sans-serif',
                        fontSize: '11px'
                    }}>
                        <span style={{ color: 'var(--text-secondary)' }}>Refs: </span>
                        <span style={{ color: referenceCount > 0 ? '#60a5fa' : 'var(--text-dim)' }}>
                            {referenceCount}
                        </span>
                    </span>
                )}
            </div>

            {/* 描述（可选） */}
            {event.description && (
                <div style={{
                    marginTop: '8px',
                    fontSize: '11px',
                    color: 'var(--text-secondary)',
                    fontStyle: 'italic'
                }}>
                    {event.description}
                </div>
            )}
        </div>
    );
};

export default EventCard;
