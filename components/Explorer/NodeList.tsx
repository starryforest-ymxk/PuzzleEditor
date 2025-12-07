import React from 'react';
import { useEditorState, useEditorDispatch } from '../../store/context';
import { PuzzleNode } from '../../types/puzzleNode';

export const NodeList = () => {
  const { project, ui } = useEditorState();
  const dispatch = useEditorDispatch();

  // 获取当前选中 Stage 的子节点
  const currentStageId = ui.selection.type === 'STAGE' ? ui.selection.id : 
                         ui.selection.type === 'NODE' ? project.nodes[ui.selection.id!]?.stageId : null;

  const nodes: PuzzleNode[] = React.useMemo(() => {
    if (!currentStageId) return [];
    return Object.values(project.nodes).filter((node: PuzzleNode) => node.stageId === currentStageId);
  }, [project.nodes, currentStageId]);

  const handleSelectNode = (e: React.MouseEvent, nodeId: string) => {
    e.stopPropagation();
    dispatch({ type: 'SELECT_OBJECT', payload: { type: 'NODE', id: nodeId } });
  };

  if (!currentStageId) {
    return (
      <div className="empty-state" style={{ padding: '20px', fontSize: '12px' }}>
        Select a Stage to view Nodes
      </div>
    );
  }

  if (nodes.length === 0) {
     return (
        <div className="empty-state" style={{ padding: '20px', fontSize: '12px' }}>
            No Nodes in this Stage
        </div>
     )
  }

  return (
    <div style={{ padding: '8px 0' }}>
      {nodes.map(node => {
        const isSelected = ui.selection.type === 'NODE' && ui.selection.id === node.id;
        return (
            <div 
                key={node.id}
                className={`tree-node ${isSelected ? 'selected' : ''}`}
                style={{ paddingLeft: '24px' }} // Indent slightly to look different from stages
                onClick={(e) => handleSelectNode(e, node.id)}
            >
                <span style={{ fontSize: '12px', marginRight: '6px', opacity: 0.8 }}>❏</span>
                {node.name}
            </div>
        );
      })}
    </div>
  );
};