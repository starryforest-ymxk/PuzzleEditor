import React from 'react';
import { useEditorState, useEditorDispatch } from '../../store/context';
import { PuzzleNode } from '../../types/puzzleNode';
import { Folder, Box, FileCode } from 'lucide-react';

interface StageOverviewProps {
    stageId: string;
}

export const StageOverview: React.FC<StageOverviewProps> = ({ stageId }) => {
    const { project, ui } = useEditorState();
    const dispatch = useEditorDispatch();

    const stage = project.stageTree.stages[stageId];
    if (!stage) return <div className="empty-state">Stage not found</div>;

    // 1. Get Sub-Stages
    const subStages = stage.childrenIds
        .map(id => project.stageTree.stages[id])
        .filter(Boolean);

    // 2. Get Puzzle Nodes
    const nodes = (Object.values(project.nodes) as PuzzleNode[])
        .filter(n => n.stageId === stageId);

    const handleStageClick = (e: React.MouseEvent) => {
        // Select Stage when clicking background
        if (e.target === e.currentTarget) {
            dispatch({ type: 'SELECT_OBJECT', payload: { type: 'STAGE', id: stageId } });
        }
    };

    const handleCardClick = (e: React.MouseEvent, type: 'STAGE' | 'NODE', id: string) => {
        e.stopPropagation();
        dispatch({ type: 'SELECT_OBJECT', payload: { type, id } });
    };

    const handleNodeDoubleClick = (e: React.MouseEvent, nodeId: string) => {
        e.stopPropagation();
        dispatch({ type: 'NAVIGATE_TO', payload: { nodeId } });
        dispatch({ type: 'SELECT_OBJECT', payload: { type: 'NODE', id: nodeId } });
    };

    const handleStageDoubleClick = (e: React.MouseEvent, stageId: string) => {
        e.stopPropagation();
        dispatch({ type: 'NAVIGATE_TO', payload: { stageId, nodeId: null } });
        dispatch({ type: 'SELECT_OBJECT', payload: { type: 'STAGE', id: stageId } });
    }

    const renderCard = (
        id: string,
        name: string,
        type: 'STAGE' | 'NODE',
        description?: string,
        onDoubleClick?: (e: React.MouseEvent) => void
    ) => {
        const isSelected = ui.selection.type === type && ui.selection.id === id;

        return (
            <div
                key={id}
                className={`overview-card ${isSelected ? 'selected' : ''}`}
                style={{ height: '140px' }}
                onClick={(e) => handleCardClick(e, type, id)}
                onDoubleClick={onDoubleClick}
            >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                    <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        {type === 'STAGE' ? <Folder size={14} /> : <FileCode size={14} />}
                        {name}
                    </div>
                    <div style={{
                        fontSize: '10px',
                        color: 'var(--text-secondary)',
                        background: 'var(--bg-color)',
                        padding: '2px 6px',
                        borderRadius: 'var(--radius-sm)',
                        border: '1px solid var(--border-color)'
                    }}>
                        {type}
                    </div>
                </div>

                <div style={{ fontSize: '12px', color: 'var(--text-secondary)', flex: 1, overflow: 'hidden', lineHeight: '1.4' }}>
                    {description || 'No description provided.'}
                </div>

                <div style={{
                    borderTop: '1px solid var(--border-color)',
                    paddingTop: '8px',
                    marginTop: 'auto',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    fontSize: '11px'
                }}>
                    <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-dim)' }}>{id.slice(0, 8)}...</span>
                    <span style={{ color: 'var(--accent-color)', fontWeight: 500, display: 'flex', alignItems: 'center', opacity: 0.8 }}>
                        {type === 'NODE' ? 'Open Node ->' : 'Open Stage ->'}
                    </span>
                </div>
            </div>
        );
    };

    return (
        <div
            className="canvas-grid"
            style={{
                position: 'relative',
                zIndex: 1,
                padding: '40px',
                height: '100%',
                boxSizing: 'border-box',
                overflowY: 'auto',
                background: 'var(--bg-color)' // Ensure pattern visibility
            }}
            onClick={handleStageClick}
        >
            {/* Header Section */}
            <div style={{ marginBottom: '32px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px', color: 'var(--accent-color)' }}>
                    <Box size={16} />
                    <span style={{ fontSize: '12px', fontWeight: 600, letterSpacing: '1px', textTransform: 'uppercase' }}>Stage Overview</span>
                </div>
                <h1 style={{ margin: '0 0 8px 0', fontWeight: 300, fontSize: '28px', color: 'var(--text-primary)' }}>
                    {stage.name}
                </h1>
                <div style={{ color: 'var(--text-secondary)', fontSize: '13px', maxWidth: '600px' }}>
                    {stage.description || 'No description provided for this stage.'}
                </div>
            </div>

            {/* Section: Sub-Stages */}
            {subStages.length > 0 && (
                <div style={{ marginBottom: '32px' }}>
                    <h3 style={{ fontSize: '12px', color: 'var(--text-dim)', textTransform: 'uppercase', marginBottom: '12px', letterSpacing: '0.5px' }}>
                        Sub-Stages ({subStages.length})
                    </h3>
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
                        gap: '16px'
                    }}>
                        {subStages.map(s => renderCard(s.id, s.name, 'STAGE', s.description, (e) => handleStageDoubleClick(e, s.id)))}
                    </div>
                </div>
            )}

            {/* Section: Puzzle Nodes */}
            <div style={{ marginBottom: '32px' }}>
                <h3 style={{ fontSize: '12px', color: 'var(--text-dim)', textTransform: 'uppercase', marginBottom: '12px', letterSpacing: '0.5px' }}>
                    Puzzle Nodes ({nodes.length})
                </h3>
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
                    gap: '16px'
                }}>
                    {nodes.map(n => renderCard(n.id, n.name, 'NODE', n.description, (e) => handleNodeDoubleClick(e, n.id)))}

                    {nodes.length === 0 && subStages.length === 0 && (
                        <div style={{
                            gridColumn: '1 / -1',
                            border: '2px dashed var(--border-color)',
                            borderRadius: 'var(--radius-md)',
                            height: '160px',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: 'var(--text-dim)',
                            backgroundColor: 'rgba(255,255,255,0.02)'
                        }}>
                            <div style={{ fontSize: '24px', marginBottom: '8px' }}>Empty</div>
                            <div>This stage is empty</div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
