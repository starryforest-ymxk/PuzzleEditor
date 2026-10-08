import React from 'react';
import type { PresentationGraph } from '../../../types/presentation';
import type { PresentationCanvasModel } from '../../../hooks/usePresentationCanvas';
import {
  PRESENTATION_NODE_DIMENSIONS,
  presentationLinkPath,
  presentationModifiedPath,
} from '../../../utils/presentationGeometry';
import { parseVirtualEdgeId } from '../../../utils/graphAdapter';
import { GraphEdge } from '../shared';
import { ConnectionArrowMarkers } from '../Elements/TempConnectionLine';
import { CuttingLineOverlay } from '../Elements/CanvasOverlays';

/** 固定边和临时边共用 SVG 层；路径计算独立于 React 与 Store。 */
export function PresentationEdges({
  graph,
  model,
}: {
  graph: PresentationGraph;
  model: PresentationCanvasModel;
}) {
  const {
    edges,
    getNodeDisplayPosition,
    modifyingTransition,
    contextMenu,
    handleEdgeSelect,
    handleEdgeContextMenu,
    linkingState,
    activeSnapPoint,
    mousePos,
    cuttingLine,
  } = model;
  const source = linkingState && graph.nodes[linkingState.nodeId];
  const target = activeSnapPoint || mousePos;
  const linkingPath = source
    ? presentationLinkPath(
        getNodeDisplayPosition(source.id, source.position),
        target,
        activeSnapPoint?.side,
      )
    : null;
  const modifyingPath = modifyingTransition
    ? presentationModifiedPath(
        graph,
        modifyingTransition.id,
        modifyingTransition.handle,
        target,
        activeSnapPoint?.side,
        getNodeDisplayPosition,
      )
    : null;
  return (
    <svg className="presentation-edges">
      <ConnectionArrowMarkers />
      {edges.map((edge) => {
        const from = graph.nodes[edge.fromNodeId],
          to = graph.nodes[edge.toNodeId];
        if (!from || !to) return null;
        const index = from.type === 'Branch' ? parseVirtualEdgeId(edge.id)?.index : undefined;
        const branch = index === 0 ? 'true' : index === 1 ? 'false' : undefined;
        return (
          <GraphEdge
            key={edge.id}
            edge={edge}
            fromPos={getNodeDisplayPosition(from.id, from.position)}
            toPos={getNodeDisplayPosition(to.id, to.position)}
            nodeDimensions={PRESENTATION_NODE_DIMENSIONS}
            isSelected={false}
            isContextTarget={contextMenu?.type === 'EDGE' && contextMenu.targetId === edge.id}
            isModifying={modifyingTransition?.id === edge.id}
            disableInteractions
            customColor={branch ? `var(--graph-branch-${branch})` : undefined}
            renderLabel={
              branch
                ? () => (
                    <span className={`presentation-edge-label presentation-branch-${branch}`}>
                      {branch.toUpperCase()}
                    </span>
                  )
                : undefined
            }
            onSelect={handleEdgeSelect}
            onContextMenu={handleEdgeContextMenu}
          />
        );
      })}
      {linkingPath && (
        <path
          className="presentation-preview presentation-preview-link"
          d={linkingPath}
          markerEnd="url(#arrow-temp)"
        />
      )}
      {modifyingPath && (
        <path
          className="presentation-preview presentation-preview-modify"
          d={modifyingPath}
          markerEnd="url(#arrow-temp)"
        />
      )}
      <CuttingLineOverlay line={cuttingLine} />
    </svg>
  );
}
