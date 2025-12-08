import React from 'react';
import { useEditorState, useEditorDispatch } from '../../store/context';
import { PuzzleNode } from '../../types/puzzleNode';
import { StateMachineCanvas } from './StateMachineCanvas';
import { PresentationCanvas } from './PresentationCanvas';

export const Canvas = () => {
    const { ui, project } = useEditorState();
    const dispatch = useEditorDispatch();

    // Mode 1: Stage Overview (Card List)
    const renderStageOverview = (stageId: string) => {
        const nodes = (Object.values(project.nodes) as PuzzleNode[]).filter(n => n.stageId === stageId);

        return (
            <div style={{
                position: 'relative',
                zIndex: 1,
                padding: '40px',
                height: '100%',
                boxSizing: 'border-box',
                overflowY: 'auto'
            }}
                onClick={() => dispatch({ type: 'SELECT_OBJECT', payload: { type: 'STAGE', id: stageId } })}>

                <div style={{ marginBottom: '32px' }}>
                    <h1 style={{ margin: '0 0 8px 0', fontWeight: 300, fontSize: '28px', color: '#fff' }}>
                        {project.stageTree.stages[stageId]?.name}
                    </h1>
                    <div style={{ color: '#666', fontSize: '13px', maxWidth: '600px' }}>
                        {project.stageTree.stages[stageId]?.description || 'No description provided for this stage.'}
                    </div>
                </div>

                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
                    gap: '16px'
                }}>
                    {nodes.map(node => {
                        const isSelected = ui.selection.type === 'NODE' && ui.selection.id === node.id;
                        return (
                            <div
                                key={node.id}
                                className={`overview-card ${isSelected ? 'selected' : ''}`}
                                style={{ height: '140px' }}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    dispatch({ type: 'SELECT_OBJECT', payload: { type: 'NODE', id: node.id } });
                                }}
                            >
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                                    <div style={{ fontWeight: 600, color: '#f0f0f0', fontSize: '14px' }}>{node.name}</div>
                                    <div style={{ fontSize: '10px', color: '#666', background: '#1e1e1e', padding: '2px 6px', borderRadius: '4px' }}>NODE</div>
                                </div>

                                <div style={{ fontSize: '12px', color: '#888', flex: 1, overflow: 'hidden', lineHeight: '1.4' }}>
                                    {node.description}
                                </div>

                                <div style={{
                                    borderTop: '1px solid rgba(255,255,255,0.05)',
                                    paddingTop: '8px',
                                    marginTop: 'auto',
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    fontSize: '11px'
                                }}>
                                    <span style={{ fontFamily: 'monospace', color: '#555' }}>{node.id}</span>
                                    <span style={{ color: 'var(--accent-color)', fontWeight: 500, display: 'flex', alignItems: 'center' }}>
                                        Edit Logic <span style={{ fontSize: '14px', marginLeft: '2px' }}>→</span>
                                    </span>
                                </div>
                            </div>
                        );
                    })}

                    {nodes.length === 0 && (
                        <div style={{
                            gridColumn: '1 / -1',
                            border: '2px dashed #333',
                            borderRadius: '8px',
                            height: '160px',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: '#555',
                            backgroundColor: 'rgba(0,0,0,0.1)'
                        }}>
                            <div style={{ fontSize: '24px', marginBottom: '8px' }}>∅</div>
                            <div>This stage is empty</div>
                        </div>
                    )}
                </div>
            </div>
        );
    };

    if (ui.isLoading) {
        return <div className="canvas-area"><div className="empty-state">Initializing Project...</div></div>;
    }

    // --- Router Logic ---

    // 1. Presentation Editor (Graph or Node selected)
    if (ui.selection.type === 'PRESENTATION_GRAPH' || ui.selection.type === 'PRESENTATION_NODE') {
        let graphId = ui.selection.id;
        // If node is selected, id is node id, contextId is graphId
        if (ui.selection.type === 'PRESENTATION_NODE') {
            graphId = ui.selection.contextId;
        }

        const graph = project.presentationGraphs[graphId!];
        if (graph) {
            return (
                <div className="canvas-area">
                    <PresentationCanvas graph={graph} ownerNodeId={ui.selection.type === 'PRESENTATION_GRAPH' ? ui.selection.contextId : null} />
                </div>
            )
        }
    }

    // 2. FSM Editor (Node, State, or Transition selected)
    // Fix: Included TRANSITION type and logic to find nodeId from contextId
    if (ui.selection.type === 'NODE' || ui.selection.type === 'STATE' || ui.selection.type === 'TRANSITION') {
        let nodeId = ui.selection.id;

        // If State or Transition is selected, the Node ID is stored in contextId
        if ((ui.selection.type === 'STATE' || ui.selection.type === 'TRANSITION') && ui.selection.contextId) {
            nodeId = ui.selection.contextId;
        }

        const node = project.nodes[nodeId!];
        if (node) {
            return (
                <div className="canvas-area">
                    <StateMachineCanvas node={node} />
                </div>
            );
        }
    }

    // 3. Stage Overview
    if (ui.selection.type === 'STAGE') {
        return (
            <div className="canvas-area canvas-grid">
                {renderStageOverview(ui.selection.id!)}
            </div>
        );
    }

    // 4. Default Empty State
    return (
        <div className="canvas-area canvas-grid">
            <div className="empty-state">
                <h1 style={{ margin: 0, fontSize: '64px', fontWeight: 800, opacity: 0.03, letterSpacing: '-2px' }}>CANVAS</h1>
                <div style={{ marginTop: '-40px', color: '#444' }}>Select a Stage or Node to begin</div>
            </div>
        </div>
    );
};
