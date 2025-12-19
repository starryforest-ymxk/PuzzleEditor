/**
 * components/Layout/Header.tsx
 * 顶部导航栏 - 项目控制、视图切换、消息堆栈
 * 
 * 重构说明：
 * - 弹窗逻辑已抽离至 HeaderDialogManager
 * - 消息面板已抽离至 MessageStackPanel
 * - 保存 (Ctrl+S) → .puzzle.json（完整编辑状态）由 GlobalKeyboardShortcuts 处理
 * - 导出 (EXPORT) → .json（精简运行时数据）
 */

import React, { useRef, useState, useCallback, useMemo } from 'react';
import { Settings } from 'lucide-react';
import { useEditorState, useEditorDispatch } from '../../store/context';
import { normalizeProjectForStore } from '../../utils/projectNormalizer';
import { createEmptyProject } from '../../utils/projectFactory';
import { ExportBundle, ProjectMeta, ProjectFile } from '../../types/project';
import { UiMessage } from '../../store/types';

// 抽离的子组件
import { MessageStackPanel } from './MessageStackPanel';
import { HeaderDialogManager, HeaderDialogState, HeaderDialogCallbacks } from './HeaderDialogManager';

// 编辑器版本号
const EDITOR_VERSION = '1.0.0';

export const Header = () => {
  const { project, ui } = useEditorState();
  const dispatch = useEditorDispatch();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // UI 状态
  const [showMessages, setShowMessages] = useState(false);
  const [dialog, setDialog] = useState<HeaderDialogState>({ type: 'none' });

  // ========== 工具函数 ==========
  const pushMessage = useCallback((level: UiMessage['level'], text: string) => {
    dispatch({
      type: 'ADD_MESSAGE',
      payload: { id: `msg-${Date.now()}`, level, text, timestamp: new Date().toISOString() }
    });
  }, [dispatch]);

  // ========== 保存功能（完整项目文件）==========
  const handleSave = useCallback(() => {
    if (!project.isLoaded) return;

    const projectFile: ProjectFile = {
      fileType: 'puzzle-project',
      editorVersion: EDITOR_VERSION,
      savedAt: new Date().toISOString(),
      project: {
        meta: project.meta,
        blackboard: project.blackboard,
        scripts: project.scripts,
        triggers: project.triggers,
        stageTree: project.stageTree,
        nodes: project.nodes,
        stateMachines: project.stateMachines,
        presentationGraphs: project.presentationGraphs
      },
      editorState: {
        panelSizes: ui.panelSizes,
        stageExpanded: ui.stageExpanded,
        currentStageId: ui.currentStageId,
        currentNodeId: ui.currentNodeId,
        currentGraphId: ui.currentGraphId,
        view: ui.view
      }
    };

    const jsonStr = JSON.stringify(projectFile, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${project.meta.name || 'project'}.puzzle.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    dispatch({ type: 'MARK_CLEAN' });
    pushMessage('info', 'Project saved successfully');
  }, [project, ui, dispatch, pushMessage]);

  // ========== 导出功能（精简运行时数据）==========
  const handleExport = useCallback(() => {
    if (!project.isLoaded) return;

    // 精简导出：仅包含游戏引擎需要的运行时数据
    const exportBundle: ExportBundle = {
      fileType: 'puzzle-export',
      manifestVersion: '1.0.0',
      exportedAt: new Date().toISOString(),
      projectName: project.meta.name,
      projectVersion: project.meta.version,
      data: {
        blackboard: project.blackboard,
        scripts: project.scripts,
        triggers: project.triggers,
        stageTree: project.stageTree,
        nodes: project.nodes,
        stateMachines: project.stateMachines,
        presentationGraphs: project.presentationGraphs
      }
    };

    const jsonStr = JSON.stringify(exportBundle, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    // 导出文件使用 _export 后缀区分
    link.download = `${project.meta.name || 'project'}_export.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    pushMessage('info', 'Project exported for runtime');
  }, [project, pushMessage]);

  // ========== 加载功能 ==========
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

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    dispatch({ type: 'INIT_START' });

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = event.target?.result as string;
        const parsed = JSON.parse(content);
        const normalized = normalizeProjectForStore(parsed as any);

        dispatch({
          type: 'INIT_SUCCESS',
          payload: {
            stageTree: normalized.project.stageTree,
            nodes: normalized.project.nodes,
            stateMachines: normalized.project.stateMachines,
            presentationGraphs: normalized.project.presentationGraphs,
            blackboard: normalized.project.blackboard,
            meta: normalized.project.meta,
            scripts: normalized.project.scripts,
            triggers: normalized.project.triggers
          }
        });

        // 如果是 ProjectFile 格式，恢复编辑器 UI 状态
        if (normalized.editorState) {
          const es = normalized.editorState;
          dispatch({ type: 'SET_PANEL_SIZES', payload: es.panelSizes });
          // 恢复阶段树展开状态
          Object.entries(es.stageExpanded).forEach(([id, expanded]) => {
            dispatch({ type: 'SET_STAGE_EXPANDED', payload: { id, expanded } });
          });
          // 恢复视图
          dispatch({ type: 'SWITCH_VIEW', payload: es.view });
          // 恢复导航位置
          if (es.currentStageId) {
            dispatch({
              type: 'NAVIGATE_TO',
              payload: { stageId: es.currentStageId, nodeId: es.currentNodeId, graphId: es.currentGraphId }
            });
          }
          pushMessage('info', `Project "${normalized.project.meta.name}" restored with editor state`);
        } else {
          // 普通加载，跳转到根 Stage
          pushMessage('info', `Project "${normalized.project.meta.name}" loaded successfully`);

          if (normalized.project.stageTree.rootId) {
            dispatch({
              type: 'NAVIGATE_TO',
              payload: { stageId: normalized.project.stageTree.rootId, nodeId: null, graphId: null }
            });
            dispatch({
              type: 'SELECT_OBJECT',
              payload: { type: 'STAGE', id: normalized.project.stageTree.rootId }
            });
          }
        }
      } catch (err) {
        console.error('Failed to parse JSON:', err);
        dispatch({ type: 'INIT_ERROR', payload: { message: 'JSON import failed' } });
        pushMessage('error', 'Failed to load project: invalid JSON format');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  }, [dispatch, pushMessage]);

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

  // ========== 弹窗回调 ==========
  const dialogCallbacks: HeaderDialogCallbacks = useMemo(() => ({
    onCreateProject: (name: string, description: string) => {
      const newProject = createEmptyProject(name, description);

      dispatch({
        type: 'INIT_SUCCESS',
        payload: {
          stageTree: newProject.stageTree,
          nodes: newProject.nodes,
          stateMachines: newProject.stateMachines,
          presentationGraphs: newProject.presentationGraphs,
          blackboard: newProject.blackboard,
          meta: newProject.meta,
          scripts: newProject.scripts,
          triggers: newProject.triggers
        }
      });

      if (newProject.stageTree.rootId) {
        dispatch({
          type: 'NAVIGATE_TO',
          payload: { stageId: newProject.stageTree.rootId, nodeId: null, graphId: null }
        });
        dispatch({
          type: 'SELECT_OBJECT',
          payload: { type: 'STAGE', id: newProject.stageTree.rootId }
        });
      }

      pushMessage('info', `New project "${name}" created`);
      setDialog({ type: 'none' });
    },

    onSaveSettings: (updates: Partial<ProjectMeta>) => {
      dispatch({ type: 'UPDATE_PROJECT_META', payload: updates });
      pushMessage('info', 'Project settings updated');
      setDialog({ type: 'none' });
    },

    onConfirmSave: () => {
      handleExport();
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
  }), [dispatch, pushMessage, handleExport, doLoadFile, dialog]);

  return (
    <div className="app-header" style={{ position: 'relative' }}>
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
        <span style={{ fontSize: '20px', marginRight: '10px' }}>⚙</span>
        <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1 }}>
          <span style={{ fontWeight: 700, letterSpacing: '0.5px', color: 'var(--text-primary)' }}>PUZZLE EDITOR</span>
          <span style={{ fontSize: '9px', color: 'var(--text-secondary)', marginTop: '2px' }}>CORE SYSTEMS // P4</span>
        </div>
      </div>

      <div style={{ width: '2px', height: '24px', background: 'var(--border-color)', margin: '0 24px' }}></div>

      {/* 2. 项目信息 */}
      {project.isLoaded && (
        <div style={{ display: 'flex', flexDirection: 'column', fontSize: '11px', minWidth: '150px' }}>
          <div style={{ color: 'var(--text-secondary)', marginBottom: '2px' }}>PROJECT</div>
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
        <button className="btn-ghost" onClick={handleNew}>
          NEW
        </button>
        <button className="btn-ghost" onClick={handleLoad}>
          LOAD
        </button>
        <button
          className="btn-ghost"
          onClick={handleSettings}
          disabled={!project.isLoaded}
          style={{
            padding: '6px 8px',
            display: 'flex',
            alignItems: 'center',
            opacity: project.isLoaded ? 1 : 0.5
          }}
          title="Project Settings"
        >
          <Settings size={16} />
        </button>
        <button
          className="btn-primary"
          style={{ background: 'var(--accent-success)', boxShadow: '0 2px 0 #15803d' }}
          onClick={handleExport}
          disabled={!project.isLoaded}
        >
          EXPORT
        </button>
        <button
          className={showMessages ? 'btn-primary' : 'btn-ghost'}
          onClick={() => setShowMessages(!showMessages)}
          style={{ position: 'relative', minWidth: '100px' }}
          data-messages-button
        >
          Messages {ui.messages.length > 0 && (
            <span style={{ marginLeft: 6, color: showMessages ? '#ffffff' : 'var(--accent-color)', fontWeight: 700 }}>
              ({ui.messages.length})
            </span>
          )}
        </button>
      </div>

      {/* 消息面板 */}
      <MessageStackPanel
        isOpen={showMessages}
        onClose={() => setShowMessages(false)}
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
