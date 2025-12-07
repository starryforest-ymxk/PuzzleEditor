
import React from 'react';
import { useEditorState, useEditorDispatch } from '../../store/context';
import { ScriptParamEditor } from './ScriptParamEditor';

interface Props {
    graphId: string;
    nodeId: string;
}

export const PresentationNodeInspector = ({ graphId, nodeId }: Props) => {
    const { project, manifest } = useEditorState();
    const dispatch = useEditorDispatch();

    const graph = project.presentationGraphs[graphId];
    const node = graph ? graph.nodes[nodeId] : null;

    if (!node) return <div className="empty-state">Node not found</div>;

    const handleChange = (field: string, value: any) => {
        dispatch({
            type: 'UPDATE_PRESENTATION_NODE',
            payload: {
                graphId,
                nodeId: node.id,
                data: { [field]: value }
            }
        });
    };

    const handleParamChange = (paramName: string, value: any) => {
        const newParams = { ...(node.parameters || {}), [paramName]: value };
        handleChange('parameters', newParams);
    };

    const selectedScriptDef = node.scriptId ? manifest.scripts.find(s => s.id === node.scriptId) : null;

    return (
        <div>
            <div style={{ padding: '16px', background: '#2d2d30', borderBottom: '1px solid #3e3e42' }}>
                <div style={{ fontSize: '10px', color: '#c586c0', marginBottom: '4px' }}>ACTION NODE</div>
                <input 
                    type="text" 
                    value={node.name} 
                    onChange={(e) => handleChange('name', e.target.value)}
                    style={{ background: '#222', border: '1px solid #444', color: '#fff', fontSize: '14px', fontWeight: 600, width: '100%', padding: '4px' }}
                />
            </div>
            
            <div className="prop-row">
                <div className="prop-label">Type</div>
                 <select 
                    value={node.type}
                    onChange={(e) => handleChange('type', e.target.value)}
                    style={{ background: '#222', color: '#ccc', border: '1px solid #444', padding: '2px', width: '100%' }}
                >
                    <option value="ScriptCall">ScriptCall</option>
                    <option value="Wait">Wait</option>
                    <option value="Branch">Branch</option>
                    <option value="Parallel">Parallel</option>
                </select>
            </div>

            {/* Script Selection Logic */}
            {node.type === 'ScriptCall' && (
                <>
                    <div className="prop-row">
                        <div className="prop-label">Script</div>
                        <select 
                            value={node.scriptId || ''}
                            onChange={(e) => handleChange('scriptId', e.target.value)}
                            style={{ background: '#222', color: '#ccc', border: '1px solid #444', padding: '2px', width: '100%' }}
                        >
                            <option value="">-- Select Script --</option>
                            {manifest.scripts.map(s => (
                                <option key={s.id} value={s.id}>{s.name}</option>
                            ))}
                        </select>
                    </div>

                    <div className="panel-header" style={{ marginTop: '16px' }}>Parameters</div>
                    {selectedScriptDef ? (
                        <ScriptParamEditor 
                            scriptDef={selectedScriptDef}
                            values={node.parameters || {}}
                            onChange={handleParamChange}
                        />
                    ) : (
                        <div style={{ padding: '16px', color: '#666', fontSize: '12px' }}>
                            Select a script to configure parameters.
                        </div>
                    )}
                </>
            )}

            {node.type === 'Wait' && (
                 <div className="prop-row">
                    <div className="prop-label">Duration (s)</div>
                    <input 
                        type="number" step="0.1"
                        value={node.parameters?.duration ?? 0}
                        onChange={(e) => handleParamChange('duration', parseFloat(e.target.value))}
                        style={{ background: '#222', border: '1px solid #444', color: '#ccc', width: '100%' }}
                    />
                 </div>
            )}
        </div>
    );
};
