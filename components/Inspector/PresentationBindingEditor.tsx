/**
 * components/Inspector/PresentationBindingEditor.tsx
 * Presentation binding editor - select performance script or presentation graph
 * Types:
 * - None
 * - Script (with parameter bindings via PresentationParamEditor)
 * - Graph
 */

import React, { useMemo } from 'react';
import { PresentationBinding, ValueSource, ParameterBinding } from '../../types/common';
import { ScriptDefinition } from '../../types/manifest';
import { VariableDefinition } from '../../types/blackboard';
import { ResourceSelect, ResourceOption } from './ResourceSelect';
import { PresentationParamEditor } from './PresentationParamEditor';

interface Props {
  binding?: PresentationBinding;
  onChange: (binding?: PresentationBinding) => void;
  scriptDefs: Record<string, ScriptDefinition>;
  scriptOptions: ResourceOption[];
  graphOptions: ResourceOption[];
  variables: VariableDefinition[];
  title?: string;
  onNavigateToGraph?: (graphId: string) => void;
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
  title,
  onNavigateToGraph
}) => {
  const currentType = binding?.type || 'None';

  // Get selected script definition for parameter editing
  const selectedScriptDef = useMemo(() => {
    if (binding?.type === 'Script' && binding.scriptId) {
      return scriptDefs[binding.scriptId] || null;
    }
    return null;
  }, [binding, scriptDefs]);

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

  // Handle script selection
  const handleScriptChange = (scriptId: string) => {
    if (binding?.type === 'Script') {
      // When changing script, reset parameters
      onChange({ type: 'Script', scriptId, parameters: [] });
    }
  };

  // Handle parameter bindings change
  const handleParametersChange = (parameters: ParameterBinding[]) => {
    if (binding?.type === 'Script') {
      onChange({ ...binding, parameters });
    }
  };

  // Render script picker with parameters
  const renderScript = () => {
    if (binding?.type !== 'Script') return null;

    return (
      <div style={{ marginTop: '8px' }}>
        <ResourceSelect
          options={scriptOptions}
          value={binding.scriptId || ''}
          onChange={handleScriptChange}
          placeholder="Select performance script"
          warnOnMarkedDelete
        />

        {/* Parameter bindings section using PresentationParamEditor */}
        {selectedScriptDef && (
          <div style={{ marginTop: '12px', padding: '10px', background: '#1a1a1a', borderRadius: '4px', border: '1px solid #333' }}>
            <PresentationParamEditor
              scriptDef={selectedScriptDef}
              bindings={binding.parameters || []}
              onChange={handleParametersChange}
              variables={variables}
            />
          </div>
        )}

        {binding.scriptId && !selectedScriptDef && (
          <div style={{ marginTop: '8px', padding: '8px', color: '#ff6b6b', fontSize: '11px', background: '#2a1a1a', borderRadius: '4px' }}>
            Warning: Script definition not found
          </div>
        )}
      </div>
    );
  };

  // Render graph picker
  const renderGraph = () => {
    if (binding?.type !== 'Graph') return null;

    const hasValidGraph = binding.graphId && graphOptions.some(g => g.id === binding.graphId);

    return (
      <div style={{ marginTop: '8px' }}>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <div style={{ flex: 1 }}>
            <ResourceSelect
              options={graphOptions}
              value={binding.graphId || ''}
              onChange={(val) => onChange({ type: 'Graph', graphId: val })}
              placeholder="Select presentation graph"
              warnOnMarkedDelete
            />
          </div>
          {hasValidGraph && onNavigateToGraph && (
            <button
              className="btn-ghost"
              onClick={() => onNavigateToGraph(binding.graphId)}
              style={{ fontSize: '11px', padding: '4px 8px' }}
            >
              Edit →
            </button>
          )}
        </div>
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
