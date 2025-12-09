/**
 * components/Inspector/PresentationBindingEditor.tsx
 * Presentation binding editor - select performance script or presentation graph
 * Types:
 * - None
 * - Script
 * - Graph
 */

import React from 'react';
import { PresentationBinding, ValueSource } from '../../types/common';
import { ScriptDefinition } from '../../types/manifest';
import { VariableDefinition } from '../../types/blackboard';
import { ResourceSelect, ResourceOption } from './ResourceSelect';

interface Props {
  binding?: PresentationBinding;
  onChange: (binding?: PresentationBinding) => void;
  scriptDefs: Record<string, ScriptDefinition>;
  scriptOptions: ResourceOption[];
  graphOptions: ResourceOption[];
  variables: VariableDefinition[];
  title?: string;
}

/**
 * Presentation binding editor component
 */
export const PresentationBindingEditor: React.FC<Props> = ({
  binding,
  onChange,
  scriptDefs,
  scriptOptions,
  graphOptions,
  variables,
  title
}) => {
  const currentType = binding?.type || 'None';

  // Handle type switch
  const handleTypeChange = (type: string) => {
    if (type === 'None') {
      onChange(undefined);
    } else if (type === 'Script') {
      onChange({ type: 'Script', scriptId: '', parameters: [] });
    } else if (type === 'Graph') {
      onChange({ type: 'Graph', graphId: '' });
    }
  };

  // Render script picker
  const renderScript = () => {
    if (binding?.type !== 'Script') return null;

    return (
      <div style={{ marginTop: '8px' }}>
        <ResourceSelect
          options={scriptOptions}
          value={binding.scriptId || ''}
          onChange={(val) => onChange({ ...binding, scriptId: val })}
          placeholder="Select performance script"
          warnOnMarkedDelete
        />
      </div>
    );
  };

  // Render graph picker
  const renderGraph = () => {
    if (binding?.type !== 'Graph') return null;

    return (
      <div style={{ marginTop: '8px' }}>
        <ResourceSelect
          options={graphOptions}
          value={binding.graphId || ''}
          onChange={(val) => onChange({ type: 'Graph', graphId: val })}
          placeholder="Select presentation graph"
          warnOnMarkedDelete
        />
      </div>
    );
  };

  return (
    <div style={{ padding: '8px', background: '#1e1e1e', borderRadius: '4px' }}>
      {title && (
        <div style={{ fontSize: '11px', color: '#888', marginBottom: '8px' }}>{title}</div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span style={{ fontSize: '11px', color: '#aaa' }}>Type:</span>
        <select
          value={currentType}
          onChange={(e) => handleTypeChange(e.target.value)}
          style={{
            background: '#222',
            color: '#eee',
            border: '1px solid #444',
            padding: '4px 8px',
            fontSize: '12px',
            borderRadius: '3px'
          }}
        >
          <option value="None">None</option>
          <option value="Script">Script</option>
          <option value="Graph">Graph</option>
        </select>
      </div>

      {renderScript()}
      {renderGraph()}
    </div>
  );
};
