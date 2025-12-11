/**
 * components/Inspector/ResourceSelect.tsx
 * Generic resource picker for scripts/events/variables
 * Features:
 * - Shows resource state (Draft/Implemented/MarkedForDelete)
 * - Warns on MarkedForDelete when enabled
 * - Optional extra label
 */

import React from 'react';
import { ResourceState } from '../../types/common';

export interface ResourceOption {
  id: string;
  name: string;
  state?: ResourceState;
  extraLabel?: string;
}

interface Props {
  options: ResourceOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  warnOnMarkedDelete?: boolean;
  disabled?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Resource picker dropdown for selecting blackboard-defined resources
 */
export const ResourceSelect: React.FC<Props> = ({
  options,
  value,
  onChange,
  placeholder = 'Select...',
  warnOnMarkedDelete = false,
  disabled = false,
  className,
  style
}) => {
  const selected = options.find(opt => opt.id === value);
  // 默认隐藏已标记删除的选项，若当前值已被标记则仅保留当前值以便提示
  const visibleOptions = options.filter(opt => opt.state !== 'MarkedForDelete' || opt.id === value);
  const isSelectedDeleted = selected?.state === 'MarkedForDelete';
  const optionStyle: React.CSSProperties = { padding: '6px 8px', height: 30, lineHeight: '18px' };

  return (
    <div style={{ flex: 1, ...(style || {}) }} className={className}>
      <select
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        style={{
          width: '100%',
          background: '#27272a',
          color: isSelectedDeleted ? '#ef4444' : '#e4e4e7',
          border: `1px solid ${isSelectedDeleted ? '#ef4444' : '#52525b'}`,
          padding: '4px 8px',
          fontSize: '12px',
          borderRadius: '4px',
          height: 30,
          boxSizing: 'border-box',
          lineHeight: '18px',
          outline: 'none',
          fontFamily: 'Inter, sans-serif'
        }}
      >
        <option value="" disabled hidden>{placeholder}</option>
        {visibleOptions.map(opt => {
          const isDeleted = opt.state === 'MarkedForDelete';
          return (
            <option
              key={opt.id}
              value={opt.id}
              style={{ ...optionStyle, color: isDeleted ? '#f66' : '#eee' }}
            >
              {opt.name}
              {opt.extraLabel ? ` ${opt.extraLabel}` : ''}
              {isDeleted ? ' [Marked for Delete]' : ''}
            </option>
          );
        })}
      </select>

      {/* Warning: selected a resource marked for delete */}
      {warnOnMarkedDelete && isSelectedDeleted && (
        <div style={{ color: '#f66', fontSize: '10px', marginTop: '4px' }}>
          ⚠ Resource is marked for delete. Please choose another.
        </div>
      )}
    </div>
  );
};
