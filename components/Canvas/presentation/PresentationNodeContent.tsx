import React from 'react';
import type { PresentationNode } from '../../../types/presentation';

/** 摘要只展示节点数据；Branch 的两个槽位分别对应 True/False。 */
export function PresentationNodeContent({
  node,
  nodes,
}: {
  node: PresentationNode;
  nodes: Record<string, PresentationNode>;
}) {
  const binding = node.presentation;
  return (
    <div className="presentation-node-content">
      {node.type === 'Branch' ? (
        <div className="presentation-branch-content">
          {node.type}
          {(['TRUE', 'FALSE'] as const).map((label, index) => (
            <div
              key={label}
              className={`presentation-branch-row presentation-branch-${label.toLowerCase()}`}
            >
              <span className="presentation-branch-label">{label}:</span>
              <span className="presentation-branch-target">
                {node.nextIds[index]
                  ? nodes[node.nextIds[index]]?.name || node.nextIds[index]
                  : '--'}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <>
          {node.type}
          {node.type === 'Wait' && node.duration !== undefined && (
            <div className="presentation-node-detail presentation-duration">
              Duration: {node.duration}s
            </div>
          )}
          {binding?.type === 'Script' && binding.scriptId && (
            <div className="presentation-node-detail presentation-script">
              Script: {binding.scriptId}
            </div>
          )}
          {binding?.type === 'Graph' && binding.graphId && (
            <div className="presentation-node-detail presentation-graph">
              Graph: {binding.graphId}
            </div>
          )}
        </>
      )}
    </div>
  );
}
