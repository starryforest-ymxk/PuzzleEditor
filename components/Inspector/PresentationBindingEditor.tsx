import React from 'react';
import { PresentationBinding } from '../../types/common';
import { ScriptDefinition } from '../../types/manifest';
import { VariableDefinition } from '../../types/blackboard';
import { PresentationGraph } from '../../types/presentation';
import { ResourceOption } from './ResourceSelect';
import { ScriptBindingSection } from './presentation/ScriptBindingSection';
import { GraphBindingSection } from './presentation/GraphBindingSection';

interface Props {
  binding?: PresentationBinding;
  onChange: (binding?: PresentationBinding) => void;
  scriptDefs: Record<string, ScriptDefinition>;
  scriptOptions: ResourceOption[];
  graphOptions: ResourceOption[];
  graphData?: Record<string, PresentationGraph>; // 完整演出图数据用于详情
  variables: VariableDefinition[];
  title?: string;
  onNavigateToGraph?: (graphId: string) => void;
  readOnly?: boolean;
}

export const PresentationBindingEditor: React.FC<Props> = ({
  binding,
  onChange,
  scriptDefs,
  scriptOptions,
  graphOptions,
  graphData,
  variables,
  title,
  onNavigateToGraph,
  readOnly = false
}) => {
  const currentType = binding?.type || 'None';

  const handleTypeChange = (type: string) => {
    if (readOnly) return;
    if (type === 'None') {
      onChange(undefined);
    } else if (type === 'Script') {
      onChange({ type: 'Script', scriptId: '', parameters: [] });
    } else if (type === 'Graph') {
      onChange({ type: 'Graph', graphId: '' });
    }
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
          disabled={readOnly}
          style={{
            background: '#222',
            color: '#eee',
            border: '1px solid #444',
            padding: '2px 4px',
            fontSize: '12px',
            borderRadius: '3px',
            outline: 'none'
          }}
        >
          <option value="None">None</option>
          <option value="Script">Script</option>
          <option value="Graph">Graph</option>
        </select>
      </div>

      {currentType === 'Script' && binding?.type === 'Script' && (
        <ScriptBindingSection
          binding={binding}
          onChange={onChange}
          scriptDefs={scriptDefs}
          scriptOptions={scriptOptions}
          variables={variables}
          readOnly={readOnly}
        />
      )}

      {currentType === 'Graph' && binding?.type === 'Graph' && (
        <GraphBindingSection
          binding={binding}
          onChange={onChange}
          graphOptions={graphOptions}
          graphData={graphData}
          onNavigateToGraph={onNavigateToGraph}
          readOnly={readOnly}
        />
      )}
    </div>
  );
};
