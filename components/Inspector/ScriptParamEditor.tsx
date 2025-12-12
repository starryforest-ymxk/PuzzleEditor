import React from 'react';
import { ScriptDefinition, ScriptParameterDefinition } from '../../types/manifest';
import { ParameterBinding } from '../../types/common';
import { VariableDefinition } from '../../types/blackboard';
import { ValueSourceEditor } from './ValueSourceEditor';

interface Props {
    scriptDef: ScriptDefinition;
    bindings: ParameterBinding[];
    onChange: (next: ParameterBinding[]) => void;
    variables: VariableDefinition[];
}

export const ScriptParamEditor = ({ scriptDef, bindings, onChange, variables }: Props) => {
    // 兼容 manifest 中暂未定义参数字段的脚本，安全回退为空数组
    const params: ScriptParameterDefinition[] = (scriptDef as ScriptDefinition & { parameters?: ScriptParameterDefinition[] }).parameters || [];
    const upsert = (paramName: string, source: ParameterBinding['source']) => {
        const filtered = bindings.filter(b => b.paramName !== paramName);
        onChange([...filtered, { paramName, source }]);
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '12px' }}>
            {params.map(param => {
                const existing = bindings.find(b => b.paramName === param.name);
                const currentSource = existing?.source || { type: 'Constant', value: param.defaultValue ?? '' };
                const label = param.type === 'enum' && param.options ? `${param.name} (enum)` : param.name;
                return (
                    <div key={param.name} style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <label style={{ color: '#aaa', fontSize: '11px' }}>{label}</label>
                            <span style={{ fontSize: '9px', color: '#555' }}>{param.type}</span>
                        </div>
                        <ValueSourceEditor
                            source={currentSource}
                            onChange={(src) => upsert(param.name, src)}
                            variables={variables}
                            valueType={param.type as any}
                        />
                    </div>
                );
            })}

            {params.length === 0 && (
                <div style={{ fontSize: '11px', color: '#666', fontStyle: 'italic' }}>
                    No parameters required.
                </div>
            )}
        </div>
    );
};
