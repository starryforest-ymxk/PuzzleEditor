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
import { PresentationGraph } from '../../types/presentation';
import { ResourceSelect, ResourceOption } from './ResourceSelect';
import { PresentationParamEditor } from './PresentationParamEditor';

interface Props {
  binding?: PresentationBinding;
  onChange: (binding?: PresentationBinding) => void;
  scriptDefs: Record<string, ScriptDefinition>;
  scriptOptions: ResourceOption[];
  graphOptions: ResourceOption[];
  graphData?: Record<string, PresentationGraph>;  // 完整的演出图数据，用于显示节点数量等信息
  variables: VariableDefinition[];
  title?: string;
  onNavigateToGraph?: (graphId: string) => void;
  readOnly?: boolean;
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
  graphData,
  variables,
  title,
  onNavigateToGraph,
  readOnly = false
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
    if (readOnly) return;
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
    if (readOnly) return;
    if (binding?.type === 'Script') {
      // When changing script, reset parameters
      onChange({ type: 'Script', scriptId, parameters: [] });
    }
  };

  // Handle parameter bindings change
  const handleParametersChange = (parameters: ParameterBinding[]) => {
    if (readOnly) return;
    if (binding?.type === 'Script') {
      onChange({ ...binding, parameters });
    }
  };

  // Render script picker with parameters
  // 先显示脚本选择器和脚本信息卡片，再显示参数传递区域
  const renderScript = () => {
    if (binding?.type !== 'Script') return null;

    return (
      <div style={{ marginTop: '8px' }}>
        {/* 脚本选择器 - 启用 showDetails 显示脚本信息卡片 */}
        <ResourceSelect
          options={scriptOptions}
          value={binding.scriptId || ''}
          onChange={handleScriptChange}
          placeholder="Select performance script"
          warnOnMarkedDelete
          disabled={readOnly}
          onClear={binding.scriptId ? () => handleScriptChange('') : undefined}
          showDetails={!!binding.scriptId}
        />

        {/* 参数传递区域 - 在脚本信息卡片下方显示 */}
        {selectedScriptDef && (
          <div style={{ marginTop: '12px', padding: '10px', background: '#1a1a1a', borderRadius: '4px', border: '1px solid #333' }}>
            <PresentationParamEditor
              scriptDef={selectedScriptDef}
              bindings={binding.parameters || []}
              onChange={handleParametersChange}
              variables={variables}
              readOnly={readOnly}
            />
          </div>
        )}

        {/* 警告：脚本定义未找到 */}
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

    // 获取选中的演出图信息
    const selectedGraph = binding.graphId ? graphOptions.find(g => g.id === binding.graphId) : null;
    // 获取完整的演出图数据（用于显示节点数量和起始节点）
    const fullGraphData = binding.graphId && graphData ? graphData[binding.graphId] : null;
    const nodeCount = fullGraphData ? Object.keys(fullGraphData.nodes || {}).length : 0;
    const startNode = fullGraphData?.startNodeId ? fullGraphData.nodes[fullGraphData.startNodeId] : null;

    return (
      <div style={{ marginTop: '8px' }}>
        <ResourceSelect
          options={graphOptions}
          value={binding.graphId || ''}
          onChange={(val) => onChange({ type: 'Graph', graphId: val })}
          placeholder="Select presentation graph"
          warnOnMarkedDelete
          disabled={readOnly}
          onClear={binding.graphId ? () => onChange({ type: 'Graph', graphId: '' }) : undefined}
        />

        {/* 演出图详情卡片 - 样式参考 ResourceDetailsCard */}
        {selectedGraph && (
          <div style={{
            marginTop: '8px',
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
              <span style={{ fontWeight: 600, color: '#e4e4e7' }}>{selectedGraph.name}</span>
              <span style={{ fontSize: '10px', color: '#666', fontFamily: 'monospace' }}>{selectedGraph.id}</span>
            </div>

            {/* Grid: State, Nodes, Start Node */}
            <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '4px 8px', fontSize: '11px' }}>
              {selectedGraph.state && (
                <>
                  <span style={{ color: '#888' }}>State:</span>
                  <span style={{ color: selectedGraph.state === 'Implemented' ? '#4ec9b0' : '#ce9178' }}>
                    {selectedGraph.state}
                  </span>
                </>
              )}
              {/* 节点数量 */}
              {fullGraphData && (
                <>
                  <span style={{ color: '#888' }}>Nodes:</span>
                  <span style={{ color: '#f97316' }}>{nodeCount}</span>
                </>
              )}
              {/* 起始节点 */}
              {fullGraphData && (
                <>
                  <span style={{ color: '#888' }}>Start Node:</span>
                  <span style={{ color: '#4fc1ff' }}>{startNode ? startNode.name : '-'}</span>
                </>
              )}
            </div>

            {/* Description */}
            {selectedGraph.description && (
              <div style={{
                marginTop: '4px',
                paddingTop: '8px',
                borderTop: '1px solid #333',
                color: '#9ca3af',
                fontStyle: 'italic',
                lineHeight: 1.4
              }}>
                {selectedGraph.description}
              </div>
            )}

            {/* Edit Button - 放在卡片内部 */}
            {onNavigateToGraph && (
              <div style={{
                marginTop: '4px',
                paddingTop: '8px',
                borderTop: '1px solid #333',
                display: 'flex',
                justifyContent: 'flex-end'
              }}>
                <button
                  className="btn-ghost"
                  onClick={() => onNavigateToGraph(binding.graphId)}
                  style={{ fontSize: '11px', padding: '4px 12px' }}
                  disabled={readOnly}
                >
                  Edit Graph →
                </button>
              </div>
            )}
          </div>
        )}

        {/* 警告：选中的演出图未找到 */}
        {binding.graphId && !selectedGraph && (
          <div style={{ marginTop: '8px', padding: '8px', color: '#ff6b6b', fontSize: '11px', background: '#2a1a1a', borderRadius: '4px' }}>
            Warning: Presentation graph not found
          </div>
        )}
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

      {renderScript()}
      {renderGraph()}
    </div>
  );
};
