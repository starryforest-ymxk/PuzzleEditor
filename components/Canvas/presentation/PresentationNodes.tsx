import React from 'react';
import type { PresentationGraph, PresentationNode } from '../../../types/presentation';
import type { PresentationCanvasModel } from '../../../hooks/usePresentationCanvas';
import { PRESENTATION_NODE_DIMENSIONS } from '../../../utils/presentationGeometry';
import { GraphNode } from '../shared';
import { PresentationNodeContent } from './PresentationNodeContent';
export function PresentationNodes({
  graph,
  model,
  readOnly,
}: {
  graph: PresentationGraph;
  model: PresentationCanvasModel;
  readOnly: boolean;
}) {
  const {
    getNodeDisplayPosition,
    selection,
    multiSelectIds,
    validationResults,
    contextMenu,
    handleNodeMouseDown,
    handleNodeMouseUp,
    handleContextMenu,
  } = model;
  return (
    <>
      {' '}
      {/* 节点层 */}
      {(Object.values(graph.nodes) as PresentationNode[]).map((node) => {
        const pos = getNodeDisplayPosition(node.id, node.position);
        const isSingleSelected = selection.type === 'PRESENTATION_NODE' && selection.id === node.id;
        const isMultiSelected = multiSelectIds.includes(node.id); // 检查是否在多选列表中
        const isStart = graph.startNodeId === node.id;

        // 获取校验结果
        const nodeValidation = validationResults[node.id];
        const errorTooltip = nodeValidation?.hasError
          ? nodeValidation.issues
              .filter((i) => i.type === 'error')
              .map((i) => i.message)
              .join('\n')
          : undefined;
        const warningTooltip = nodeValidation?.hasWarning
          ? nodeValidation.issues
              .filter((i) => i.type === 'warning')
              .map((i) => i.message)
              .join('\n')
          : undefined;

        return (
          <GraphNode
            key={node.id}
            node={node}
            position={pos}
            dimensions={PRESENTATION_NODE_DIMENSIONS}
            isSelected={isSingleSelected}
            isMultiSelected={isMultiSelected}
            isInitial={isStart}
            isContextTarget={contextMenu?.type === 'NODE' && contextMenu?.targetId === node.id}
            readOnly={readOnly}
            hasError={nodeValidation?.hasError}
            hasWarning={nodeValidation?.hasWarning}
            errorTooltip={errorTooltip}
            warningTooltip={warningTooltip}
            renderContent={() => <PresentationNodeContent node={node} nodes={graph.nodes} />}
            onMouseDown={handleNodeMouseDown}
            onMouseUp={handleNodeMouseUp}
            onContextMenu={(e, id) => handleContextMenu(e, 'NODE', id)}
          />
        );
      })}
    </>
  );
}
