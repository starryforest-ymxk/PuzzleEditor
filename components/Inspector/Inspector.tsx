
import React from 'react';
import { useEditorState, useEditorDispatch } from '../../store/context';
import { BlackboardEditor } from './BlackboardEditor';
import { StateInspector } from './StateInspector';
import { TransitionInspector } from './TransitionInspector';
import { PresentationNodeInspector } from './PresentationNodeInspector';
import { EventListenersEditor } from './EventListenersEditor';
import { PresentationBindingEditor } from './PresentationBindingEditor';
import { collectVisibleVariables } from '../../utils/variableScope';

export const Inspector = () => {
  const { ui, project } = useEditorState();
  const dispatch = useEditorDispatch();

  // 预先拉平脚本、事件等选项，避免在条件分支内调用 Hook 产生渲染错误
  const scriptDefs = project.scripts.scripts || {};
  const scriptOptions = Object.values(scriptDefs).map(s => ({ id: s.id, name: s.name, state: s.state }));
  const performanceScriptOptions = Object.values(scriptDefs)
    .filter(s => s.category === 'Performance')
    .map(s => ({ id: s.id, name: s.name, state: s.state }));
  const graphOptions = Object.values(project.presentationGraphs || {}).map(g => ({ id: g.id, name: g.name, state: 'Draft' as any }));
  const eventOptions = Object.values(project.blackboard.events || {}).map(e => ({ id: e.id, name: e.name, state: e.state }));

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
    const stage = project.stageTree.stages[ui.selection.id!];
    if (!stage) return <div className="empty-state">Stage not found</div>;
    // 直接计算当前可见变量，避免条件 Hook 破坏 Hook 调用顺序
    const visibleVars = collectVisibleVariables(
      { project, ui: { selection: ui.selection, multiSelectStateIds: [] }, history: { past: [], future: [] } } as any,
      stage.id,
      null
    ).all.filter(v => v.state !== 'MarkedForDelete');

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

        <div className="panel-header" style={{ marginTop: '16px' }}>OnEnter Presentation</div>
        <div style={{ padding: '12px' }}>
          <PresentationBindingEditor
            binding={stage.onEnterPresentation}
            onChange={(next) => dispatch({ type: 'UPDATE_STAGE_TREE', payload: { ...project.stageTree, stages: { ...project.stageTree.stages, [stage.id]: { ...stage, onEnterPresentation: next } } } })}
            scriptDefs={scriptDefs}
            scriptOptions={performanceScriptOptions}
            graphOptions={graphOptions}
            variables={visibleVars}
            title="On Enter Presentation"
          />
        </div>

        <div className="panel-header" style={{ marginTop: '16px' }}>OnExit Presentation</div>
        <div style={{ padding: '12px' }}>
          <PresentationBindingEditor
            binding={stage.onExitPresentation}
            onChange={(next) => dispatch({ type: 'UPDATE_STAGE_TREE', payload: { ...project.stageTree, stages: { ...project.stageTree.stages, [stage.id]: { ...stage, onExitPresentation: next } } } })}
            scriptDefs={scriptDefs}
            scriptOptions={performanceScriptOptions}
            graphOptions={graphOptions}
            variables={visibleVars}
            title="On Exit Presentation"
          />
        </div>

        <div className="panel-header" style={{ marginTop: '16px' }}>Event Listeners</div>
        <EventListenersEditor
          listeners={stage.eventListeners || []}
          onChange={(next) => dispatch({ type: 'UPDATE_STAGE_TREE', payload: { ...project.stageTree, stages: { ...project.stageTree.stages, [stage.id]: { ...stage, eventListeners: next } } } })}
          eventOptions={eventOptions}
          scriptOptions={scriptOptions}
          variables={visibleVars}
        />
      </div>
    );
  }

  // --- NODE INSPECTOR ---
  if (ui.selection.type === 'NODE') {
    const node = project.nodes[ui.selection.id!];
    if (!node) return <div className="empty-state">Node not found</div>;
    // 直接计算当前可见变量，避免条件 Hook 破坏 Hook 调用顺序
    const visibleVars = collectVisibleVariables(
      { project, ui: { selection: ui.selection, multiSelectStateIds: [] }, history: { past: [], future: [] } } as any,
      node.stageId,
      node.id
    ).all.filter(v => v.state !== 'MarkedForDelete');

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
        <BlackboardEditor variables={node.localVariables} nodeId={node.id} />

        <div className="panel-header" style={{ marginTop: '16px' }}>Event Listeners</div>
        <EventListenersEditor
          listeners={node.eventListeners || []}
          onChange={(next) => dispatch({ type: 'UPDATE_NODE', payload: { nodeId: node.id, data: { eventListeners: next } } })}
          eventOptions={eventOptions}
          scriptOptions={scriptOptions}
          variables={visibleVars}
        />
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
