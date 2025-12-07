
import React from 'react';
import { useEditorState, useEditorDispatch } from '../../store/context';

export const StageExplorer = () => {
  const { project, ui } = useEditorState();
  const dispatch = useEditorDispatch();

  const handleSelect = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    dispatch({ type: 'SELECT_OBJECT', payload: { type: 'STAGE', id } });
  };

  const handleToggle = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    dispatch({ type: 'TOGGLE_STAGE_EXPAND', payload: { id } });
  };

  const renderTree = (stageId: string, depth = 0) => {
    const stage = project.stages[stageId];
    if (!stage) return null;

    const isSelected = ui.selection.type === 'STAGE' && ui.selection.id === stageId;
    const hasChildren = stage.childrenIds.length > 0;

    return (
      <div key={stage.id}>
        <div 
          className={`tree-node ${isSelected ? 'selected' : ''}`}
          style={{ paddingLeft: `${depth * 16 + 8}px` }}
          onClick={(e) => handleSelect(e, stage.id)}
        >
          <span 
            style={{ 
              marginRight: '6px', 
              opacity: hasChildren ? 0.7 : 0.2, 
              fontSize: '10px',
              cursor: hasChildren ? 'pointer' : 'default',
              width: '12px',
              display: 'inline-block',
              textAlign: 'center'
            }}
            onClick={(e) => hasChildren && handleToggle(e, stage.id)}
          >
            {hasChildren ? (stage.isExpanded ? '▼' : '▶') : '•'}
          </span>
          <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
             {stage.name}
          </span>
        </div>
        
        {hasChildren && stage.isExpanded && (
            <div>
                {stage.childrenIds.map(childId => renderTree(childId, depth + 1))}
            </div>
        )}
      </div>
    );
  };

  if (!project.isLoaded) {
    return <div className="empty-state">Loading...</div>;
  }

  return (
    <div style={{ padding: '8px 0' }}>
      {project.rootStageId ? renderTree(project.rootStageId) : <div className="empty-state">No Root Stage</div>}
    </div>
  );
};
