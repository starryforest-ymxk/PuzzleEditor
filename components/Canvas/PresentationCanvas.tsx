import React from 'react';
import type { PresentationGraph } from '../../types/presentation';
import { usePresentationCanvas } from '../../hooks/usePresentationCanvas';
import { GraphContextMenu } from './shared';
import { ShortcutPanel, BoxSelectOverlay, CanvasInfoOverlay } from './Elements/CanvasOverlays';
import { CANVAS } from '../../utils/constants';
import { PresentationEdges } from './presentation/PresentationEdges';
import { PresentationNodes } from './presentation/PresentationNodes';
import { PresentationHandles } from './presentation/PresentationHandles';
import './presentation/presentation.css';
interface Props {
  graph: PresentationGraph;
  ownerNodeId?: string | null;
  readOnly?: boolean;
}
/** 主组件仅组合画布层与覆盖层，交互逻辑由协调 Hook 管理。 */
export const PresentationCanvas: React.FC<Props> = ({ graph, readOnly = false }) => {
  const model = usePresentationCanvas(graph, readOnly);
  const {
    multiSelectIds,
    isLineCuttingMode,
    linkingState,
    modifyingTransition,
    isLinkKeyActive,
    isPanningActive,
    showShortcuts,
    setShowShortcuts,
    canvasRef,
    contentRef,
    cuttingLine,
    boxSelectRect,
    handleCanvasMouseDown,
    handleCanvasMouseUp,
    handleContextMenu,
    contextMenu,
    setContextMenu,
    getMenuItems,
  } = model;
  // ========== Render ==========
  return (
    <div className="presentation-canvas">
      {/* 左上角标题显示（与FSM保持一致） */}
      <CanvasInfoOverlay
        nodeName={graph.name || 'Presentation Graph'}
        multiSelectCount={multiSelectIds.length}
        isLineCuttingMode={isLineCuttingMode}
        isLinkMode={Boolean(linkingState || modifyingTransition || isLinkKeyActive)}
        isPanMode={isPanningActive}
        hasNoInitialState={!graph.startNodeId || !graph.nodes[graph.startNodeId]}
        headerLabel="Presentation Editor"
        initialStateWarningText="No start node set"
      />

      {/* 快捷键面板 */}
      <ShortcutPanel visible={showShortcuts} onToggle={() => setShowShortcuts((v) => !v)} />

      {/* 画布区域 */}
      <div
        ref={canvasRef}
        className="canvas-grid presentation-canvas-grid"
        style={{
          cursor: isPanningActive
            ? 'grabbing'
            : linkingState || modifyingTransition || cuttingLine || boxSelectRect
              ? 'crosshair'
              : 'default',
        }}
        onMouseDown={handleCanvasMouseDown}
        onMouseUp={handleCanvasMouseUp}
        onContextMenu={(e) => handleContextMenu(e, 'CANVAS')}
      >
        {/* 使用通用右键菜单组件 */}
        {contextMenu && (
          <GraphContextMenu
            menu={contextMenu}
            onClose={() => setContextMenu(null)}
            getMenuItems={getMenuItems}
            contentRef={contentRef}
          />
        )}

        {/* 画布内容区域 */}
        <div
          ref={contentRef}
          className="presentation-canvas-content"
          style={{
            minWidth: `${CANVAS.SIZE}px`,
            minHeight: `${CANVAS.SIZE}px`,
          }}
        >
          {/* 框选可视化，与 FSM 画布保持一致 */}
          <BoxSelectOverlay rect={boxSelectRect} />

          <PresentationEdges graph={graph} model={model} />
          <PresentationNodes graph={graph} model={model} readOnly={readOnly} />
          <PresentationHandles graph={graph} model={model} readOnly={readOnly} />
        </div>
      </div>
    </div>
  );
};

export default PresentationCanvas;
