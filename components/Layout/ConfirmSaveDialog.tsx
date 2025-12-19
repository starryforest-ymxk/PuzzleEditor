/**
 * components/Layout/ConfirmSaveDialog.tsx
 * 切换/关闭工程确认弹窗 - 提示用户保存未保存的更改
 * 
 * P4-T06: 项目级操作与多工程支持
 */

import React from 'react';

// 弹窗颜色配置（与 ConfirmDialog 保持一致）
const dialogColors = {
    overlay: 'rgba(0,0,0,0.55)',
    background: '#1f1f23',
    border: '#52525b',
    borderSecondary: '#3f3f46',
    text: '#e4e4e7',
    accent: '#f97316',
    warning: '#eab308',
    danger: '#ef4444',
    muted: '#a1a1aa',
    panel: '#18181b'
};

interface ConfirmSaveDialogProps {
    /** 下一步操作的描述，如 "create a new project" 或 "load another project" */
    nextAction: string;
    onSave: () => void;       // 保存并继续
    onDiscard: () => void;    // 丢弃更改
    onCancel: () => void;     // 取消操作
}

export const ConfirmSaveDialog: React.FC<ConfirmSaveDialogProps> = ({
    nextAction,
    onSave,
    onDiscard,
    onCancel
}) => {
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
                width: '440px',
                background: dialogColors.background,
                border: `1px solid ${dialogColors.border}`,
                borderRadius: '6px',
                boxShadow: '0 12px 32px rgba(0,0,0,0.45)',
                padding: '20px',
                color: dialogColors.text,
                fontFamily: 'Inter, "IBM Plex Mono", monospace'
            }}>
                {/* 标题 */}
                <div style={{
                    fontSize: '13px',
                    letterSpacing: '0.5px',
                    color: dialogColors.warning,
                    marginBottom: '12px',
                    textTransform: 'uppercase',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                }}>
                    <span style={{ fontSize: '16px' }}>⚠</span>
                    Unsaved Changes
                </div>

                {/* 内容 */}
                <div style={{ fontSize: '14px', marginBottom: '20px', lineHeight: 1.6 }}>
                    You have unsaved changes in the current project.
                    What would you like to do before you {nextAction}?
                </div>

                {/* 按钮区域 */}
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
                        Cancel
                    </button>
                    <button
                        onClick={onDiscard}
                        style={{
                            padding: '8px 14px',
                            borderRadius: '4px',
                            border: `1px solid ${dialogColors.danger}`,
                            background: 'transparent',
                            color: dialogColors.danger,
                            cursor: 'pointer'
                        }}
                    >
                        Discard
                    </button>
                    <button
                        onClick={onSave}
                        style={{
                            padding: '8px 14px',
                            borderRadius: '4px',
                            border: `1px solid #22c55e`,
                            background: '#22c55e',
                            color: '#0b0b0f',
                            fontWeight: 600,
                            cursor: 'pointer'
                        }}
                    >
                        Save & Continue
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ConfirmSaveDialog;
