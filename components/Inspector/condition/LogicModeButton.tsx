/**
 * LogicModeButton.tsx - 逻辑模式切换按钮
 * 用于 Condition Builder 的 AND/OR/NOT 模式切换
 */

import React from 'react';
import { BLOCK_STYLES } from './conditionStyles';

interface LogicModeButtonProps {
    mode: 'AND' | 'OR' | 'NOT';    // 逻辑模式
    label?: string;                 // 显示文字（可自定义，如 OR 显示为 ANY）
    isActive: boolean;              // 是否激活状态
    onClick: () => void;            // 点击回调
    disabled?: boolean;             // 是否禁用
}

/**
 * 逻辑模式按钮组件
 * 根据不同逻辑类型应用对应的颜色主题
 */
export const LogicModeButton: React.FC<LogicModeButtonProps> = ({
    mode,
    label,
    isActive,
    onClick,
    disabled
}) => {
    const style = BLOCK_STYLES[mode];

    return (
        <button
            onClick={onClick}
            disabled={disabled}
            style={{
                padding: '4px 10px',
                fontSize: '11px',
                fontWeight: 700,
                letterSpacing: '0.5px',
                border: isActive ? `1px solid ${style.labelColor}` : '1px solid #3f3f46',
                borderRadius: '4px',
                background: isActive ? style.labelBg : 'transparent',
                color: isActive ? style.labelColor : '#71717a',
                cursor: disabled ? 'not-allowed' : 'pointer',
                opacity: disabled ? 0.5 : 1,
                transition: 'all 0.15s ease',
                minWidth: 0,
                flexShrink: 1,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis'
            }}
        >
            {label || mode}
        </button>
    );
};
