import React, { useMemo, useState, useEffect } from 'react';
import { VariableDefinition } from '../../types/blackboard';
import { MessageLevel, VariableType } from '../../types/common';
import { useEditorDispatch, useEditorState } from '../../store/context';
import { withScope } from '../../utils/variableScope';
import { findNodeVariableReferences } from '../../utils/variableReferences';

interface Props {
    variables: Record<string, VariableDefinition>;
    nodeId?: string; // If provided, enables editing for this node
    readOnly?: boolean;
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

const getDefaultValueByType = (type: VariableType) => {
    switch (type) {
        case 'boolean': return false;
        case 'integer': return 0;
        case 'float': return 0;
        case 'string': return '';
        default: return '';
    }
};

const normalizeValueByType = (type: VariableType, raw: any) => {
    if (type === 'boolean') return raw === true || raw === 'true';
    if (type === 'integer') return Number.isNaN(parseInt(raw, 10)) ? 0 : parseInt(raw, 10);
    if (type === 'float') return Number.isNaN(parseFloat(raw)) ? 0 : parseFloat(raw);
    return raw ?? '';
};

export const BlackboardEditor = ({ variables, nodeId, readOnly = false }: Props) => {
    const { project } = useEditorState();
    const dispatch = useEditorDispatch();
    const vars = useMemo(() => Object.values(variables), [variables]);
    const [newVarName, setNewVarName] = useState('');
    const [newVarType, setNewVarType] = useState<VariableType>('string');
    const [newVarValue, setNewVarValue] = useState<any>(getDefaultValueByType('string'));
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [confirmDialog, setConfirmDialog] = useState<{
        varId: string;
        title: string;
        message: string;
        refs: string[];
    } | null>(null);
    const [prevDefaults, setPrevDefaults] = useState<Record<string, any>>({});

    // 预计算引用信息，删除时提示用户
    const referenceMap = useMemo(() => {
        const map: Record<string, string[]> = {};
        if (!nodeId) return map;
        vars.forEach(v => {
            const refs = findNodeVariableReferences(project, nodeId, v.id);
            map[v.id] = refs.map(r => r.location);
        });
        return map;
    }, [project, nodeId, vars]);

    // 同步已存在的默认值，用于数值失焦时回退
    useEffect(() => {
        setPrevDefaults((prev) => {
            const next: Record<string, any> = {};
            vars.forEach(v => {
                next[v.id] = prev[v.id] !== undefined ? prev[v.id] : v.defaultValue;
            });
            return next;
        });
    }, [vars]);

    const pushMessage = (level: MessageLevel, text: string) => {
        dispatch({
            type: 'ADD_MESSAGE',
            payload: { id: `msg-${Date.now()}`, level, text, timestamp: new Date().toISOString() }
        });
    };

    const hasNameConflict = (name: string, excludeId?: string) =>
        vars.some(v => v.id !== excludeId && v.name.trim().toLowerCase() === name.trim().toLowerCase());

    const handleAdd = () => {
        if (!nodeId || readOnly) return;
        if (!newVarName.trim()) {
            setErrors(prev => ({ ...prev, __new: 'Name cannot be empty' }));
            return;
        }
        const normalizedName = newVarName.trim();
        if (hasNameConflict(normalizedName)) {
            setErrors(prev => ({ ...prev, __new: 'Duplicate variable name' }));
            pushMessage('error', `Local variable "${normalizedName}" already exists. Creation blocked.`);
            return;
        }
        const id = `var-${Date.now()}`;
        // 创建带有唯一ID/Key、作用域和初始状态的局部变量，符合P1规范
        const variable: VariableDefinition = withScope({
            id,
            key: id,
            name: normalizedName,
            type: newVarType,
            defaultValue: normalizeValueByType(newVarType, newVarValue),
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
        pushMessage('info', `Added node-local variable "${normalizedName}".`);
        setNewVarName('');
        setNewVarValue(getDefaultValueByType(newVarType));
        setErrors(prev => ({ ...prev, __new: '' }));
    };

    const handleUpdate = (id: string, field: string, value: any) => {
        if (!nodeId || readOnly) return;

        if (field === 'name') {
            const trimmed = String(value).trim();
            if (!trimmed) {
                setErrors(prev => ({ ...prev, [id]: 'Name cannot be empty' }));
                return;
            }
            if (hasNameConflict(trimmed, id)) {
                setErrors(prev => ({ ...prev, [id]: 'Duplicate variable name' }));
                pushMessage('warning', `Rename conflict: "${trimmed}" is already used.`);
                return;
            }
            value = trimmed;
        }

        const data: any = { [field]: value };
        if (field === 'type') {
            // 切换类型时同步重置默认值，避免类型不匹配
            data.defaultValue = getDefaultValueByType(value as VariableType);
        }
        // int/float 编辑过程中不做实时校验，保留原始输入

        dispatch({
            type: 'UPDATE_NODE_PARAM',
            payload: { nodeId, varId: id, data }
        });
        setErrors(prev => ({ ...prev, [id]: '' }));
    };

    const handleDelete = (id: string) => {
        if (!nodeId || readOnly) return;
        const variable = variables[id];
        const refs = referenceMap[id] || [];
        const needsConfirm = (variable?.state === 'Implemented') || refs.length > 0;

        // No confirmation needed: delete directly
        if (!needsConfirm) {
            dispatch({ type: 'DELETE_NODE_PARAM', payload: { nodeId, varId: id } });
            pushMessage('info', `Deleted local variable "${variable?.name || id}".`);
            return;
        }

        // Confirmation required: open custom dialog
        const preview = refs.slice(0, 5);
        const msg = [
            `Variable "${variable?.name || id}"${variable?.state === 'Implemented' ? ' is Implemented' : ''}${refs.length > 0 ? ` and referenced ${refs.length} time(s)` : ''}.`,
            refs.length > 0 ? 'Deleting it requires fixing related conditions/parameters manually.' : ''
        ].join(' ');

        setConfirmDialog({
            varId: id,
            title: 'Confirm Delete',
            message: msg,
            refs: preview
        });
    };

    const handleConfirmDelete = () => {
        if (!confirmDialog || !nodeId || readOnly) return;
        const { varId, refs } = confirmDialog;
        const variable = variables[varId];
        dispatch({ type: 'DELETE_NODE_PARAM', payload: { nodeId, varId } });
        if (refs.length > 0) {
            pushMessage('warning', `Deleted referenced local variable "${variable?.name || varId}". Please review ${referenceMap[varId]?.length || refs.length} reference(s).`);
        } else {
            pushMessage('info', `Deleted local variable "${variable?.name || varId}".`);
        }
        setConfirmDialog(null);
    };

    // 数值类型失焦校验：无效则回退到上一次合法值
    const handleNumberBlur = (varId: string, raw: any) => {
        if (!nodeId || readOnly) return;
        const variable = variables[varId];
        if (!variable) return;
        const type = variable.type;
        if (type !== 'integer' && type !== 'float') return;

        const parsed = type === 'integer' ? parseInt(raw, 10) : parseFloat(raw);
        const prevValue = prevDefaults[varId] !== undefined ? prevDefaults[varId] : variable.defaultValue;

        if (Number.isNaN(parsed)) {
            dispatch({ type: 'UPDATE_NODE_PARAM', payload: { nodeId, varId, data: { defaultValue: prevValue } } });
        } else {
            dispatch({ type: 'UPDATE_NODE_PARAM', payload: { nodeId, varId, data: { defaultValue: parsed } } });
            setPrevDefaults((old) => ({ ...old, [varId]: parsed }));
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
                    <div className="inspector-row" style={{ justifyContent: 'space-between' }}>
                        <div className="inspector-row" style={{ justifyContent: 'flex-start' }}>
                            {/* 编辑名称 */}
                            {nodeId ? (
                                <input
                                    className="prop-value"
                                    value={v.name}
                                    onChange={(e) => handleUpdate(v.id, 'name', e.target.value)}
                                    disabled={readOnly}
                                    style={{ background: 'transparent', border: 'none', borderBottom: '1px dashed #444', color: '#ddd', width: '140px' }}
                                />
                            ) : (
                                <span style={{ color: '#ddd', fontSize: '12px' }}>{v.name}</span>
                            )}
                            {/* Hide ID; keep status and reference hints */}
                            <span style={{ color: '#666', fontSize: '10px' }}>Status: {v.state}</span>
                            {referenceMap[v.id]?.length > 0 && (
                                <span style={{ color: '#f9a825', fontSize: '10px' }}>
                                    {referenceMap[v.id].length} reference(s)
                                </span>
                            )}
                        </div>

                        {nodeId && !readOnly && (
                            <button
                                onClick={() => handleDelete(v.id)}
                                style={{ background: 'transparent', border: 'none', color: '#666', cursor: 'pointer', fontSize: '14px' }}
                            >
                                &times;
                            </button>
                        )}
                    </div>

                    {/* Edit Type and Default Value */}
                    <div className="inspector-row" style={{ gap: '8px', alignItems: 'center' }}>
                        <select
                            value={v.type}
                            onChange={(e) => handleUpdate(v.id, 'type', e.target.value as VariableType)}
                            disabled={!nodeId || readOnly}
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
                                v.type === 'boolean' ? (
                                    <select
                                        value={(v.defaultValue === true || v.defaultValue === 'true') ? 'true' : 'false'}
                                        onChange={(e) => handleUpdate(v.id, 'defaultValue', e.target.value === 'true')}
                                        disabled={readOnly}
                                        style={{
                                            width: '100%', background: '#1e1e1e', border: '1px solid #333',
                                            color: '#e0e0e0', fontFamily: 'monospace', fontSize: '11px', padding: '2px 4px',
                                            boxSizing: 'border-box'
                                        }}
                                    >
                                        <option value="true">True</option>
                                        <option value="false">False</option>
                                    </select>
                                ) : (
                                    <input
                                        type="text"
                                        value={String(v.defaultValue ?? '')}
                                        onChange={(e) => handleUpdate(v.id, 'defaultValue', e.target.value)}
                                        onBlur={(e) => handleNumberBlur(v.id, e.target.value)}
                                        disabled={readOnly}
                                        style={{
                                            width: '100%', background: '#1e1e1e', border: '1px solid #333',
                                            color: '#e0e0e0', fontFamily: 'monospace', fontSize: '11px', padding: '2px 4px',
                                            boxSizing: 'border-box'
                                        }}
                                    />
                                )
                            ) : (
                                <span style={{ color: '#e0e0e0', fontFamily: 'monospace', fontSize: '11px' }}>
                                    {String(v.defaultValue)}
                                </span>
                            )}
                        </div>
                    </div>
                    {errors[v.id] && (
                        <div style={{ color: '#f2777a', fontSize: '11px' }}>{errors[v.id]}</div>
                    )}
                </div>
            ))}

            {/* Add New Row */}
            {nodeId && (
                <div style={{ padding: '8px 12px' }} className="inspector-inline-row">
                    <input
                        type="text"
                        placeholder="New variable name..."
                        value={newVarName}
                        onChange={(e) => setNewVarName(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
                        style={{ width: '100%', background: '#222', border: '1px solid #444', color: '#ccc', fontSize: '11px', padding: '4px', boxSizing: 'border-box' }}
                        disabled={readOnly}
                    />
                    <select
                        value={newVarType}
                        onChange={(e) => {
                            const nextType = e.target.value as VariableType;
                            setNewVarType(nextType);
                            setNewVarValue(getDefaultValueByType(nextType));
                        }}
                        disabled={readOnly}
                        style={{ width: '100%', background: '#222', border: '1px solid #444', color: '#ccc', fontSize: '11px', padding: '4px', boxSizing: 'border-box' }}
                    >
                        <option value="string">String</option>
                        <option value="integer">Integer</option>
                        <option value="float">Float</option>
                        <option value="boolean">Boolean</option>
                    </select>
                    <button
                        onClick={handleAdd}
                        disabled={!newVarName || readOnly}
                        style={{ background: '#264f78', border: '1px solid #264f78', color: '#fff', borderRadius: '4px', cursor: 'pointer', fontSize: '11px', padding: '6px 12px', width: '100%', boxSizing: 'border-box' }}
                    >
                        Add
                    </button>
                </div>
            )}
            {errors.__new && (
                <div style={{ color: '#f2777a', fontSize: '11px', padding: '0 12px 8px 12px' }}>{errors.__new}</div>
            )}

            {/* Custom confirmation dialog */}
            {confirmDialog && (
                <div style={{
                    position: 'fixed',
                    top: 0, left: 0, right: 0, bottom: 0,
                    background: 'rgba(0,0,0,0.55)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 9999
                }}>
                    <div style={{
                        width: '420px',
                        background: '#1f1f23',
                        border: '1px solid #52525b',
                        borderRadius: '6px',
                        boxShadow: '0 12px 32px rgba(0,0,0,0.45)',
                        padding: '20px',
                        color: '#e4e4e7',
                        fontFamily: 'Inter, "IBM Plex Mono", monospace'
                    }}>
                        <div style={{ fontSize: '13px', letterSpacing: '0.5px', color: '#f97316', marginBottom: '8px', textTransform: 'uppercase' }}>
                            {confirmDialog.title}
                        </div>
                        <div style={{ fontSize: '14px', marginBottom: '12px', lineHeight: 1.5 }}>
                            {confirmDialog.message}
                        </div>
                        {confirmDialog.refs.length > 0 && (
                            <div style={{
                                border: '1px solid #2f2f36',
                                borderRadius: '4px',
                                padding: '10px',
                                background: '#18181b',
                                maxHeight: '140px',
                                overflow: 'auto',
                                marginBottom: '12px'
                            }}>
                        <div style={{ fontSize: '12px', color: '#a1a1aa', marginBottom: '6px' }}>Reference preview</div>
                        {confirmDialog.refs.map((r, idx) => (
                            <div key={idx} style={{ fontSize: '12px', color: '#e4e4e7', lineHeight: 1.4 }}>• {r}</div>
                        ))}
                        {referenceMap[confirmDialog.varId]?.length > confirmDialog.refs.length && (
                            <div style={{ fontSize: '12px', color: '#a1a1aa', marginTop: '4px' }}>... {referenceMap[confirmDialog.varId].length - confirmDialog.refs.length} more reference(s)</div>
                        )}
                    </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                    <button
                        onClick={() => setConfirmDialog(null)}
                                style={{
                                    padding: '8px 14px',
                                    borderRadius: '4px',
                                    border: '1px solid #3f3f46',
                                    background: '#27272a',
                                    color: '#e4e4e7',
                                    cursor: 'pointer'
                        }}
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleConfirmDelete}
                        style={{
                                    padding: '8px 14px',
                                    borderRadius: '4px',
                                    border: '1px solid #f97316',
                                    background: '#f97316',
                                    color: '#0b0b0f',
                                    fontWeight: 600,
                                    cursor: 'pointer'
                        }}
                    >
                        Delete
                    </button>
                </div>
            </div>
        </div>
    )}
        </div>
    );
};
