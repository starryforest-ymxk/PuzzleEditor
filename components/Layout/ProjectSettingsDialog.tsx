/**
 * components/Layout/ProjectSettingsDialog.tsx
 * 项目设置弹窗 - 编辑项目元信息和导出配置
 * 
 * P4-T06: 项目级操作与多工程支持
 */

import React, { useState, useRef, useEffect } from 'react';
import { FolderOpen } from 'lucide-react';
import { ProjectMeta } from '../../types/project';
import { isElectron, openDirectoryDialog } from '@/src/electron/api';

// 弹窗颜色配置（与 ConfirmDialog 保持一致）
const dialogColors = {
    overlay: 'rgba(0,0,0,0.55)',
    background: '#1f1f23',
    border: '#52525b',
    borderSecondary: '#3f3f46',
    text: '#e4e4e7',
    accent: '#f97316',  // 橙色主题
    muted: '#a1a1aa',
    panel: '#18181b',
    inputBg: '#27272a'
};

interface ProjectSettingsDialogProps {
    meta: ProjectMeta;
    onSave: (updates: Partial<ProjectMeta>) => void;
    onCancel: () => void;
}

export const ProjectSettingsDialog: React.FC<ProjectSettingsDialogProps> = ({
    meta,
    onSave,
    onCancel
}) => {
    const [name, setName] = useState(meta.name);
    const [description, setDescription] = useState(meta.description || '');
    const [version, setVersion] = useState(meta.version);
    const [exportPath, setExportPath] = useState(meta.exportPath || '');
    const [exportFileName, setExportFileName] = useState(meta.exportFileName || '');
    const nameInputRef = useRef<HTMLInputElement>(null);

    // 当 meta 变化时同步更新表单状态
    useEffect(() => {
        setName(meta.name);
        setDescription(meta.description || '');
        setVersion(meta.version);
        setExportPath(meta.exportPath || '');
        setExportFileName(meta.exportFileName || '');
    }, [meta]);

    // 自动聚焦名称输入框
    useEffect(() => {
        if (nameInputRef.current) {
            nameInputRef.current.focus();
            nameInputRef.current.select();
        }
    }, []);

    const handleSubmit = () => {
        if (!name.trim()) return;
        onSave({
            name: name.trim(),
            description: description.trim(),
            version: version.trim() || '1.0.0',
            exportPath: exportPath.trim() || undefined,
            exportFileName: exportFileName.trim() || undefined
        });
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && e.ctrlKey && name.trim()) {
            handleSubmit();
        } else if (e.key === 'Escape') {
            onCancel();
        }
    };

    const handleSelectExportPath = async () => {
        if (isElectron()) {
            const result = await openDirectoryDialog();
            if (result && !result.canceled && result.filePath) {
                setExportPath(result.filePath);
            }
        }
    };

    // 格式化日期显示
    const formatDate = (isoString: string) => {
        if (!isoString) return '-';
        try {
            return new Date(isoString).toLocaleString();
        } catch {
            return isoString;
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
                width: '500px',
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
                    Project Settings
                </div>

                {/* 只读信息区域 */}
                <div style={{
                    background: dialogColors.panel,
                    borderRadius: '4px',
                    padding: '12px',
                    marginBottom: '16px',
                    border: `1px solid ${dialogColors.borderSecondary}`
                }}>
                    <div style={{ display: 'flex', gap: '24px', fontSize: '12px' }}>
                        <div>
                            <span style={{ color: dialogColors.muted }}>ID: </span>
                            <span style={{ fontFamily: 'monospace' }}>{meta.id || '-'}</span>
                        </div>
                    </div>
                    <div style={{ display: 'flex', gap: '24px', fontSize: '12px', marginTop: '6px' }}>
                        <div>
                            <span style={{ color: dialogColors.muted }}>Created: </span>
                            <span>{formatDate(meta.createdAt)}</span>
                        </div>
                        <div>
                            <span style={{ color: dialogColors.muted }}>Updated: </span>
                            <span>{formatDate(meta.updatedAt)}</span>
                        </div>
                    </div>
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
                    />
                </div>

                {/* 版本输入 */}
                <div style={{ marginBottom: '12px' }}>
                    <label style={{
                        display: 'block',
                        fontSize: '11px',
                        color: dialogColors.muted,
                        marginBottom: '6px',
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px'
                    }}>
                        Version
                    </label>
                    <input
                        type="text"
                        value={version}
                        onChange={(e) => setVersion(e.target.value)}
                        onKeyDown={handleKeyDown}
                        style={{
                            width: '120px',
                            padding: '10px 12px',
                            borderRadius: '4px',
                            border: `1px solid ${dialogColors.borderSecondary}`,
                            background: dialogColors.inputBg,
                            color: dialogColors.text,
                            fontSize: '14px',
                            outline: 'none',
                            boxSizing: 'border-box'
                        }}
                        placeholder="1.0.0"
                    />
                </div>

                {/* 描述输入 */}
                <div style={{ marginBottom: '12px' }}>
                    <label style={{
                        display: 'block',
                        fontSize: '11px',
                        color: dialogColors.muted,
                        marginBottom: '6px',
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px'
                    }}>
                        Description
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

                {/* 导出路径配置（仅 Electron 模式） */}
                {isElectron() && (
                    <div style={{ marginBottom: '20px' }}>
                        <label style={{
                            display: 'block',
                            fontSize: '11px',
                            color: dialogColors.muted,
                            marginBottom: '6px',
                            textTransform: 'uppercase',
                            letterSpacing: '0.5px'
                        }}>
                            Export Path
                        </label>
                        <div style={{ display: 'flex', gap: '8px' }}>
                            <input
                                type="text"
                                value={exportPath}
                                onChange={(e) => setExportPath(e.target.value)}
                                onKeyDown={handleKeyDown}
                                style={{
                                    flex: 1,
                                    padding: '10px 12px',
                                    borderRadius: '4px',
                                    border: `1px solid ${dialogColors.borderSecondary}`,
                                    background: dialogColors.inputBg,
                                    color: dialogColors.text,
                                    fontSize: '13px',
                                    outline: 'none'
                                }}
                                placeholder="Use default export directory"
                            />
                            <button
                                onClick={handleSelectExportPath}
                                style={{
                                    padding: '10px 12px',
                                    borderRadius: '4px',
                                    border: `1px solid ${dialogColors.borderSecondary}`,
                                    background: dialogColors.inputBg,
                                    color: dialogColors.text,
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center'
                                }}
                                title="Browse"
                            >
                                <FolderOpen size={16} />
                            </button>
                        </div>
                        <div style={{ fontSize: '11px', color: dialogColors.muted, marginTop: '4px' }}>
                            Leave empty to use default export directory from Preferences
                        </div>
                    </div>
                )}

                {/* 导出文件名 */}
                <div style={{ marginBottom: '20px' }}>
                    <label style={{
                        display: 'block',
                        fontSize: '11px',
                        color: dialogColors.muted,
                        marginBottom: '6px',
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px'
                    }}>
                        Export File Name
                    </label>
                    <input
                        type="text"
                        value={exportFileName}
                        onChange={(e) => setExportFileName(e.target.value)}
                        onKeyDown={handleKeyDown}
                        style={{
                            width: '100%',
                            boxSizing: 'border-box',
                            padding: '10px 12px',
                            borderRadius: '4px',
                            border: `1px solid ${dialogColors.borderSecondary}`,
                            background: dialogColors.inputBg,
                            color: dialogColors.text,
                            fontSize: '13px',
                            outline: 'none'
                        }}
                        placeholder={`${name || 'project'}.export`}
                    />
                    <div style={{ fontSize: '11px', color: dialogColors.muted, marginTop: '4px' }}>
                        Leave empty to use default: {`<project_name>.export.json`}
                    </div>
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
                        Save Changes
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ProjectSettingsDialog;

