/**
 * components/Layout/PreferencePanel.tsx
 * 用户偏好设置面板 - 配置项目存储路径、导出路径等
 * 
 * P4-T06: Electron 项目管理与用户偏好
 */

import React, { useState, useEffect } from 'react';
import { Settings, FolderOpen, RotateCcw } from 'lucide-react';
import { isElectron, loadPreferences, savePreferences, openDirectoryDialog } from '@/src/electron/api';
import type { UserPreferences } from '@/electron/types';

// 弹窗颜色配置（与现有弹窗保持一致）
const dialogColors = {
    overlay: 'rgba(0,0,0,0.55)',
    background: '#1f1f23',
    border: '#52525b',
    borderSecondary: '#3f3f46',
    text: '#e4e4e7',
    accent: '#f97316',
    muted: '#a1a1aa',
    panel: '#18181b',
    inputBg: '#27272a',
    success: '#22c55e'
};

interface PreferencePanelProps {
    onClose: () => void;
}

export const PreferencePanel: React.FC<PreferencePanelProps> = ({ onClose }) => {
    const [preferences, setPreferences] = useState<UserPreferences | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // 加载偏好设置
    useEffect(() => {
        const loadPrefs = async () => {
            if (!isElectron()) {
                setError('Preferences are only available in Electron mode');
                setLoading(false);
                return;
            }

            const result = await loadPreferences();
            if (result.success && result.data) {
                setPreferences(result.data);
            } else {
                setError(result.error || 'Failed to load preferences');
            }
            setLoading(false);
        };

        loadPrefs();
    }, []);

    // 保存偏好设置
    const handleSave = async () => {
        if (!preferences) return;

        setSaving(true);
        const result = await savePreferences(preferences);
        if (result.success) {
            onClose();
        } else {
            setError(result.error || 'Failed to save preferences');
        }
        setSaving(false);
    };

    // 选择目录
    const handleSelectDirectory = async (field: 'projectsDirectory' | 'exportDirectory') => {
        const result = await openDirectoryDialog();
        if (result && !result.canceled && result.filePath) {
            setPreferences(prev => prev ? { ...prev, [field]: result.filePath } : null);
        }
    };

    // 切换布尔值
    const handleToggle = (field: keyof UserPreferences) => {
        setPreferences(prev => prev ? { ...prev, [field]: !prev[field] } : null);
    };

    // 键盘处理
    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Escape') {
            onClose();
        } else if (e.key === 'Enter' && e.ctrlKey) {
            handleSave();
        }
    };

    return (
        <div
            style={{
                position: 'fixed',
                top: 0, left: 0, right: 0, bottom: 0,
                background: dialogColors.overlay,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 9999
            }}
            onClick={(e) => e.target === e.currentTarget && onClose()}
            onKeyDown={handleKeyDown}
        >
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
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    fontSize: '13px',
                    letterSpacing: '0.5px',
                    color: dialogColors.accent,
                    marginBottom: '20px',
                    textTransform: 'uppercase'
                }}>
                    <Settings size={16} />
                    Preferences
                </div>

                {loading ? (
                    <div style={{ textAlign: 'center', padding: '20px', color: dialogColors.muted }}>
                        Loading preferences...
                    </div>
                ) : error && !preferences ? (
                    <div style={{ textAlign: 'center', padding: '20px', color: '#ef4444' }}>
                        {error}
                    </div>
                ) : preferences && (
                    <>
                        {/* Projects Directory */}
                        <div style={{ marginBottom: '16px' }}>
                            <label style={{
                                display: 'block',
                                fontSize: '11px',
                                color: dialogColors.muted,
                                marginBottom: '6px',
                                textTransform: 'uppercase',
                                letterSpacing: '0.5px'
                            }}>
                                Projects Directory
                            </label>
                            <div style={{ display: 'flex', gap: '8px' }}>
                                <input
                                    type="text"
                                    value={preferences.projectsDirectory}
                                    onChange={(e) => setPreferences({ ...preferences, projectsDirectory: e.target.value })}
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
                                />
                                <button
                                    onClick={() => handleSelectDirectory('projectsDirectory')}
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
                                Default location for new projects
                            </div>
                        </div>

                        {/* Restore Last Project Toggle */}
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '12px',
                            background: dialogColors.panel,
                            borderRadius: '4px',
                            border: `1px solid ${dialogColors.borderSecondary}`,
                            marginBottom: '20px'
                        }}>
                            <div>
                                <div style={{ fontSize: '13px', marginBottom: '2px' }}>
                                    Restore Last Project on Startup
                                </div>
                                <div style={{ fontSize: '11px', color: dialogColors.muted }}>
                                    Automatically load the last opened project when starting
                                </div>
                            </div>
                            <button
                                onClick={() => handleToggle('restoreLastProject')}
                                style={{
                                    width: '44px',
                                    height: '24px',
                                    borderRadius: '12px',
                                    border: 'none',
                                    background: preferences.restoreLastProject ? dialogColors.success : dialogColors.borderSecondary,
                                    cursor: 'pointer',
                                    position: 'relative',
                                    transition: 'background 0.2s'
                                }}
                            >
                                <div style={{
                                    width: '18px',
                                    height: '18px',
                                    borderRadius: '50%',
                                    background: '#fff',
                                    position: 'absolute',
                                    top: '3px',
                                    left: preferences.restoreLastProject ? '23px' : '3px',
                                    transition: 'left 0.2s'
                                }} />
                            </button>
                        </div>

                        {/* Error Display */}
                        {error && (
                            <div style={{
                                padding: '10px',
                                background: 'rgba(239, 68, 68, 0.1)',
                                border: '1px solid #ef4444',
                                borderRadius: '4px',
                                color: '#ef4444',
                                fontSize: '12px',
                                marginBottom: '16px'
                            }}>
                                {error}
                            </div>
                        )}

                        {/* Buttons */}
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                            <button
                                onClick={onClose}
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
                                onClick={handleSave}
                                disabled={saving}
                                style={{
                                    padding: '8px 14px',
                                    borderRadius: '4px',
                                    border: `1px solid ${dialogColors.accent}`,
                                    background: dialogColors.accent,
                                    color: '#0b0b0f',
                                    fontWeight: 600,
                                    cursor: saving ? 'wait' : 'pointer',
                                    opacity: saving ? 0.7 : 1
                                }}
                            >
                                {saving ? 'Saving...' : 'Save Preferences'}
                            </button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

export default PreferencePanel;
