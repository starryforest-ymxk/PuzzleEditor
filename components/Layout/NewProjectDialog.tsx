/**
 * components/Layout/NewProjectDialog.tsx
 * 新建工程弹窗 - 输入项目名称和描述
 * 
 * P4-T06: 项目级操作与多工程支持
 */

import React, { useState, useRef, useEffect } from 'react';

// 弹窗颜色配置（与 ConfirmDialog 保持一致）
const dialogColors = {
    overlay: 'rgba(0,0,0,0.55)',
    background: '#1f1f23',
    border: '#52525b',
    borderSecondary: '#3f3f46',
    text: '#e4e4e7',
    accent: '#22c55e',  // 使用绿色突出创建按钮
    muted: '#a1a1aa',
    panel: '#18181b',
    inputBg: '#27272a'
};

interface NewProjectDialogProps {
    onConfirm: (name: string, description: string) => void;
    onCancel: () => void;
}

export const NewProjectDialog: React.FC<NewProjectDialogProps> = ({
    onConfirm,
    onCancel
}) => {
    const [name, setName] = useState('New Project');
    const [description, setDescription] = useState('');
    const nameInputRef = useRef<HTMLInputElement>(null);

    // 自动聚焦并选中名称输入框
    useEffect(() => {
        if (nameInputRef.current) {
            nameInputRef.current.focus();
            nameInputRef.current.select();
        }
    }, []);

    const handleSubmit = () => {
        if (!name.trim()) return;
        onConfirm(name.trim(), description.trim());
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && name.trim()) {
            handleSubmit();
        } else if (e.key === 'Escape') {
            onCancel();
        }
    };

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
                {/* 标题 */}
                <div style={{
                    fontSize: '13px',
                    letterSpacing: '0.5px',
                    color: dialogColors.accent,
                    marginBottom: '16px',
                    textTransform: 'uppercase'
                }}>
                    Create New Project
                </div>

                {/* 名称输入 */}
                <div style={{ marginBottom: '12px' }}>
                    <label style={{
                        display: 'block',
                        fontSize: '11px',
                        color: dialogColors.muted,
                        marginBottom: '6px',
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px'
                    }}>
                        Project Name *
                    </label>
                    <input
                        ref={nameInputRef}
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        onKeyDown={handleKeyDown}
                        style={{
                            width: '100%',
                            padding: '10px 12px',
                            borderRadius: '4px',
                            border: `1px solid ${dialogColors.borderSecondary}`,
                            background: dialogColors.inputBg,
                            color: dialogColors.text,
                            fontSize: '14px',
                            outline: 'none',
                            boxSizing: 'border-box'
                        }}
                        placeholder="Enter project name"
                    />
                </div>

                {/* 描述输入 */}
                <div style={{ marginBottom: '20px' }}>
                    <label style={{
                        display: 'block',
                        fontSize: '11px',
                        color: dialogColors.muted,
                        marginBottom: '6px',
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px'
                    }}>
                        Description (Optional)
                    </label>
                    <textarea
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Escape') onCancel();
                        }}
                        style={{
                            width: '100%',
                            padding: '10px 12px',
                            borderRadius: '4px',
                            border: `1px solid ${dialogColors.borderSecondary}`,
                            background: dialogColors.inputBg,
                            color: dialogColors.text,
                            fontSize: '14px',
                            outline: 'none',
                            boxSizing: 'border-box',
                            resize: 'vertical',
                            minHeight: '60px'
                        }}
                        placeholder="Enter project description"
                    />
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
                        onClick={handleSubmit}
                        disabled={!name.trim()}
                        style={{
                            padding: '8px 14px',
                            borderRadius: '4px',
                            border: `1px solid ${dialogColors.accent}`,
                            background: name.trim() ? dialogColors.accent : '#3f3f46',
                            color: name.trim() ? '#0b0b0f' : dialogColors.muted,
                            fontWeight: 600,
                            cursor: name.trim() ? 'pointer' : 'not-allowed'
                        }}
                    >
                        Create Project
                    </button>
                </div>
            </div>
        </div>
    );
};

export default NewProjectDialog;
