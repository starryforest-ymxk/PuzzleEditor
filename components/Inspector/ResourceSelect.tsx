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
  key?: string;
  category?: string;
  description?: string;
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
  showDetails?: boolean;
  onClear?: () => void;
  height?: number; // New optional height prop
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
  style,
  showDetails = false,
  onClear,
  height = 30 // Default
}) => {
  const selected = options.find(opt => opt.id === value);
  // 默认隐藏已标记删除的选项，若当前值已被标记则仅保留当前值以便提示
  const visibleOptions = options.filter(opt => opt.state !== 'MarkedForDelete' || opt.id === value);
  const isSelectedDeleted = selected?.state === 'MarkedForDelete';
  const optionStyle: React.CSSProperties = { padding: '6px 8px', height: height, lineHeight: `${height * 0.6}px` };

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px', ...(style || {}) }} className={className}>
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
        <select
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          style={{
            flex: 1,
            width: '100%',
            minWidth: 0,
            background: '#27272a',
            color: isSelectedDeleted ? '#ef4444' : '#e4e4e7',
            border: `1px solid ${isSelectedDeleted ? '#ef4444' : '#52525b'}`,
            padding: '0 8px',
            fontSize: '12px',
            borderRadius: '4px',
            height: height,
            boxSizing: 'border-box',
            lineHeight: `${height - 2}px`,
            outline: 'none',
            fontFamily: 'Inter, sans-serif',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap'
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

        {onClear && value && (
          <button
            onClick={onClear}
            disabled={disabled}
            className="btn-ghost"
            style={{
              height: 30,
              padding: '0 8px',
              fontSize: '16px',
              lineHeight: '1',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#999'
            }}
            title="Clear selection"
          >
            ×
          </button>
        )}
      </div>

      {/* Script Details Card */}
      {showDetails && selected && (
        <ResourceDetailsCard resource={selected} />
      )}

      {/* Warning: selected a resource marked for delete */}
      {warnOnMarkedDelete && isSelectedDeleted && (
        <div style={{ color: '#f66', fontSize: '10px', marginTop: '4px' }}>
          ⚠ Resource is marked for delete. Please choose another.
        </div>
      )}
    </div>
  );
};

export const ResourceDetailsCard: React.FC<{ resource: ResourceOption }> = ({ resource }) => (
  <div style={{
    padding: '12px',
    background: '#222',
    border: '1px solid #3e3e42',
    borderRadius: '4px',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    fontSize: '12px',
    animation: 'fadeIn 0.2s ease-out',
    width: '100%',
    boxSizing: 'border-box'
  }}>
    {/* Header: Name + ID */}
    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
      <span style={{ fontWeight: 600, color: '#e4e4e7' }}>{resource.name}</span>
      <span style={{ fontSize: '10px', color: '#666', fontFamily: 'monospace' }}>{resource.id}</span>
    </div>

    {/* Grid: State */}
    <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '4px 8px', fontSize: '11px' }}>
      {resource.state && (
        <>
          <span style={{ color: '#888' }}>State:</span>
          <span style={{ color: resource.state === 'Implemented' ? '#4ec9b0' : '#ce9178' }}>
            {resource.state}
          </span>
        </>
      )}
    </div>

    {/* Description */}
    {resource.description && (
      <div style={{
        marginTop: '4px',
        paddingTop: '8px',
        borderTop: '1px solid #333',
        color: '#9ca3af',
        fontStyle: 'italic',
        lineHeight: 1.4
      }}>
        {resource.description}
      </div>
    )}
  </div>
);
