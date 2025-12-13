import React, { useMemo } from 'react';
import { PresentationBinding, ValueSource, ParameterBinding, VariableType } from '../../types/common';
import { ScriptDefinition } from '../../types/manifest';
import { VariableDefinition } from '../../types/blackboard';
import { PresentationGraph } from '../../types/presentation';
import { ResourceSelect, ResourceOption } from './ResourceSelect';
import { VariableSelector } from './VariableSelector';
import { ValueSourceEditor } from './ValueSourceEditor';

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

/**
 * 演出绑定编辑器 - 统一参数传递 UI，支持已有变量和临时参数
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
  const CONTROL_HEIGHT = 24; // 统一控件高度
  const noWrapText: React.CSSProperties = { whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' };

  const genId = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;

  const getDefaultValueByType = (type: VariableType) => {
    switch (type) {
      case 'boolean': return false;
      case 'integer': return 0;
      case 'float': return 0;
      default: return '';
    }
  };

  const normalizedParams: ParameterBinding[] = useMemo(() => {
    if (binding?.type !== 'Script') return [];
    return (binding.parameters || []).map((p, idx) => ({
      ...p,
      id: p.id || `param-${idx}-${p.paramName || 'param'}`,
      kind: p.kind || (p.tempVariable ? 'Temporary' : 'Variable')
    }));
  }, [binding]);

  const selectedScriptDef = useMemo(() => {
    if (binding?.type === 'Script' && binding.scriptId) {
      return scriptDefs[binding.scriptId] || null;
    }
    return null;
  }, [binding, scriptDefs]);

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

  const handleScriptChange = (scriptId: string) => {
    if (readOnly) return;
    if (binding?.type === 'Script') {
      onChange({ type: 'Script', scriptId, parameters: [] });
    }
  };

  const handleParametersChange = (parameters: ParameterBinding[]) => {
    if (readOnly) return;
    if (binding?.type === 'Script') {
      onChange({ ...binding, parameters });
    }
  };

  const handleAddVariableParam = () => {
    if (readOnly || binding?.type !== 'Script') return;
    const next: ParameterBinding = {
      id: genId('param'),
      paramName: '',
      kind: 'Variable',
      source: { type: 'VariableRef', variableId: '', scope: 'Global' }
    };
    handleParametersChange([...(binding.parameters || []), next]);
  };

  const handleAddTemporaryParam = () => {
    if (readOnly || binding?.type !== 'Script') return;
    const tempType: VariableType = 'string';
    const next: ParameterBinding = {
      id: genId('temp'),
      paramName: '',
      kind: 'Temporary',
      tempVariable: {
        id: genId('tempvar'),
        name: 'Temporary',
        type: tempType,
        description: ''
      },
      source: { type: 'Constant', value: getDefaultValueByType(tempType) }
    };
    handleParametersChange([...(binding.parameters || []), next]);
  };

  const upsertParam = (targetId: string, updater: (prev: ParameterBinding) => ParameterBinding) => {
    if (readOnly || binding?.type !== 'Script') return;
    const nextList = (normalizedParams.length ? normalizedParams : binding.parameters || []).map((p, idx) => {
      const key = p.id || `${idx}`;
      return key === targetId ? updater(p) : p;
    });
    handleParametersChange(nextList);
  };

  const removeParam = (targetId: string) => {
    if (readOnly || binding?.type !== 'Script') return;
    const next = (normalizedParams.length ? normalizedParams : binding.parameters || []).filter((p, idx) => (p.id || `${idx}`) !== targetId);
    handleParametersChange(next);
  };

  const syncTempType = (param: ParameterBinding, nextType: VariableType): ParameterBinding => {
    const tempVar = param.tempVariable || { id: genId('tempvar'), name: 'Temporary', type: nextType };
    const nextSource = param.source.type === 'Constant'
      ? { type: 'Constant', value: getDefaultValueByType(nextType) }
      : param.source;
    return {
      ...param,
      kind: 'Temporary',
      tempVariable: { ...tempVar, type: nextType },
      source: nextSource
    };
  };

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
          disabled={readOnly}
          onClear={binding.scriptId ? () => handleScriptChange('') : undefined}
          showDetails={!!binding.scriptId}
        />

        {binding.type === 'Script' && (
          <div style={{ marginTop: '12px', padding: '12px', background: '#111', borderRadius: '6px', border: '1px solid #333', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ fontSize: '11px', color: '#999', letterSpacing: '0.5px', textTransform: 'uppercase', ...noWrapText }}>Parameters</div>

            {!binding.scriptId && (
              <div style={{ fontSize: '11px', color: '#777', ...noWrapText }}>Select a performance script to keep parameter intent aligned.</div>
            )}

            {normalizedParams.length === 0 && (
              <div style={{ fontSize: '11px', color: '#666', fontStyle: 'italic', ...noWrapText }}>No parameters added.</div>
            )}

            {normalizedParams.map((param, idx) => {
              const key = param.id || `param-${idx}`;
              const isTemp = param.kind === 'Temporary';
              const tempVar = param.tempVariable;

              if (!isTemp) {
                return (
                  <div key={key} style={{ padding: '10px', border: '1px solid #333', borderRadius: '4px', background: '#18181b', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                      <input
                        value={param.paramName || ''}
                        onChange={(e) => upsertParam(key, (prev) => ({ ...prev, paramName: e.target.value }))}
                        placeholder="Target param name"
                        disabled={readOnly}
                        style={{ flex: 1, minWidth: 0, background: '#222', border: '1px solid #444', color: '#eee', padding: '6px 8px', borderRadius: '4px', fontSize: '12px', height: CONTROL_HEIGHT, boxSizing: 'border-box' }}
                      />
                      <button
                        className="btn-ghost"
                        onClick={() => removeParam(key)}
                        disabled={readOnly}
                        style={{ fontSize: '12px', color: '#f97316', height: CONTROL_HEIGHT, padding: '0 12px', boxSizing: 'border-box', display: 'flex', alignItems: 'center', ...noWrapText }}
                      >
                        Remove
                      </button>
                    </div>

                    <div style={{ display: 'flex', gap: '8px', minWidth: 0 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '10px', color: '#888', marginBottom: '4px', ...noWrapText }}>Variable</div>
                        <VariableSelector
                          value={param.source.type === 'VariableRef' ? param.source.variableId : ''}
                          variables={variables}
                          onChange={(id, scope) => {
                            const nextSource: ValueSource = { type: 'VariableRef', variableId: id, scope };
                            upsertParam(key, (prev) => ({ ...prev, kind: 'Variable', source: nextSource }));
                          }}
                          placeholder="Select variable"
                          height={CONTROL_HEIGHT}
                        />
                      </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <label style={{ fontSize: '10px', color: '#888', ...noWrapText }}>Description</label>
                      <input
                        value={param.description || ''}
                        onChange={(e) => upsertParam(key, (prev) => ({ ...prev, description: e.target.value }))}
                        placeholder="Optional description"
                        disabled={readOnly}
                        style={{ background: '#222', border: '1px solid #444', color: '#eee', padding: '6px 8px', borderRadius: '4px', fontSize: '12px', height: CONTROL_HEIGHT, boxSizing: 'border-box' }}
                      />
                    </div>
                  </div>
                );
              }

              return (
                <div key={key} style={{ padding: '12px', border: '1px solid #3a3a3d', borderRadius: '4px', background: '#151518', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                    <input
                      value={param.paramName || ''}
                      onChange={(e) => upsertParam(key, (prev) => {
                        const nextName = e.target.value;
                        const base = prev.tempVariable
                          ? { ...prev.tempVariable }
                          : { id: genId('tempvar'), name: nextName, type: 'string', description: '' };
                        return {
                          ...prev,
                          paramName: nextName,
                          kind: 'Temporary',
                          tempVariable: { ...base, name: nextName }
                        };
                      })}
                      placeholder="Target param name"
                      disabled={readOnly}
                      style={{ flex: 1, minWidth: 0, background: '#222', border: '1px solid #444', color: '#eee', padding: '4px 8px', borderRadius: '4px', fontSize: '12px', height: CONTROL_HEIGHT, boxSizing: 'border-box', display: 'flex', alignItems: 'center' }}
                    />
                    <button
                      className="btn-ghost"
                      onClick={() => removeParam(key)}
                      disabled={readOnly}
                      style={{ fontSize: '12px', color: '#f97316', height: CONTROL_HEIGHT, padding: '0 12px', boxSizing: 'border-box', display: 'flex', alignItems: 'center', ...noWrapText }}
                    >
                      Remove
                    </button>
                  </div>

                  {/* 临时参数下拉保持单行并列，避免 Inspector 窄宽度时换行 */}
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'nowrap' }}>
                    <div style={{ flex: '1 1 50%', minWidth: 0, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <label style={{ fontSize: '10px', color: '#888', ...noWrapText }}>Type</label>
                      <select
                        value={tempVar?.type || 'string'}
                        onChange={(e) => upsertParam(key, (prev) => syncTempType(prev, e.target.value as VariableType))}
                        disabled={readOnly}
                        style={{ background: '#222', color: '#eee', border: '1px solid #444', padding: '0 8px', borderRadius: '4px', fontSize: '12px', height: CONTROL_HEIGHT, boxSizing: 'border-box', lineHeight: `${CONTROL_HEIGHT - 2}px`, width: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                      >
                        <option value="string">String</option>
                        <option value="integer">Integer</option>
                        <option value="float">Float</option>
                        <option value="boolean">Boolean</option>
                        <option value="enum">Enum</option>
                      </select>
                    </div>

                    <div style={{ flex: '1 1 50%', minWidth: 0, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <label style={{ fontSize: '10px', color: '#888', ...noWrapText }}>Value Source Type</label>
                      <select
                        value={param.source.type}
                        onChange={(e) => {
                          const nextType = e.target.value as ValueSource['type'];
                          const nextSource = nextType === 'Constant'
                            ? { type: 'Constant', value: getDefaultValueByType(tempVar?.type || 'string') }
                            : { type: 'VariableRef', variableId: '', scope: 'Global' };
                          upsertParam(key, (prev) => ({ ...prev, kind: 'Temporary', source: nextSource }));
                        }}
                        disabled={readOnly}
                        style={{ background: '#222', color: '#eee', border: '1px solid #444', padding: '0 8px', borderRadius: '4px', fontSize: '12px', height: CONTROL_HEIGHT, boxSizing: 'border-box', lineHeight: `${CONTROL_HEIGHT - 2}px`, width: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                      >
                        <option value="Constant">Constant</option>
                        <option value="VariableRef">Variable Ref</option>
                      </select>
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '10px', color: '#888', ...noWrapText }}>Value</label>
                    <ValueSourceEditor
                      source={param.source}
                      onChange={(src) => upsertParam(key, (prev) => ({ ...prev, kind: 'Temporary', source: src }))}
                      variables={variables}
                      valueType={tempVar?.type as any}
                      allowedTypes={tempVar?.type ? [tempVar.type] : undefined}
                      height={CONTROL_HEIGHT}
                      hideTypeSelect
                    />
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '10px', color: '#888', ...noWrapText }}>Description</label>
                    <input
                      value={tempVar?.description || ''}
                      onChange={(e) => upsertParam(key, (prev) => ({
                        ...prev,
                        kind: 'Temporary',
                        tempVariable: {
                          id: prev.tempVariable?.id || genId('tempvar'),
                          name: prev.paramName || prev.tempVariable?.name || 'Temporary',
                          type: prev.tempVariable?.type || 'string',
                          description: e.target.value
                        }
                      }))}
                      placeholder="Optional description"
                      disabled={readOnly}
                      style={{ background: '#222', border: '1px solid #444', color: '#eee', padding: '6px 8px', borderRadius: '4px', fontSize: '12px', height: CONTROL_HEIGHT, boxSizing: 'border-box' }}
                    />
                  </div>
                </div>
              );
            })}

            <div style={{ display: 'flex', gap: '8px', flexWrap: 'nowrap' }}>
              <button
                onClick={handleAddVariableParam}
                disabled={readOnly}
                style={{ background: '#2d2d30', color: '#fff', border: '1px solid #3e3e42', padding: '0 12px', borderRadius: '4px', fontSize: '12px', cursor: 'pointer', height: CONTROL_HEIGHT, boxSizing: 'border-box', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: '1 1 50%', minWidth: 0, overflow: 'hidden', ...noWrapText }}
              >
                + Add Parameter
              </button>
              <button
                onClick={handleAddTemporaryParam}
                disabled={readOnly}
                style={{ background: '#264f78', color: '#fff', border: '1px solid #264f78', padding: '0 12px', borderRadius: '4px', fontSize: '12px', cursor: 'pointer', height: CONTROL_HEIGHT, boxSizing: 'border-box', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: '1 1 50%', minWidth: 0, overflow: 'hidden', ...noWrapText }}
              >
                + Temporary Parameter
              </button>
            </div>
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

  const renderGraph = () => {
    if (binding?.type !== 'Graph') return null;

    const selectedGraph = binding.graphId ? graphOptions.find(g => g.id === binding.graphId) : null;
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
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
              <span style={{ fontWeight: 600, color: '#e4e4e7' }}>{selectedGraph.name}</span>
              <span style={{ fontSize: '10px', color: '#666', fontFamily: 'monospace' }}>{selectedGraph.id}</span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '4px 8px', fontSize: '11px' }}>
              {selectedGraph.state && (
                <>
                  <span style={{ color: '#888' }}>State:</span>
                  <span style={{ color: selectedGraph.state === 'Implemented' ? '#4ec9b0' : '#ce9178' }}>
                    {selectedGraph.state}
                  </span>
                </>
              )}
              {fullGraphData && (
                <>
                  <span style={{ color: '#888' }}>Nodes:</span>
                  <span style={{ color: '#f97316' }}>{nodeCount}</span>
                </>
              )}
              {fullGraphData && (
                <>
                  <span style={{ color: '#888' }}>Start Node:</span>
                  <span style={{ color: '#4fc1ff' }}>{startNode ? startNode.name : '-'}</span>
                </>
              )}
            </div>

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
