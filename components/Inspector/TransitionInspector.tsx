import React, { useMemo } from 'react';
import { useEditorState, useEditorDispatch } from '../../store/context';
import { ConditionEditor } from './ConditionEditor';
import { TriggerConfig } from '../../types/stateMachine';
import { ParameterModifier } from '../../types/common';
import { ResourceSelect, ResourceDetailsCard } from './ResourceSelect';
import { ParameterModifierEditor } from './ParameterModifierEditor';
import { PresentationBindingEditor } from './PresentationBindingEditor';
import { TriggerEditor } from './TriggerEditor';
import { buildEventOptions, buildScriptOptionsByCategory, buildGraphOptions } from '../../utils/resourceOptions';
import { Trash2 } from 'lucide-react';
import { filterActiveOrSelected } from '../../utils/resourceFilters';
import { useFsmVisibleVariables } from '../../hooks/useFsmVisibleVariables';

interface Props {
    fsmId: string;
    transitionId: string;
    readOnly?: boolean;
}

/**
 * TransitionInspector - 转移连线属性检查器
 * 显示和编辑 FSM Transition 的属性：名称、优先级、触发器、条件、演出绑定、参数修改器
 */
export const TransitionInspector = ({ fsmId, transitionId, readOnly = false }: Props) => {
    const state = useEditorState();
    const { project } = state;
    const dispatch = useEditorDispatch();

    const parsePriority = (value: string, current: number | undefined) => {
        const num = Number(value);
        if (Number.isFinite(num)) return num;
        return Number.isFinite(current) ? current : 0;
    };

    const fsm = project.stateMachines[fsmId];
    const trans = fsm ? fsm.transitions[transitionId] : null;

    // 查找所属节点并收集可见变量
    const { visibleVars } = useFsmVisibleVariables(fsmId);

    // 事件和脚本选项
    const eventOptions = useMemo(() => buildEventOptions(project.blackboard.events), [project.blackboard.events]);

    const scriptRecords = project.scripts.scripts;

    const triggerScriptOptions = useMemo(() => buildScriptOptionsByCategory(scriptRecords, 'Trigger'), [scriptRecords]);

    const conditionScriptOptions = useMemo(() => buildScriptOptionsByCategory(scriptRecords, 'Condition'), [scriptRecords]);

    const performanceScriptOptions = useMemo(() => buildScriptOptionsByCategory(scriptRecords, 'Performance'), [scriptRecords]);

    const scriptDefs = scriptRecords;

    const graphOptions = useMemo(() => buildGraphOptions(project.presentationGraphs), [project.presentationGraphs]);

    if (!trans || !fsm) return <div className="empty-state">Transition not found</div>;

    const fromState = fsm.states[trans.fromStateId];
    const toState = fsm.states[trans.toStateId];

    // 更新 Transition 属性
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

    // 删除 Transition
    const handleDelete = () => {
        if (readOnly) return;
        dispatch({
            type: 'DELETE_TRANSITION',
            payload: { fsmId: fsm.id, transitionId: trans.id }
        });
    };

    return (
        <div>
            {/* Transition Header */}
            <div className="inspector-header-panel">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                    <div className="inspector-type-label inspector-type-label--transition">TRANSITION</div>
                    {!readOnly && (
                        <button
                            className="btn-icon btn-icon--danger"
                            onClick={handleDelete}
                            title="Delete this transition"
                        >
                            <Trash2 size={14} />
                        </button>
                    )}
                </div>
                <input
                    type="text"
                    value={trans.name || ''}
                    onChange={(e) => handleChange('name', e.target.value)}
                    placeholder="Transition name"
                    disabled={readOnly}
                    className="inspector-name-input"
                />
            </div>

            {/* Basic Info Section */}
            <div className="inspector-section inspector-basic-info">
                <div className="inspector-section-title">Basic Info</div>
                <div className="prop-row">
                    <div className="prop-label">ID</div>
                    <div className="prop-value inspector-value-monospace">{trans.id}</div>
                </div>
                <div className="prop-row">
                    <div className="prop-label">From</div>
                    <div className="prop-value inspector-value-secondary">{fromState?.name || trans.fromStateId}</div>
                </div>
                <div className="prop-row">
                    <div className="prop-label">To</div>
                    <div className="prop-value inspector-value-secondary">{toState?.name || trans.toStateId}</div>
                </div>
                <div className="prop-row">
                    <div className="prop-label">Priority</div>
                    <input
                        type="number"
                        value={trans.priority}
                        onChange={(e) => handleChange('priority', parsePriority(e.target.value, trans.priority))}
                        disabled={readOnly}
                        className="inspector-number-input"
                    />
                </div>
                <div className="inspector-description-block">
                    <div className="inspector-description-label">Description</div>
                    <textarea
                        value={trans.description || ''}
                        onChange={(e) => handleChange('description', e.target.value)}
                        disabled={readOnly}
                        placeholder="No description."
                        className="inspector-textarea"
                    />
                </div>
            </div>

            {/* Trigger Section */}
            <div className="inspector-section">
                <div className="inspector-section-title">Trigger</div>
                <TriggerEditor
                    triggers={triggers}
                    onChange={updateTriggers}
                    eventOptions={eventOptions}
                    scriptOptions={triggerScriptOptions}
                    readOnly={readOnly}
                />
            </div>

            {/* Condition Section */}
            <div className="inspector-section">
                <div className="inspector-section-title">Condition</div>
                <div className={readOnly ? 'inspector-readonly-wrapper' : ''}>
                    <ConditionEditor
                        condition={trans.condition}
                        onChange={(newCond) => handleChange('condition', newCond)}
                        variables={visibleVars}
                        conditionScripts={conditionScriptOptions}
                    />
                </div>
            </div>

            {/* Presentation Section */}
            <div className="inspector-section">
                <div className="inspector-section-title">Presentation</div>
                <div className={readOnly ? 'inspector-readonly-wrapper' : ''}>
                    <PresentationBindingEditor
                        binding={trans.presentation}
                        onChange={(next) => handleChange('presentation', next)}
                        scriptDefs={scriptDefs}
                        scriptOptions={performanceScriptOptions}
                        graphOptions={graphOptions}
                        graphData={project.presentationGraphs}
                        variables={visibleVars}
                        title="On Transition"
                        onNavigateToGraph={(graphId) => {
                            dispatch({ type: 'NAVIGATE_TO', payload: { graphId } });
                            dispatch({ type: 'SELECT_OBJECT', payload: { type: 'PRESENTATION_GRAPH', id: graphId } });
                        }}
                        readOnly={readOnly}
                    />
                </div>
            </div>

            {/* Event Invoker Section - 转移执行时触发的事件 */}
            <div className="inspector-section">
                <div className="inspector-section-title">Event Invoker</div>
                <div className={`inspector-list-container ${readOnly ? 'inspector-readonly-wrapper' : ''}`}>
                    {(trans.invokeEventIds || []).map((eventId, idx) => {
                        const selectedEvent = eventOptions.find(e => e.id === eventId);
                        return (
                            <div key={idx} style={{ marginBottom: '2px' }}>
                                {/* 第一行：下拉框 + Remove 按钮 */}
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <select
                                        value={eventId || ''}
                                        onChange={(e) => {
                                            const next = [...(trans.invokeEventIds || [])];
                                            next[idx] = e.target.value;
                                            handleChange('invokeEventIds', next);
                                        }}
                                        className="inspector-select"
                                        style={{ flex: 1 }}
                                    >
                                        <option value="" disabled hidden>Select event to invoke</option>
                                        {filterActiveOrSelected<typeof eventOptions[number]>(eventOptions, eventId).map(opt => (
                                            <option key={opt.id} value={opt.id} style={{ color: opt.state === 'MarkedForDelete' ? '#f66' : '#eee' }}>
                                                {opt.name}{opt.state === 'MarkedForDelete' ? ' [Marked for Delete]' : ''}
                                            </option>
                                        ))}
                                    </select>
                                    <button
                                        onClick={() => {
                                            const next = (trans.invokeEventIds || []).filter((_, i) => i !== idx);
                                            handleChange('invokeEventIds', next.length > 0 ? next : undefined);
                                        }}
                                        className="btn-remove-text"
                                        title="Remove Event Invoker"
                                    >
                                        × Remove
                                    </button>
                                </div>
                                {/* 第二行：事件详情 */}
                                {selectedEvent && (
                                    <div style={{ marginTop: '8px' }}>
                                        <ResourceDetailsCard resource={selectedEvent} />
                                    </div>
                                )}
                            </div>
                        );
                    })}

                    {(trans.invokeEventIds || []).length === 0 && (
                        <div className="inspector-empty-hint">No event triggers</div>
                    )}

                    <button
                        className="btn-add-ghost btn-add-ghost--with-margin"
                        onClick={() => {
                            const next = [...(trans.invokeEventIds || []), ''];
                            handleChange('invokeEventIds', next);
                        }}
                    >
                        + Add Event Invoker
                    </button>
                </div>
            </div>

            {/* Parameter Modifier Section */}
            <div className="inspector-section">
                <div className="inspector-section-title">Parameter Modifier</div>
                <div className={`inspector-list-container ${readOnly ? 'inspector-readonly-wrapper' : ''}`}>
                    {modifiers.map((m, idx) => (
                        <div key={idx} className="inspector-modifier-card">
                            <div className="inspector-modifier-header">
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
                        <div className="inspector-empty-hint">No parameter modifiers</div>
                    )}

                    <button
                        className="btn-add-ghost btn-add-ghost--with-margin"
                        onClick={() => updateModifiers([...modifiers, { targetVariableId: '', targetScope: 'NodeLocal', operation: 'Set', source: { type: 'Constant', value: '' } }])}
                    >
                        + Add Parameter Modifier
                    </button>
                </div>
            </div>
        </div>
    );
};
