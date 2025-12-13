import React, { useEffect, useMemo, useState } from 'react';
import { VariableDefinition } from '../../types/blackboard';
import type { VariableType } from '../../types/common';
import type { MessageLevel } from '../../store/types';
import { useEditorDispatch, useEditorState } from '../../store/context';
import { withScope } from '../../utils/variableScope';
import { findNodeVariableReferences } from '../../utils/variableReferences';

export type LocalVariableOwner = 'node' | 'stage';

export interface LocalVariableEditorProps {
    variables: Record<string, VariableDefinition>;
    ownerType: LocalVariableOwner;
    ownerId?: string;
    readOnly?: boolean;
    // 可选外部引用解析器，便于 Stage 等场景自定义引用检查
    resolveReferences?: (varId: string) => string[];
    // 可选外部处理函数，便于 Stage/其他场景复用编辑逻辑
    onAddVariable?: (variable: VariableDefinition) => void;
    onUpdateVariable?: (varId: string, data: Partial<VariableDefinition>) => void;
    onDeleteVariable?: (varId: string) => void;
}

// 类型对应的 UI 颜色
const getTypeColor = (type: string) => {
    switch (type) {
        case 'boolean': return '#569cd6';
        case 'integer': return '#b5cea8';
        case 'float': return '#4ec9b0';
        case 'string': return '#ce9178';
        default: return '#ccc';
    }
};

// 按类型返回默认值，避免类型不匹配
const getDefaultValueByType = (type: VariableType) => {
    switch (type) {
        case 'boolean': return false;
        case 'integer': return 0;
        case 'float': return 0;
        case 'string': return '';
        default: return '';
    }
};

// 根据类型规范化输入值，保障存入 store 的值合法
const normalizeValueByType = (type: VariableType, raw: any) => {
    if (type === 'boolean') return raw === true || raw === 'true';
    if (type === 'integer') return Number.isNaN(parseInt(raw, 10)) ? 0 : parseInt(raw, 10);
    if (type === 'float') return Number.isNaN(parseFloat(raw)) ? 0 : parseFloat(raw);
    return raw ?? '';
};

// 通用局部变量编辑器，支持 Node/Stage 复用；Node 默认直接派发 store，Stage 可传入自定义回调
export const LocalVariableEditor: React.FC<LocalVariableEditorProps> = ({
    variables,
    ownerType,
    ownerId,
    readOnly = false,
    resolveReferences,
    onAddVariable,
    onUpdateVariable,
    onDeleteVariable
}) => {
    const { project } = useEditorState();
    const dispatch = useEditorDispatch();
    const vars = useMemo(() => Object.values(variables), [variables]);
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [confirmDialog, setConfirmDialog] = useState<{
        varId: string;
        title: string;
        message: string;
        refs: string[];
    } | null>(null);
    const [prevDefaults, setPrevDefaults] = useState<Record<string, any>>({});

    // 仅 Node 场景默认提供内置引用解析；其他场景可由 resolveReferences 自定义
    const referenceMap = useMemo(() => {
        const map: Record<string, string[]> = {};
        const resolver = resolveReferences;
        vars.forEach(v => {
            if (resolver) {
                map[v.id] = resolver(v.id) || [];
            } else if (ownerType === 'node' && ownerId) {
                const refs = findNodeVariableReferences(project, ownerId, v.id);
                map[v.id] = refs.map(r => r.location);
            } else {
                map[v.id] = [];
            }
        });
        return map;
    }, [project, ownerId, ownerType, resolveReferences, vars]);

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

    // 生成唯一名称，避免自动创建时重名
    const makeUniqueName = (base: string) => {
        let candidate = base;
        let counter = 2;
        while (hasNameConflict(candidate)) {
            candidate = `${base} (${counter})`;
            counter += 1;
        }
        return candidate;
    };

    const scopeLabel = ownerType === 'stage' ? 'stage-local' : 'node-local';
    const scopeKey = ownerType === 'stage' ? 'StageLocal' : 'NodeLocal';
    const supportsBuiltInActions = ownerType === 'node' && !!ownerId;
    const hasCustomHandlers = Boolean(onAddVariable || onUpdateVariable || onDeleteVariable);
    const canMutate = !readOnly && (supportsBuiltInActions || hasCustomHandlers);

    const handleAdd = () => {
        if (!canMutate || !ownerId) return;
        const normalizedName = makeUniqueName('New Variable');
        const id = `var-${Date.now()}`;
        // 按作用域写入 scope，保持 P1 规范
        const variable: VariableDefinition = withScope({
            id,
            key: id,
            name: normalizedName,
            type: 'string',
            defaultValue: normalizeValueByType('string', ''),
            state: 'Draft',
            scope: scopeKey as any
        }, scopeKey as any);

        if (onAddVariable) {
            onAddVariable(variable);
        } else if (supportsBuiltInActions) {
            dispatch({ type: 'ADD_NODE_PARAM', payload: { nodeId: ownerId, variable } });
        }
        pushMessage('info', `Added ${scopeLabel} variable "${normalizedName}".`);
    };

    const handleUpdate = (id: string, field: string, value: any) => {
        if (!canMutate || !ownerId) return;

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

        if (onUpdateVariable) {
            onUpdateVariable(id, data);
        } else if (supportsBuiltInActions) {
            dispatch({ type: 'UPDATE_NODE_PARAM', payload: { nodeId: ownerId, varId: id, data } });
        }
        setErrors(prev => ({ ...prev, [id]: '' }));
    };

    const handleDelete = (id: string) => {
        if (!canMutate || !ownerId) return;
        const variable = variables[id];
        const refs = referenceMap[id] || [];
        const needsConfirm = (variable?.state === 'Implemented') || refs.length > 0;

        // 无需确认则直接删除
        if (!needsConfirm) {
            if (onDeleteVariable) {
                onDeleteVariable(id);
            } else if (supportsBuiltInActions) {
                dispatch({ type: 'DELETE_NODE_PARAM', payload: { nodeId: ownerId, varId: id } });
            }
            pushMessage('info', `Deleted ${scopeLabel} variable "${variable?.name || id}".`);
            return;
        }

        // 需要确认时展示引用摘要
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
        if (!confirmDialog || !canMutate || !ownerId) return;
        const { varId, refs } = confirmDialog;
        const variable = variables[varId];
        if (onDeleteVariable) {
            onDeleteVariable(varId);
        } else if (supportsBuiltInActions) {
            dispatch({ type: 'DELETE_NODE_PARAM', payload: { nodeId: ownerId, varId } });
        }
        if (refs.length > 0) {
            pushMessage('warning', `Deleted referenced ${scopeLabel} variable "${variable?.name || varId}". Please review ${referenceMap[varId]?.length || refs.length} reference(s).`);
        } else {
            pushMessage('info', `Deleted ${scopeLabel} variable "${variable?.name || varId}".`);
        }
        setConfirmDialog(null);
    };

    // 数值类型失焦校验：无效则回退到上一次合法值
    const handleNumberBlur = (varId: string, raw: any) => {
        if (!canMutate || !ownerId) return;
        const variable = variables[varId];
        if (!variable) return;
        const type = variable.type;
        if (type !== 'integer' && type !== 'float') return;

        const parsed = type === 'integer' ? parseInt(raw, 10) : parseFloat(raw);
        const prevValue = prevDefaults[varId] !== undefined ? prevDefaults[varId] : variable.defaultValue;

        if (Number.isNaN(parsed)) {
            if (onUpdateVariable) {
                onUpdateVariable(varId, { defaultValue: prevValue });
            } else if (supportsBuiltInActions) {
                dispatch({ type: 'UPDATE_NODE_PARAM', payload: { nodeId: ownerId, varId, data: { defaultValue: prevValue } } });
            }
        } else {
            if (onUpdateVariable) {
                onUpdateVariable(varId, { defaultValue: parsed });
            } else if (supportsBuiltInActions) {
                dispatch({ type: 'UPDATE_NODE_PARAM', payload: { nodeId: ownerId, varId, data: { defaultValue: parsed } } });
            }
            setPrevDefaults((old) => ({ ...old, [varId]: parsed }));
        }
    };

    return (
        <div>
            {vars.map(v => (
                <div key={v.id} className="blackboard-var-item">
                    {/* Header: Name and Type */}
                    <div className="blackboard-var-header">
                        <div className="blackboard-var-info">
                            {/* 编辑名称 */}
                            {canMutate ? (
                                <input
                                    className="prop-value"
                                    value={v.name}
                                    onChange={(e) => handleUpdate(v.id, 'name', e.target.value)}
                                    disabled={readOnly || !canMutate}
                                    style={{ background: 'transparent', border: 'none', borderBottom: '1px dashed #444', color: '#ddd', width: '140px', minWidth: '100px' }}
                                />
                            ) : (
                                <span style={{ color: '#ddd', fontSize: '12px', fontWeight: 600 }}>{v.name}</span>
                            )}

                            <div className="blackboard-var-meta">
                                {/* Hide ID; keep status and reference hints */}
                                <span style={{ color: '#666', fontSize: '10px' }}>Status: {v.state}</span>
                                {referenceMap[v.id]?.length > 0 && (
                                    <span style={{ color: '#f9a825', fontSize: '10px' }}>
                                        {referenceMap[v.id].length} reference(s)
                                    </span>
                                )}
                            </div>
                        </div>

                        {canMutate && (
                            <button
                                onClick={() => handleDelete(v.id)}
                                style={{ background: 'transparent', border: 'none', color: '#666', cursor: 'pointer', fontSize: '14px', alignSelf: 'flex-start', padding: '0 0 0 8px' }}
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
                            disabled={!canMutate}
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
                            {canMutate ? (
                                v.type === 'boolean' ? (
                                    <select
                                        value={(v.defaultValue === true || v.defaultValue === 'true') ? 'true' : 'false'}
                                        onChange={(e) => handleUpdate(v.id, 'defaultValue', e.target.value === 'true')}
                                        disabled={!canMutate}
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
                                        disabled={!canMutate}
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

                    {/* Description */}
                    <div style={{ marginTop: '6px' }}>
                        {canMutate ? (
                            <textarea
                                value={v.description || ''}
                                onChange={(e) => handleUpdate(v.id, 'description', e.target.value)}
                                disabled={!canMutate}
                                placeholder="Description"
                                style={{
                                    width: '100%', minHeight: '32px', background: '#1e1e1e', border: '1px solid #333',
                                    color: '#e0e0e0', fontSize: '11px', padding: '6px 8px', resize: 'vertical',
                                    boxSizing: 'border-box', borderRadius: '4px'
                                }}
                            />
                        ) : (
                            <div style={{ color: '#9ca3af', fontSize: '11px', lineHeight: 1.5 }}>
                                {v.description || 'No description'}
                            </div>
                        )}
                    </div>
                </div>
            ))}

            {/* Add New Row */}
            {canMutate && (
                <div className="blackboard-add-row">
                    <button
                        onClick={handleAdd}
                        disabled={!canMutate}
                        style={{ background: '#264f78', border: '1px solid #264f78', color: '#fff', borderRadius: '4px', cursor: 'pointer', fontSize: '11px', boxSizing: 'border-box' }}
                    >
                        Add Variable
                    </button>
                </div>
            )}

            {/* Custom confirmation dialog */}
            {confirmDialog && canMutate && (
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
                                    <div key={idx} style={{ fontSize: '12px', color: '#e4e4e7', lineHeight: 1.4 }}>? {r}</div>
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
