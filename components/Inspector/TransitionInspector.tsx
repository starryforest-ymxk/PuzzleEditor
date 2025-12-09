
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
}

export const TransitionInspector = ({ fsmId, transitionId }: Props) => {
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
            <div style={{ padding: '16px', background: '#2d2d30', borderBottom: '1px solid #3e3e42' }}>
                <div style={{ fontSize: '10px', color: '#ff9800', marginBottom: '4px' }}>TRANSITION</div>
                <input 
                    type="text" 
                    value={trans.name} 
                    onChange={(e) => handleChange('name', e.target.value)}
                    placeholder="Transition name"
                    style={{ background: '#222', border: '1px solid #444', color: '#fff', fontSize: '14px', fontWeight: 600, width: '100%', padding: '4px' }}
                />
            </div>

            <div className="prop-row">
                <div className="prop-label">From</div>
                <div className="prop-value" style={{ color: '#aaa' }}>{fromState?.name || trans.fromStateId}</div>
            </div>
            <div className="prop-row">
                <div className="prop-label">To</div>
                <div className="prop-value" style={{ color: '#aaa' }}>{toState?.name || trans.toStateId}</div>
            </div>
            
            <div className="panel-header" style={{ marginTop: '12px' }}>Triggers</div>
            <div style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
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
                                style={{ background: '#222', color: '#eee', border: '1px solid #444', padding: '2px 4px', fontSize: '12px' }}
                            >
                                <option value="Always">Always</option>
                                <option value="OnEvent">On Event</option>
                                <option value="CustomScript">Custom Script</option>
                            </select>
                            <button
                                onClick={() => handleRemoveTrigger(idx)}
                                style={{ marginLeft: 'auto', background: '#3a3a3a', color: '#ff6b6b', border: '1px solid #555', padding: '2px 6px', cursor: 'pointer' }}
                            >
                                Delete
                            </button>
                        </div>

                        {t.type === 'OnEvent' && (
                            <ResourceSelect
                                value={t.eventId || ''}
                                onChange={(val) => handleTriggerChange(idx, { eventId: val })}
                                options={eventOptions}
                                placeholder="Select event"
                                style={{ width: '100%' }}
                            />
                        )}

                        {t.type === 'CustomScript' && (
                            <ResourceSelect
                                value={t.scriptId || ''}
                                onChange={(val) => handleTriggerChange(idx, { scriptId: val })}
                                options={triggerScriptOptions}
                                placeholder="Select trigger script"
                                style={{ width: '100%' }}
                            />
                        )}
                    </div>
                ))}

                <div style={{ display: 'flex', gap: '8px' }}>
                    <button onClick={() => handleAddTrigger('Always')} style={{ background: '#2e7d32', color: '#fff', border: 'none', padding: '6px 8px', cursor: 'pointer' }}>+ Always</button>
                    <button onClick={() => handleAddTrigger('OnEvent')} style={{ background: '#1976d2', color: '#fff', border: 'none', padding: '6px 8px', cursor: 'pointer' }}>+ On Event</button>
                    <button onClick={() => handleAddTrigger('CustomScript')} style={{ background: '#7b1fa2', color: '#fff', border: 'none', padding: '6px 8px', cursor: 'pointer' }}>+ Custom Script</button>
                </div>
            </div>

            <div className="prop-row">
                <div className="prop-label">Priority</div>
                <input 
                    type="number" 
                    value={trans.priority} 
                    onChange={(e) => handleChange('priority', parseInt(e.target.value))}
                    style={{ background: '#222', border: '1px solid #444', color: '#ccc', width: '60px' }}
                />
            </div>

            <div className="panel-header" style={{ marginTop: '16px' }}>Condition Logic</div>
            <div style={{ padding: '16px' }}>
                <ConditionEditor 
                    condition={trans.condition || { type: 'LITERAL', value: true }} 
                    onChange={(newCond) => handleChange('condition', newCond)}
                    variables={visibleVars}
                    conditionScripts={conditionScriptOptions}
                />
            </div>

            <div className="panel-header" style={{ marginTop: '16px' }}>Parameter Modifiers</div>
            <div style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {modifiers.map((m, idx) => (
                    <div key={idx} style={{ border: '1px solid #444', padding: '8px', borderRadius: '4px', background: '#1f1f1f', display: 'flex', flexDirection: 'column', gap: '6px' }}>
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
                            style={{ alignSelf: 'flex-end', background: '#3a3a3a', color: '#ff6b6b', border: '1px solid #555', padding: '2px 6px', cursor: 'pointer' }}
                        >Delete</button>
                    </div>
                ))}
                <div style={{ display: 'flex', gap: '8px' }}>
                    <button onClick={() => updateModifiers([...modifiers, { targetVariableId: '', targetScope: 'NodeLocal', operation: 'Set', source: { type: 'Constant', value: '' } }])} style={{ background: '#2e7d32', color: '#fff', border: 'none', padding: '6px 8px', cursor: 'pointer' }}>+ Add Modifier</button>
                </div>
            </div>

            <div className="panel-header" style={{ marginTop: '16px' }}>Presentation Binding</div>
            <div style={{ padding: '12px' }}>
                <PresentationBindingEditor
                    binding={trans.presentation}
                    onChange={(next) => handleChange('presentation', next)}
                    scriptDefs={scriptDefs}
                    scriptOptions={performanceScriptOptions}
                    graphOptions={graphOptions}
                    variables={visibleVars}
                    title="On Transition Presentation"
                />
            </div>
        </div>
    );
};
