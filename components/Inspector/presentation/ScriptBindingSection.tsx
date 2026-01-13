import React, { useMemo } from 'react';
import { PresentationBinding, ValueSource, ParameterBinding, VariableType } from '../../../types/common';
import { ScriptDefinition } from '../../../types/manifest';
import { VariableDefinition } from '../../../types/blackboard';
import { ResourceSelect, ResourceOption } from '../ResourceSelect';
import { VariableSelector } from '../VariableSelector';
import { ValueSourceEditor } from '../ValueSourceEditor';
import { isValidAssetName } from '../../../utils/assetNameValidation';

interface ScriptBindingSectionProps {
    binding: PresentationBinding & { type: 'Script' };
    onChange: (binding: PresentationBinding) => void;
    scriptDefs: Record<string, ScriptDefinition>;
    scriptOptions: ResourceOption[];
    variables: VariableDefinition[];
    readOnly?: boolean;
}

const CONTROL_HEIGHT = 24;
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

// 参数行组件，独立管理 paramName 的本地状态以支持“编辑后校验/回退”逻辑
const ScriptParameterRow: React.FC<{
    param: ParameterBinding;
    idx: number;
    readOnly: boolean;
    upsertParam: (targetId: string, updater: (prev: ParameterBinding) => ParameterBinding) => void;
    removeParam: (targetId: string) => void;
    variables: VariableDefinition[];
    syncTempType: (param: ParameterBinding, nextType: VariableType) => ParameterBinding;
}> = ({ param, idx, readOnly, upsertParam, removeParam, variables, syncTempType }) => {
    const key = param.id || `param-${idx}`;
    const isTemp = param.kind === 'Temporary';
    const tempVar = param.tempVariable;

    // 本地状态用于输入框
    const [localName, setLocalName] = React.useState(param.paramName || '');

    // 当 props 更新时同步本地状态
    React.useEffect(() => {
        setLocalName(param.paramName || '');
    }, [param.paramName]);

    const handleBlur = () => {
        if (!localName) {
            // 如果清空，回退
            setLocalName(param.paramName || '');
            return;
        }
        if (localName === param.paramName) return;

        if (isValidAssetName(localName)) {
            // 合法：提交更新
            if (isTemp) {
                upsertParam(key, (prev) => {
                    const base = prev.tempVariable
                        ? { ...prev.tempVariable }
                        : { id: genId('tempvar'), name: localName, type: 'string' as VariableType, description: '' };
                    return {
                        ...prev,
                        paramName: localName,
                        kind: 'Temporary',
                        tempVariable: { ...base, name: localName }
                    };
                });
            } else {
                upsertParam(key, (prev) => ({ ...prev, paramName: localName }));
            }
        } else {
            // 非法：回退
            setLocalName(param.paramName || '');
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            (e.target as HTMLInputElement).blur();
        }
    };

    if (!isTemp) {
        return (
            <div key={key} style={{ padding: '10px', border: '1px solid #333', borderRadius: '4px', background: '#18181b', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                    <input
                        value={localName}
                        onChange={(e) => setLocalName(e.target.value)}
                        onBlur={handleBlur}
                        onKeyDown={handleKeyDown}
                        placeholder="Target param name"
                        disabled={readOnly}
                        style={{ flex: 1, minWidth: 0, background: '#222', border: '1px solid #444', color: isValidAssetName(localName) ? '#eee' : '#f87171', padding: '6px 8px', borderRadius: '4px', fontSize: '12px', height: CONTROL_HEIGHT, boxSizing: 'border-box' }}
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
                    value={localName}
                    onChange={(e) => setLocalName(e.target.value)}
                    onBlur={handleBlur}
                    onKeyDown={handleKeyDown}
                    placeholder="Target param name"
                    disabled={readOnly}
                    style={{ flex: 1, minWidth: 0, background: '#222', border: '1px solid #444', color: isValidAssetName(localName) ? '#eee' : '#f87171', padding: '4px 8px', borderRadius: '4px', fontSize: '12px', height: CONTROL_HEIGHT, boxSizing: 'border-box', display: 'flex', alignItems: 'center' }}
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
                    </select>
                </div>

                <div style={{ flex: '1 1 50%', minWidth: 0, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '10px', color: '#888', ...noWrapText }}>Value Source Type</label>
                    <select
                        value={param.source.type}
                        onChange={(e) => {
                            const nextType = e.target.value as ValueSource['type'];
                            const currentType: VariableType = tempVar?.type || 'string';
                            const nextSource: ValueSource = nextType === 'Constant'
                                ? { type: 'Constant', value: getDefaultValueByType(currentType) }
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
};

// 演出脚本绑定区，包含脚本选择与参数行编辑
export const ScriptBindingSection: React.FC<ScriptBindingSectionProps> = ({
    binding,
    onChange,
    scriptDefs,
    scriptOptions,
    variables,
    readOnly = false
}) => {
    const normalizedParams: ParameterBinding[] = useMemo(() => {
        return (binding.parameters || []).map((p, idx) => ({
            ...p,
            id: p.id || `param-${idx}-${p.paramName || 'param'}`,
            kind: p.kind || (p.tempVariable ? 'Temporary' : 'Variable')
        }));
    }, [binding.parameters]);

    const selectedScriptDef = useMemo(() => {
        if (binding.scriptId) {
            return scriptDefs[binding.scriptId] || null;
        }
        return null;
    }, [binding.scriptId, scriptDefs]);

    const handleScriptChange = (scriptId: string) => {
        if (readOnly) return;
        onChange({ type: 'Script', scriptId, parameters: [] });
    };

    const handleParametersChange = (parameters: ParameterBinding[]) => {
        if (readOnly) return;
        onChange({ ...binding, parameters });
    };

    const handleAddVariableParam = () => {
        if (readOnly) return;
        const next: ParameterBinding = {
            id: genId('param'),
            paramName: '',
            kind: 'Variable',
            source: { type: 'VariableRef', variableId: '', scope: 'Global' }
        };
        handleParametersChange([...(binding.parameters || []), next]);
    };

    const handleAddTemporaryParam = () => {
        if (readOnly) return;
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
        if (readOnly) return;
        const nextList = (normalizedParams.length ? normalizedParams : binding.parameters || []).map((p, idx) => {
            const key = p.id || `${idx}`;
            return key === targetId ? updater(p) : p;
        });
        handleParametersChange(nextList);
    };

    const removeParam = (targetId: string) => {
        if (readOnly) return;
        const next = (normalizedParams.length ? normalizedParams : binding.parameters || []).filter((p, idx) => (p.id || `${idx}`) !== targetId);
        handleParametersChange(next);
    };

    const syncTempType = (param: ParameterBinding, nextType: VariableType): ParameterBinding => {
        const tempVar = param.tempVariable || { id: genId('tempvar'), name: 'Temporary', type: nextType };
        const nextSource: ValueSource = param.source.type === 'Constant'
            ? { type: 'Constant', value: getDefaultValueByType(nextType) }
            : param.source;
        return {
            ...param,
            kind: 'Temporary',
            tempVariable: { ...tempVar, type: nextType },
            source: nextSource
        };
    };

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

            <div style={{ marginTop: '12px', padding: '12px', background: '#111', borderRadius: '6px', border: '1px solid #333', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ fontSize: '11px', color: '#999', letterSpacing: '0.5px', textTransform: 'uppercase', ...noWrapText }}>Parameters</div>

                {!binding.scriptId && (
                    <div style={{ fontSize: '11px', color: '#777', ...noWrapText }}>Select a performance script to keep parameter intent aligned.</div>
                )}

                {normalizedParams.length === 0 && (
                    <div style={{ fontSize: '11px', color: '#666', fontStyle: 'italic', ...noWrapText }}>No parameters added.</div>
                )}

                {normalizedParams.map((param, idx) => (
                    <ScriptParameterRow
                        key={param.id || `param-${idx}`}
                        param={param}
                        idx={idx}
                        readOnly={readOnly}
                        upsertParam={upsertParam}
                        removeParam={removeParam}
                        variables={variables}
                        syncTempType={syncTempType}
                    />
                ))}

                <div style={{ display: 'flex', gap: '8px', flexWrap: 'nowrap' }}>
                    <button
                        className="btn-add-ghost"
                        onClick={handleAddVariableParam}
                        disabled={readOnly}
                        style={{ flex: '1 1 50%', minWidth: 0, height: CONTROL_HEIGHT, ...noWrapText }}
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

            {binding.scriptId && !selectedScriptDef && (
                <div style={{ marginTop: '8px', padding: '8px', color: '#ff6b6b', fontSize: '11px', background: '#2a1a1a', borderRadius: '4px' }}>
                    Warning: Script definition not found
                </div>
            )}
        </div>
    );
};
