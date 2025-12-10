
import React from 'react';
import { useEditorState, useEditorDispatch } from '../../store/context';
import { BlackboardEditor } from './BlackboardEditor';
import { StateInspector } from './StateInspector';
import { TransitionInspector } from './TransitionInspector';
import { PresentationNodeInspector } from './PresentationNodeInspector';
import { EventListenersEditor } from './EventListenersEditor';
import { PresentationBindingEditor } from './PresentationBindingEditor';
import { ConditionEditor } from './ConditionEditor';
import { ResourceSelect } from './ResourceSelect';
import { collectVisibleVariables } from '../../utils/variableScope';

export const Inspector = ({ readOnly = false }: { readOnly?: boolean }) => {
  const { ui, project } = useEditorState();
  const dispatch = useEditorDispatch();

  // 预先拉平脚本、事件等选项，避免在条件分支内调用 Hook 产生渲染错误
  const scriptDefs = project.scripts.scripts || {};
  const scriptOptions = Object.values(scriptDefs).map(s => ({ id: s.id, name: s.name, state: s.state }));
  const performanceScriptOptions = Object.values(scriptDefs)
    .filter(s => s.category === 'Performance')
    .map(s => ({ id: s.id, name: s.name, state: s.state }));
  const lifecycleScriptOptions = Object.values(scriptDefs)
    .filter(s => s.category === 'Lifecycle')
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

    // 判定初始阶段：无父节点或为父节点首子
    const parent = stage.parentId ? project.stageTree.stages[stage.parentId] : null;
    const isInitialStage = !parent || (parent.childrenIds && parent.childrenIds[0] === stage.id);

    const updateStage = (partial: Partial<typeof stage>) => {
      dispatch({
        type: 'UPDATE_STAGE_TREE',
        payload: {
          ...project.stageTree,
          stages: {
            ...project.stageTree.stages,
            [stage.id]: { ...stage, ...partial }
          }
        }
      });
    };

    const renderLocalVariables = () => {
      const vars = Object.values(stage.localVariables || {});
      if (vars.length === 0) {
        return <div style={{ padding: '12px 16px', color: '#666', fontSize: '12px' }}>No stage-local parameters.</div>;
      }
      return (
        <div style={{ padding: '8px 0' }}>
          {vars.map(v => (
            <div key={v.id} style={{
              padding: '10px 12px',
              borderBottom: '1px solid #2a2a2a',
              background: 'rgba(255,255,255,0.02)',
              display: 'flex',
              flexDirection: 'column',
              gap: '6px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontWeight: 600, color: '#e4e4e7', fontSize: '13px' }}>{v.name}</div>
                <span style={{ fontSize: '10px', color: '#9ca3af', fontFamily: 'monospace' }}>{v.key}</span>
              </div>
              <div style={{ display: 'flex', gap: '12px', fontSize: '11px', color: '#d1d5db' }}>
                <div>
                  <span style={{ color: '#9ca3af' }}>Type: </span>
                  <span style={{ fontFamily: 'monospace' }}>{v.type}</span>
                </div>
                <div>
                  <span style={{ color: '#9ca3af' }}>Default: </span>
                  <span style={{ fontFamily: 'monospace' }}>{String(v.defaultValue)}</span>
                </div>
                <div>
                  <span style={{ color: '#9ca3af' }}>State: </span>
                  <span>{v.state}</span>
                </div>
              </div>
              {v.description && (
                <div style={{ fontSize: '11px', color: '#9ca3af' }}>{v.description}</div>
              )}
            </div>
          ))}
        </div>
      );
    };

    return (
      <div>
        {/* Stage Header */}
        <div style={{ padding: '16px', background: '#2d2d30', borderBottom: '1px solid #3e3e42' }}>
          <div style={{ fontSize: '10px', color: 'var(--accent-color)', marginBottom: '4px', letterSpacing: '1px' }}>STAGE</div>
          <div style={{ fontSize: '16px', fontWeight: 600 }}>{stage.name}</div>
        </div>

        {/* Basic Info Section */}
        <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-color)' }}>
          <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Basic Info</div>
          <div className="prop-row">
            <div className="prop-label">ID</div>
            <div className="prop-value" style={{ fontFamily: 'monospace', color: '#666' }}>{stage.id}</div>
          </div>
          <div className="prop-row">
            <div className="prop-label">Description</div>
            <div className="prop-value">{stage.description || 'No description.'}</div>
          </div>
        </div>

        {/* Unlock Condition Section */}
        <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-color)' }}>
          <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Unlock Condition</div>
          {isInitialStage ? (
            <div style={{ color: '#9ca3af', fontSize: '12px' }}>
              Initial stage unlocks automatically.
            </div>
          ) : (
            <div style={{ pointerEvents: readOnly ? 'none' : 'auto', opacity: readOnly ? 0.6 : 1 }}>
              <ConditionEditor
                condition={stage.unlockCondition || { type: 'LITERAL', value: true }}
                onChange={(next) => updateStage({ unlockCondition: next })}
                variables={visibleVars}
                conditionScripts={Object.values(scriptDefs).filter(s => s.category === 'Condition')}
              />
            </div>
          )}
        </div>

        {/* Lifecycle Script Section */}
        <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-color)' }}>
          <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Lifecycle Script</div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', pointerEvents: readOnly ? 'none' : 'auto', opacity: readOnly ? 0.6 : 1 }}>
            <ResourceSelect
              options={lifecycleScriptOptions}
              value={stage.lifecycleScriptId || ''}
              onChange={(val) => updateStage({ lifecycleScriptId: val || undefined })}
              placeholder="Select lifecycle script"
              warnOnMarkedDelete
              disabled={readOnly}
            />
            {stage.lifecycleScriptId && (
              <button
                className="btn-ghost"
                onClick={() => updateStage({ lifecycleScriptId: undefined })}
                disabled={readOnly}
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {/* Presentation Section (Enter & Exit combined) */}
        <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-color)' }}>
          <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Presentation</div>
          <div style={{ pointerEvents: readOnly ? 'none' : 'auto', opacity: readOnly ? 0.6 : 1 }}>
            <div style={{ marginBottom: '12px' }}>
              <PresentationBindingEditor
                binding={stage.onEnterPresentation}
                onChange={(next) => updateStage({ onEnterPresentation: next })}
                scriptDefs={scriptDefs}
                scriptOptions={performanceScriptOptions}
                graphOptions={graphOptions}
                variables={visibleVars}
                title="On Enter"
                onNavigateToGraph={(graphId) => dispatch({ type: 'NAVIGATE_TO', payload: { graphId } })}
              />
            </div>
            <div>
              <PresentationBindingEditor
                binding={stage.onExitPresentation}
                onChange={(next) => updateStage({ onExitPresentation: next })}
                scriptDefs={scriptDefs}
                scriptOptions={performanceScriptOptions}
                graphOptions={graphOptions}
                variables={visibleVars}
                title="On Exit"
                onNavigateToGraph={(graphId) => dispatch({ type: 'NAVIGATE_TO', payload: { graphId } })}
              />
            </div>
          </div>
        </div>

        {/* Event Listeners Section */}
        <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-color)' }}>
          <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Event Listeners</div>
          <div style={{ pointerEvents: readOnly ? 'none' : 'auto', opacity: readOnly ? 0.6 : 1 }}>
            <EventListenersEditor
              listeners={stage.eventListeners || []}
              onChange={(next) => updateStage({ eventListeners: next })}
              eventOptions={eventOptions}
              scriptOptions={scriptOptions}
              variables={visibleVars}
            />
          </div>
        </div>

        {/* Local Parameters Section */}
        <div style={{ padding: '12px 16px' }}>
          <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Local Variables</div>
          {renderLocalVariables()}
        </div>
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
        {/* Node Header */}
        <div style={{ padding: '16px', background: '#2d2d30', borderBottom: '1px solid #3e3e42' }}>
          <div style={{ fontSize: '10px', color: '#ce9178', marginBottom: '4px', letterSpacing: '1px' }}>PUZZLE NODE</div>
          <div style={{ fontSize: '16px', fontWeight: 600 }}>{node.name}</div>
        </div>

        {/* Basic Info Section */}
        <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-color)' }}>
          <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Basic Info</div>
          <div className="prop-row">
            <div className="prop-label">ID</div>
            <div className="prop-value" style={{ fontFamily: 'monospace', color: '#666' }}>{node.id}</div>
          </div>
          <div className="prop-row">
            <div className="prop-label">Type</div>
            <div className="prop-value">{node.type || 'Default'}</div>
          </div>
          <div className="prop-row">
            <div className="prop-label">Description</div>
            <div className="prop-value">{node.description || 'No description.'}</div>
          </div>
        </div>

        {/* Lifecycle Script Section */}
        <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-color)' }}>
          <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Lifecycle Script</div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', pointerEvents: readOnly ? 'none' : 'auto', opacity: readOnly ? 0.6 : 1 }}>
            <ResourceSelect
              options={lifecycleScriptOptions}
              value={node.lifecycleScriptId || ''}
              onChange={(val) => dispatch({ type: 'UPDATE_NODE', payload: { nodeId: node.id, data: { lifecycleScriptId: val || undefined } } })}
              placeholder="Select lifecycle script"
              warnOnMarkedDelete
              disabled={readOnly}
            />
            {node.lifecycleScriptId && (
              <button
                className="btn-ghost"
                onClick={() => dispatch({ type: 'UPDATE_NODE', payload: { nodeId: node.id, data: { lifecycleScriptId: undefined } } })}
                disabled={readOnly}
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {/* Event Listeners Section */}
        <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-color)' }}>
          <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Event Listeners</div>
          <div style={{ pointerEvents: readOnly ? 'none' : 'auto', opacity: readOnly ? 0.6 : 1 }}>
            <EventListenersEditor
              listeners={node.eventListeners || []}
              onChange={(next) => dispatch({ type: 'UPDATE_NODE', payload: { nodeId: node.id, data: { eventListeners: next } } })}
              eventOptions={eventOptions}
              scriptOptions={scriptOptions}
              variables={visibleVars}
            />
          </div>
        </div>

        {/* Local Variables Section */}
        <div style={{ padding: '12px 16px' }}>
          <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Local Variables</div>
          <div style={{ pointerEvents: readOnly ? 'none' : 'auto', opacity: readOnly ? 0.6 : 1 }}>
            <BlackboardEditor variables={node.localVariables} nodeId={node.id} />
          </div>
        </div>
      </div>
    );
  }

  // --- STATE INSPECTOR ---
  if (ui.selection.type === 'STATE') {
    if (!ui.selection.contextId) return <div className="empty-state">Context missing for State</div>;

    const node = project.nodes[ui.selection.contextId];
    if (!node) return <div className="empty-state">Context Node not found</div>;

    return <StateInspector fsmId={node.stateMachineId} stateId={ui.selection.id!} readOnly={readOnly} />;
  }

  // --- TRANSITION INSPECTOR ---
  if (ui.selection.type === 'TRANSITION') {
    if (!ui.selection.contextId) return <div className="empty-state">Context missing for Transition</div>;

    const node = project.nodes[ui.selection.contextId];
    if (!node) return <div className="empty-state">Context Node not found</div>;

    return <TransitionInspector fsmId={node.stateMachineId} transitionId={ui.selection.id!} readOnly={readOnly} />;
  }

  // --- PRESENTATION NODE INSPECTOR ---
  if (ui.selection.type === 'PRESENTATION_NODE') {
    const graphId = ui.selection.contextId;
    if (!graphId) return <div className="empty-state">Graph Context missing</div>;

    return <PresentationNodeInspector graphId={graphId} nodeId={ui.selection.id!} />;
  }

  // --- PRESENTATION GRAPH INSPECTOR ---
  if (ui.selection.type === 'PRESENTATION_GRAPH') {
    const graph = project.presentationGraphs[ui.selection.id!];
    if (!graph) return <div className="empty-state">Graph not found</div>;

    const nodeCount = Object.keys(graph.nodes || {}).length;
    const startNode = graph.startNodeId ? graph.nodes[graph.startNodeId] : null;

    return (
      <div>
        {/* Presentation Graph Header */}
        <div style={{ padding: '16px', background: '#2d2d30', borderBottom: '1px solid #3e3e42' }}>
          <div style={{ fontSize: '10px', color: '#c586c0', marginBottom: '4px', letterSpacing: '1px' }}>PRESENTATION GRAPH</div>
          <div style={{ fontSize: '16px', fontWeight: 600 }}>{graph.name}</div>
        </div>

        {/* Basic Info Section */}
        <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-color)' }}>
          <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Basic Info</div>
          <div className="prop-row">
            <div className="prop-label">ID</div>
            <div className="prop-value" style={{ fontFamily: 'monospace', color: '#666' }}>{graph.id}</div>
          </div>
          <div className="prop-row">
            <div className="prop-label">Node Count</div>
            <div className="prop-value" style={{ color: 'var(--accent-color)' }}>{nodeCount}</div>
          </div>
          <div className="prop-row">
            <div className="prop-label">Start Node</div>
            <div className="prop-value" style={{ color: '#4fc1ff' }}>{startNode ? startNode.name : '-'}</div>
          </div>
        </div>

        {/* Nodes Section */}
        <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-color)' }}>
          <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Nodes</div>
          <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
            {Object.values(graph.nodes).length === 0 ? (
              <div style={{ fontSize: '11px', color: '#666', fontStyle: 'italic' }}>No nodes</div>
            ) : (
              Object.values(graph.nodes).map((node: any) => (
                <div key={node.id} style={{ padding: '8px', marginBottom: '6px', background: '#1f1f1f', borderRadius: '4px', borderLeft: '3px solid #c586c0' }}>
                  <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>{node.name}</div>
                  <div style={{ fontSize: '10px', color: 'var(--text-dim)', fontFamily: 'monospace' }}>{node.type}</div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* References Section (Placeholder) */}
        <div style={{ padding: '12px 16px' }}>
          <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>References</div>
          <div style={{ padding: '12px', background: '#1a1a1a', borderRadius: '4px', border: '1px dashed #444', textAlign: 'center' }}>
            <div style={{ fontSize: '11px', color: '#888', marginBottom: '4px' }}>Reference tracking coming soon</div>
            <div style={{ fontSize: '10px', color: '#666' }}>This section will show where this graph is used (Stage enter/exit, State/Transition presentations, nested graph calls, etc.)</div>
          </div>
        </div>
      </div>
    );
  }

  // --- FSM INSPECTOR ---
  if (ui.selection.type === 'FSM') {
    const fsm = project.stateMachines[ui.selection.id!];
    if (!fsm) return <div className="empty-state">State Machine not found</div>;

    const stateCount = Object.keys(fsm.states || {}).length;
    const transitionCount = Object.keys(fsm.transitions || {}).length;
    const initialState = fsm.initialStateId ? fsm.states[fsm.initialStateId] : null;

    // Find owner Puzzle Node
    const ownerNode = Object.values(project.nodes).find(n => n.stateMachineId === fsm.id);

    return (
      <div>
        {/* FSM Header */}
        <div style={{ padding: '16px', background: '#2d2d30', borderBottom: '1px solid #3e3e42' }}>
          <div style={{ fontSize: '10px', color: '#4fc1ff', marginBottom: '4px', letterSpacing: '1px' }}>STATE MACHINE</div>
          <div style={{ fontSize: '16px', fontWeight: 600 }}>{fsm.name}</div>
        </div>

        {/* Basic Info Section */}
        <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-color)' }}>
          <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Basic Info</div>
          <div className="prop-row">
            <div className="prop-label">ID</div>
            <div className="prop-value" style={{ fontFamily: 'monospace', color: '#666' }}>{fsm.id}</div>
          </div>
          <div className="prop-row">
            <div className="prop-label">State Count</div>
            <div className="prop-value" style={{ color: 'var(--accent-color)' }}>{stateCount}</div>
          </div>
          <div className="prop-row">
            <div className="prop-label">Transition Count</div>
            <div className="prop-value" style={{ color: 'var(--accent-warning)' }}>{transitionCount}</div>
          </div>
          <div className="prop-row">
            <div className="prop-label">Initial State</div>
            <div className="prop-value" style={{ color: '#4fc1ff' }}>{initialState ? initialState.name : '-'}</div>
          </div>
        </div>

        {/* Owner Section */}
        <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-color)' }}>
          <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Owner</div>
          {ownerNode ? (
            <>
              <div className="prop-row">
                <div className="prop-label">Puzzle Node</div>
                <div className="prop-value" style={{ color: '#ce9178' }}>{ownerNode.name}</div>
              </div>
              <div className="prop-row">
                <div className="prop-label">Node ID</div>
                <div className="prop-value" style={{ fontFamily: 'monospace', color: '#666' }}>{ownerNode.id}</div>
              </div>
            </>
          ) : (
            <div style={{ fontSize: '11px', color: '#888', fontStyle: 'italic' }}>No owner node found</div>
          )}
        </div>

        {/* States Section */}
        <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-color)' }}>
          <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>States</div>
          <div style={{ maxHeight: '150px', overflowY: 'auto' }}>
            {Object.values(fsm.states).length === 0 ? (
              <div style={{ fontSize: '11px', color: '#666', fontStyle: 'italic' }}>No states</div>
            ) : (
              Object.values(fsm.states).map((state: any) => (
                <div key={state.id} style={{ padding: '6px 8px', marginBottom: '4px', background: '#1f1f1f', borderRadius: '4px', borderLeft: state.id === fsm.initialStateId ? '3px solid #4fc1ff' : '3px solid #444' }}>
                  <div style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-primary)' }}>{state.name}</div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Transitions Section */}
        <div style={{ padding: '12px 16px' }}>
          <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Transitions</div>
          <div style={{ maxHeight: '150px', overflowY: 'auto' }}>
            {Object.values(fsm.transitions).length === 0 ? (
              <div style={{ fontSize: '11px', color: '#666', fontStyle: 'italic' }}>No transitions</div>
            ) : (
              Object.values(fsm.transitions).map((trans: any) => {
                const from = fsm.states[trans.fromStateId];
                const to = fsm.states[trans.toStateId];
                return (
                  <div key={trans.id} style={{ padding: '6px 8px', marginBottom: '4px', background: '#1f1f1f', borderRadius: '4px', borderLeft: '3px solid var(--accent-warning)' }}>
                    <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                      {from?.name || '?'} → {to?.name || '?'}
                    </div>
                    <div style={{ fontSize: '10px', color: 'var(--text-dim)' }}>{trans.name}</div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    );
  }

  // --- VARIABLE INSPECTOR ---
  if (ui.selection.type === 'VARIABLE') {
    // Try to find in global variables first
    let variable = project.blackboard.globalVariables[ui.selection.id!];
    let variableScope: 'Global' | 'Stage' | 'Node' = 'Global';
    let scopeOwnerName = '';
    let scopeOwnerId = '';

    // If not found in global, search in stages
    if (!variable) {
      for (const stage of Object.values(project.stageTree.stages)) {
        if (stage.localVariables && stage.localVariables[ui.selection.id!]) {
          variable = stage.localVariables[ui.selection.id!];
          variableScope = 'Stage';
          scopeOwnerName = stage.name;
          scopeOwnerId = stage.id;
          break;
        }
      }
    }

    // If not found in stages, search in nodes
    if (!variable) {
      for (const node of Object.values(project.nodes)) {
        if (node.localVariables && node.localVariables[ui.selection.id!]) {
          variable = node.localVariables[ui.selection.id!];
          variableScope = 'Node';
          scopeOwnerName = node.name;
          scopeOwnerId = node.id;
          break;
        }
      }
    }

    if (!variable) return <div className="empty-state">Variable not found</div>;

    const scopeColor = variableScope === 'Global' ? '#4fc3f7' : variableScope === 'Stage' ? '#4fc1ff' : '#ce9178';
    const scopeLabel = variableScope === 'Global' ? 'GLOBAL VARIABLE' : variableScope === 'Stage' ? 'STAGE LOCAL VARIABLE' : 'NODE LOCAL VARIABLE';

    return (
      <div>
        {/* Variable Header */}
        <div style={{ padding: '16px', background: '#2d2d30', borderBottom: '1px solid #3e3e42' }}>
          <div style={{ fontSize: '10px', color: scopeColor, marginBottom: '4px', letterSpacing: '1px' }}>{scopeLabel}</div>
          <div style={{ fontSize: '16px', fontWeight: 600 }}>{variable.name}</div>
        </div>

        {/* Basic Info Section */}
        <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-color)' }}>
          <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Basic Info</div>
          <div className="prop-row">
            <div className="prop-label">Key</div>
            <div className="prop-value monospace">{variable.key}</div>
          </div>
          <div className="prop-row">
            <div className="prop-label">Type</div>
            <div className="prop-value monospace">{variable.type}</div>
          </div>
          <div className="prop-row">
            <div className="prop-label">Default Value</div>
            <div className="prop-value monospace">{String(variable.defaultValue)}</div>
          </div>
          <div className="prop-row">
            <div className="prop-label">State</div>
            <div className="prop-value">{variable.state}</div>
          </div>
          {variable.description && (
            <div className="prop-row">
              <div className="prop-label">Description</div>
              <div className="prop-value">{variable.description}</div>
            </div>
          )}
        </div>

        {/* Scope Section (for local variables) */}
        {variableScope !== 'Global' && (
          <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-color)' }}>
            <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Scope</div>
            <div className="prop-row">
              <div className="prop-label">Owner Type</div>
              <div className="prop-value" style={{ color: scopeColor }}>{variableScope}</div>
            </div>
            <div className="prop-row">
              <div className="prop-label">Owner Name</div>
              <div className="prop-value">{scopeOwnerName}</div>
            </div>
          </div>
        )}

        {/* References Section (Placeholder) */}
        <div style={{ padding: '12px 16px' }}>
          <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>References</div>
          <div style={{ padding: '12px', background: '#1a1a1a', borderRadius: '4px', border: '1px dashed #444', textAlign: 'center' }}>
            <div style={{ fontSize: '11px', color: '#888', marginBottom: '4px' }}>Reference tracking coming soon</div>
            <div style={{ fontSize: '10px', color: '#666' }}>This section will show where this variable is used (conditions, parameter modifiers, script bindings, etc.)</div>
          </div>
        </div>
      </div>
    );
  }

  // --- SCRIPT INSPECTOR ---
  if (ui.selection.type === 'SCRIPT') {
    const script = project.scripts.scripts[ui.selection.id!];
    if (!script) return <div className="empty-state">Script not found</div>;

    // Category color mapping
    const categoryColors: Record<string, string> = {
      Performance: '#c586c0',
      Lifecycle: '#4fc1ff',
      Condition: '#dcdcaa',
      Trigger: '#ce9178'
    };
    const categoryColor = categoryColors[script.category] || '#c586c0';

    return (
      <div>
        {/* Script Header */}
        <div style={{ padding: '16px', background: '#2d2d30', borderBottom: '1px solid #3e3e42' }}>
          <div style={{ fontSize: '10px', color: categoryColor, marginBottom: '4px', letterSpacing: '1px' }}>{script.category.toUpperCase()} SCRIPT</div>
          <div style={{ fontSize: '16px', fontWeight: 600 }}>{script.name}</div>
        </div>

        {/* Basic Info Section */}
        <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-color)' }}>
          <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Basic Info</div>
          <div className="prop-row">
            <div className="prop-label">Key</div>
            <div className="prop-value monospace">{script.key}</div>
          </div>
          <div className="prop-row">
            <div className="prop-label">Category</div>
            <div className="prop-value" style={{ color: categoryColor }}>{script.category}</div>
          </div>
          <div className="prop-row">
            <div className="prop-label">State</div>
            <div className="prop-value">{script.state}</div>
          </div>
          {script.description && (
            <div className="prop-row">
              <div className="prop-label">Description</div>
              <div className="prop-value">{script.description}</div>
            </div>
          )}
        </div>

        {/* References Section (Placeholder) */}
        <div style={{ padding: '12px 16px' }}>
          <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>References</div>
          <div style={{ padding: '12px', background: '#1a1a1a', borderRadius: '4px', border: '1px dashed #444', textAlign: 'center' }}>
            <div style={{ fontSize: '11px', color: '#888', marginBottom: '4px' }}>Reference tracking coming soon</div>
            <div style={{ fontSize: '10px', color: '#666' }}>This section will show where this script is used (presentation bindings, event listeners, lifecycle bindings, etc.)</div>
          </div>
        </div>
      </div>
    );
  }

  // --- EVENT INSPECTOR ---
  if (ui.selection.type === 'EVENT') {
    const event = project.blackboard.events[ui.selection.id!];
    if (!event) return <div className="empty-state">Event not found</div>;

    return (
      <div>
        <div style={{ padding: '16px', background: '#2d2d30', borderBottom: '1px solid #3e3e42' }}>
          <div style={{ fontSize: '10px', color: '#dcdcaa', marginBottom: '4px' }}>EVENT DEFINITION</div>
          <div style={{ fontSize: '16px', fontWeight: 600 }}>{event.name}</div>
        </div>
        <div className="prop-row">
          <div className="prop-label">Key</div>
          <div className="prop-value monospace">{event.key}</div>
        </div>
        <div className="prop-row">
          <div className="prop-label">State</div>
          <div className="prop-value">{event.state}</div>
        </div>
        <div className="prop-row">
          <div className="prop-label">Description</div>
          <div className="prop-value">{event.description || '-'}</div>
        </div>
      </div>
    );
  }

  return <div className="empty-state">Unknown selection type</div>;
};
