/**
 * utils/validation/rules/validateVariables.ts
 * 校验变量引用的完整性 (Global, StageLocal, NodeLocal)
 * 
 * 检查以下位置的 VARIABLE_REF:
 * 1. Conditions
 * 2. Parameter Modifiers
 * 3. Parameter Bindings
 */

import { ValidationResult } from '../../../store/types';
import { ProjectData } from '../../../types/project';
import { ConditionExpression } from '../../../types/stateMachine';
import { ParameterBinding, ValueSource, ParameterModifier, EventListener, PresentationBinding, VariableScope, VariableType } from '../../../types/common';
import { StageNode } from '../../../types/stage';
import { PuzzleNode } from '../../../types/puzzleNode';
import { VariableDefinition } from '../../../types/blackboard';

interface VariableContext {
    stage?: StageNode;
    node?: PuzzleNode;
}

/**
 * 校验变量 ID
 */
function validateVariableId(
    results: ValidationResult[],
    variableId: string | undefined,
    scope: VariableScope | undefined,
    project: ProjectData,
    context: VariableContext,
    locationContext: { objectType: ValidationResult['objectType'], objectId: string, location: string },
    contextDescription: string = 'Variable reference'
) {
    if (!variableId || !scope) return;

    // Ignore Temporary variables as they are transient
    if (scope === 'Temporary') return;

    let variable: VariableDefinition | undefined;

    if (scope === 'Global') {
        variable = project.blackboard.globalVariables[variableId];
    } else if (scope === 'StageLocal') {
        if (context.stage && context.stage.localVariables) {
            // localVariables is a Record, use bracket access
            variable = context.stage.localVariables[variableId];
        } else {
            // Referenced StageLocal but no stage context (e.g. cross-context reference which shouldn't happen, or inside a node causing issues?)
            // Actually Nodes belong to Stages, so Node logic can access StageLocal.
            // We need to ensure 'context.stage' is populated when validating Nodes.
        }
    } else if (scope === 'NodeLocal') {
        if (context.node && context.node.localVariables) {
            // localVariables is a Record, use bracket access
            variable = context.node.localVariables[variableId];
        }
    }

    if (!variable) {
        // Special case: If Scope is StageLocal but we are in a context where stage might not be easily resolved or variable is truly missing
        // For strictness, if we can't find it in the provided list, it's missing.
        results.push({
            id: `err-${locationContext.objectType.toLowerCase()}-var-missing-${locationContext.objectId}-${variableId}`,
            level: 'error',
            message: `${contextDescription} references missing ${scope} variable: ${variableId}`,
            ...locationContext
        });
    } else if (variable.state === 'MarkedForDelete') {
        results.push({
            id: `err-${locationContext.objectType.toLowerCase()}-var-del-${locationContext.objectId}-${variableId}`,
            level: 'error',
            message: `${contextDescription} uses ${scope} variable marked for delete: ${variable.name}`,
            ...locationContext
        });
    }
}

/**
 * 校验 ValueSource
 */
function validateValueSource(
    results: ValidationResult[],
    source: ValueSource | undefined,
    project: ProjectData,
    context: VariableContext,
    locationContext: { objectType: ValidationResult['objectType'], objectId: string, location: string },
    contextDescription: string
) {
    if (source && source.type === 'VariableRef') {
        validateVariableId(results, source.variableId, source.scope, project, context, locationContext, contextDescription);
    }
}

/**
 * 校验 Parameter Bindings
 */
function validateParameterBindings(
    results: ValidationResult[],
    bindings: ParameterBinding[] | undefined,
    project: ProjectData,
    context: VariableContext,
    locationContext: { objectType: ValidationResult['objectType'], objectId: string, location: string },
    contextDescription: string
) {
    if (!bindings) return;
    bindings.forEach(binding => {
        validateValueSource(results, binding.source, project, context, locationContext, `${contextDescription} (Param: ${binding.paramName})`);
    });
}

/**
 * 校验 Parameter Modifiers
 */
function validateParameterModifiers(
    results: ValidationResult[],
    modifiers: ParameterModifier[] | undefined,
    project: ProjectData,
    context: VariableContext,
    locationContext: { objectType: ValidationResult['objectType'], objectId: string, location: string },
    contextDescription: string
) {
    if (!modifiers) return;
    modifiers.forEach((mod, idx) => {
        // Check Target
        validateVariableId(results, mod.targetVariableId, mod.targetScope, project, context, locationContext, `${contextDescription} (Modifier #${idx + 1} Target)`);
        // Check Source
        validateValueSource(results, mod.source, project, context, locationContext, `${contextDescription} (Modifier #${idx + 1} Source)`);
    });
}

/**
 * 校验 Condition Expression
 */
function validateCondition(
    results: ValidationResult[],
    condition: ConditionExpression | undefined,
    project: ProjectData,
    context: VariableContext,
    locationContext: { objectType: ValidationResult['objectType'], objectId: string, location: string },
    contextDescription: string
) {
    if (!condition) return;

    // Check COMPARISON operands
    if (condition.type === 'COMPARISON') {
        validateValueSource(results, condition.left, project, context, locationContext, `${contextDescription} > Left`);
        validateValueSource(results, condition.right, project, context, locationContext, `${contextDescription} > Right`);
    }

    // Recurse children
    if (condition.children) {
        condition.children.forEach((child, idx) => {
            validateCondition(results, child, project, context, locationContext, `${contextDescription} > Sub #${idx + 1}`);
        });
    }
    if (condition.operand) {
        validateCondition(results, condition.operand, project, context, locationContext, `${contextDescription} > NOT`);
    }
}

/**
 * 校验 Event Listeners
 */
function validateEventListeners(
    results: ValidationResult[],
    listeners: EventListener[] | undefined,
    project: ProjectData,
    context: VariableContext,
    locationContext: { objectType: ValidationResult['objectType'], objectId: string, location: string }
) {
    if (!listeners) return;
    listeners.forEach((listener, idx) => {
        if (listener.action.type === 'ModifyParameter') {
            validateParameterModifiers(results, listener.action.modifiers, project, context, locationContext, `Listener #${idx + 1}`);
        }
    });
}

/**
 * 校验 Presentation Binding
 */
function validatePresentationBinding(
    results: ValidationResult[],
    binding: PresentationBinding | undefined,
    project: ProjectData,
    context: VariableContext,
    locationContext: { objectType: ValidationResult['objectType'], objectId: string, location: string },
    contextDescription: string
) {
    if (!binding) return;
    if (binding.type === 'Script') {
        validateParameterBindings(results, binding.parameters, project, context, locationContext, contextDescription);
    }
}


export const validateVariables = (project: ProjectData): ValidationResult[] => {
    const results: ValidationResult[] = [];

    // --- 1. Stage Tree ---
    Object.values(project.stageTree.stages).forEach(stage => {
        const stageContext = { objectType: 'STAGE' as const, objectId: stage.id, location: `Stage: ${stage.name}` };
        const varContext: VariableContext = { stage };

        validateCondition(results, stage.unlockCondition, project, varContext, stageContext, 'Unlock Condition');
        validatePresentationBinding(results, stage.onEnterPresentation, project, varContext, stageContext, 'OnEnter Presentation');
        validatePresentationBinding(results, stage.onExitPresentation, project, varContext, stageContext, 'OnExit Presentation');
        validateEventListeners(results, stage.eventListeners, project, varContext, stageContext);
    });

    // --- 2. Nodes ---
    Object.values(project.nodes).forEach(node => {
        const nodeContext = { objectType: 'NODE' as const, objectId: node.id, location: `Node: ${node.name}` };
        // Resolve parent stage
        const parentStage = node.stageId ? project.stageTree.stages[node.stageId] : undefined;
        const varContext: VariableContext = { node, stage: parentStage };

        validateEventListeners(results, node.eventListeners, project, varContext, nodeContext);

        const fsm = project.stateMachines[node.stateMachineId];
        if (fsm) {
            Object.values(fsm.states || {}).forEach(state => {
                const stateContext = {
                    objectType: 'STATE' as const,
                    objectId: state.id,
                    contextId: node.id,
                    location: `Node: ${node.name} > State: ${state.name}`
                };

                validateEventListeners(results, state.eventListeners, project, varContext, stateContext);

                const outgoingTransitions = Object.values(fsm.transitions || {}).filter(t => t.fromStateId === state.id);
                outgoingTransitions.forEach((trans, idx) => {
                    const transContext = {
                        objectType: 'TRANSITION' as const,
                        objectId: trans.id,
                        contextId: node.id,
                        location: `Node: ${node.name} > State: ${state.name} > Transition #${idx + 1}`
                    };

                    validateCondition(results, trans.condition, project, varContext, transContext, 'Condition');
                    validatePresentationBinding(results, trans.presentation, project, varContext, transContext, 'Presentation');
                    validateParameterModifiers(results, trans.parameterModifiers, project, varContext, transContext, 'Parameter Modifiers');
                });
            });
        }
    });

    // --- 3. Presentation Graphs ---
    // Note: Presentation Graphs are "stateless" until instantiated. 
    // Usually they shouldn't reference NodeLocal variables unless bound to a specific node type context, which isn't distinct here.
    // They can reference Global. 
    // References to StageLocal/NodeLocal inside a shared Graph might be valid if they expect dynamic binding, 
    // but rigid validation might fail them. 
    // For now, valid scopes are Global (always) or others (if we can resolve context). 
    // Since graph context is unknown here, strict validation might block valid dynamic usage. 
    // Strategy: Warn/Error on Global missing. Skip Local checks if context is missing?
    // Let's perform strict check for Global, and maybe lenient or skip for Local to avoid false positives.
    // HOWEVER, the logic `validateVariableId` will fail if context.stage/node is missing and scope is Local. 
    // This is correct behavior: a pure Presentation Graph shouldn't link hard NodeLocal ID unless it's designed to be embedded in specific nodes.
    // But usually Graphs use Parameters, not direct Variable Refs for maximizing reuse.
    // If they DO use Variable Refs, they must exist. 

    if (project.presentationGraphs) {
        Object.values(project.presentationGraphs).forEach(graph => {
            const graphContext = {
                objectType: 'PRESENTATION_GRAPH' as const,
                objectId: graph.id,
                location: `Presentation Graph: ${graph.name || graph.id}`
            };
            const varContext: VariableContext = {}; // No context

            Object.values(graph.nodes || {}).forEach(pNode => {
                const nodeContext = {
                    ...graphContext,
                    location: `${graphContext.location} > Node: ${pNode.name || pNode.id}`
                };

                validatePresentationBinding(results, pNode.presentation, project, varContext, nodeContext, 'Presentation');
                validateCondition(results, pNode.condition, project, varContext, nodeContext, 'Condition');
            });
        });
    }

    return results;
};
