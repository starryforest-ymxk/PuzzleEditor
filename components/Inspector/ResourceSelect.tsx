import { InspectorError } from './InspectorInfo';
import { ResourcePreview } from '../shared/ResourcePreview';
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
import { filterActiveOrSelected } from '../../utils/resourceFilters';

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
  height = 30, // Default
}) => {
  const selected = options.find((opt) => opt.id === value);
  // 默认隐藏已标记删除的选项，若当前值已被标记则仅保留当前值以便提示
  const visibleOptions = filterActiveOrSelected<ResourceOption>(options, value);
  const isSelectedDeleted = selected?.state === 'MarkedForDelete';
  const optionStyle: React.CSSProperties = {
    padding: '6px 8px',
    height: height,
    lineHeight: `${height * 0.6}px`,
  };

  return (
    <div
      style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px', ...(style || {}) }}
      className={className}
    >
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
        <select
          data-invalid={isSelectedDeleted}
          className="ui-control"
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          style={{
            flex: 1,
            width: '100%',
            minWidth: 0,
            height: height,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          <option value="" disabled hidden>
            {placeholder}
          </option>
          {visibleOptions.map((opt) => {
            const isDeleted = opt.state === 'MarkedForDelete';
            return (
              <option
                key={opt.id}
                value={opt.id}
                style={{
                  ...optionStyle,
                  color: isDeleted ? 'var(--accent-error)' : 'var(--text-primary)',
                }}
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
              color: '#999',
            }}
            title="Clear selection"
          >
            ×
          </button>
        )}
      </div>

      {/* Script Details Card */}
      {showDetails && selected && <ResourceDetailsCard resource={selected} />}

      {/* Warning: selected a resource marked for delete */}
      {warnOnMarkedDelete && isSelectedDeleted && (
        <InspectorError
          style={{ marginTop: 4 }}
          message="Resource is marked for delete. Please choose another."
        />
      )}
    </div>
  );
};

// 兼容已有调用接口，预览布局只在 ResourcePreview 维护。
export const ResourceDetailsCard: React.FC<{ resource: ResourceOption }> = ({ resource }) => (
  <ResourcePreview
    name={resource.name}
    id={resource.id}
    state={resource.state}
    description={resource.description}
  />
);
