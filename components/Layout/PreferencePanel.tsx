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
import { useEditorState, useEditorDispatch } from '../../store/context';
import type { TranslationProvider } from '../../types/settings';
import { OpenAIModelSelect } from './OpenAIModelSelect';

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

// 统一的字体和卡片样式
const cardStyles = {
    // 设置项卡片容器
    card: {
        background: dialogColors.panel,
        borderRadius: '4px',
        padding: '16px',
        marginBottom: '16px',
        border: `1px solid ${dialogColors.borderSecondary}`
    },
    // 卡片主标题（白色）
    cardTitle: {
        fontSize: '13px',
        fontWeight: 600,
        color: dialogColors.text,
        marginBottom: '4px'
    },
    // 卡片次级标题/描述（浅灰）
    cardDesc: {
        fontSize: '11px',
        color: dialogColors.muted,
        marginBottom: '12px'
    },
    // 字段标签（如 "Provider", "API Key"）
    label: {
        display: 'block',
        fontSize: '11px',
        color: dialogColors.muted,
        marginBottom: '6px',
        textTransform: 'uppercase' as const,
        letterSpacing: '0.5px'
    },
    // 输入框样式
    input: {
        padding: '10px 12px',
        borderRadius: '4px',
        border: `1px solid ${dialogColors.borderSecondary}`,
        background: dialogColors.inputBg,
        color: dialogColors.text,
        fontSize: '13px',
        outline: 'none',
        boxSizing: 'border-box' as const
    },
    // 帮助文字（最小字号浅灰）
    helpText: {
        fontSize: '11px',
        color: dialogColors.muted
    }
};

// 移除旧的 MODEL_OPTIONS 常量，改用 OpenAIModelSelect 组件


interface PreferencePanelProps {
    onClose: () => void;
}

export const PreferencePanel: React.FC<PreferencePanelProps> = ({ onClose }) => {
    const [preferences, setPreferences] = useState<UserPreferences | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // 翻译设置状态
    const { settings } = useEditorState();
    const dispatch = useEditorDispatch();
    const [translationProvider, setTranslationProvider] = useState<TranslationProvider>(settings.translation.provider);
    const [openaiApiKey, setOpenaiApiKey] = useState(settings.translation.openaiApiKey || '');
    const [googleApiKey, setGoogleApiKey] = useState(settings.translation.googleApiKey || '');
    const [openaiModel, setOpenaiModel] = useState(settings.translation.openaiModel || 'gpt-3.5-turbo');
    const [openaiBaseUrl, setOpenaiBaseUrl] = useState(settings.translation.openaiBaseUrl || '');
    const [googleBaseUrl, setGoogleBaseUrl] = useState(settings.translation.googleBaseUrl || '');
    const [autoTranslate, setAutoTranslate] = useState(settings.translation.autoTranslate || false);

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

                // 从持久化偏好中同步翻译设置
                if (result.data.translation) {
                    setTranslationProvider(result.data.translation.provider);
                    setOpenaiApiKey(result.data.translation.openaiApiKey || '');
                    setGoogleApiKey(result.data.translation.googleApiKey || '');
                    setOpenaiModel(result.data.translation.openaiModel || 'gpt-3.5-turbo');
                    setOpenaiBaseUrl(result.data.translation.openaiBaseUrl || '');
                    setGoogleBaseUrl(result.data.translation.googleBaseUrl || '');
                    setAutoTranslate(result.data.translation.autoTranslate || false);
                }
            } else {
                setError(result.error || 'Failed to load preferences');
            }
            setLoading(false);
        };

        loadPrefs();
    }, []);

    // 保存偏好设置
    const handleSave = async () => {
        // 保存翻译设置到 Store
        dispatch({
            type: 'UPDATE_TRANSLATION_SETTINGS',
            payload: {
                provider: translationProvider,
                openaiApiKey: openaiApiKey.trim() || undefined,
                googleApiKey: googleApiKey.trim() || undefined,
                openaiModel: openaiModel.trim() || 'gpt-3.5-turbo',
                openaiBaseUrl: openaiBaseUrl.trim() || undefined,
                googleBaseUrl: googleBaseUrl.trim() || undefined,
                autoTranslate: autoTranslate
            }
        });

        // Electron 模式下保存文件设置
        if (preferences) {
            setSaving(true);

            // 构建完整的偏好设置对象，包含翻译设置
            const updatedPreferences: UserPreferences = {
                ...preferences,
                translation: {
                    provider: translationProvider,
                    openaiApiKey: openaiApiKey.trim() || undefined,
                    googleApiKey: googleApiKey.trim() || undefined,
                    openaiModel: openaiModel.trim() || 'gpt-3.5-turbo',
                    openaiBaseUrl: openaiBaseUrl.trim() || undefined,
                    googleBaseUrl: googleBaseUrl.trim() || undefined,
                    autoTranslate: autoTranslate
                }
            };

            const result = await savePreferences(updatedPreferences);
            if (!result.success) {
                setError(result.error || 'Failed to save preferences');
                setSaving(false);
                return;
            }
            setSaving(false);
        }
        onClose();
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
                        {/* Projects Directory Card */}
                        <div style={cardStyles.card}>
                            <div style={cardStyles.cardTitle}>Projects Directory</div>
                            <div style={cardStyles.cardDesc}>Default location for new projects</div>
                            <div style={{ display: 'flex', gap: '8px' }}>
                                <input
                                    type="text"
                                    value={preferences.projectsDirectory}
                                    onChange={(e) => setPreferences({ ...preferences, projectsDirectory: e.target.value })}
                                    style={{ ...cardStyles.input, flex: 1 }}
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
                        </div>

                        {/* Restore Last Project Card */}
                        <div style={{ ...cardStyles.card, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <div>
                                <div style={cardStyles.cardTitle}>Restore Last Project</div>
                                <div style={{ ...cardStyles.cardDesc, marginBottom: 0 }}>
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
                                    transition: 'background 0.2s',
                                    flexShrink: 0
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

                        {/* Translation Service Card */}
                        <div style={cardStyles.card}>
                            <div style={cardStyles.cardTitle}>Translation Service</div>
                            <div style={cardStyles.cardDesc}>Configure AssetName auto-fill translation provider</div>

                            {/* Provider Select */}
                            <div style={{ marginBottom: '12px' }}>
                                <label style={cardStyles.label}>Provider</label>
                                <select
                                    value={translationProvider}
                                    onChange={(e) => setTranslationProvider(e.target.value as TranslationProvider)}
                                    style={{ ...cardStyles.input, width: '100%', cursor: 'pointer' }}
                                >
                                    <option value="local">Local Dictionary (Offline)</option>
                                    <option value="openai">OpenAI (Recommended)</option>
                                    <option value="google">Google Translate</option>
                                </select>
                            </div>

                            {/* OpenAI Settings */}
                            {translationProvider === 'openai' && (
                                <>
                                    <div style={{ marginBottom: '12px' }}>
                                        <label style={cardStyles.label}>OpenAI API Key</label>
                                        <input
                                            type="password"
                                            value={openaiApiKey}
                                            onChange={(e) => setOpenaiApiKey(e.target.value)}
                                            placeholder="sk-..."
                                            style={{ ...cardStyles.input, width: '100%', fontFamily: 'monospace' }}
                                        />
                                    </div>
                                    <div style={{ marginBottom: '12px' }}>
                                        <label style={cardStyles.label}>Model</label>
                                        <OpenAIModelSelect
                                            value={openaiModel}
                                            onChange={(val) => setOpenaiModel(val)}
                                            style={{ ...cardStyles.input, width: '100%', cursor: 'pointer' }}
                                        />
                                    </div>
                                    <div style={{ marginBottom: '12px' }}>
                                        <label style={cardStyles.label}>API Base URL (Optional)</label>
                                        <input
                                            type="text"
                                            value={openaiBaseUrl}
                                            onChange={(e) => setOpenaiBaseUrl(e.target.value)}
                                            placeholder="https://api.openai.com/v1"
                                            style={{ ...cardStyles.input, width: '100%', fontFamily: 'monospace' }}
                                        />
                                    </div>
                                    <div style={cardStyles.helpText}>
                                        ⚠️ Note: API calls will incur costs. Base URL can be a custom proxy; leaving this blank uses the default and automatically appends "/v1/chat/completions".
                                    </div>
                                </>
                            )}

                            {/* Google Settings */}
                            {translationProvider === 'google' && (
                                <>
                                    <div style={{ marginBottom: '12px' }}>
                                        <label style={cardStyles.label}>Google Cloud API Key</label>
                                        <input
                                            type="password"
                                            value={googleApiKey}
                                            onChange={(e) => setGoogleApiKey(e.target.value)}
                                            placeholder="AIza..."
                                            style={{ ...cardStyles.input, width: '100%', fontFamily: 'monospace' }}
                                        />
                                    </div>
                                    <div style={{ marginBottom: '12px' }}>
                                        <label style={cardStyles.label}>API Base URL (Optional)</label>
                                        <input
                                            type="text"
                                            value={googleBaseUrl}
                                            onChange={(e) => setGoogleBaseUrl(e.target.value)}
                                            placeholder="https://translation.googleapis.com"
                                            style={{ ...cardStyles.input, width: '100%', fontFamily: 'monospace' }}
                                        />
                                    </div>
                                    <div style={cardStyles.helpText}>
                                        ⚠️ Note: Requires Google Cloud Translation API; leaving this blank uses the default and automatically appends "/language/translate/v2".
                                    </div>
                                </>
                            )}

                            {/* Local Dictionary Info */}
                            {translationProvider === 'local' && (
                                <div style={cardStyles.helpText}>
                                    ✓ Works offline, 150+ game terms included.
                                </div>
                            )}

                            {/* Auto Translate Toggle */}
                            <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                marginTop: '16px',
                                paddingTop: '16px',
                                borderTop: `1px solid ${dialogColors.borderSecondary}`
                            }}>
                                <div>
                                    <div style={cardStyles.cardTitle}>Auto Translate AssetName</div>
                                    <div style={{ ...cardStyles.cardDesc, marginBottom: 0 }}>
                                        Automatically translate name to AssetName when editing completes
                                    </div>
                                </div>
                                <button
                                    onClick={() => setAutoTranslate(!autoTranslate)}
                                    style={{
                                        width: '44px',
                                        height: '24px',
                                        borderRadius: '12px',
                                        border: 'none',
                                        background: autoTranslate ? dialogColors.success : dialogColors.borderSecondary,
                                        cursor: 'pointer',
                                        position: 'relative',
                                        transition: 'background 0.2s',
                                        flexShrink: 0
                                    }}
                                >
                                    <div style={{
                                        width: '18px',
                                        height: '18px',
                                        borderRadius: '50%',
                                        background: '#fff',
                                        position: 'absolute',
                                        top: '3px',
                                        left: autoTranslate ? '23px' : '3px',
                                        transition: 'left 0.2s'
                                    }} />
                                </button>
                            </div>
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
        </div >
    );
};

export default PreferencePanel;

