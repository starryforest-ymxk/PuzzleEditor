import { MenuSurface, MenuItem, MenuSeparator } from '../shared/Menu';
/**
 * components/Layout/ProjectMenu.tsx
 * Project 下拉菜单 - 新建、打开、最近项目、导出等操作
 *
 * P4-T06: Electron 项目管理与用户偏好
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  ChevronDown,
  Plus,
  FolderOpen,
  Clock,
  Trash2,
  FileOutput,
  Settings,
  Save,
  ExternalLink,
  CheckCircle,
} from 'lucide-react';
import {
  isElectron,
  loadPreferences,
  removeRecentProject,
  clearRecentProjects,
  showInExplorer,
} from '@/platform/electron';
import type { RecentProject } from '@/electron/types';
import type { SessionResult, SaveResult } from '../../services/projectSession';

// 菜单颜色配置

interface ProjectMenuProps {
  onNewProject: () => void;
  onOpenProject: (path?: string) => Promise<SessionResult>;
  onSave: () => Promise<SaveResult>;
  onEditMetadata: () => void;
  onExport: () => void;
  onValidate: () => void;
  isProjectLoaded: boolean;
  currentProjectPath?: string;
  disabled?: boolean;
}

export const ProjectMenu: React.FC<ProjectMenuProps> = ({
  onNewProject,
  onOpenProject,
  onSave,
  onEditMetadata,
  onExport,
  onValidate,
  isProjectLoaded,
  currentProjectPath,
  disabled = false,
}) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [recentProjects, setRecentProjects] = useState<RecentProject[]>([]);
  const [showRecentSubmenu, setShowRecentSubmenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // 加载最近项目列表
  useEffect(() => {
    const loadRecent = async () => {
      if (!isElectron()) return;
      const result = await loadPreferences();
      if (result.success && result.data) {
        setRecentProjects(result.data.recentProjects);
      }
    };

    if (isMenuOpen) {
      loadRecent();
    }
  }, [isMenuOpen]);

  // 点击外部关闭菜单

  // 所有打开入口交给同一个候选读取与保存确认流程。
  const handleOpenProject = async () => {
    setIsMenuOpen(false);
    await onOpenProject();
  };
  const handleOpenRecentProject = async (project: RecentProject) => {
    setIsMenuOpen(false);
    setShowRecentSubmenu(false);
    await onOpenProject(project.path);
  };

  // 从最近项目移除（手动点垃圾桶）
  const handleRemoveRecent = async (e: React.MouseEvent, path: string) => {
    e.stopPropagation();
    await removeRecentProject(path);
    setRecentProjects((prev) => prev.filter((p) => p.path !== path));
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

  return (
    <div ref={menuRef} style={{ position: 'relative' }}>
      {/* 菜单触发按钮 */}
      <button
        className="btn-ghost"
        onClick={() => setIsMenuOpen(!isMenuOpen)}
        disabled={disabled}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          opacity: disabled ? 0.5 : 1,
        }}
      >
        Project
        <ChevronDown
          size={14}
          style={{
            transform: isMenuOpen ? 'rotate(180deg)' : 'none',
            transition: 'transform 0.2s',
          }}
        />
      </button>

      {/* 下拉菜单 */}
      {isMenuOpen && (
        <MenuSurface
          boundaryRef={menuRef}
          onClose={() => {
            setIsMenuOpen(false);
            setShowRecentSubmenu(false);
          }}
          style={{ position: 'absolute', top: '100%', left: 0, width: '220px' }}
        >
          {/* New Project */}
          <MenuItem
            onClick={() => {
              setIsMenuOpen(false);
              onNewProject();
            }}
          >
            <Plus size={16} style={{ color: 'var(--accent-color)' }} />
            New Project
          </MenuItem>

          {/* Open Project */}
          <MenuItem onClick={handleOpenProject}>
            <FolderOpen size={16} style={{ color: 'var(--text-secondary)' }} />
            Open Project...
          </MenuItem>

          {/* Open Recent */}
          <div
            style={{ position: 'relative' }}
            onMouseEnter={() => setShowRecentSubmenu(true)}
            onMouseLeave={() => setShowRecentSubmenu(false)}
          >
            <MenuItem
              aria-haspopup="menu"
              aria-expanded={showRecentSubmenu}
              onClick={() => setShowRecentSubmenu(true)}
              style={{ justifyContent: 'space-between' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Clock size={16} style={{ color: 'var(--text-secondary)' }} />
                Open Recent
              </div>
              <ChevronDown
                size={14}
                style={{ transform: 'rotate(90deg)', color: 'var(--text-secondary)' }}
              />
            </MenuItem>

            {/* Recent Projects Submenu */}
            {showRecentSubmenu && (
              <div
                style={{
                  position: 'absolute',
                  right: '100%',
                  top: 0,
                  marginRight: '-4px',
                  paddingRight: '8px',
                  width: '288px',
                  maxHeight: '300px',
                  overflowY: 'auto',
                  zIndex: 1001,
                }}
              >
                <MenuSurface submenu>
                  {recentProjects.length === 0 ? (
                    <div
                      style={{
                        padding: '12px',
                        color: 'var(--text-secondary)',
                        fontSize: '12px',
                        textAlign: 'center',
                      }}
                    >
                      No recent projects
                    </div>
                  ) : (
                    <>
                      {recentProjects.map((project) => (
                        <MenuItem
                          as="div"
                          key={project.path}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                          }}

                          onClick={() => handleOpenRecentProject(project)}
                        >
                          <div style={{ flex: 1, overflow: 'hidden' }}>
                            <div
                              style={{
                                fontSize: '13px',
                                color: 'var(--text-primary)',
                                whiteSpace: 'nowrap',
                                textOverflow: 'ellipsis',
                                overflow: 'hidden',
                              }}
                            >
                              {project.name}
                            </div>
                            <div
                              style={{
                                fontSize: '11px',
                                color: 'var(--text-secondary)',
                                whiteSpace: 'nowrap',
                                textOverflow: 'ellipsis',
                                overflow: 'hidden',
                              }}
                            >
                              {formatDate(project.lastOpened)}
                            </div>
                          </div>
                          <button
                            style={{
                              padding: '4px',
                              background: 'transparent',
                              border: 'none',
                              cursor: 'pointer',
                              color: 'var(--text-secondary)',
                              borderRadius: '4px',
                            }}
                            onMouseEnter={(e) =>
                              (e.currentTarget.style.color = 'var(--accent-error)')
                            }
                            onMouseLeave={(e) =>
                              (e.currentTarget.style.color = 'var(--text-secondary)')
                            }
                            onClick={(e) => handleRemoveRecent(e, project.path)}
                            title="Remove from list"
                          >
                            <Trash2 size={14} />
                          </button>
                        </MenuItem>
                      ))}

                      {/* Clear All */}
                      <div
                        style={{
                          borderTop: `1px solid ${'var(--resource-menu-border)'}`,
                          marginTop: '6px',
                          paddingTop: '6px',
                        }}
                      >
                        <MenuItem onClick={handleClearRecent}>
                          <Trash2 size={14} />
                          Clear Recent Projects
                        </MenuItem>
                      </div>
                    </>
                  )}
                </MenuSurface>
              </div>
            )}
          </div>

          {/* Separator */}
          <MenuSeparator />

          {/* Save Project */}
          <MenuItem
            onClick={() => {
              if (isProjectLoaded) {
                setIsMenuOpen(false);
                onSave();
              }
            }}
            disabled={!isProjectLoaded}
          >
            <Save size={16} style={{ color: 'var(--accent-color)' }} />
            Save Project
            <span style={{ marginLeft: 'auto', fontSize: '11px', color: 'var(--text-secondary)' }}>
              Ctrl+S
            </span>
          </MenuItem>

          {/* Show in Explorer (Electron only) */}
          {isElectron() && (
            <MenuItem
              onClick={() => {
                if (currentProjectPath) {
                  setIsMenuOpen(false);
                  showInExplorer(currentProjectPath);
                }
              }}
              disabled={!currentProjectPath}
            >
              <ExternalLink size={16} style={{ color: 'var(--text-secondary)' }} />
              Show in Explorer
            </MenuItem>
          )}

          {/* Project Settings */}
          <MenuItem
            onClick={() => {
              if (isProjectLoaded) {
                setIsMenuOpen(false);
                onEditMetadata();
              }
            }}
            disabled={!isProjectLoaded}
          >
            <Settings size={16} style={{ color: 'var(--text-secondary)' }} />
            Project Settings...
          </MenuItem>

          {/* Separator */}
          <MenuSeparator />

          {/* Export */}
          <MenuItem
            onClick={() => {
              setIsMenuOpen(false);
              onValidate();
            }}
            disabled={!isProjectLoaded}
          >
            <CheckCircle size={16} /> Validate Project
          </MenuItem>
          <MenuItem
            onClick={() => {
              if (isProjectLoaded) {
                setIsMenuOpen(false);
                onExport();
              }
            }}
            disabled={!isProjectLoaded}
          >
            <FileOutput size={16} style={{ color: 'var(--accent-color)' }} />
            Export
          </MenuItem>
        </MenuSurface>
      )}
    </div>
  );
};

export default ProjectMenu;
