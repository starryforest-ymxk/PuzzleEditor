
import React, { useMemo } from 'react';
import { useEditorState, useEditorDispatch } from '../../store/context';
import { ConditionEditor } from './ConditionEditor';
import { TriggerConfig } from '../../types/stateMachine';
import { collectVisibleVariables } from '../../utils/variableScope';
import { ParameterModifier } from '../../types/common';
import { ResourceSelect } from './ResourceSelect';
import { ParameterModifierEditor } from './ParameterModifierEditor';
import { PresentationBindingEditor } from './PresentationBindingEditor';

interface Props {
    fsmId: string;
    transitionId: string;
    readOnly?: boolean;
}

export const TransitionInspector = ({ fsmId, transitionId, readOnly = false }: Props) => {
    const { project } = useEditorState();
    const dispatch = useEditorDispatch();

    const fsm = project.stateMachines[fsmId];
    const trans = fsm ? fsm.transitions[transitionId] : null;

    // Lookup owning node by stateMachineId (assume 1:1; if multiple, pick first)
    const owningNode = useMemo(() => {
        return Object.values(project.nodes).find(n => n.stateMachineId === fsmId) || null;
    }, [project.nodes, fsmId]);

    // Visible variables (filter MarkedForDelete)
    const visibleVars = useMemo(() => {
        const vars = collectVisibleVariables({ project, ui: { selection: { type: 'NONE', id: null }, multiSelectStateIds: [] }, history: { past: [], future: [] } } as any, owningNode?.stageId, owningNode?.id);
        return vars.all.filter(v => v.state !== 'MarkedForDelete');
    }, [project, owningNode]);

    // Event & script options (filter MarkedForDelete)
    const eventOptions = useMemo(() => Object.values(project.blackboard.events || {}).map(e => ({ id: e.id, name: e.name, state: e.state })), [project.blackboard.events]);
    const triggerScriptOptions = useMemo(() => Object.values(project.scripts.scripts || {}).filter(s => s.category === 'Trigger').map(s => ({ id: s.id, name: s.name, state: s.state })), [project.scripts]);
    const conditionScriptOptions = useMemo(() => Object.values(project.scripts.scripts || {}).filter(s => s.category === 'Condition').map(s => ({ id: s.id, name: s.name, state: s.state })), [project.scripts]);
    const performanceScriptOptions = useMemo(() => Object.values(project.scripts.scripts || {}).filter(s => s.category === 'Performance').map(s => ({ id: s.id, name: s.name, state: s.state })), [project.scripts]);
    const scriptDefs = project.scripts.scripts || {};
    const graphOptions = useMemo(() => Object.values(project.presentationGraphs || {}).map(g => ({ id: g.id, name: g.name, state: 'Draft' as any })), [project.presentationGraphs]);

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

    const handleTriggerChange = (index: number, partial: Partial<TriggerConfig>) => {
        const next = [...triggers];
        next[index] = { ...next[index], ...partial } as TriggerConfig;
        updateTriggers(next);
    };

    const handleAddTrigger = (type: TriggerConfig['type'] = 'Always') => {
        const base: TriggerConfig =
            type === 'OnEvent'
                ? { type: 'OnEvent', eventId: '' }
                : type === 'CustomScript'
                    ? { type: 'CustomScript', scriptId: '' }
                    : { type: 'Always' };
        updateTriggers([...triggers, base]);
    };

    const handleRemoveTrigger = (index: number) => {
        const next = triggers.filter((_, i) => i !== index);
        updateTriggers(next);
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
            <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-color)' }}>
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
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', pointerEvents: readOnly ? 'none' : 'auto', opacity: readOnly ? 0.6 : 1 }}>
                    {triggers.map((t, idx) => (
                        <div key={idx} style={{ border: '1px solid #444', padding: '8px', borderRadius: '4px', background: '#1f1f1f' }}>
                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '6px' }}>
                                <select
                                    value={t.type}
                                    onChange={(e) => {
                                        const newType = e.target.value as TriggerConfig['type'];
                                        const base =
                                            newType === 'OnEvent'
                                                ? { type: 'OnEvent', eventId: '' }
                                                : newType === 'CustomScript'
                                                    ? { type: 'CustomScript', scriptId: '' }
                                                    : { type: 'Always' };
                                        handleTriggerChange(idx, base);
                                    }}
                                    style={{ background: '#222', color: '#eee', border: '1px solid #444', padding: '2px 4px', fontSize: '12px', borderRadius: '3px' }}
                                >
                                    <option value="Always">Always</option>
                                    <option value="OnEvent">On Event</option>
                                    <option value="CustomScript">Custom Script</option>
                                </select>
                                <button
                                    onClick={() => handleRemoveTrigger(idx)}
                                    style={{ marginLeft: 'auto', background: 'transparent', color: '#ff6b6b', border: 'none', padding: '2px 6px', cursor: 'pointer', fontSize: '14px' }}
                                >
                                    ×
                                </button>
                            </div>

                            {t.type === 'OnEvent' && (
                                <ResourceSelect
                                    value={t.eventId || ''}
                                    onChange={(val) => handleTriggerChange(idx, { eventId: val })}
                                    options={eventOptions}
                                    placeholder="Select event"
                                />
                            )}

                            {t.type === 'CustomScript' && (
                                <ResourceSelect
                                    value={t.scriptId || ''}
                                    onChange={(val) => handleTriggerChange(idx, { scriptId: val })}
                                    options={triggerScriptOptions}
                                    placeholder="Select trigger script"
                                />
                            )}
                        </div>
                    ))}

                    {triggers.length === 0 && (
                        <div style={{ color: '#666', fontSize: '11px', padding: '8px', textAlign: 'center' }}>No triggers configured</div>
                    )}

                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        <button onClick={() => handleAddTrigger('Always')} style={{ background: '#2e7d32', color: '#fff', border: 'none', padding: '6px 8px', cursor: 'pointer', borderRadius: '3px', fontSize: '11px' }}>+ Always</button>
                        <button onClick={() => handleAddTrigger('OnEvent')} style={{ background: '#1976d2', color: '#fff', border: 'none', padding: '6px 8px', cursor: 'pointer', borderRadius: '3px', fontSize: '11px' }}>+ On Event</button>
                        <button onClick={() => handleAddTrigger('CustomScript')} style={{ background: '#7b1fa2', color: '#fff', border: 'none', padding: '6px 8px', cursor: 'pointer', borderRadius: '3px', fontSize: '11px' }}>+ Custom Script</button>
                    </div>
                </div>
            </div>

            {/* Condition Section */}
            <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-color)' }}>
                <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Condition</div>
                <div style={{ pointerEvents: readOnly ? 'none' : 'auto', opacity: readOnly ? 0.6 : 1 }}>
                    <ConditionEditor
                        condition={trans.condition || { type: 'LITERAL', value: true }}
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
                        variables={visibleVars}
                        title="On Transition"
                        onNavigateToGraph={(graphId) => dispatch({ type: 'NAVIGATE_TO', payload: { graphId } })}
                    />
                </div>
            </div>

            {/* Parameter Modifier Section */}
            <div style={{ padding: '12px 16px' }}>
                <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Parameter Modifier</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', pointerEvents: readOnly ? 'none' : 'auto', opacity: readOnly ? 0.6 : 1 }}>
                    {modifiers.map((m, idx) => (
                        <div key={idx} style={{ border: '1px solid #444', padding: '8px', borderRadius: '4px', background: '#1f1f1f' }}>
                            <ParameterModifierEditor
                                modifier={m}
                                onChange={(pm) => {
                                    const next = [...modifiers];
                                    next[idx] = pm;
                                    updateModifiers(next);
                                }}
                                variables={visibleVars}
                            />
                            <button
                                onClick={() => updateModifiers(modifiers.filter((_, i) => i !== idx))}
                                style={{ marginTop: '8px', background: 'transparent', color: '#ff6b6b', border: 'none', padding: '2px 6px', cursor: 'pointer', fontSize: '11px' }}
                            >
                                Remove
                            </button>
                        </div>
                    ))}

                    {modifiers.length === 0 && (
                        <div style={{ color: '#666', fontSize: '11px', padding: '8px', textAlign: 'center' }}>No parameter modifiers</div>
                    )}

                    <button
                        onClick={() => updateModifiers([...modifiers, { targetVariableId: '', targetScope: 'NodeLocal', operation: 'Set', source: { type: 'Constant', value: '' } }])}
                        style={{ background: '#2e7d32', color: '#fff', border: 'none', padding: '6px 8px', cursor: 'pointer', borderRadius: '3px', fontSize: '11px', alignSelf: 'flex-start' }}
                    >
                        + Add Modifier
                    </button>
                </div>
            </div>
        </div>
    );
};
