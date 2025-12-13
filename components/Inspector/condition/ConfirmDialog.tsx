/**
 * ConfirmDialog.tsx - 通用确认弹窗组件
 * 用于需要用户确认的危险操作（如删除）
 */

import React from 'react';
import { COLORS } from './conditionStyles';

interface ConfirmDialogProps {
    title: string;           // 弹窗标题
    message: string;         // 确认提示信息
    confirmText?: string;    // 确认按钮文字，默认 "Delete"
    cancelText?: string;     // 取消按钮文字，默认 "Cancel"
    onConfirm: () => void;   // 确认回调
    onCancel: () => void;    // 取消回调
}

/**
 * 确认弹窗组件
 * 复用 LocalVariableEditor 的弹窗样式，保持 UI 一致性
 */
export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
    title,
    message,
    confirmText = 'Delete',
    cancelText = 'Cancel',
    onConfirm,
    onCancel
}) => {
    return (
        <div style={{
            position: 'fixed',
            top: 0, left: 0, right: 0, bottom: 0,
            background: COLORS.overlayBg,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999
        }}>
            <div style={{
                width: '400px',
                background: COLORS.bgPrimary,
                border: `1px solid ${COLORS.borderSecondary}`,
                borderRadius: '6px',
                boxShadow: '0 12px 32px rgba(0,0,0,0.45)',
                padding: '20px',
                color: COLORS.textPrimary,
                fontFamily: 'Inter, "IBM Plex Mono", monospace'
            }}>
                {/* 标题 */}
                <div style={{
                    fontSize: '13px',
                    letterSpacing: '0.5px',
                    color: COLORS.accent,
                    marginBottom: '8px',
                    textTransform: 'uppercase'
                }}>
                    {title}
                </div>

                {/* 提示信息 */}
                <div style={{
                    fontSize: '14px',
                    marginBottom: '16px',
                    lineHeight: 1.5
                }}>
                    {message}
                </div>

                {/* 操作按钮 */}
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                    <button
                        onClick={onCancel}
                        style={{
                            padding: '8px 14px',
                            borderRadius: '4px',
                            border: `1px solid ${COLORS.borderPrimary}`,
                            background: COLORS.bgSecondary,
                            color: COLORS.textPrimary,
                            cursor: 'pointer'
                        }}
                    >
                        {cancelText}
                    </button>
                    <button
                        onClick={onConfirm}
                        style={{
                            padding: '8px 14px',
                            borderRadius: '4px',
                            border: `1px solid ${COLORS.accent}`,
                            background: COLORS.accent,
                            color: '#0b0b0f',
                            fontWeight: 600,
                            cursor: 'pointer'
                        }}
                    >
                        {confirmText}
                    </button>
                </div>
            </div>
        </div>
    );
};
