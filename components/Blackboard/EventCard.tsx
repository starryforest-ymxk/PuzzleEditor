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
  referenceCount,
}) => {
  const isDeleted = event.state === 'MarkedForDelete';

  return (
    <div
      onClick={onClick}
      data-deleted={isDeleted}
      className={`overview-card ui-resource-card ${isSelected ? 'selected' : ''}`}
    >
      {/* 头部：图标 + 名称 + 状态徽章 */}
      <div className="ui-entity-heading">
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Zap size={14} style={{ color: 'var(--accent-warning)' }} />
          <span
            style={{
              fontWeight: 600,
              fontSize: '13px',
              color: 'var(--text-primary)',
            }}
          >
            {event.name}
          </span>
        </div>
        <StateBadge state={event.state} />
      </div>

      {/* Key 和引用数量 */}
      <div className="ui-id" style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
        <span>{event.id}</span>
        {referenceCount !== undefined && (
          <span
            style={{
              fontFamily: 'Inter, sans-serif',
              fontSize: '11px',
            }}
          >
            <span style={{ color: 'var(--text-secondary)' }}>Refs: </span>
            <span style={{ color: referenceCount > 0 ? '#60a5fa' : 'var(--text-dim)' }}>
              {referenceCount}
            </span>
          </span>
        )}
      </div>

      {/* 描述（可选） */}
      {event.description && (
        <div className="ui-description" style={{ marginTop: '8px' }}>
          {event.description}
        </div>
      )}
    </div>
  );
};

export default EventCard;
