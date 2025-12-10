import React from 'react';
import { useEditorState, useEditorDispatch } from '../../store/context';
import { PuzzleNode } from '../../types/puzzleNode';
import { FileCode } from 'lucide-react';

export const NodeList = () => {
  const { project, ui } = useEditorState();
  const dispatch = useEditorDispatch();

  // 获取当前选中 Stage 的子节点
  // P2-T02: Use navigation state (currentStageId) instead of selection
  const currentStageId = ui.currentStageId;

  const nodes: PuzzleNode[] = React.useMemo(() => {
    if (!currentStageId) return [];
    return Object.values(project.nodes).filter((node: PuzzleNode) => node.stageId === currentStageId);
  }, [project.nodes, currentStageId]);

  const handleSelectNode = (e: React.MouseEvent, nodeId: string) => {
    e.stopPropagation();
    // P2-T02: Navigate to Node (updates breadcrumb & currentNodeId)
    dispatch({ type: 'NAVIGATE_TO', payload: { nodeId: nodeId, graphId: null } });
    dispatch({ type: 'SELECT_OBJECT', payload: { type: 'NODE', id: nodeId } });
  };

  if (!currentStageId) {
    return (
      <div className="empty-state" style={{ padding: '12px 16px', fontSize: '12px', height: 'auto' }}>
        Select a Stage to view Nodes
      </div>
    );
  }

  if (nodes.length === 0) {
    return (
      <div className="empty-state" style={{ padding: '12px 16px', fontSize: '12px', height: 'auto' }}>
        No Nodes in this Stage
      </div>
    )
  }

  return (
    <div style={{ padding: '8px 0' }}>
      {nodes.map(node => {
        const isSelected = ui.currentNodeId === node.id;
        return (
          <div
            key={node.id}
            className={`tree-node ${isSelected ? 'selected' : ''}`}
            style={{ paddingLeft: '24px' }} // Indent slightly to look different from stages
            onClick={(e) => handleSelectNode(e, node.id)}
          >
            <span style={{ marginRight: '8px', color: 'var(--text-secondary)', display: 'flex' }}>
              <FileCode size={14} />
            </span>
            <span style={{ fontSize: '13px' }}>{node.name}</span>
          </div>
        );
      })}
    </div>
  );
};
