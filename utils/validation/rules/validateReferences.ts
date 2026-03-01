/**
 * utils/validation/rules/validateReferences.ts
 * 校验资源引用的完整性（是否丢失、是否已删除、字段是否缺失）
 * 
 * 对应后端校验规则：
 * #6-#7: 黑板/脚本定义校验
 * #33-#56: 引用完整性校验（生命周期、事件、变量、触发器、条件、参数修改器、演出配置）
 */

import { ValidationResult } from '../../../store/types';
import { ProjectData } from '../../../types/project';
import { ConditionExpression, TriggerConfig } from '../../../types/stateMachine';
import { EventListener, PresentationBinding, ParameterModifier, ValueSource } from '../../../types/common';

// =========================================================================
// Helper: 校验脚本 ID 引用 — 后端 #33-#35, #43, #46, #52
// =========================================================================

function validateScriptId(
    results: ValidationResult[],
    scriptId: string | undefined,
    project: ProjectData,
    locationContext: { objectType: ValidationResult['objectType'], objectId: string, location: string },
    contextDescription: string = 'Script reference'
) {
    if (!scriptId) return;

    const script = project.scripts?.scripts[scriptId];
    if (!script) {
        results.push({
            id: `err-${locationContext.objectType.toLowerCase()}-script-missing-${locationContext.objectId}-${scriptId}`,
            level: 'error',
            message: `${contextDescription} references missing script: ${scriptId}`,
            ...locationContext
        });
    } else if (script.state === 'MarkedForDelete') {
        results.push({
            id: `err-${locationContext.objectType.toLowerCase()}-script-del-${locationContext.objectId}-${scriptId}`,
            level: 'error',
            message: `${contextDescription} uses script marked for delete: ${script.name}`,
            ...locationContext
        });
    }
}

// =========================================================================
// Helper: 校验触发器列表引用 — 后端 #39-#43
// =========================================================================

function validateTriggers(
    results: ValidationResult[],
    triggers: TriggerConfig[],
    project: ProjectData,
    locationContext: { objectType: ValidationResult['objectType'], objectId: string, location: string }
) {
    triggers.forEach((trigger, idx) => {
        // #39: Trigger type is empty
        if (!trigger.type) {
            results.push({
                id: `err-${locationContext.objectType.toLowerCase()}-trigger-no-type-${locationContext.objectId}-${idx}`,
                level: 'error',
                message: `Trigger #${idx + 1} type is empty.`,
                ...locationContext
            });
            return;
        }

        if (trigger.type === 'OnEvent') {
            // #40: OnEvent 缺少 eventId
            if (!trigger.eventId) {
                results.push({
                    id: `err-${locationContext.objectType.toLowerCase()}-trigger-no-evt-${locationContext.objectId}-${idx}`,
                    level: 'error',
                    message: `Trigger #${idx + 1} (OnEvent) missing eventId.`,
                    ...locationContext
                });
            } else {
                // #41: 事件不存在
                const evt = project.blackboard.events[trigger.eventId];
                if (!evt) {
                    results.push({
                        id: `err-${locationContext.objectType.toLowerCase()}-trigger-evt-${locationContext.objectId}-${idx}`,
                        level: 'error',
                        message: `Trigger #${idx + 1} references missing event: ${trigger.eventId}`,
                        ...locationContext
                    });
                } else if (evt.state === 'MarkedForDelete') {
                    results.push({
                        id: `err-${locationContext.objectType.toLowerCase()}-trigger-evt-del-${locationContext.objectId}-${idx}`,
                        level: 'error',
                        message: `Trigger #${idx + 1} uses event marked for delete: ${evt.name}`,
                        ...locationContext
                    });
                }
            }
        } else if (trigger.type === 'CustomScript') {
            // #42: CustomScript 缺少 scriptId
            if (!trigger.scriptId) {
                results.push({
                    id: `err-${locationContext.objectType.toLowerCase()}-trigger-no-script-${locationContext.objectId}-${idx}`,
                    level: 'error',
                    message: `Trigger #${idx + 1} (CustomScript) missing scriptId.`,
                    ...locationContext
                });
            } else {
                // #43: 脚本不存在
                validateScriptId(results, trigger.scriptId, project, locationContext, `Trigger #${idx + 1}`);
            }
        }
    });
}

// =========================================================================
// Helper: 校验条件表达式引用 — 后端 #44-#46
// =========================================================================

function validateCondition(
    results: ValidationResult[],
    condition: ConditionExpression | undefined,
    project: ProjectData,
    locationContext: { objectType: ValidationResult['objectType'], objectId: string, location: string },
    contextDescription: string = 'Condition'
) {
    if (!condition) return;

    // #44: Condition type is empty
    if (!condition.type) {
        results.push({
            id: `err-${locationContext.objectType.toLowerCase()}-cond-no-type-${locationContext.objectId}`,
            level: 'error',
            message: `${contextDescription} type is empty.`,
            ...locationContext
        });
        return;
    }

    // #45-#46: ScriptRef 的脚本引用
    if (condition.type === 'ScriptRef') {
        if (!condition.scriptId) {
            // #45: SCRIPT_REF 缺少 scriptId
            results.push({
                id: `err-${locationContext.objectType.toLowerCase()}-cond-no-scriptid-${locationContext.objectId}`,
                level: 'error',
                message: `${contextDescription} (ScriptRef) missing scriptId.`,
                ...locationContext
            });
        } else {
            // #46: 脚本不存在
            validateScriptId(results, condition.scriptId, project, locationContext, `${contextDescription} (Script)`);
        }
    }

    // Recurse children
    if (condition.children) {
        condition.children.forEach((child, idx) => {
            validateCondition(results, child, project, locationContext, `${contextDescription} > Sub #${idx + 1}`);
        });
    }
    if (condition.operand) {
        validateCondition(results, condition.operand, project, locationContext, `${contextDescription} > NOT`);
    }
}

// =========================================================================
// Helper: 校验演出绑定引用 — 后端 #50-#54
// =========================================================================

function validatePresentationBinding(
    results: ValidationResult[],
    binding: PresentationBinding | undefined,
    project: ProjectData,
    locationContext: { objectType: ValidationResult['objectType'], objectId: string, location: string },
    contextDescription: string
) {
    if (!binding) return;

    // #50: PresentationConfig type 为空（Warning）
    if (!binding.type) {
        results.push({
            id: `warn-${locationContext.objectType.toLowerCase()}-pres-no-type-${locationContext.objectId}`,
            level: 'warning',
            message: `${contextDescription} type is empty.`,
            ...locationContext
        });
        return;
    }

    if (binding.type === 'Script') {
        // #51: Script 型缺少 scriptId
        if (!binding.scriptId) {
            results.push({
                id: `err-${locationContext.objectType.toLowerCase()}-pres-no-scriptid-${locationContext.objectId}`,
                level: 'error',
                message: `${contextDescription} (Script) missing scriptId.`,
                ...locationContext
            });
        } else {
            // #52: 脚本不存在
            validateScriptId(results, binding.scriptId, project, locationContext, contextDescription);
        }
    }

    if (binding.type === 'Graph') {
        // #53: Graph 型缺少 graphId
        if (!binding.graphId) {
            results.push({
                id: `err-${locationContext.objectType.toLowerCase()}-pres-no-graphid-${locationContext.objectId}`,
                level: 'error',
                message: `${contextDescription} (Graph) missing graphId.`,
                ...locationContext
            });
        } else {
            // #54: 演出图不存在
            const graph = project.presentationGraphs?.[binding.graphId];
            if (!graph) {
                results.push({
                    id: `err-${locationContext.objectType.toLowerCase()}-pres-graph-${locationContext.objectId}`,
                    level: 'error',
                    message: `${contextDescription} references missing Presentation Graph: ${binding.graphId}`,
                    ...locationContext
                });
            }
        }
    }
}

// =========================================================================
// Helper: 校验事件监听器引用
// =========================================================================

function validateEventListeners(
    results: ValidationResult[],
    listeners: EventListener[],
    project: ProjectData,
    locationContext: { objectType: ValidationResult['objectType'], objectId: string, location: string },
    hostLifecycleScriptId?: string
) {
    listeners.forEach((listener, idx) => {
        // Check Event Ref
        if (listener.eventId) {
            const evt = project.blackboard.events[listener.eventId];
            if (!evt) {
                results.push({
                    id: `err-${locationContext.objectType.toLowerCase()}-listener-${locationContext.objectId}-${idx}`,
                    level: 'error',
                    message: `Event Listener #${idx + 1} references missing event: ${listener.eventId}`,
                    ...locationContext
                });
            } else if (evt.state === 'MarkedForDelete') {
                results.push({
                    id: `err-${locationContext.objectType.toLowerCase()}-listener-del-${locationContext.objectId}-${idx}`,
                    level: 'error',
                    message: `Event Listener #${idx + 1} uses event marked for delete: ${evt.name}`,
                    ...locationContext
                });
            }
        }

        // Check Action logic
        if (listener.action.type === 'InvokeScript') {
            if (!hostLifecycleScriptId) {
                results.push({
                    id: `err-${locationContext.objectType.toLowerCase()}-listener-invoke-fail-${locationContext.objectId}-${idx}`,
                    level: 'error',
                    message: `Event Listener #${idx + 1} tries to Invoke Script, but host object has no Lifecycle Script assigned.`,
                    ...locationContext
                });
            }
        }
    });
}

// =========================================================================
// Helper: 校验事件 ID 列表引用 — 后端 #36
// =========================================================================

function validateEventIds(
    results: ValidationResult[],
    eventIds: string[] | undefined,
    project: ProjectData,
    locationContext: { objectType: ValidationResult['objectType'], objectId: string, location: string },
    contextDescription: string
) {
    if (!eventIds) return;
    eventIds.forEach((evtId, idx) => {
        const evt = project.blackboard.events[evtId];
        if (!evt) {
            results.push({
                id: `err-${locationContext.objectType.toLowerCase()}-invoke-${locationContext.objectId}-${idx}`,
                level: 'error',
                message: `${contextDescription} references missing event: ${evtId}`,
                ...locationContext
            });
        } else if (evt.state === 'MarkedForDelete') {
            results.push({
                id: `err-${locationContext.objectType.toLowerCase()}-invoke-del-${locationContext.objectId}-${idx}`,
                level: 'error',
                message: `${contextDescription} uses event marked for delete: ${evt.name}`,
                ...locationContext
            });
        }
    });
}

// =========================================================================
// Helper: 校验参数修改器结构 — 后端 #47-#49
// =========================================================================

function validateParameterModifierStructure(
    results: ValidationResult[],
    modifiers: ParameterModifier[] | undefined,
    locationContext: { objectType: ValidationResult['objectType'], objectId: string, location: string },
    contextDescription: string
) {
    if (!modifiers) return;
    modifiers.forEach((mod, idx) => {
        // #47: 缺少 targetVariableId
        if (!mod.targetVariableId) {
            results.push({
                id: `err-${locationContext.objectType.toLowerCase()}-mod-no-target-${locationContext.objectId}-${idx}`,
                level: 'error',
                message: `${contextDescription} ParameterModifier #${idx + 1} missing targetVariableId.`,
                ...locationContext
            });
        }

        // #48: 缺少 operation
        if (!mod.operation) {
            results.push({
                id: `err-${locationContext.objectType.toLowerCase()}-mod-no-op-${locationContext.objectId}-${idx}`,
                level: 'error',
                message: `${contextDescription} ParameterModifier #${idx + 1} missing operation.`,
                ...locationContext
            });
        }

        // #49: ValueSource VariableRef 缺少 variableId
        if (mod.source && mod.source.type === 'VariableRef' && !mod.source.variableId) {
            results.push({
                id: `err-${locationContext.objectType.toLowerCase()}-mod-src-no-varid-${locationContext.objectId}-${idx}`,
                level: 'error',
                message: `${contextDescription} ParameterModifier #${idx + 1} source (VariableRef) missing variableId.`,
                ...locationContext
            });
        }
    });
}

// =========================================================================
// Helper: 校验 ValueSource 结构 — 后端 #55-#56 (结构部分)
// =========================================================================

function validateValueSourceStructure(
    results: ValidationResult[],
    source: ValueSource | undefined,
    locationContext: { objectType: ValidationResult['objectType'], objectId: string, location: string },
    contextDescription: string
) {
    if (!source) return;
    // #56: VariableRef 缺少 variableId
    if (source.type === 'VariableRef' && !source.variableId) {
        results.push({
            id: `err-${locationContext.objectType.toLowerCase()}-vs-no-varid-${locationContext.objectId}`,
            level: 'error',
            message: `${contextDescription} ValueSource (VariableRef) missing variableId.`,
            ...locationContext
        });
    }
}

// =========================================================================
// Helper: 校验条件中 ValueSource 结构
// =========================================================================

function validateConditionValueSourceStructure(
    results: ValidationResult[],
    condition: ConditionExpression | undefined,
    locationContext: { objectType: ValidationResult['objectType'], objectId: string, location: string },
    contextDescription: string
) {
    if (!condition) return;

    if (condition.type === 'Comparison') {
        validateValueSourceStructure(results, condition.left, locationContext, `${contextDescription} > Left`);
        validateValueSourceStructure(results, condition.right, locationContext, `${contextDescription} > Right`);
    }

    if (condition.children) {
        condition.children.forEach((child, idx) => {
            validateConditionValueSourceStructure(results, child, locationContext, `${contextDescription} > Sub #${idx + 1}`);
        });
    }
    if (condition.operand) {
        validateConditionValueSourceStructure(results, condition.operand, locationContext, `${contextDescription} > NOT`);
    }
}

// =========================================================================
// MAIN: validateReferences
// =========================================================================

export const validateReferences = (project: ProjectData): ValidationResult[] => {
    const results: ValidationResult[] = [];

    // =========================================================================
    // 0. Blackboard & Script 定义校验 — 后端 #5-#7
    // =========================================================================

    // #6: Script category is empty (Warning)
    Object.values(project.scripts?.scripts || {}).forEach(script => {
        if (!script.category || script.category.trim() === '') {
            results.push({
                id: `warn-script-no-category-${script.id}`,
                level: 'warning',
                message: `Script "${script.name}" has empty category.`,
                objectType: 'SCRIPT',
                objectId: script.id,
                location: `Script: ${script.name}`
            });
        }

        // #7: Lifecycle 脚本必须有 lifecycleType
        if (script.category === 'Lifecycle' && !script.lifecycleType) {
            results.push({
                id: `err-script-no-lifecycle-type-${script.id}`,
                level: 'error',
                message: `Lifecycle script "${script.name}" missing lifecycleType.`,
                objectType: 'SCRIPT',
                objectId: script.id,
                location: `Script: ${script.name}`
            });
        }
    });

    // =========================================================================
    // 1. Stage Tree References — 后端 #33, 触发器/条件/演出
    // =========================================================================
    Object.values(project.stageTree.stages).forEach(stage => {
        const stageContext = { objectType: 'STAGE' as const, objectId: stage.id, location: `Stage: ${stage.name}` };

        // #33: Lifecycle Script
        validateScriptId(results, stage.lifecycleScriptId, project, stageContext, 'Lifecycle Script');

        // Unlock Triggers
        if (stage.unlockTriggers) {
            validateTriggers(results, stage.unlockTriggers, project, stageContext);
        }

        // Unlock Condition
        validateCondition(results, stage.unlockCondition, project, stageContext, 'Unlock Condition');
        validateConditionValueSourceStructure(results, stage.unlockCondition, stageContext, 'Unlock Condition');

        // OnEnter/OnExit Presentation
        validatePresentationBinding(results, stage.onEnterPresentation, project, stageContext, 'OnEnter Presentation');
        validatePresentationBinding(results, stage.onExitPresentation, project, stageContext, 'OnExit Presentation');

        // Event Listeners
        if (stage.eventListeners) {
            validateEventListeners(results, stage.eventListeners, project, stageContext, stage.lifecycleScriptId);
        }
    });

    // =========================================================================
    // 2. Puzzle Nodes & FSM State References — 后端 #34-#36, #39-#56
    // =========================================================================
    Object.values(project.nodes).forEach(node => {
        const nodeContext = { objectType: 'NODE' as const, objectId: node.id, location: `Node: ${node.name}` };

        // #34: Lifecycle Script
        validateScriptId(results, node.lifecycleScriptId, project, nodeContext, 'Lifecycle Script');

        // Node Listeners
        if (node.eventListeners) {
            validateEventListeners(results, node.eventListeners, project, nodeContext, node.lifecycleScriptId);
        }

        const fsm = project.stateMachines[node.stateMachineId];
        if (!fsm) return;

        // States
        Object.values(fsm.states || {}).forEach(state => {
            const stateContext = {
                objectType: 'STATE' as const,
                objectId: state.id,
                contextId: node.id,
                location: `Node: ${node.name} > State: ${state.name}`
            };

            // #35: Lifecycle Script
            validateScriptId(results, state.lifecycleScriptId, project, stateContext, 'Lifecycle Script');

            // State Listeners
            if (state.eventListeners) {
                validateEventListeners(results, state.eventListeners, project, stateContext, state.lifecycleScriptId);
            }

            // Transitions
            const outgoingTransitions = Object.values(fsm.transitions || {}).filter(t => t.fromStateId === state.id);
            outgoingTransitions.forEach((trans, idx) => {
                const transContext = {
                    objectType: 'TRANSITION' as const,
                    objectId: trans.id,
                    contextId: node.id,
                    location: `Node: ${node.name} > State: ${state.name} > Transition #${idx + 1}`
                };

                // Target State（#25 对应）
                if (trans.toStateId && !fsm.states[trans.toStateId]) {
                    results.push({
                        id: `err-trans-target-${state.id}-${trans.id}`,
                        level: 'error',
                        message: `Transition points to missing state: ${trans.toStateId}`,
                        ...transContext
                    });
                }

                // Transition Triggers (#39-#43)
                if (trans.triggers) {
                    validateTriggers(results, trans.triggers, project, transContext);
                }

                // Condition (#44-#46)
                validateCondition(results, trans.condition, project, transContext, 'Condition');
                // Condition ValueSource 结构 (#55-#56)
                validateConditionValueSourceStructure(results, trans.condition, transContext, 'Condition');

                // Presentation (#50-#54)
                validatePresentationBinding(results, trans.presentation, project, transContext, 'Presentation');

                // Invoke Events (#36)
                if (trans.invokeEventIds) {
                    validateEventIds(results, trans.invokeEventIds, project, transContext, 'Transition Invoke');
                }

                // Parameter Modifier 结构 (#47-#49)
                validateParameterModifierStructure(results, trans.parameterModifiers, transContext, 'Transition');
            });
        });
    });

    // =========================================================================
    // 3. Presentation Graphs (Script References) — 后端 #44-#46, #50-#54
    // =========================================================================
    if (project.presentationGraphs) {
        Object.values(project.presentationGraphs).forEach(graph => {
            const graphContext = {
                objectType: 'PRESENTATION_GRAPH' as const,
                objectId: graph.id,
                location: `Presentation Graph: ${graph.name || graph.id}`
            };

            Object.values(graph.nodes || {}).forEach(pNode => {
                const nodeContext = {
                    ...graphContext,
                    location: `${graphContext.location} > Node: ${pNode.name || pNode.id}`
                };

                // Presentation Binding (#50-#54)
                validatePresentationBinding(results, pNode.presentation, project, nodeContext, 'Presentation');

                // Branch Condition (#44-#46)
                validateCondition(results, pNode.condition, project, nodeContext, 'Condition');
                validateConditionValueSourceStructure(results, pNode.condition, nodeContext, 'Condition');
            });
        });
    }

    return results;
};
