/**
 * AddDropdown.tsx - 添加条件/组的下拉菜单
 * 规范：Add Condition 直接创建条件，Add Group 创建空组
 */

import React, { useState, useRef, useEffect } from 'react';
import { COLORS } from './conditionStyles';

interface AddDropdownProps {
    onAddCondition: () => void;     // 添加条件回调
    onAddGroup: () => void;         // 添加组回调
    disabled?: boolean;             // 是否禁用
    disabledReason?: string;        // 禁用原因提示（如 not  组限制）
}

/**
 * 添加下拉菜单组件
 * 提供 Add Condition 和 Add Group 两个选项
 */
export const AddDropdown: React.FC<AddDropdownProps> = ({
    onAddCondition,
    onAddGroup,
    disabled,
    disabledReason
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // 点击外部关闭下拉菜单
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
                setIsOpen(false);
            }
        };
        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isOpen]);

    // 菜单项样式
    const menuItemStyle: React.CSSProperties = {
        display: 'block',
        width: '100%',
        padding: '8px 12px',
        fontSize: '12px',
        color: COLORS.textPrimary,
        background: 'transparent',
        border: 'none',
        cursor: 'pointer',
        textAlign: 'left'
    };

    return (
        <div ref={dropdownRef} style={{ position: 'relative', minWidth: 0 }}>
            {/* 触发按钮 */}
            <button
                onClick={() => !disabled && setIsOpen(!isOpen)}
                disabled={disabled}
                title={disabledReason || ''}
                style={{
                    padding: '4px 10px',
                    fontSize: '11px',
                    fontWeight: 600,
                    border: `1px solid ${COLORS.borderPrimary}`,
                    borderRadius: '4px',
                    background: COLORS.bgSecondary,
                    color: disabled ? COLORS.textDisabled : COLORS.textSecondary,
                    cursor: disabled ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    opacity: disabled ? 0.6 : 1,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    minWidth: 0,
                    maxWidth: '100%'
                }}
            >
                + Add
                <span style={{ fontSize: '10px' }}>▼</span>
            </button>

            {/* 下拉菜单 */}
            {isOpen && (
                <div style={{
                    position: 'absolute',
                    top: '100%',
                    right: 0,
                    marginTop: '4px',
                    background: COLORS.bgPrimary,
                    border: `1px solid ${COLORS.borderPrimary}`,
                    borderRadius: '6px',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
                    zIndex: 100,
                    minWidth: '140px',
                    overflow: 'hidden'
                }}>
                    {/* Add Condition - 直接创建 */}
                    <button
                        onClick={() => { onAddCondition(); setIsOpen(false); }}
                        style={menuItemStyle}
                        onMouseEnter={(e) => e.currentTarget.style.background = COLORS.bgSecondary}
                        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                    >
                        Add Condition
                    </button>

                    {/* Add Group */}
                    <button
                        onClick={() => { onAddGroup(); setIsOpen(false); }}
                        style={menuItemStyle}
                        onMouseEnter={(e) => e.currentTarget.style.background = COLORS.bgSecondary}
                        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                    >
                        Add Group
                    </button>
                </div>
            )}
        </div>
    );
};
