
import React, { useMemo } from 'react';
import { useEditorState, useEditorDispatch } from '../../store/context';
import { ConditionEditor } from './ConditionEditor';
import { TriggerConfig } from '../../types/stateMachine';
import { collectVisibleVariables } from '../../utils/variableScope';
import { ParameterModifier } from '../../types/common';
import { ResourceSelect } from './ResourceSelect';
import { ParameterModifierEditor } from './ParameterModifierEditor';
import { PresentationBindingEditor } from './PresentationBindingEditor';
import { TriggerEditor } from './TriggerEditor';
import type { PuzzleNode } from '../../types/puzzleNode';
import type { EventDefinition } from '../../types/blackboard';
import type { ScriptDefinition } from '../../types/manifest';
import type { PresentationGraph } from '../../types/presentation';

interface Props {
    fsmId: string;
    transitionId: string;
    readOnly?: boolean;
}

export const TransitionInspector = ({ fsmId, transitionId, readOnly = false }: Props) => {
    // 直接持有完整状态，方便传递给可见变量收集器
    const state = useEditorState();
    const { project } = state;
    const dispatch = useEditorDispatch();

    const fsm = project.stateMachines[fsmId];
    const trans = fsm ? fsm.transitions[transitionId] : null;

    // Lookup owning node by stateMachineId (assume 1:1; if multiple, pick first)
    const owningNode = useMemo(() => {
        return Object.values<PuzzleNode>(project.nodes).find(n => n.stateMachineId === fsmId) || null;
    }, [project.nodes, fsmId]);

    // Visible variables (filter MarkedForDelete)
    const visibleVars = useMemo(() => {
        // 过滤掉已标记删除的变量，避免下拉列表出现无效引用
        const vars = collectVisibleVariables(state, owningNode?.stageId, owningNode?.id);
        return vars.all.filter(v => v.state !== 'MarkedForDelete');
    }, [state, owningNode]);

    // Event & script options（仅保留有效资源）
    const eventOptions = useMemo(() => Object.values<EventDefinition>(project.blackboard.events).map(e => ({
        id: e.id,
        name: e.name,
        state: e.state,
        key: e.key,
        description: e.description
    })), [project.blackboard.events]);
    const scriptRecords = project.scripts.scripts;
    const triggerScriptOptions = useMemo(() => Object.values<ScriptDefinition>(scriptRecords)
        .filter(s => s.category === 'Trigger')
        .map(s => ({
            id: s.id,
            name: s.name,
            state: s.state,
            key: s.key,
            category: s.category,
            description: s.description
        })), [scriptRecords]);
    const conditionScriptOptions = useMemo(() => Object.values<ScriptDefinition>(scriptRecords).filter(s => s.category === 'Condition').map(s => ({ id: s.id, name: s.name, state: s.state })), [scriptRecords]);
    const performanceScriptOptions = useMemo(() => Object.values<ScriptDefinition>(scriptRecords).filter(s => s.category === 'Performance').map(s => ({ id: s.id, name: s.name, state: s.state, description: s.description })), [scriptRecords]);
    const scriptDefs = scriptRecords;
    const graphOptions = useMemo(() => Object.values<PresentationGraph>(project.presentationGraphs).map(g => ({ id: g.id, name: g.name, state: 'Draft' as const, description: g.description })), [project.presentationGraphs]);

    if (!trans || !fsm) return <div className="empty-state">Transition not found</div>;

    const fromState = fsm.states[trans.fromStateId];
    const toState = fsm.states[trans.toStateId];

    const handleChange = (field: string, value: any) => {
        dispatch({
            type: 'UPDATE_TRANSITION',
            payload: {
                fsmId: fsm.id,
                transitionId: trans.id,
                data: { [field]: value }
            }
        });
    };

    const triggers: TriggerConfig[] = trans.triggers || [];
    const modifiers: ParameterModifier[] = trans.parameterModifiers || [];

    const updateTriggers = (nextTriggers: TriggerConfig[]) => {
        handleChange('triggers', nextTriggers);
    };

    const updateModifiers = (nextModifiers: ParameterModifier[]) => {
        handleChange('parameterModifiers', nextModifiers);
    };

    return (
        <div>
            {/* Transition Header */}
            <div style={{ padding: '16px', background: '#2d2d30', borderBottom: '1px solid #3e3e42' }}>
                <div style={{ fontSize: '10px', color: '#ff9800', marginBottom: '4px', letterSpacing: '1px' }}>TRANSITION</div>
                <input
                    type="text"
                    value={trans.name}
                    onChange={(e) => handleChange('name', e.target.value)}
                    placeholder="Transition name"
                    disabled={readOnly}
                    style={{ background: '#222', border: '1px solid #444', color: '#fff', fontSize: '14px', fontWeight: 600, width: '100%', padding: '4px', opacity: readOnly ? 0.7 : 1 }}
                />
            </div>

            {/* Basic Info Section */}
            <div className="inspector-basic-info" style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-color)' }}>
                <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Basic Info</div>
                <div className="prop-row">
                    <div className="prop-label">ID</div>
                    <div className="prop-value" style={{ fontFamily: 'monospace', color: '#666' }}>{trans.id}</div>
                </div>
                <div className="prop-row">
                    <div className="prop-label">From</div>
                    <div className="prop-value" style={{ color: '#aaa' }}>{fromState?.name || trans.fromStateId}</div>
                </div>
                <div className="prop-row">
                    <div className="prop-label">To</div>
                    <div className="prop-value" style={{ color: '#aaa' }}>{toState?.name || trans.toStateId}</div>
                </div>
                <div className="prop-row">
                    <div className="prop-label">Priority</div>
                    <input
                        type="number"
                        value={trans.priority}
                        onChange={(e) => handleChange('priority', parseInt(e.target.value))}
                        disabled={readOnly}
                        style={{ background: '#222', border: '1px solid #444', color: '#ccc', width: '60px', opacity: readOnly ? 0.7 : 1 }}
                    />
                </div>
                <div style={{ marginTop: '8px' }}>
                    <div style={{ color: '#888', marginBottom: '4px', fontSize: '11px' }}>Description</div>
                    <textarea
                        value={trans.description || ''}
                        onChange={(e) => handleChange('description', e.target.value)}
                        disabled={readOnly}
                        placeholder="No description."
                        style={{ background: '#222', border: '1px solid #444', color: '#ccc', width: '100%', height: '60px', resize: 'vertical', fontFamily: 'inherit', opacity: readOnly ? 0.7 : 1 }}
                    />
                </div>
            </div>

            {/* Trigger Section */}
            <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-color)' }}>
                <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Trigger</div>
                <TriggerEditor
                    triggers={triggers}
                    onChange={updateTriggers}
                    eventOptions={eventOptions}
                    scriptOptions={triggerScriptOptions}
                    readOnly={readOnly}
                />
            </div>

            {/* Condition Section */}
            <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-color)' }}>
                <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Condition</div>
                <div style={{ pointerEvents: readOnly ? 'none' : 'auto', opacity: readOnly ? 0.6 : 1 }}>
                    <ConditionEditor
                        condition={trans.condition}
                        onChange={(newCond) => handleChange('condition', newCond)}
                        variables={visibleVars}
                        conditionScripts={conditionScriptOptions}
                    />
                </div>
            </div>

            {/* Presentation Section */}
            <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-color)' }}>
                <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Presentation</div>
                <div style={{ pointerEvents: readOnly ? 'none' : 'auto', opacity: readOnly ? 0.6 : 1 }}>
                    <PresentationBindingEditor
                        binding={trans.presentation}
                        onChange={(next) => handleChange('presentation', next)}
                        scriptDefs={scriptDefs}
                        scriptOptions={performanceScriptOptions}
                        graphOptions={graphOptions}
                        graphData={project.presentationGraphs}
                        variables={visibleVars}
                        title="On Transition"
                        onNavigateToGraph={(graphId) => dispatch({ type: 'NAVIGATE_TO', payload: { graphId } })}
                        readOnly={readOnly}
                    />
                </div>
            </div>

            {/* Parameter Modifier Section */}
            <div style={{ padding: '12px 16px' }}>
                <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Parameter Modifier</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', pointerEvents: readOnly ? 'none' : 'auto', opacity: readOnly ? 0.6 : 1 }}>
                    {modifiers.map((m, idx) => (
                        <div key={idx} style={{
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '4px',
                            padding: '8px',
                            background: 'rgba(255,255,255,0.03)',
                            border: '1px solid #333',
                            borderRadius: '4px',
                            position: 'relative'
                        }}>
                            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                                <button
                                    onClick={() => updateModifiers(modifiers.filter((_, i) => i !== idx))}
                                    className="btn-remove-text"
                                    title="Remove Modifier"
                                >
                                    × Remove
                                </button>
                            </div>
                            <ParameterModifierEditor
                                modifier={m}
                                onChange={(pm) => {
                                    const next = [...modifiers];
                                    next[idx] = pm;
                                    updateModifiers(next);
                                }}
                                variables={visibleVars}
                            />
                        </div>
                    ))}

                    {modifiers.length === 0 && (
                        <div style={{ color: '#666', fontSize: '11px', padding: '8px', textAlign: 'center' }}>No parameter modifiers</div>
                    )}

                    <button
                        className="btn-ghost"
                        onClick={() => updateModifiers([...modifiers, { targetVariableId: '', targetScope: 'NodeLocal', operation: 'Set', source: { type: 'Constant', value: '' } }])}
                        style={{
                            width: '100%',
                            justifyContent: 'center',
                            marginTop: '4px',
                            borderStyle: 'dashed',
                            opacity: 0.7
                        }}
                    >
                        + Add Parameter Modifier
                    </button>
                </div>
            </div>
        </div>
    );
};
