import React from 'react';
import type { VariableType } from '../../../types/common';

interface VariableValueInputProps {
    type: VariableType;
    value: any;
    disabled: boolean;
    canMutate: boolean;
    onChange: (val: any) => void;
    onNumberBlur: (raw: any) => void;
}

// 局部变量默认值输入，抽离输入控件以降低主组件复杂度
export const VariableValueInput: React.FC<VariableValueInputProps> = ({
    type,
    value,
    disabled,
    canMutate,
    onChange,
    onNumberBlur
}) => {
    if (!canMutate) {
        return (
            <span style={{ color: '#e0e0e0', fontFamily: 'monospace', fontSize: '11px' }}>
                {String(value)}
            </span>
        );
    }

    if (type === 'boolean') {
        return (
            <select
                value={(value === true || value === 'true') ? 'true' : 'false'}
                onChange={(e) => onChange(e.target.value === 'true')}
                disabled={disabled}
                style={{
                    width: '100%', background: '#1e1e1e', border: '1px solid #333',
                    color: '#e0e0e0', fontFamily: 'monospace', fontSize: '11px', padding: '2px 4px',
                    boxSizing: 'border-box'
                }}
            >
                <option value="true">True</option>
                <option value="false">False</option>
            </select>
        );
    }

    return (
        <input
            type="text"
            value={String(value ?? '')}
            onChange={(e) => onChange(e.target.value)}
            onBlur={(e) => onNumberBlur(e.target.value)}
            disabled={disabled}
            style={{
                width: '100%', background: '#1e1e1e', border: '1px solid #333',
                color: '#e0e0e0', fontFamily: 'monospace', fontSize: '11px', padding: '2px 4px',
                boxSizing: 'border-box'
            }}
        />
    );
};
