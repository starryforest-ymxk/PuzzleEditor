import React from 'react';
import type { PresentationGraph } from '../../../types/presentation';
import type { PresentationCanvasModel } from '../../../hooks/usePresentationCanvas';
import { presentationEdgeAnchors } from '../../../utils/presentationGeometry';
export function PresentationHandles({
  graph,
  model,
  readOnly,
}: {
  graph: PresentationGraph;
  model: PresentationCanvasModel;
  readOnly: boolean;
}) {
  const {
    edges,
    modifyingTransition,
    getNodeDisplayPosition,
    handleEdgeHandleDown,
    linkingState,
    snapPoints,
    activeSnapPoint,
  } = model;
  return (
    <>
      {' '}
      {/* 边端点手柄层（仅显示拖拽手柄，不显示标签） */}
      {!readOnly &&
        edges.map((edge) => {
          const fromNode = graph.nodes[edge.fromNodeId];
          const toNode = graph.nodes[edge.toNodeId];
          if (!fromNode || !toNode) return null;
          if (modifyingTransition?.id === edge.id) return null;

          const fromPos = getNodeDisplayPosition(edge.fromNodeId, fromNode.position);
          const toPos = getNodeDisplayPosition(edge.toNodeId, toNode.position);

          const { start, end } = presentationEdgeAnchors(fromPos, toPos, edge);

          return (
            <React.Fragment key={`handles-${edge.id}`}>
              {/* 源端手柄 - 使用 CSS .handle 类的 transform 居中 */}
              <div
                className="handle presentation-handle"
                style={{ left: start.x, top: start.y }}
                onMouseDown={(e) => handleEdgeHandleDown(e, edge.id, 'source')}
              />
              {/* 目标端手柄 */}
              <div
                className="handle presentation-handle"
                style={{ left: end.x, top: end.y }}
                onMouseDown={(e) => handleEdgeHandleDown(e, edge.id, 'target')}
              />
            </React.Fragment>
          );
        })}
      {/* 吸附点提示（连线/修改连线时） */}
      {(linkingState || modifyingTransition) &&
        snapPoints.map((point, idx) => (
          <div
            key={idx}
            className={`presentation-snap ${activeSnapPoint === point ? 'presentation-snap-active' : ''}`}
            style={{ left: point.x - 4, top: point.y - 4 }}
          />
        ))}
    </>
  );
}
