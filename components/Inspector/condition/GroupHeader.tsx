import React from 'react';
import type { ConditionExpression } from '../../../types/stateMachine';
import { LogicModeButton } from './LogicModeButton';

interface GroupHeaderProps {
  groupType: 'And' | 'Or' | 'Not';
  childCount: number;
  collapsed: boolean;
  depth: number;
  onChange?: (condition: ConditionExpression | undefined) => void;
  onRemove?: () => void;
  onDragStart?: (e: React.DragEvent) => void;
  onDragEnd?: () => void;
  onCollapsedChange: (collapsed: boolean) => void;
  onModeChange: (mode: 'And' | 'Or' | 'Not') => void;
  onDeleteClick: () => void;
}
/** 组头只显示折叠、逻辑模式和删除意图，不持有条件树。 */
export function GroupHeader({
  groupType,
  childCount,
  collapsed,
  depth,
  onChange,
  onRemove,
  onDragStart,
  onDragEnd,
  onCollapsedChange,
  onModeChange,
  onDeleteClick,
}: GroupHeaderProps) {
  return (
    <div
      className={`condition-group-header ${collapsed ? 'condition-group-header-collapsed' : ''}`}
    >
      <button
        className="condition-collapse"
        aria-label={collapsed ? 'Expand group' : 'Collapse group'}
        onClick={() => onCollapsedChange(!collapsed)}
      >
        <span
          className={`condition-collapse-arrow ${collapsed ? 'condition-collapse-arrow-collapsed' : ''}`}
        >
          ▼
        </span>
      </button>
      {depth > 0 && (
        <span
          className="condition-group-drag"
          draggable={!!onDragStart}
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
        >
          ⋮⋮
        </span>
      )}
      <div className="condition-group-modes">
        {(['And', 'Or', 'Not'] as const).map((mode) => (
          <LogicModeButton
            key={mode}
            mode={mode}
            label={mode}
            isActive={groupType === mode}
            onClick={() => onModeChange(mode)}
            disabled={!onChange}
          />
        ))}
      </div>
      <span className="condition-group-count">({childCount})</span>
      {(onChange || onRemove) && (
        <button title="Delete Group" className="condition-group-delete" onClick={onDeleteClick}>
          🗑
        </button>
      )}
    </div>
  );
}
