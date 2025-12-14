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

    // 查找所属 PuzzleNode
    const owningNode = useMemo(() => {
        return Object.values<PuzzleNode>(project.nodes).find(n => n.stateMachineId === fsmId) || null;
    }, [project.nodes, fsmId]);

    // 可见变量（过滤已标记删除的）
    const visibleVars = useMemo(() => {
        const vars = collectVisibleVariables(state, owningNode?.stageId, owningNode?.id);
        return vars.all.filter(v => v.state !== 'MarkedForDelete');
    }, [state, owningNode]);

    // 事件和脚本选项
    const eventOptions = useMemo(() => Object.values<EventDefinition>(project.blackboard.events).map(e => ({
        id: e.id,
        name: e.name,
        state: e.state,
        description: e.description
    })), [project.blackboard.events]);

    const scriptRecords = project.scripts.scripts;

    const triggerScriptOptions = useMemo(() => Object.values<ScriptDefinition>(scriptRecords)
        .filter(s => s.category === 'Trigger')
        .map(s => ({
            id: s.id,
            name: s.name,
            state: s.state,
            category: s.category,
            description: s.description
        })), [scriptRecords]);

    const conditionScriptOptions = useMemo(() => Object.values<ScriptDefinition>(scriptRecords)
        .filter(s => s.category === 'Condition')
        .map(s => ({ id: s.id, name: s.name, state: s.state })), [scriptRecords]);

    const performanceScriptOptions = useMemo(() => Object.values<ScriptDefinition>(scriptRecords)
        .filter(s => s.category === 'Performance')
        .map(s => ({ id: s.id, name: s.name, state: s.state, description: s.description })), [scriptRecords]);

    const scriptDefs = scriptRecords;

    const graphOptions = useMemo(() => Object.values<PresentationGraph>(project.presentationGraphs)
        .map(g => ({ id: g.id, name: g.name, state: 'Draft' as const, description: g.description })), [project.presentationGraphs]);

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

    return (
        <div>
            {/* Transition Header */}
            <div className="inspector-header-panel">
                <div className="inspector-type-label inspector-type-label--transition">TRANSITION</div>
                <input
                    type="text"
                    value={trans.name}
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
                        onNavigateToGraph={(graphId) => dispatch({ type: 'NAVIGATE_TO', payload: { graphId } })}
                        readOnly={readOnly}
                    />
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
