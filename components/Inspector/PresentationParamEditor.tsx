/**
 * components/Inspector/PresentationParamEditor.tsx
 * 演出参数传递编辑器 - 支持两种模式：
 * 1. 传递已有参数（局部/全局变量引用）
 * 2. 新建临时参数（配置 Type, Name, Comment, Value）
 */

import React, { useState } from 'react';
import { ParameterBinding, ValueSource, VariableType, VariableScope } from '../../types/common';
import { VariableDefinition } from '../../types/blackboard';
import { ScriptDefinition } from '../../types/manifest';

interface Props {
    scriptDef: ScriptDefinition;
    bindings: ParameterBinding[];
    onChange: (bindings: ParameterBinding[]) => void;
    variables: VariableDefinition[];
    // 临时参数也需要收集，用于作用域传递
    temporaryParams?: VariableDefinition[];
    onTemporaryParamsChange?: (params: VariableDefinition[]) => void;
    readOnly?: boolean;
}

// 临时参数定义（用于UI状态）
interface TempParamDef {
    id: string;
    paramName: string;  // 目标脚本里的变量名
    type: VariableType;
    name: string;
    comment: string;
    valueSourceType: 'Constant' | 'VariableRef';
    constantValue: any;
    variableRefId: string;
    variableRefScope: VariableScope;
}

/**
 * 演出参数传递编辑器
 */
export const PresentationParamEditor: React.FC<Props> = ({
    scriptDef,
    bindings,
    onChange,
    variables,
    readOnly = false
}) => {
    // 临时参数列表（本地状态）
    const [tempParams, setTempParams] = useState<TempParamDef[]>([]);

    // 更新绑定
    const upsertBinding = (paramName: string, source: ValueSource) => {
        const filtered = bindings.filter(b => b.paramName !== paramName);
        onChange([...filtered, { paramName, source }]);
    };

    // 移除绑定
    const removeBinding = (paramName: string) => {
        onChange(bindings.filter(b => b.paramName !== paramName));
    };

    // 添加临时参数
    const addTempParam = () => {
        const newParam: TempParamDef = {
            id: `temp_${Date.now()}`,
            paramName: '',
            type: 'string',
            name: '',
            comment: '',
            valueSourceType: 'Constant',
            constantValue: '',
            variableRefId: '',
            variableRefScope: 'Global'
        };
        setTempParams([...tempParams, newParam]);
    };

    // 更新临时参数
    const updateTempParam = (id: string, updates: Partial<TempParamDef>) => {
        const updated = tempParams.map(p => p.id === id ? { ...p, ...updates } : p);
        setTempParams(updated);

        // 同步到 bindings
        const param = updated.find(p => p.id === id);
        if (param && param.paramName) {
            const source: ValueSource = param.valueSourceType === 'Constant'
                ? { type: 'Constant', value: param.constantValue }
                : { type: 'VariableRef', variableId: param.variableRefId, scope: param.variableRefScope };
            upsertBinding(param.paramName, source);
        }
    };

    // 删除临时参数
    const removeTempParam = (id: string) => {
        const param = tempParams.find(p => p.id === id);
        if (param?.paramName) {
            removeBinding(param.paramName);
        }
        setTempParams(tempParams.filter(p => p.id !== id));
    };

    const renderDefinedParams = () => {
        if (scriptDef.parameters.length === 0) {
            return (
                <div style={{ fontSize: '11px', color: '#666', fontStyle: 'italic', padding: '8px' }}>
                    No parameters defined in script.
                </div>
            );
        }

        return scriptDef.parameters.map(param => {
            const existing = bindings.find(b => b.paramName === param.name);
            const sourceType = existing?.source.type || 'Constant';
            const constantValue = existing?.source.type === 'Constant' ? existing.source.value : (param.defaultValue ?? '');
            const varRefId = existing?.source.type === 'VariableRef' ? existing.source.variableId : '';
            const varRefScope = existing?.source.type === 'VariableRef' ? existing.source.scope : 'Global';

            return (
                <div key={param.name} style={{ padding: '8px', background: '#1a1a1a', borderRadius: '4px', marginBottom: '8px', border: '1px solid #333' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                        <span style={{ fontSize: '12px', color: '#ccc', fontWeight: 500 }}>{param.name}</span>
                        <span style={{ fontSize: '10px', color: '#666', background: '#2a2a2a', padding: '2px 6px', borderRadius: '3px' }}>{param.type}</span>
                    </div>

                    {param.description && (
                        <div style={{ fontSize: '10px', color: '#888', marginBottom: '6px' }}>{param.description}</div>
                    )}

                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <select
                            value={sourceType}
                            onChange={(e) => {
                                const newType = e.target.value as 'Constant' | 'VariableRef';
                                if (newType === 'Constant') {
                                    upsertBinding(param.name, { type: 'Constant', value: param.defaultValue ?? '' });
                                } else {
                                    upsertBinding(param.name, { type: 'VariableRef', variableId: '', scope: 'Global' });
                                }
                            }}
                            style={{ background: '#222', color: '#ccc', border: '1px solid #444', padding: '4px', borderRadius: '3px', fontSize: '11px' }}
                        >
                            <option value="Constant">Constant</option>
                            <option value="VariableRef">Variable</option>
                        </select>

                        {sourceType === 'Constant' ? (
                            <input
                                type={param.type === 'integer' || param.type === 'float' ? 'number' : 'text'}
                                value={constantValue}
                                onChange={(e) => upsertBinding(param.name, { type: 'Constant', value: param.type === 'integer' ? parseInt(e.target.value) : param.type === 'float' ? parseFloat(e.target.value) : e.target.value })}
                                style={{ flex: 1, background: '#222', border: '1px solid #444', color: '#ccc', padding: '4px 8px', borderRadius: '3px', fontSize: '11px' }}
                            />
                        ) : (
                            <select
                                value={varRefId}
                                onChange={(e) => {
                                    const selectedVar = variables.find(v => v.id === e.target.value);
                                    upsertBinding(param.name, { type: 'VariableRef', variableId: e.target.value, scope: selectedVar?.scope || 'Global' });
                                }}
                                style={{ flex: 1, background: '#222', color: '#ccc', border: '1px solid #444', padding: '4px', borderRadius: '3px', fontSize: '11px' }}
                            >
                                <option value="">-- Select Variable --</option>
                                {variables.map(v => (
                                    <option key={v.id} value={v.id}>{v.name} ({v.scope})</option>
                                ))}
                            </select>
                        )}
                    </div>
                </div>
            );
        });
    };

    // 渲染临时参数
    const renderTempParams = () => {
        return tempParams.map(param => (
            <div key={param.id} style={{ padding: '10px', background: '#1a1a2a', borderRadius: '4px', marginBottom: '8px', border: '1px solid #334' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <span style={{ fontSize: '11px', color: '#88a', fontWeight: 500 }}>Temporary Parameter</span>
                    <button
                        onClick={() => removeTempParam(param.id)}
                        style={{ background: 'transparent', border: 'none', color: '#ff6b6b', cursor: 'pointer', fontSize: '14px' }}
                    >
                        ×
                    </button>
                </div>

                {/* Param Name (target script variable) */}
                <div style={{ marginBottom: '6px' }}>
                    <label style={{ fontSize: '10px', color: '#888', display: 'block', marginBottom: '2px' }}>Target Param Name</label>
                    <input
                        type="text"
                        value={param.paramName}
                        onChange={(e) => updateTempParam(param.id, { paramName: e.target.value })}
                        placeholder="param_name"
                        style={{ width: '100%', background: '#222', border: '1px solid #444', color: '#ccc', padding: '4px 8px', borderRadius: '3px', fontSize: '11px' }}
                    />
                </div>

                {/* Type */}
                <div style={{ display: 'flex', gap: '8px', marginBottom: '6px' }}>
                    <div style={{ flex: 1 }}>
                        <label style={{ fontSize: '10px', color: '#888', display: 'block', marginBottom: '2px' }}>Type</label>
                        <select
                            value={param.type}
                            onChange={(e) => updateTempParam(param.id, { type: e.target.value as VariableType })}
                            style={{ width: '100%', background: '#222', color: '#ccc', border: '1px solid #444', padding: '4px', borderRadius: '3px', fontSize: '11px' }}
                        >
                            <option value="string">String</option>
                            <option value="integer">Integer</option>
                            <option value="float">Float</option>
                            <option value="boolean">Boolean</option>
                        </select>
                    </div>
                    <div style={{ flex: 1 }}>
                        <label style={{ fontSize: '10px', color: '#888', display: 'block', marginBottom: '2px' }}>Name</label>
                        <input
                            type="text"
                            value={param.name}
                            onChange={(e) => updateTempParam(param.id, { name: e.target.value })}
                            placeholder="Display name"
                            style={{ width: '100%', background: '#222', border: '1px solid #444', color: '#ccc', padding: '4px 8px', borderRadius: '3px', fontSize: '11px' }}
                        />
                    </div>
                </div>

                {/* Comment */}
                <div style={{ marginBottom: '6px' }}>
                    <label style={{ fontSize: '10px', color: '#888', display: 'block', marginBottom: '2px' }}>Comment</label>
                    <input
                        type="text"
                        value={param.comment}
                        onChange={(e) => updateTempParam(param.id, { comment: e.target.value })}
                        placeholder="Optional comment"
                        style={{ width: '100%', background: '#222', border: '1px solid #444', color: '#ccc', padding: '4px 8px', borderRadius: '3px', fontSize: '11px' }}
                    />
                </div>

                {/* Value Source */}
                <div>
                    <label style={{ fontSize: '10px', color: '#888', display: 'block', marginBottom: '2px' }}>Value Source</label>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <select
                            value={param.valueSourceType}
                            onChange={(e) => updateTempParam(param.id, { valueSourceType: e.target.value as 'Constant' | 'VariableRef' })}
                            style={{ background: '#222', color: '#ccc', border: '1px solid #444', padding: '4px', borderRadius: '3px', fontSize: '11px' }}
                        >
                            <option value="Constant">Constant</option>
                            <option value="VariableRef">Variable</option>
                        </select>

                        {param.valueSourceType === 'Constant' ? (
                            <input
                                type={param.type === 'integer' || param.type === 'float' ? 'number' : 'text'}
                                value={param.constantValue}
                                onChange={(e) => updateTempParam(param.id, { constantValue: param.type === 'integer' ? parseInt(e.target.value) : param.type === 'float' ? parseFloat(e.target.value) : e.target.value })}
                                placeholder="Value"
                                style={{ flex: 1, background: '#222', border: '1px solid #444', color: '#ccc', padding: '4px 8px', borderRadius: '3px', fontSize: '11px' }}
                            />
                        ) : (
                            <select
                                value={param.variableRefId}
                                onChange={(e) => {
                                    const selectedVar = variables.find(v => v.id === e.target.value);
                                    updateTempParam(param.id, { variableRefId: e.target.value, variableRefScope: selectedVar?.scope || 'Global' });
                                }}
                                style={{ flex: 1, background: '#222', color: '#ccc', border: '1px solid #444', padding: '4px', borderRadius: '3px', fontSize: '11px' }}
                            >
                                <option value="">-- Select Variable --</option>
                                {variables.map(v => (
                                    <option key={v.id} value={v.id}>{v.name} ({v.scope})</option>
                                ))}
                            </select>
                        )}
                    </div>
                </div>
            </div>
        ));
    };

    return (
        <div style={{ pointerEvents: readOnly ? 'none' : 'auto', opacity: readOnly ? 0.6 : 1 }}>
            {/* Defined Parameters */}
            <div style={{ marginBottom: '12px' }}>
                <div style={{ fontSize: '10px', color: '#888', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Script Parameters</div>
                {renderDefinedParams()}
            </div>

            {/* Temporary Parameters */}
            <div>
                <div style={{ fontSize: '10px', color: '#88a', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Temporary Parameters</div>
                {tempParams.length === 0 && (
                    <div style={{ fontSize: '11px', color: '#666', fontStyle: 'italic', padding: '8px', marginBottom: '8px' }}>
                        No temporary parameters added.
                    </div>
                )}
                {renderTempParams()}
                <button
                    onClick={addTempParam}
                    style={{ background: '#2e5d32', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: '3px', cursor: 'pointer', fontSize: '11px' }}
                >
                    + Temporary Parameter
                </button>
            </div>
        </div>
    );
};
