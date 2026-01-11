/**
 * utils/validation/rules/validateReferences.ts
 * 校验资源引用的完整性（是否丢失、是否已删除）
 */

import { ValidationResult } from '../../../store/types';
import { ProjectData } from '../../../types/project';
import { ConditionExpression, TriggerConfig } from '../../../types/stateMachine';
import { EventListener, PresentationBinding } from '../../../types/common';

/**
 * 校验脚本 ID 引用
 */
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

/**
 * 校验触发器列表引用
 */
function validateTriggers(
    results: ValidationResult[],
    triggers: TriggerConfig[],
    project: ProjectData,
    locationContext: { objectType: ValidationResult['objectType'], objectId: string, location: string }
) {
    triggers.forEach((trigger, idx) => {
        if (trigger.type === 'OnEvent') {
            if (trigger.eventId) {
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
            validateScriptId(results, trigger.scriptId, project, locationContext, `Trigger #${idx + 1}`);
        }
    });
}

/**
 * 校验此条件表达式中的引用
 */
function validateCondition(
    results: ValidationResult[],
    condition: ConditionExpression | undefined,
    project: ProjectData,
    locationContext: { objectType: ValidationResult['objectType'], objectId: string, location: string },
    contextDescription: string = 'Condition'
) {
    if (!condition) return;

    // Check Script Ref
    if (condition.type === 'ScriptRef') {
        validateScriptId(results, condition.scriptId, project, locationContext, `${contextDescription} (Script)`);
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

/**
 * 校验演出绑定引用
 */
function validatePresentationBinding(
    results: ValidationResult[],
    binding: PresentationBinding | undefined,
    project: ProjectData,
    locationContext: { objectType: ValidationResult['objectType'], objectId: string, location: string },
    contextDescription: string
) {
    if (!binding) return;

    if (binding.type === 'Script') {
        validateScriptId(results, binding.scriptId, project, locationContext, contextDescription);
    }
    // Graph type validation is implicit via finding the graph itself (graphs are not 'referenced' by ID usually, or if they are we verify the ID exists)
    if (binding.type === 'Graph') {
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

/**
 * 校验事件监听器引用
 */
function validateEventListeners(
    results: ValidationResult[],
    listeners: EventListener[],
    project: ProjectData,
    locationContext: { objectType: ValidationResult['objectType'], objectId: string, location: string },
    hostLifecycleScriptId?: string // Optional: if provided, validate 'InvokeScript' action
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

/**
 * 校验事件 ID 列表引用 (Invoke Events)
 */
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

export const validateReferences = (project: ProjectData): ValidationResult[] => {
    const results: ValidationResult[] = [];

    // --- 1. Stage Tree References ---
    Object.values(project.stageTree.stages).forEach(stage => {
        const stageContext = { objectType: 'STAGE' as const, objectId: stage.id, location: `Stage: ${stage.name}` };

        // Lifecycle Script
        validateScriptId(results, stage.lifecycleScriptId, project, stageContext, 'Lifecycle Script');

        // Unlock Triggers
        if (stage.unlockTriggers) {
            validateTriggers(results, stage.unlockTriggers, project, stageContext);
        }

        // Unlock Condition
        validateCondition(results, stage.unlockCondition, project, stageContext, 'Unlock Condition');

        // OnEnter/OnExit Presentation
        validatePresentationBinding(results, stage.onEnterPresentation, project, stageContext, 'OnEnter Presentation');
        validatePresentationBinding(results, stage.onExitPresentation, project, stageContext, 'OnExit Presentation');

        // Event Listeners
        if (stage.eventListeners) {
            validateEventListeners(results, stage.eventListeners, project, stageContext, stage.lifecycleScriptId);
        }
    });

    // --- 2. Puzzle Nodes & FSM State References ---
    Object.values(project.nodes).forEach(node => {
        const nodeContext = { objectType: 'NODE' as const, objectId: node.id, location: `Node: ${node.name}` };

        // Lifecycle Script
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

            // Lifecycle Script
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

                // Target State
                if (!fsm.states[trans.toStateId]) {
                    results.push({
                        id: `err-trans-target-${state.id}-${trans.id}`,
                        level: 'error',
                        message: `Transition points to missing state: ${trans.toStateId}`,
                        ...transContext
                    });
                }

                // Transition Triggers
                if (trans.triggers) {
                    validateTriggers(results, trans.triggers, project, transContext);
                }

                // Condition
                validateCondition(results, trans.condition, project, transContext, 'Condition');

                // Presentation
                validatePresentationBinding(results, trans.presentation, project, transContext, 'Presentation');

                // Invoke Events
                if (trans.invokeEventIds) {
                    validateEventIds(results, trans.invokeEventIds, project, transContext, 'Transition Invoke');
                }
            });
        });
    });

    // --- 3. Presentation Graphs (Script References) ---
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

                // Presentation Binding
                validatePresentationBinding(results, pNode.presentation, project, nodeContext, 'Presentation');

                // Branch Condition
                validateCondition(results, pNode.condition, project, nodeContext, 'Condition');
            });
        });
    }

    return results;
};
