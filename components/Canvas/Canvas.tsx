import React from 'react';
import { useEditorState, useEditorDispatch } from '../../store/context';
import { StateMachineCanvas } from './StateMachineCanvas';
import { PresentationCanvas } from './PresentationCanvas';
import { StageOverview } from './StageOverview';

export const Canvas = ({ readOnly = false }: { readOnly?: boolean }) => {
    const { ui, project } = useEditorState();

    if (ui.isLoading) {
        return <div className="canvas-area"><div className="empty-state">Initializing Project...</div></div>;
    }

    // --- Router Logic ---

    // 0. Presentation Graph View
    // Priority: currentGraphId (Navigation) -> Only if valid graph
    if (ui.currentGraphId) {
        const graph = project.presentationGraphs[ui.currentGraphId];
        if (graph) {
            return (
                <div className="canvas-area">
                    <PresentationCanvas graph={graph} ownerNodeId={null} readOnly={readOnly} />
                </div>
            );
        }
    }

    // 1. Specific Node View (FSM Editor)
    // Priority: currentNodeId (Navigation) -> Only if valid node
    if (ui.currentNodeId) {
        const node = project.nodes[ui.currentNodeId];
        if (node) {
            return (
                <div className="canvas-area">
                    <StateMachineCanvas node={node} readOnly={readOnly} />
                </div>
            );
        }
    }

    // 2. Stage Overview
    // Priority: currentStageId (Navigation)
    // Note: If navigating to Root, both stageId and nodeId might be null initially? 
    // Actually our nav logic sets Root ID.
    if (ui.currentStageId) {
        return (
            <div className="canvas-area">
                <StageOverview stageId={ui.currentStageId} />
            </div>
        );
    }

    // 3. Fallback: Empty State
    return (
        <div className="canvas-area canvas-grid">
            <div className="empty-state">
                <h1 style={{ margin: 0, fontSize: '64px', fontWeight: 800, opacity: 0.03, letterSpacing: '-2px' }}>CANVAS</h1>
                <div style={{ marginTop: '-40px', color: 'var(--text-dim)' }}>Select a Stage or Node to begin</div>
            </div>
        </div>
    );
};
