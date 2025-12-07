
import React from 'react';
import { useEditorState, useEditorDispatch } from '../../store/context';
import { BlackboardEditor } from './BlackboardEditor';
import { StateInspector } from './StateInspector';
import { TransitionInspector } from './TransitionInspector';
import { PresentationNodeInspector } from './PresentationNodeInspector';

export const Inspector = () => {
  const { ui, project } = useEditorState();
  const dispatch = useEditorDispatch();
  
  if (ui.selection.type === 'NONE') {
    return (
      <div className="empty-state">
        <div style={{ marginBottom: '8px', fontSize: '24px', opacity: 0.2 }}>ⓘ</div>
        Select an object to inspect properties
      </div>
    );
  }

  // --- STAGE INSPECTOR ---
  if (ui.selection.type === 'STAGE') {
    const stage = project.stages[ui.selection.id!];
    if (!stage) return <div className="empty-state">Stage not found</div>;

    return (
      <div>
         <div style={{ padding: '16px', background: '#2d2d30', borderBottom: '1px solid #3e3e42' }}>
            <div style={{ fontSize: '10px', color: 'var(--accent-color)', marginBottom: '4px' }}>STAGE</div>
            <div style={{ fontSize: '16px', fontWeight: 600 }}>{stage.name}</div>
         </div>
         <div className="prop-row">
           <div className="prop-label">Description</div>
           <div className="prop-value">{stage.description || '-'}</div>
         </div>
         <div className="prop-row">
           <div className="prop-label">ID</div>
           <div className="prop-value" style={{ fontFamily: 'monospace', color: '#666' }}>{stage.id}</div>
         </div>
      </div>
    );
  }

  // --- NODE INSPECTOR ---
  if (ui.selection.type === 'NODE') {
    const node = project.nodes[ui.selection.id!];
    if (!node) return <div className="empty-state">Node not found</div>;

    return (
      <div>
         <div style={{ padding: '16px', background: '#2d2d30', borderBottom: '1px solid #3e3e42' }}>
            <div style={{ fontSize: '10px', color: '#ce9178', marginBottom: '4px' }}>PUZZLE NODE</div>
            <div style={{ fontSize: '16px', fontWeight: 600 }}>{node.name}</div>
         </div>
         <div className="prop-row">
           <div className="prop-label">ID</div>
           <div className="prop-value" style={{ fontFamily: 'monospace' }}>{node.id}</div>
         </div>
         <div className="panel-header" style={{ marginTop: '16px' }}>Local Parameters</div>
         <BlackboardEditor variables={node.localBlackboard} nodeId={node.id} />
         <div className="panel-header" style={{ marginTop: '16px' }}>Presentation Graphs</div>
         {node.presentationGraphIds.map(gid => (
             <div key={gid} className="prop-row" style={{ cursor: 'pointer', color: 'var(--accent-color)' }}
                onClick={() => dispatch({ type: 'SELECT_OBJECT', payload: { type: 'PRESENTATION_GRAPH', id: gid, contextId: node.id } })}>
                <div className="prop-value" style={{ textDecoration: 'underline' }}>{gid}</div>
                <div style={{ fontSize: '10px' }}>Open ↗</div>
             </div>
         ))}
      </div>
    );
  }

  // --- STATE INSPECTOR ---
  if (ui.selection.type === 'STATE') {
      if (!ui.selection.contextId) return <div className="empty-state">Context missing for State</div>;
      
      const node = project.nodes[ui.selection.contextId];
      if (!node) return <div className="empty-state">Context Node not found</div>;
      
      return <StateInspector fsmId={node.stateMachineId} stateId={ui.selection.id!} />;
  }

  // --- TRANSITION INSPECTOR ---
  if (ui.selection.type === 'TRANSITION') {
      if (!ui.selection.contextId) return <div className="empty-state">Context missing for Transition</div>;
      
      const node = project.nodes[ui.selection.contextId];
      if (!node) return <div className="empty-state">Context Node not found</div>;

      return <TransitionInspector fsmId={node.stateMachineId} transitionId={ui.selection.id!} />;
  }

  // --- PRESENTATION NODE INSPECTOR ---
  if (ui.selection.type === 'PRESENTATION_NODE') {
      const graphId = ui.selection.contextId;
      if (!graphId) return <div className="empty-state">Graph Context missing</div>;

      return <PresentationNodeInspector graphId={graphId} nodeId={ui.selection.id!} />;
  }

  return <div className="empty-state">Unknown selection type</div>;
};
