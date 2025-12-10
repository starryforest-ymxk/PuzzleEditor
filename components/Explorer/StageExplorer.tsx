import React from 'react';
import { useEditorState, useEditorDispatch } from '../../store/context';
import { ChevronRight, ChevronDown, Folder, Flag, Box } from 'lucide-react';

export const StageExplorer = () => {
  const { project, ui } = useEditorState();
  const dispatch = useEditorDispatch();

  const handleSelect = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    // P2-T02: Navigate to Stage
    dispatch({ type: 'NAVIGATE_TO', payload: { stageId: id, nodeId: null, graphId: null } });
    // Keep selection focus
    dispatch({ type: 'SELECT_OBJECT', payload: { type: 'STAGE', id } });
  };

  const handleToggle = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    dispatch({ type: 'TOGGLE_STAGE_EXPAND', payload: { id } });
  };

  const renderTree = (stageId: string, depth = 0) => {
    const stage = project.stageTree.stages[stageId];
    if (!stage) return null;

    const isSelected = ui.currentStageId === stage.id;
    const hasChildren = stage.childrenIds.length > 0;

    // Check if Initial: Root is initial, or it is the first child of its parent
    const parent = stage.parentId ? project.stageTree.stages[stage.parentId] : null;
    const isInitial = !parent || parent.childrenIds[0] === stage.id;

    return (
      <div key={stage.id}>
        <div
          className={`tree-node ${isSelected ? 'selected' : ''}`}
          style={{ paddingLeft: `${depth * 16 + 8}px` }}
          onClick={(e) => handleSelect(e, stage.id)}
        >
          {/* Expander Icon */}
          <span
            style={{
              marginRight: '4px',
              display: 'flex',
              alignItems: 'center',
              cursor: hasChildren ? 'pointer' : 'default',
              opacity: hasChildren ? 1 : 0.3,
              color: 'var(--text-secondary)'
            }}
            onClick={(e) => hasChildren && handleToggle(e, stage.id)}
          >
            {hasChildren ? (
              stage.isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />
            ) : (
              <div style={{ width: 14, height: 14 }} />
            )}
          </span>

          {/* Type Icon */}
          <span style={{ marginRight: '6px', color: isSelected ? 'inherit' : 'var(--text-secondary)' }}>
            {hasChildren ? <Folder size={14} /> : <Box size={14} />}
          </span>

          {/* Name */}
          <span style={{
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            fontSize: '13px',
            flex: 1
          }}>
            {stage.name}
          </span>

          {/* Initial Marker */}
          {isInitial && (
            <span
              title="Initial Stage"
              style={{
                marginLeft: '6px',
                color: 'var(--accent-color)',
                display: 'flex',
                alignItems: 'center'
              }}
            >
              <Flag size={12} fill="currentColor" />
            </span>
          )}
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
      {project.stageTree.rootId ? renderTree(project.stageTree.rootId) : <div className="empty-state">No Root Stage</div>}
    </div>
  );
};
