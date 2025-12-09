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
  disabled = false
}) => {
  const selected = options.find(opt => opt.id === value);
  const isSelectedDeleted = selected?.state === 'MarkedForDelete';

  return (
    <div style={{ flex: 1 }}>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        style={{
          width: '100%',
          background: '#222',
          color: isSelectedDeleted ? '#f66' : '#eee',
          border: `1px solid ${isSelectedDeleted ? '#f66' : '#444'}`,
          padding: '4px 8px',
          fontSize: '11px',
          borderRadius: '3px'
        }}
      >
        <option value="">{placeholder}</option>
        {options.map(opt => {
          const isDeleted = opt.state === 'MarkedForDelete';
          return (
            <option
              key={opt.id}
              value={opt.id}
              style={{ color: isDeleted ? '#f66' : '#eee' }}
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
