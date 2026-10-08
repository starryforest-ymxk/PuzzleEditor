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

import React, { useState, useCallback, useMemo } from 'react';
import { Sliders } from 'lucide-react';
import { useEditorState, useEditorDispatch, useProjectSession } from '../../store/context';
import { useProjectActions } from '../../hooks/useProjectActions';

import { MessageLevel } from '../../store/types';

import { isElectron, loadPreferences, savePreferences } from '@/platform/electron';
import type { UserPreferences } from '@/electron/types';

// 抽离的子组件
import { MessageStackPanel } from './MessageStackPanel';
import {
  HeaderDialogManager,
  HeaderDialogState,
  HeaderDialogCallbacks,
} from './HeaderDialogManager';
import { ProjectMenu } from './ProjectMenu';
import { ConfirmSaveDialog } from './ConfirmSaveDialog';

export const Header = () => {
  const { project, ui, runtime, settings } = useEditorState();
  const dispatch = useEditorDispatch();
  const session = useProjectSession();

  // 使用项目操作 hook
  const {
    saveProject,
    saveProjectSettings,
    createAndSaveProject,
    exportProject,
    openProject,
    validateProject,
  } = useProjectActions();

  // UI 状态
  const [showMessages, setShowMessages] = useState(false);
  const [dialog, setDialog] = useState<HeaderDialogState>({ type: 'none' });

  // 切换某个等级的显示状态
  const handleToggleLevel = async (level: MessageLevel) => {
    const newValue = !settings.messageFilters[level];

    dispatch({
      type: 'UPDATE_MESSAGE_FILTERS',
      payload: { [level]: newValue },
    });

    // 持久化保存到偏好设置
    if (isElectron()) {
      try {
        const result = await loadPreferences();
        if (result.success && result.data) {
          const currentFilters = result.data.messageFilters || {
            info: true,
            warning: true,
            error: true,
          };
          const updatedPrefs: UserPreferences = {
            ...result.data,
            messageFilters: {
              ...currentFilters,
              [level]: newValue,
            },
          };
          await savePreferences(updatedPrefs);
        }
      } catch (error) {
        console.error('Failed to save message filters:', error);
      }
    }
  };

  // 计算过滤后的消息数量
  const filteredMessageCount = useMemo(() => {
    return ui.messages.filter((msg) => settings.messageFilters[msg.level]).length;
  }, [ui.messages, settings.messageFilters]);

  // 新建先收集候选信息；统一会话流程在提交前确认旧项目修改。
  const handleNew = useCallback(() => {
    session.markUserIntent();
    setDialog({ type: 'new-project' });
  }, [session]);

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
  const dialogCallbacks: HeaderDialogCallbacks = {
    onCreateProject: async (name, description, location) => {
      const result = await createAndSaveProject(name, description, location);
      if (result.status === 'loaded') setDialog({ type: 'none' });
      return result;
    },
    onSaveSettings: async (updates) => {
      const result = await saveProjectSettings(updates);
      const completed = result.status === 'saved' || result.status === 'downloadInitiated';
      if (completed) setDialog({ type: 'none' });
      return result;
    },
    onClose: () => setDialog({ type: 'none' }),
  };
  const operation = runtime.projectOperation;

  return (
    <div className="app-header" style={{ position: 'relative', zIndex: 50 }}>
      {/* 1. 品牌标识 */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          color: 'var(--accent-color)',
          minWidth: '200px',
        }}
      >
        <img
          src="./icon.png"
          alt="Puzzle Editor"
          style={{ width: '24px', height: '24px', marginRight: '10px' }}
        />
        <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1 }}>
          <span style={{ fontWeight: 700, letterSpacing: '0.5px', color: 'var(--text-primary)' }}>
            PUZZLE EDITOR
          </span>
          <span style={{ fontSize: '9px', color: 'var(--text-secondary)', marginTop: '2px' }}>
            v{__APP_VERSION__}
          </span>
        </div>
      </div>

      <div
        style={{
          width: '2px',
          height: '24px',
          background: 'var(--border-color)',
          margin: '0 24px',
        }}
      ></div>

      {/* 2. 项目信息 */}
      {project.isLoaded && (
        <div
          style={{ display: 'flex', flexDirection: 'column', fontSize: '11px', minWidth: '150px' }}
        >
          <div style={{ color: 'var(--text-secondary)', marginBottom: '2px' }}>Project</div>
          <div
            style={{
              fontWeight: 600,
              color: 'var(--text-primary)',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            {project.meta.name}
            <span style={{ opacity: 0.5, fontWeight: 400 }}>v{project.meta.version}</span>
            {ui.isDirty && (
              <span
                style={{ color: 'var(--accent-color)', fontWeight: 700 }}
                title="Unsaved changes"
              >
                *
              </span>
            )}
          </div>
        </div>
      )}

      {/* 3. 视图切换器（居中） */}
      <div style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
        <div
          style={{
            display: 'flex',
            background: 'var(--bg-color)',
            padding: '2px',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--border-color)',
          }}
        >
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
          onOpenProject={openProject}
          disabled={operation.phase !== 'idle'}
          onSave={saveProject}
          onEditMetadata={handleSettings}
          onExport={exportProject}
          onValidate={validateProject}
          isProjectLoaded={project.isLoaded}
          currentProjectPath={runtime.currentProjectPath ?? undefined}
        />

        {/* Preferences 按钮 */}
        <button
          className="btn-ghost"
          onClick={handlePreferences}
          style={{
            padding: '6px 8px',
            display: 'flex',
            alignItems: 'center',
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
            <span
              style={{
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
                zIndex: 10,
              }}
            >
              {filteredMessageCount}
            </span>
          )}
        </button>
      </div>

      {/* 消息面板 */}
      <MessageStackPanel
        isOpen={showMessages}
        onClose={() => setShowMessages(false)}
        levelFilters={settings.messageFilters}
        onToggleLevel={handleToggleLevel}
      />

      {/* 弹窗管理器 */}
      <HeaderDialogManager dialog={dialog} projectMeta={project.meta} callbacks={dialogCallbacks} />
      {(operation.phase === 'confirming' ||
        operation.phase === 'saving' ||
        operation.phase === 'committing') && (
        <ConfirmSaveDialog
          nextAction={operation.nextAction || 'switch projects'}
          busy={operation.phase !== 'confirming'}
          message={operation.message}
          desktop={isElectron()}
          onSave={() => session.choose('save')}
          onDiscard={() => session.choose('discard')}
          onCancel={() => session.choose('cancel')}
        />
      )}
    </div>
  );
};
