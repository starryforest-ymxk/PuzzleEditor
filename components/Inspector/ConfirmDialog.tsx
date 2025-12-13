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
    references?: string[];
    totalReferences?: number;
    onConfirm: () => void;
    onCancel: () => void;
}

const dialogColors = {
    overlay: 'rgba(0,0,0,0.55)',
    background: '#1f1f23',
    border: '#52525b',
    borderSecondary: '#3f3f46',
    text: '#e4e4e7',
    accent: '#f97316',
    muted: '#a1a1aa',
    panel: '#18181b'
};

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
    title,
    message,
    confirmText = 'Confirm',
    cancelText = 'Cancel',
    references = [],
    totalReferences,
    onConfirm,
    onCancel
}) => {
    const hasRefs = references.length > 0;
    const moreCount = totalReferences !== undefined && totalReferences > references.length
        ? totalReferences - references.length
        : 0;

    return (
        <div style={{
            position: 'fixed',
            top: 0, left: 0, right: 0, bottom: 0,
            background: dialogColors.overlay,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999
        }}>
            <div style={{
                width: '420px',
                background: dialogColors.background,
                border: `1px solid ${dialogColors.border}`,
                borderRadius: '6px',
                boxShadow: '0 12px 32px rgba(0,0,0,0.45)',
                padding: '20px',
                color: dialogColors.text,
                fontFamily: 'Inter, "IBM Plex Mono", monospace'
            }}>
                <div style={{ fontSize: '13px', letterSpacing: '0.5px', color: dialogColors.accent, marginBottom: '8px', textTransform: 'uppercase' }}>
                    {title}
                </div>
                <div style={{ fontSize: '14px', marginBottom: hasRefs ? '12px' : '16px', lineHeight: 1.5 }}>
                    {message}
                </div>

                {hasRefs && (
                    <div style={{
                        border: '1px solid #2f2f36',
                        borderRadius: '4px',
                        padding: '10px',
                        background: dialogColors.panel,
                        maxHeight: '140px',
                        overflow: 'auto',
                        marginBottom: '12px'
                    }}>
                        <div style={{ fontSize: '12px', color: dialogColors.muted, marginBottom: '6px' }}>Reference preview</div>
                        {references.map((ref, idx) => (
                            <div key={idx} style={{ fontSize: '12px', color: dialogColors.text, lineHeight: 1.4 }}>- {ref}</div>
                        ))}
                        {moreCount > 0 && (
                            <div style={{ fontSize: '12px', color: dialogColors.muted, marginTop: '4px' }}>... {moreCount} more reference(s)</div>
                        )}
                    </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                    <button
                        onClick={onCancel}
                        style={{
                            padding: '8px 14px',
                            borderRadius: '4px',
                            border: `1px solid ${dialogColors.borderSecondary}`,
                            background: '#27272a',
                            color: dialogColors.text,
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
                            border: `1px solid ${dialogColors.accent}`,
                            background: dialogColors.accent,
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

export default ConfirmDialog;
