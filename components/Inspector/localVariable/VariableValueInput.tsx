/**
 * components/Inspector/localVariable/VariableValueInput.tsx
 * 局部变量值输入组件
 * 
 * 职责：
 * - 根据变量类型渲染对应的输入控件（boolean 用 select，其他用 input）
 * - 使用统一的 CSS 类保证与类型选择器高度一致
 */

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
    // 只读模式：显示静态文本
    if (!canMutate) {
        return (
            <span className="local-variable-card__value-static">
                {String(value)}
            </span>
        );
    }

    // 布尔类型：下拉选择框
    if (type === 'boolean') {
        return (
            <select
                className="local-variable-card__value-select"
                value={(value === true || value === 'true') ? 'true' : 'false'}
                onChange={(e) => onChange(e.target.value === 'true')}
                disabled={disabled}
            >
                <option value="true">True</option>
                <option value="false">False</option>
            </select>
        );
    }

    // 其他类型：文本输入框
    return (
        <input
            type="text"
            className="local-variable-card__value-text-input"
            value={String(value ?? '')}
            onChange={(e) => onChange(e.target.value)}
            onBlur={(e) => onNumberBlur(e.target.value)}
            disabled={disabled}
        />
    );
};
