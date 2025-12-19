/**
 * components/Layout/ProjectMenu.tsx
 * Project 下拉菜单 - 新建、打开、最近项目、导出等操作
 * 
 * P4-T06: Electron 项目管理与用户偏好
 */

import React, { useState, useEffect, useRef } from 'react';
import { ChevronDown, Plus, FolderOpen, Clock, Trash2, FileOutput, Settings, Save, ExternalLink } from 'lucide-react';
import { isElectron, loadPreferences, openFileDialog, readProject, updateRecentProject, removeRecentProject, clearRecentProjects, showInExplorer } from '@/src/electron/api';
import type { RecentProject } from '@/electron/types';

// 菜单颜色配置
const menuColors = {
    background: '#1f1f23',
    border: '#52525b',
    borderSecondary: '#3f3f46',
    text: '#e4e4e7',
    accent: '#f97316',
    muted: '#a1a1aa',
    hover: '#27272a',
    danger: '#ef4444'
};

interface ProjectMenuProps {
    onNewProject: () => void;
    onLoadProject: (path: string, content: string) => void;
    onSave: () => void;
    onEditMetadata: () => void;
    onExport: () => void;
    isProjectLoaded: boolean;
    currentProjectPath?: string;
    disabled?: boolean;
}

export const ProjectMenu: React.FC<ProjectMenuProps> = ({
    onNewProject,
    onLoadProject,
    onSave,
    onEditMetadata,
    onExport,
    isProjectLoaded,
    currentProjectPath,
    disabled = false
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [recentProjects, setRecentProjects] = useState<RecentProject[]>([]);
    const [showRecentSubmenu, setShowRecentSubmenu] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // 加载最近项目列表
    useEffect(() => {
        const loadRecent = async () => {
            if (!isElectron()) return;
            const result = await loadPreferences();
            if (result.success && result.data) {
                setRecentProjects(result.data.recentProjects);
            }
        };

        if (isOpen) {
            loadRecent();
        }
    }, [isOpen]);

    // 点击外部关闭菜单
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
                setIsOpen(false);
                setShowRecentSubmenu(false);
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isOpen]);

    // 打开项目（Electron 或浏览器）
    const handleOpenProject = async () => {
        setIsOpen(false);

        if (isElectron()) {
            // Electron 环境：使用原生对话框
            const dialogResult = await openFileDialog();
            if (!dialogResult || dialogResult.canceled || !dialogResult.filePath) {
                return;
            }

            const readResult = await readProject(dialogResult.filePath);
            if (readResult.success && readResult.data) {
                try {
                    const projectData = JSON.parse(readResult.data);
                    const projectName = projectData?.project?.meta?.name || 'Unknown Project';
                    await updateRecentProject(dialogResult.filePath, projectName);
                } catch {
                    // 忽略解析错误
                }
                onLoadProject(dialogResult.filePath, readResult.data);
            }
        } else {
            // 浏览器环境：使用 input 文件选择
            fileInputRef.current?.click();
        }
    };

    // 浏览器文件选择处理
    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            const content = event.target?.result as string;
            onLoadProject(file.name, content);
        };
        reader.readAsText(file);
        e.target.value = '';
    };

    // 打开最近项目
    const handleOpenRecentProject = async (project: RecentProject) => {
        setIsOpen(false);
        setShowRecentSubmenu(false);

        const readResult = await readProject(project.path);
        if (readResult.success && readResult.data) {
            await updateRecentProject(project.path, project.name);
            onLoadProject(project.path, readResult.data);
        } else {
            // 文件不存在，从列表移除
            await removeRecentProject(project.path);
            setRecentProjects(prev => prev.filter(p => p.path !== project.path));
        }
    };

    // 从最近项目移除
    const handleRemoveRecent = async (e: React.MouseEvent, path: string) => {
        e.stopPropagation();
        await removeRecentProject(path);
        setRecentProjects(prev => prev.filter(p => p.path !== path));
    };

    // 清空最近项目
    const handleClearRecent = async () => {
        await clearRecentProjects();
        setRecentProjects([]);
        setShowRecentSubmenu(false);
    };

    // 格式化日期
    const formatDate = (isoString: string) => {
        try {
            const date = new Date(isoString);
            const now = new Date();
            const diffMs = now.getTime() - date.getTime();
            const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

            if (diffDays === 0) return 'Today';
            if (diffDays === 1) return 'Yesterday';
            if (diffDays < 7) return `${diffDays} days ago`;
            return date.toLocaleDateString();
        } catch {
            return '';
        }
    };

    // 菜单项通用样式
    const menuItemStyle = {
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        padding: '8px 12px',
        cursor: 'pointer',
        fontSize: '13px',
        color: menuColors.text,
        background: 'transparent',
        border: 'none',
        width: '100%',
        textAlign: 'left' as const,
        borderRadius: '4px'
    };

    const menuItemHoverStyle = {
        background: menuColors.hover
    };

    return (
        <div ref={menuRef} style={{ position: 'relative' }}>
            {/* 隐藏的文件输入（浏览器环境） */}
            <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                style={{ display: 'none' }}
                onChange={handleFileChange}
            />

            {/* 菜单触发按钮 */}
            <button
                className="btn-ghost"
                onClick={() => setIsOpen(!isOpen)}
                disabled={disabled}
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    opacity: disabled ? 0.5 : 1
                }}
            >
                Project
                <ChevronDown size={14} style={{ transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
            </button>

            {/* 下拉菜单 */}
            {isOpen && (
                <div style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    marginTop: '4px',
                    width: '220px',
                    background: menuColors.background,
                    border: `1px solid ${menuColors.border}`,
                    borderRadius: '6px',
                    boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
                    padding: '6px',
                    zIndex: 1000
                }}>
                    {/* New Project */}
                    <button
                        style={menuItemStyle}
                        onMouseEnter={(e) => Object.assign(e.currentTarget.style, menuItemHoverStyle)}
                        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                        onClick={() => { setIsOpen(false); onNewProject(); }}
                    >
                        <Plus size={16} style={{ color: menuColors.accent }} />
                        New Project
                    </button>

                    {/* Open Project */}
                    <button
                        style={menuItemStyle}
                        onMouseEnter={(e) => Object.assign(e.currentTarget.style, menuItemHoverStyle)}
                        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                        onClick={handleOpenProject}
                    >
                        <FolderOpen size={16} style={{ color: menuColors.muted }} />
                        Open Project...
                    </button>

                    {/* Open Recent */}
                    <div
                        style={{ position: 'relative' }}
                        onMouseEnter={() => setShowRecentSubmenu(true)}
                        onMouseLeave={() => setShowRecentSubmenu(false)}
                    >
                        <button
                            style={{
                                ...menuItemStyle,
                                justifyContent: 'space-between'
                            }}
                            onMouseEnter={(e) => Object.assign(e.currentTarget.style, menuItemHoverStyle)}
                            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                        >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <Clock size={16} style={{ color: menuColors.muted }} />
                                Open Recent
                            </div>
                            <ChevronDown size={14} style={{ transform: 'rotate(90deg)', color: menuColors.muted }} />
                        </button>

                        {/* Recent Projects Submenu */}
                        {showRecentSubmenu && (
                            <div style={{
                                position: 'absolute',
                                right: '100%',
                                top: 0,
                                marginRight: '-4px',
                                paddingRight: '8px',
                                width: '288px',
                                maxHeight: '300px',
                                overflowY: 'auto',
                                zIndex: 1001
                            }}>
                                <div style={{
                                    background: menuColors.background,
                                    border: `1px solid ${menuColors.border}`,
                                    borderRadius: '6px',
                                    boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
                                    padding: '6px'
                                }}>
                                    {recentProjects.length === 0 ? (
                                        <div style={{ padding: '12px', color: menuColors.muted, fontSize: '12px', textAlign: 'center' }}>
                                            No recent projects
                                        </div>
                                    ) : (
                                        <>
                                            {recentProjects.map((project) => (
                                                <div
                                                    key={project.path}
                                                    style={{
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'space-between',
                                                        padding: '8px 10px',
                                                        borderRadius: '4px',
                                                        cursor: 'pointer'
                                                    }}
                                                    onMouseEnter={(e) => e.currentTarget.style.background = menuColors.hover}
                                                    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                                                    onClick={() => handleOpenRecentProject(project)}
                                                >
                                                    <div style={{ flex: 1, overflow: 'hidden' }}>
                                                        <div style={{ fontSize: '13px', color: menuColors.text, whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                                                            {project.name}
                                                        </div>
                                                        <div style={{ fontSize: '11px', color: menuColors.muted, whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                                                            {formatDate(project.lastOpened)}
                                                        </div>
                                                    </div>
                                                    <button
                                                        style={{
                                                            padding: '4px',
                                                            background: 'transparent',
                                                            border: 'none',
                                                            cursor: 'pointer',
                                                            color: menuColors.muted,
                                                            borderRadius: '4px'
                                                        }}
                                                        onMouseEnter={(e) => e.currentTarget.style.color = menuColors.danger}
                                                        onMouseLeave={(e) => e.currentTarget.style.color = menuColors.muted}
                                                        onClick={(e) => handleRemoveRecent(e, project.path)}
                                                        title="Remove from list"
                                                    >
                                                        <Trash2 size={14} />
                                                    </button>
                                                </div>
                                            ))}

                                            {/* Clear All */}
                                            <div style={{ borderTop: `1px solid ${menuColors.borderSecondary}`, marginTop: '6px', paddingTop: '6px' }}>
                                                <button
                                                    style={{
                                                        ...menuItemStyle,
                                                        color: menuColors.muted,
                                                        fontSize: '12px'
                                                    }}
                                                    onMouseEnter={(e) => Object.assign(e.currentTarget.style, menuItemHoverStyle)}
                                                    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                                                    onClick={handleClearRecent}
                                                >
                                                    <Trash2 size={14} />
                                                    Clear Recent Projects
                                                </button>
                                            </div>
                                        </>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Separator */}
                    <div style={{ height: '1px', background: menuColors.borderSecondary, margin: '6px 0' }} />

                    {/* Save Project */}
                    <button
                        style={{
                            ...menuItemStyle,
                            opacity: isProjectLoaded ? 1 : 0.5,
                            cursor: isProjectLoaded ? 'pointer' : 'not-allowed'
                        }}
                        onMouseEnter={(e) => isProjectLoaded && Object.assign(e.currentTarget.style, menuItemHoverStyle)}
                        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                        onClick={() => { if (isProjectLoaded) { setIsOpen(false); onSave(); } }}
                        disabled={!isProjectLoaded}
                    >
                        <Save size={16} style={{ color: menuColors.accent }} />
                        Save Project
                        <span style={{ marginLeft: 'auto', fontSize: '11px', color: menuColors.muted }}>Ctrl+S</span>
                    </button>

                    {/* Show in Explorer (Electron only) */}
                    {isElectron() && (
                        <button
                            style={{
                                ...menuItemStyle,
                                opacity: currentProjectPath ? 1 : 0.5,
                                cursor: currentProjectPath ? 'pointer' : 'not-allowed'
                            }}
                            onMouseEnter={(e) => currentProjectPath && Object.assign(e.currentTarget.style, menuItemHoverStyle)}
                            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                            onClick={() => { if (currentProjectPath) { setIsOpen(false); showInExplorer(currentProjectPath); } }}
                            disabled={!currentProjectPath}
                        >
                            <ExternalLink size={16} style={{ color: menuColors.muted }} />
                            Show in Explorer
                        </button>
                    )}

                    {/* Project Settings */}
                    <button
                        style={{
                            ...menuItemStyle,
                            opacity: isProjectLoaded ? 1 : 0.5,
                            cursor: isProjectLoaded ? 'pointer' : 'not-allowed'
                        }}
                        onMouseEnter={(e) => isProjectLoaded && Object.assign(e.currentTarget.style, menuItemHoverStyle)}
                        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                        onClick={() => { if (isProjectLoaded) { setIsOpen(false); onEditMetadata(); } }}
                        disabled={!isProjectLoaded}
                    >
                        <Settings size={16} style={{ color: menuColors.muted }} />
                        Project Settings...
                    </button>

                    {/* Separator */}
                    <div style={{ height: '1px', background: menuColors.borderSecondary, margin: '6px 0' }} />

                    {/* Export */}
                    <button
                        style={{
                            ...menuItemStyle,
                            opacity: isProjectLoaded ? 1 : 0.5,
                            cursor: isProjectLoaded ? 'pointer' : 'not-allowed'
                        }}
                        onMouseEnter={(e) => isProjectLoaded && Object.assign(e.currentTarget.style, menuItemHoverStyle)}
                        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                        onClick={() => { if (isProjectLoaded) { setIsOpen(false); onExport(); } }}
                        disabled={!isProjectLoaded}
                    >
                        <FileOutput size={16} style={{ color: menuColors.accent }} />
                        Export
                    </button>
                </div>
            )
            }
        </div >
    );
};

export default ProjectMenu;
