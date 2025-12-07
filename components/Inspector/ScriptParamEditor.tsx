
import React from 'react';
import { ScriptDefinition, ScriptParameterDefinition } from '../../types/manifest';

interface Props {
  scriptDef: ScriptDefinition;
  values: Record<string, any>;
  onChange: (paramName: string, value: any) => void;
}

const renderInput = (param: ScriptParameterDefinition, value: any, onChange: (val: any) => void) => {
    // 1. Enum / Options (Select)
    if (param.options && param.options.length > 0) {
        return (
            <select
                value={value ?? param.defaultValue ?? ''}
                onChange={(e) => onChange(e.target.value)}
                style={{ 
                    width: '100%', background: '#222', color: '#eee', 
                    border: '1px solid #444', padding: '4px', fontSize: '11px' 
                }}
            >
                {param.options.map(opt => (
                    <option key={opt} value={opt}>{opt}</option>
                ))}
            </select>
        );
    }

    // 2. Boolean (Checkbox)
    if (param.type === 'boolean') {
        return (
            <input 
                type="checkbox"
                checked={!!(value ?? param.defaultValue)}
                onChange={(e) => onChange(e.target.checked)}
            />
        );
    }

    // 3. Number (Integer/Float)
    if (param.type === 'integer' || param.type === 'float') {
        return (
            <input 
                type="number"
                step={param.type === 'float' ? '0.1' : '1'}
                value={value ?? param.defaultValue ?? 0}
                onChange={(e) => {
                    const val = param.type === 'integer' ? parseInt(e.target.value) : parseFloat(e.target.value);
                    onChange(isNaN(val) ? 0 : val);
                }}
                style={{ 
                    width: '100%', background: '#1e1e1e', color: '#e0e0e0', 
                    border: '1px solid #333', padding: '4px', fontSize: '11px' 
                }}
            />
        );
    }

    // 4. String / Default
    return (
        <input 
            type="text"
            value={value ?? param.defaultValue ?? ''}
            onChange={(e) => onChange(e.target.value)}
            style={{ 
                width: '100%', background: '#1e1e1e', color: '#e0e0e0', 
                border: '1px solid #333', padding: '4px', fontSize: '11px' 
            }}
        />
    );
};

export const ScriptParamEditor = ({ scriptDef, values, onChange }: Props) => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '12px' }}>
        {scriptDef.parameters.map(param => (
            <div key={param.name} style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <label style={{ color: '#aaa', fontSize: '11px' }}>{param.name}</label>
                    <span style={{ fontSize: '9px', color: '#555' }}>{param.type}</span>
                </div>
                <div>
                    {renderInput(param, values[param.name], (val) => onChange(param.name, val))}
                </div>
            </div>
        ))}
        {scriptDef.parameters.length === 0 && (
            <div style={{ fontSize: '11px', color: '#666', fontStyle: 'italic' }}>
                No parameters required.
            </div>
        )}
    </div>
  );
};
