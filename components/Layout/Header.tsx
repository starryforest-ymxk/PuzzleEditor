/**
 * components/Layout/Header.tsx
 * 顶部导航栏 - 项目控制、视图切换、消息堆栈
 * 
 * 重构说明：
 * - 弹窗逻辑已抽离至 HeaderDialogManager
 * - 消息面板已抽离至 MessageStackPanel
 * - 保存/导出/加载逻辑已抽离至 useProjectActions hook
 * - Ctrl+S 保存由 GlobalKeyboardShortcuts 处理，复用相同的 hook
 */

import React, { useRef, useState, useCallback, useMemo } from 'react';
import { Sliders } from 'lucide-react';
import { useEditorState, useEditorDispatch } from '../../store/context';
import { createEmptyProject } from '../../utils/projectFactory';
import { ProjectMeta } from '../../types/project';
import { useProjectActions } from '../../hooks/useProjectActions';

import { MessageLevel } from '../../store/types';

// 抽离的子组件
import { MessageStackPanel, LevelFilters } from './MessageStackPanel';
import { HeaderDialogManager, HeaderDialogState, HeaderDialogCallbacks } from './HeaderDialogManager';
import { ProjectMenu } from './ProjectMenu';

export const Header = () => {
  const { project, ui, runtime } = useEditorState();
  const dispatch = useEditorDispatch();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 使用项目操作 hook
  const { saveProject, saveProjectSettings, createAndSaveProject, exportProject, loadProjectFromString, pushMessage } = useProjectActions();

  // UI 状态
  const [showMessages, setShowMessages] = useState(false);
  const [dialog, setDialog] = useState<HeaderDialogState>({ type: 'none' });

  // 消息等级筛选状态（默认全部开启）
  const [levelFilters, setLevelFilters] = useState<LevelFilters>({
    info: true,
    warning: true,
    error: true
  });

  // 切换某个等级的显示状态
  const handleToggleLevel = (level: MessageLevel) => {
    setLevelFilters(prev => ({ ...prev, [level]: !prev[level] }));
  };

  // 计算过滤后的消息数量
  const filteredMessageCount = useMemo(() => {
    return ui.messages.filter(msg => levelFilters[msg.level]).length;
  }, [ui.messages, levelFilters]);

  // ========== 文件加载触发 ==========
  const doLoadFile = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleLoad = useCallback(() => {
    if (project.isLoaded && ui.isDirty) {
      setDialog({ type: 'confirm-save', nextAction: 'load' });
      return;
    }
    doLoadFile();
  }, [project.isLoaded, ui.isDirty, doLoadFile]);

  // 浏览器文件选择处理
  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      loadProjectFromString(content);
    };
    reader.readAsText(file);
    e.target.value = '';
  }, [loadProjectFromString]);

  // ========== Electron 项目加载回调 ==========
  const handleElectronLoadProject = useCallback((filePath: string, content: string) => {
    loadProjectFromString(content, filePath);
  }, [loadProjectFromString]);

  // ========== 新建工程功能 ==========
  const handleNew = useCallback(() => {
    if (project.isLoaded && ui.isDirty) {
      setDialog({ type: 'confirm-save', nextAction: 'new' });
      return;
    }
    setDialog({ type: 'new-project' });
  }, [project.isLoaded, ui.isDirty]);

  // ========== 项目设置功能 ==========
  const handleSettings = useCallback(() => {
    if (!project.isLoaded) return;
    setDialog({ type: 'settings' });
  }, [project.isLoaded]);

  // ========== 偏好设置功能 ==========
  const handlePreferences = useCallback(() => {
    setDialog({ type: 'preferences' });
  }, []);

  // ========== 弹窗回调 ==========
  const dialogCallbacks: HeaderDialogCallbacks = useMemo(() => ({
    onCreateProject: async (name: string, description: string, location: string) => {
      // 使用 saveProjectAndCreate 立即创建并保存文件
      await createAndSaveProject(name, description, location);
      setDialog({ type: 'none' });
    },

    onSaveSettings: async (updates: Partial<ProjectMeta>) => {
      // 使用专门的 saveProjectSettings 函数保存设置
      await saveProjectSettings(updates);
      setDialog({ type: 'none' });
    },

    onConfirmSave: () => {
      exportProject();
      const nextAction = (dialog as any).nextAction;
      setDialog({ type: 'none' });

      setTimeout(() => {
        if (nextAction === 'new') {
          setDialog({ type: 'new-project' });
        } else if (nextAction === 'load') {
          doLoadFile();
        }
      }, 100);
    },

    onConfirmDiscard: () => {
      dispatch({ type: 'MARK_CLEAN' });
      const nextAction = (dialog as any).nextAction;
      setDialog({ type: 'none' });

      if (nextAction === 'new') {
        setDialog({ type: 'new-project' });
      } else if (nextAction === 'load') {
        doLoadFile();
      }
    },

    onClose: () => setDialog({ type: 'none' })
  }), [dispatch, pushMessage, exportProject, doLoadFile, dialog, saveProject]);

  return (
    <div className="app-header" style={{ position: 'relative', zIndex: 50 }}>
      {/* 隐藏的文件输入 */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />

      {/* 1. 品牌标识 */}
      <div style={{ display: 'flex', alignItems: 'center', color: 'var(--accent-color)', minWidth: '200px' }}>
        <img src="./icon.png" alt="Puzzle Editor" style={{ width: '24px', height: '24px', marginRight: '10px' }} />
        <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1 }}>
          <span style={{ fontWeight: 700, letterSpacing: '0.5px', color: 'var(--text-primary)' }}>PUZZLE EDITOR</span>
          <span style={{ fontSize: '9px', color: 'var(--text-secondary)', marginTop: '2px' }}>v1.0.0-alpha</span>
        </div>
      </div>

      <div style={{ width: '2px', height: '24px', background: 'var(--border-color)', margin: '0 24px' }}></div>

      {/* 2. 项目信息 */}
      {project.isLoaded && (
        <div style={{ display: 'flex', flexDirection: 'column', fontSize: '11px', minWidth: '150px' }}>
          <div style={{ color: 'var(--text-secondary)', marginBottom: '2px' }}>Project</div>
          <div style={{ fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
            {project.meta.name}
            <span style={{ opacity: 0.5, fontWeight: 400 }}>v{project.meta.version}</span>
            {ui.isDirty && (
              <span style={{ color: 'var(--accent-color)', fontWeight: 700 }} title="Unsaved changes">*</span>
            )}
          </div>
        </div>
      )}

      {/* 3. 视图切换器（居中） */}
      <div style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
        <div style={{
          display: 'flex',
          background: 'var(--bg-color)',
          padding: '2px',
          borderRadius: 'var(--radius-sm)',
          border: '1px solid var(--border-color)'
        }}>
          <button
            className={ui.view === 'EDITOR' ? 'btn-primary' : 'btn-ghost'}
            onClick={() => dispatch({ type: 'SWITCH_VIEW', payload: 'EDITOR' })}
            style={{ minWidth: '100px' }}
          >
            EDITOR
          </button>
          <div style={{ width: '2px' }}></div>
          <button
            className={ui.view === 'BLACKBOARD' ? 'btn-primary' : 'btn-ghost'}
            onClick={() => dispatch({ type: 'SWITCH_VIEW', payload: 'BLACKBOARD' })}
            style={{ minWidth: '100px' }}
          >
            BLACKBOARD
          </button>
        </div>
      </div>

      {/* 4. 全局操作按钮（右侧） */}
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
        {/* Project 下拉菜单 */}
        <ProjectMenu
          onNewProject={handleNew}
          onLoadProject={handleElectronLoadProject}
          onSave={saveProject}
          onEditMetadata={handleSettings}
          onExport={exportProject}
          isProjectLoaded={project.isLoaded}
          currentProjectPath={runtime.currentProjectPath}
        />

        {/* Preferences 按钮 */}
        <button
          className="btn-ghost"
          onClick={handlePreferences}
          style={{
            padding: '6px 8px',
            display: 'flex',
            alignItems: 'center'
          }}
          title="Preferences"
        >
          <Sliders size={16} />
        </button>

        {/* Messages 按钮 */}
        <button
          className={showMessages ? 'btn-primary' : 'btn-ghost'}
          onClick={() => setShowMessages(!showMessages)}
          style={{ position: 'relative', minWidth: '100px' }}
          data-messages-button
        >
          Messages
          {filteredMessageCount > 0 && (
            <span style={{
              position: 'absolute',
              top: '-6px',
              right: '-8px',
              background: 'var(--accent-color)',
              color: '#ffffff',
              fontSize: '10px',
              height: '18px',
              minWidth: '18px',
              padding: '0 4px',
              borderRadius: '9px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 700,
              boxShadow: '0 2px 4px rgba(0,0,0,0.3)',
              border: '2px solid var(--bg-color)', // Border to separate from button
              zIndex: 10
            }}>
              {filteredMessageCount}
            </span>
          )}
        </button>
      </div>

      {/* 消息面板 */}
      <MessageStackPanel
        isOpen={showMessages}
        onClose={() => setShowMessages(false)}
        levelFilters={levelFilters}
        onToggleLevel={handleToggleLevel}
      />

      {/* 弹窗管理器 */}
      <HeaderDialogManager
        dialog={dialog}
        projectMeta={project.meta}
        callbacks={dialogCallbacks}
      />
    </div>
  );
};
