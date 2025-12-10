import React, { useEffect, useCallback } from 'react';
import { Header } from './Header';
import { Sidebar } from './Sidebar';
import { Resizer } from './Resizer';
import { StageExplorer } from '../Explorer/StageExplorer';
import { NodeList } from '../Explorer/NodeList';
import { Inspector } from '../Inspector/Inspector';
import { Canvas } from '../Canvas/Canvas';
import { Breadcrumb } from './Breadcrumb';
import { useEditorDispatch, useEditorState } from '../../store/context';
import { BlackboardPanel } from '../Blackboard/BlackboardPanel';

// Constraints for panel sizes
const MIN_SIDEBAR_WIDTH = 180;
const MAX_SIDEBAR_WIDTH = 500;
const MIN_STAGES_HEIGHT = 20;
const MAX_STAGES_HEIGHT = 80;

export const MainLayout = () => {
  // P2 只读模式：统一传递到画布和 Inspector，避免 UI 误导
  const READ_ONLY = true;
  const dispatch = useEditorDispatch();
  const { ui } = useEditorState();
  const { panelSizes } = ui;

  // Global Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Check for modifier key (Ctrl on Windows/Linux, Cmd on Mac)
      const isModifier = e.ctrlKey || e.metaKey;

      if (isModifier && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          dispatch({ type: 'REDO' });
        } else {
          dispatch({ type: 'UNDO' });
        }
      } else if (isModifier && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        dispatch({ type: 'REDO' });
      }

      // ESC to clear multi-select
      if (e.key === 'Escape') {
        dispatch({ type: 'SET_MULTI_SELECT_STATES', payload: [] });
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [dispatch]);

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

  const renderEditorView = () => (
    <>
      {/* Left Sidebar: Explorer */}
      <Sidebar title="Explorer" position="left" width={panelSizes.explorerWidth}>
        {/* Split view: Stages / Nodes with resizable border */}
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
          <div style={{ flex: `0 0 ${panelSizes.stagesHeight}%`, minHeight: 0, overflowY: 'auto' }}>
            <div style={{ padding: '8px 16px', fontSize: '10px', color: 'var(--text-secondary)', fontWeight: 600 }}>STAGES</div>
            <StageExplorer />
          </div>
          <Resizer
            direction="vertical"
            onResize={(delta) => {
              const container = document.querySelector('.panel-content');
              if (container) handleStagesResize(delta, container.clientHeight);
            }}
          />
          <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
            <div style={{ padding: '8px 16px', fontSize: '10px', color: 'var(--text-secondary)', fontWeight: 600 }}>NODES</div>
            <NodeList />
          </div>
        </div>
      </Sidebar>

      {/* Explorer/Canvas Resizer */}
      <Resizer direction="horizontal" onResize={handleExplorerResize} />

      {/* Center: Canvas */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
        <Breadcrumb />
        <Canvas readOnly={READ_ONLY} />
      </div>

      {/* Canvas/Inspector Resizer */}
      <Resizer direction="horizontal" onResize={handleInspectorResize} />

      {/* Right Sidebar: Inspector */}
      <Sidebar title="Inspector" position="right" width={panelSizes.inspectorWidth}>
        <Inspector readOnly={READ_ONLY} />
      </Sidebar>
    </>
  );

  const renderBlackboardView = () => (
    <>
      {/* Center: Blackboard Content */}
      <div style={{ flex: 1, overflow: 'hidden', minWidth: 0 }}>
        <BlackboardPanel />
      </div>

      {/* Blackboard/Inspector Resizer */}
      <Resizer direction="horizontal" onResize={handleInspectorResize} />

      {/* Right Sidebar: Inspector */}
      <Sidebar title="Inspector" position="right" width={panelSizes.inspectorWidth}>
        <Inspector readOnly={READ_ONLY} />
      </Sidebar>
    </>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Header />

      <div className="app-body">
        {ui.view === 'EDITOR' ? renderEditorView() : renderBlackboardView()}
      </div>
    </div>
  );
};
