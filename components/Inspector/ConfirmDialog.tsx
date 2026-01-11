/**
 * 通用确认弹窗组件（Inspector 区域复用）
 * 采用与现有软删弹窗一致的样式，支持引用预览。
 */
import React from 'react';

interface ConfirmDialogProps {
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    onConfirm: () => void;
    onCancel: () => void;
    references?: string[];
}

// 统一深色弹窗配色
const dialogColors = {
    background: '#1f1f23',
    panel: '#27272a',
    border: '#3f3f46',
    text: '#e4e4e7',
    muted: '#a1a1aa',
    accent: '#ef4444', // Danger Red
    buttonPrimary: '#ef4444',
    buttonSecondary: '#3f3f46'
};

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
    title,
    message,
    confirmText = 'Confirm',
    cancelText = 'Cancel',
    onConfirm,
    onCancel,
    references
}) => {
    return (
        <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999
        }}>
            <div style={{
                backgroundColor: dialogColors.background,
                border: `1px solid ${dialogColors.border}`,
                width: '440px',
                borderRadius: '8px',
                padding: '20px',
                boxShadow: '0 8px 30px rgba(0, 0, 0, 0.5)',
                display: 'flex',
                flexDirection: 'column',
                gap: '16px'
            }}>
                <div style={{ fontSize: '16px', fontWeight: 600, color: dialogColors.text }}>
                    {title}
                </div>
                <div style={{ fontSize: '13px', color: dialogColors.muted, lineHeight: '1.5' }}>
                    {message}
                </div>

                {/* 引用列表预览 */}
                {references && references.length > 0 && (
                    <div style={{
                        marginTop: '4px',
                        backgroundColor: '#18181b',
                        border: `1px solid ${dialogColors.border}`,
                        borderRadius: '4px',
                        padding: '8px',
                        maxHeight: '120px',
                        overflowY: 'auto'
                    }}>
                        <div style={{ fontSize: '11px', color: '#71717a', marginBottom: '6px', fontWeight: 500 }}>
                            References Found ({references.length}):
                        </div>
                        {references.map((ref, i) => (
                            <div key={i} style={{ fontSize: '12px', color: '#d4d4d8', padding: '2px 0' }}>
                                • {ref}
                            </div>
                        ))}
                    </div>
                )}

                <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '8px' }}>
                    <button
                        onClick={onCancel}
                        style={{
                            padding: '6px 16px',
                            background: 'transparent',
                            border: `1px solid ${dialogColors.border}`,
                            borderRadius: '4px',
                            color: dialogColors.text,
                            cursor: 'pointer',
                            fontSize: '13px'
                        }}
                    >
                        {cancelText}
                    </button>
                    <button
                        onClick={onConfirm}
                        style={{
                            padding: '6px 16px',
                            background: dialogColors.buttonPrimary,
                            border: 'none',
                            borderRadius: '4px',
                            color: '#fff',
                            cursor: 'pointer',
                            fontSize: '13px',
                            fontWeight: 500
                        }}
                    >
                        {confirmText}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ConfirmDialog;
