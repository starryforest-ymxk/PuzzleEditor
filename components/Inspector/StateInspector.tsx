import React, { useMemo } from 'react';
import { useEditorState, useEditorDispatch } from '../../store/context';
import { collectVisibleVariables } from '../../utils/variableScope';
import { EventListener } from '../../types/common';
import { EventListenersEditor } from './EventListenersEditor';
import { ResourceSelect } from './ResourceSelect';
import type { PuzzleNode } from '../../types/puzzleNode';
import type { EventDefinition } from '../../types/blackboard';
import type { ScriptDefinition } from '../../types/manifest';

interface Props {
    fsmId: string;
    stateId: string;
    readOnly?: boolean;
}

export const StateInspector = ({ fsmId, stateId, readOnly = false }: Props) => {
    const stateTree = useEditorState();
    const { project } = stateTree;
    const dispatch = useEditorDispatch();

    const fsm = project.stateMachines[fsmId];
    const state = fsm ? fsm.states[stateId] : null;

    if (!state) return <div className="empty-state">State not found</div>;

    const handleChange = (field: string, value: any) => {
        dispatch({
            type: 'UPDATE_STATE',
            payload: {
                fsmId,
                stateId: state.id,
                data: { [field]: value }
            }
        });
    };

    const isInitial = fsm.initialStateId === state.id;

    const owningNode = useMemo(() => Object.values<PuzzleNode>(project.nodes).find(n => n.stateMachineId === fsmId) || null, [project.nodes, fsmId]);
    const visibleVars = useMemo(() => {
        // 过滤掉已标记删除的变量，确保编辑器不会引用无效资源
        const vars = collectVisibleVariables(stateTree, owningNode?.stageId, owningNode?.id);
        return vars.all.filter(v => v.state !== 'MarkedForDelete');
    }, [stateTree, owningNode]);
    const eventOptions = useMemo(() => Object.values<EventDefinition>(project.blackboard.events).map(e => ({ id: e.id, name: e.name, state: e.state })), [project.blackboard.events]);
    const scriptRecords = project.scripts.scripts;
    const scriptOptions = useMemo(() => Object.values<ScriptDefinition>(scriptRecords).map(s => ({ id: s.id, name: s.name, state: s.state })), [scriptRecords]);
    const lifecycleScriptOptions = useMemo(() => Object.values<ScriptDefinition>(scriptRecords)
        .filter(s => s.category === 'Lifecycle' && (!s.lifecycleType || s.lifecycleType === 'State'))
        .map(s => ({ id: s.id, name: s.name, state: s.state })), [scriptRecords]);

    const handleSetInitial = () => {
        dispatch({
            type: 'UPDATE_FSM',
            payload: {
                fsmId,
                data: { initialStateId: state.id }
            }
        });
    };

    return (
        <div>
            {/* State Header */}
            <div style={{ padding: '16px', background: '#2d2d30', borderBottom: '1px solid #3e3e42' }}>
                <div style={{ fontSize: '10px', color: '#4fc1ff', marginBottom: '4px', letterSpacing: '1px' }}>FSM STATE</div>
                <input
                    type="text"
                    value={state.name}
                    onChange={(e) => handleChange('name', e.target.value)}
                    disabled={readOnly}
                    style={{ background: '#222', border: '1px solid #444', color: '#fff', fontSize: '14px', fontWeight: 600, width: '100%', padding: '4px', marginBottom: '8px', opacity: readOnly ? 0.7 : 1 }}
                />

                {isInitial ? (
                    <div style={{
                        fontSize: '11px', color: '#4fc1ff', border: '1px solid #1e3a5f', background: 'rgba(79, 193, 255, 0.1)',
                        padding: '4px 8px', borderRadius: '3px', display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}>
                        <span style={{ marginRight: '6px' }}>▶</span> Initial State
                    </div>
                ) : (
                    !readOnly && <button
                        onClick={handleSetInitial}
                        style={{
                            background: '#333', border: '1px solid #555', color: '#ccc',
                            fontSize: '11px', padding: '4px 8px', borderRadius: '3px', cursor: 'pointer',
                            width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                            transition: 'background 0.2s'
                        }}
                        onMouseOver={(e) => e.currentTarget.style.background = '#444'}
                        onMouseOut={(e) => e.currentTarget.style.background = '#333'}
                    >
                        Set as Initial State
                    </button>
                )}
            </div>

            {/* Basic Info Section */}
            <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-color)' }}>
                <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Basic Info</div>
                <div className="prop-row">
                    <div className="prop-label" style={{ display: 'flex', flex: 1, }}>ID</div>
                    <div className="prop-value" style={{ display: 'flex', flex: 1, fontFamily: 'monospace', color: '#666', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{state.id}</div>
                </div>
                <div style={{ marginTop: '8px' }}>
                    <div style={{ color: '#888', marginBottom: '4px', fontSize: '11px' }}>Description</div>
                    <textarea
                        value={state.description || ''}
                        onChange={(e) => handleChange('description', e.target.value)}
                        disabled={readOnly}
                        placeholder="No description."
                        style={{ background: '#222', border: '1px solid #444', color: '#ccc', width: '100%', height: '60px', resize: 'vertical', fontFamily: 'inherit', opacity: readOnly ? 0.7 : 1 }}
                    />
                </div>
            </div>

            {/* Lifecycle Script Section */}
            <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-color)' }}>
                <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Lifecycle Script</div>
                <div className="inspector-row" style={{ pointerEvents: readOnly ? 'none' : 'auto', opacity: readOnly ? 0.6 : 1 }}>
                    <ResourceSelect
                        options={lifecycleScriptOptions}
                        value={state.lifecycleScriptId || ''}
                        onChange={(val) => handleChange('lifecycleScriptId', val || undefined)}
                        placeholder="Select lifecycle script"
                        warnOnMarkedDelete
                        disabled={readOnly}
                    />
                    {state.lifecycleScriptId && (
                        <button
                            className="btn-ghost"
                            onClick={() => handleChange('lifecycleScriptId', undefined)}
                            disabled={readOnly}
                            style={{ height: 30, padding: '4px 10px' }}
                        >
                            Clear
                        </button>
                    )}
                </div>
            </div>

            {/* Event Listeners Section */}
            <div style={{ padding: '12px 16px' }}>
                <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Event Listeners</div>
                <div style={{ pointerEvents: readOnly ? 'none' : 'auto', opacity: readOnly ? 0.6 : 1 }}>
                    <EventListenersEditor
                        listeners={state.eventListeners || []}
                        onChange={(next) => handleChange('eventListeners', next)}
                        eventOptions={eventOptions}
                        scriptOptions={scriptOptions}
                        variables={visibleVars}
                    />
                </div>
            </div>
        </div>
    );
};
