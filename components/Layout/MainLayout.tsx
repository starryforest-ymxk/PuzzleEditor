import React, { useEffect, useCallback } from 'react';
import { Header } from './Header';
import { Sidebar } from './Sidebar';
import { Resizer } from './Resizer';
import { StageExplorer } from '../Explorer/StageExplorer';
import { NodeExplorer } from '../Explorer/NodeExplorer';
import { Inspector } from '../Inspector/Inspector';
import { Canvas } from '../Canvas/Canvas';
import { Breadcrumb } from './Breadcrumb';
import { GlobalKeyboardShortcuts } from './GlobalKeyboardShortcuts';
import { useEditorDispatch, useEditorState } from '../../store/context';
import { BlackboardPanel } from '../Blackboard/BlackboardPanel';
import { useAppStartup } from '../../hooks/useAppStartup';
import { useFileWatcher } from '../../hooks/useFileWatcher';
import { ValidationPanel } from './ValidationPanel';
import { Footer } from './Footer';
import GlobalConfirmDialog from './GlobalConfirmDialog';

// Constraints for panel sizes
const MIN_SIDEBAR_WIDTH = 180;
const MAX_SIDEBAR_WIDTH = 500;
const MIN_STAGES_HEIGHT = 20;
const MAX_STAGES_HEIGHT = 80;

export const MainLayout = () => {
  const dispatch = useEditorDispatch();

  // Handle application startup logic
  useAppStartup();

  // Handle external file watcher (Sync resource states)
  useFileWatcher();

  const { ui } = useEditorState();
  const { panelSizes } = ui;
  const READ_ONLY = ui.readOnly;
  const isEditorView = ui.view === 'EDITOR';

  // 全局快捷键由 GlobalKeyboardShortcuts 组件统一管理
  // ESC 清除多选状态
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        dispatch({ type: 'SET_MULTI_SELECT_STATES', payload: [] });
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [dispatch]);

  // 全局禁用浏览器默认右键菜单
  useEffect(() => {
    const handleContextMenu = (e: MouseEvent) => {
      // 阻止浏览器默认右键菜单，让各组件自行处理右键事件
      e.preventDefault();
    };

    document.addEventListener('contextmenu', handleContextMenu);
    return () => document.removeEventListener('contextmenu', handleContextMenu);
  }, []);

  // Resize handlers with constraints
  const handleExplorerResize = useCallback((delta: number) => {
    const newWidth = Math.max(MIN_SIDEBAR_WIDTH, Math.min(MAX_SIDEBAR_WIDTH, panelSizes.explorerWidth + delta));
    dispatch({ type: 'SET_PANEL_SIZES', payload: { explorerWidth: newWidth } });
  }, [dispatch, panelSizes.explorerWidth]);

  const handleInspectorResize = useCallback((delta: number) => {
    // Inspector resize is inverted (dragging left increases width)
    const newWidth = Math.max(MIN_SIDEBAR_WIDTH, Math.min(MAX_SIDEBAR_WIDTH, panelSizes.inspectorWidth - delta));
    dispatch({ type: 'SET_PANEL_SIZES', payload: { inspectorWidth: newWidth } });
  }, [dispatch, panelSizes.inspectorWidth]);

  const handleStagesResize = useCallback((delta: number, containerHeight: number) => {
    const deltaPercent = (delta / containerHeight) * 100;
    const newHeight = Math.max(MIN_STAGES_HEIGHT, Math.min(MAX_STAGES_HEIGHT, panelSizes.stagesHeight + deltaPercent));
    dispatch({ type: 'SET_PANEL_SIZES', payload: { stagesHeight: newHeight } });
  }, [dispatch, panelSizes.stagesHeight]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <GlobalKeyboardShortcuts />
      <Header />

      <div className="app-body" style={{ position: 'relative' }}>
        {/* 左侧内容：Editor 视图显示 Explorer，Blackboard 视图隐藏 */}
        {isEditorView && (
          <>
            <Sidebar title="Explorer" position="left" width={panelSizes.explorerWidth}>
              <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                <div style={{ flex: `0 0 ${panelSizes.stagesHeight}%`, minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
                  <div style={{ padding: '8px 16px', fontSize: '10px', color: 'var(--text-secondary)', fontWeight: 600, flexShrink: 0 }}>STAGES</div>
                  <StageExplorer />
                </div>
                <Resizer
                  direction="vertical"
                  onResize={(delta) => {
                    const container = document.querySelector('.panel-content');
                    if (container) handleStagesResize(delta, container.clientHeight);
                  }}
                />
                <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', boxSizing: 'border-box' }}>
                  <div style={{ padding: '8px 16px', fontSize: '10px', color: 'var(--text-secondary)', fontWeight: 600, flexShrink: 0 }}>NODES</div>
                  <NodeExplorer />
                </div>
              </div>
            </Sidebar>
            <Resizer direction="horizontal" onResize={handleExplorerResize} />
          </>
        )}

        {/* 中央内容：Editor 或 Blackboard */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
          {isEditorView ? (
            <>
              <Breadcrumb />
              <Canvas readOnly={READ_ONLY} />
            </>
          ) : (
            <BlackboardPanel />
          )}
        </div>

        {/* 右侧 Inspector（始终保持挂载，避免闪烁） */}
        <Resizer direction="horizontal" onResize={handleInspectorResize} />
        <Sidebar title="Inspector" position="right" width={panelSizes.inspectorWidth}>
          <Inspector readOnly={READ_ONLY} />
        </Sidebar>

        <ValidationPanel
          isOpen={ui.showValidationPanel}
          onClose={() => dispatch({ type: 'SET_SHOW_VALIDATION_PANEL', payload: false })}
        />
        <GlobalConfirmDialog />
      </div>
    </div>
  );
};
