
import React, { useState } from 'react';
import { VariableDefinition } from '../../types/blackboard';
import { useEditorDispatch } from '../../store/context';
import { withScope } from '../../utils/variableScope';

interface Props {
    variables: Record<string, VariableDefinition>;
    nodeId?: string; // If provided, enables editing for this node
}

const getTypeColor = (type: string) => {
    switch (type) {
        case 'boolean': return '#569cd6';
        case 'integer': return '#b5cea8';
        case 'float': return '#4ec9b0';
        case 'string': return '#ce9178';
        default: return '#ccc';
    }
};

export const BlackboardEditor = ({ variables, nodeId }: Props) => {
    const dispatch = useEditorDispatch();
    const vars = Object.values(variables);
    const [newVarName, setNewVarName] = useState('');

    const handleAdd = () => {
        if (!nodeId || !newVarName.trim()) return;
        const normalizedName = newVarName.trim();
        const id = `var-${Date.now()}`;
        // 创建带有唯一ID/Key、作用域和初始状态的局部变量，符合P1规范
        const variable: VariableDefinition = withScope({
            id,
            key: id,
            name: normalizedName,
            type: 'string',
            defaultValue: '',
            state: 'Draft',
            scope: 'NodeLocal'
        }, 'NodeLocal');

        dispatch({
            type: 'ADD_NODE_PARAM',
            payload: {
                nodeId,
                variable
            }
        });
        setNewVarName('');
    };

    const handleUpdate = (id: string, field: string, value: any) => {
        if (!nodeId) return;
        dispatch({
            type: 'UPDATE_NODE_PARAM',
            payload: { nodeId, varId: id, data: { [field]: value } }
        });
    };

    const handleDelete = (id: string) => {
        if (!nodeId) return;
        if (confirm(`Delete parameter ${id}?`)) {
            dispatch({ type: 'DELETE_NODE_PARAM', payload: { nodeId, varId: id } });
        }
    };

    return (
        <div>
            {vars.map(v => (
                <div key={v.id} style={{
                    padding: '8px 12px',
                    borderBottom: '1px solid #2a2a2a',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '6px',
                    backgroundColor: 'rgba(0,0,0,0.1)',
                    position: 'relative'
                }}>
                    {/* Header: Name and Type */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            {/* Edit Name */}
                            {nodeId ? (
                                <input
                                    className="prop-value"
                                    value={v.name}
                                    onChange={(e) => handleUpdate(v.id, 'name', e.target.value)}
                                    style={{ background: 'transparent', border: 'none', borderBottom: '1px dashed #444', color: '#ddd', width: '100px' }}
                                />
                            ) : (
                                <span style={{ color: '#ddd', fontSize: '12px' }}>{v.name}</span>
                            )}
                            <span style={{ color: '#9cdcfe', fontSize: '10px', fontFamily: 'monospace', opacity: 0.7 }}>${v.id}</span>
                        </div>

                        {nodeId && (
                            <button
                                onClick={() => handleDelete(v.id)}
                                style={{ background: 'transparent', border: 'none', color: '#666', cursor: 'pointer', fontSize: '14px' }}
                            >
                                &times;
                            </button>
                        )}
                    </div>

                    {/* Edit Type and Default Value */}
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <select
                            value={v.type}
                            onChange={(e) => handleUpdate(v.id, 'type', e.target.value)}
                            disabled={!nodeId}
                            style={{
                                fontSize: '9px', padding: '2px 4px', borderRadius: '3px',
                                background: '#222', border: `1px solid ${getTypeColor(v.type)}`,
                                color: getTypeColor(v.type), textTransform: 'uppercase'
                            }}
                        >
                            <option value="string">String</option>
                            <option value="integer">Integer</option>
                            <option value="float">Float</option>
                            <option value="boolean">Boolean</option>
                        </select>

                        <div style={{ flex: 1 }}>
                            {nodeId ? (
                                <input
                                    type="text"
                                    value={String(v.defaultValue)}
                                    onChange={(e) => handleUpdate(v.id, 'defaultValue', e.target.value)}
                                    style={{
                                        width: '100%', background: '#1e1e1e', border: '1px solid #333',
                                        color: '#e0e0e0', fontFamily: 'monospace', fontSize: '11px', padding: '2px 4px',
                                        boxSizing: 'border-box'
                                    }}
                                />
                            ) : (
                                <span style={{ color: '#e0e0e0', fontFamily: 'monospace', fontSize: '11px' }}>
                                    {String(v.defaultValue)}
                                </span>
                            )}
                        </div>
                    </div>
                </div>
            ))}

            {/* Add New Row */}
            {nodeId && (
                <div style={{ padding: '8px 12px', display: 'flex', gap: '8px' }}>
                    <input
                        type="text"
                        placeholder="New parameter name..."
                        value={newVarName}
                        onChange={(e) => setNewVarName(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
                        style={{ flex: 1, background: '#222', border: '1px solid #444', color: '#ccc', fontSize: '11px', padding: '4px' }}
                    />
                    <button
                        onClick={handleAdd}
                        disabled={!newVarName}
                        style={{ background: '#264f78', border: 'none', color: '#fff', borderRadius: '2px', cursor: 'pointer', fontSize: '11px' }}
                    >
                        Add
                    </button>
                </div>
            )}
        </div>
    );
};
