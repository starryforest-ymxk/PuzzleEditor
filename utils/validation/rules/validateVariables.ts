/**
 * utils/validation/rules/validateVariables.ts
 * 校验变量引用的完整性 (Global, StageLocal, NodeLocal)
 * 
 * 检查以下位置的 VariableRef:
 * 1. Conditions
 * 2. Parameter Modifiers
 * 3. Parameter Bindings
 * 
 * [Updated] Context-Aware Presentation Graph Validation
 * Presentation Graphs are validated based on their usage context (where they are bound).
 * - Global Variables: Always valid if they exist.
 * - Local Variables: Must be valid in ALL contexts where the graph is used.
 * - Unused Graphs: Usage of Local Variables is an ERROR (no context to resolve them).
 */

import { ValidationResult } from '../../../store/types';
import { ProjectData } from '../../../types/project';
import { ConditionExpression } from '../../../types/stateMachine';
import { ParameterBinding, ValueSource, ParameterModifier, EventListener, PresentationBinding, VariableScope, VariableType } from '../../../types/common';
import { StageNode } from '../../../types/stage';
import { PuzzleNode } from '../../../types/puzzleNode';
import { VariableDefinition } from '../../../types/blackboard';
import { PresentationNode } from '../../../types/presentation';

import { ASSET_NAME_REGEX } from '../../assetNameValidation';

interface VariableContext {
    stage?: StageNode;
    node?: PuzzleNode;
}

// Map GraphID -> List of Usage Contexts
type GraphContextMap = Map<string, VariableContext[]>;

/**
 * 校验变量 ID (Internal Helper)
 * @param strictMode If true, reports error even if variable is missing in one of valid contexts (for Intersection Check)
 */
function checkVariableId(
    variableId: string | undefined,
    scope: VariableScope | undefined,
    project: ProjectData,
    context: VariableContext
): { valid: boolean; variable?: VariableDefinition; errorType?: 'missing' | 'markedForDelete' } {
    if (!variableId || !scope) return { valid: true };
    if (scope === 'Temporary') return { valid: true };

    let variable: VariableDefinition | undefined;

    if (scope === 'Global') {
        variable = project.blackboard.globalVariables[variableId];
    } else if (scope === 'StageLocal') {
        // 向上遍历祖先 Stage 链查找变量（与 collectVisibleVariables 保持一致）
        if (context.stage) {
            let currentStage = context.stage;
            while (currentStage) {
                if (currentStage.localVariables && currentStage.localVariables[variableId]) {
                    variable = currentStage.localVariables[variableId];
                    break;
                }
                // 沿父链向上查找
                currentStage = currentStage.parentId ? project.stageTree.stages[currentStage.parentId] : undefined!;
            }
        }
    } else if (scope === 'NodeLocal') {
        if (context.node && context.node.localVariables) {
            variable = context.node.localVariables[variableId];
        }
    }

    if (!variable) return { valid: false, errorType: 'missing' };
    if (variable.state === 'MarkedForDelete') return { valid: false, variable, errorType: 'markedForDelete' };

    return { valid: true, variable };
}

/**
 * 通用变量校验入口
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
    const check = checkVariableId(variableId, scope, project, context);
    if (!check.valid) {
        if (check.errorType === 'missing') {
            results.push({
                id: `err-${locationContext.objectType.toLowerCase()}-var-missing-${locationContext.objectId}-${variableId}`,
                level: 'error',
                message: `${contextDescription} references missing ${scope} variable: ${variableId}`,
                ...locationContext
            });
        } else if (check.errorType === 'markedForDelete') {
            results.push({
                id: `err-${locationContext.objectType.toLowerCase()}-var-del-${locationContext.objectId}-${variableId}`,
                level: 'error',
                message: `${contextDescription} uses ${scope} variable marked for delete: ${check.variable!.name}`,
                ...locationContext
            });
        }
    }
}

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

function validateParameterBindings(
    results: ValidationResult[],
    bindings: ParameterBinding[] | undefined,
    project: ProjectData,
    context: VariableContext,
    locationContext: { objectType: ValidationResult['objectType'], objectId: string, location: string },
    contextDescription: string
) {
    if (!bindings) return;
    bindings.forEach((binding, idx) => {
        // Validate Param Name Format (Strict)
        if (binding.paramName && !ASSET_NAME_REGEX.test(binding.paramName)) {
            results.push({
                id: `err-${locationContext.objectType.toLowerCase()}-param-fmt-${locationContext.objectId}-${idx}`,
                level: 'error',
                message: `${contextDescription} has invalid parameter name "${binding.paramName}". Must match /^[a-zA-Z_][a-zA-Z0-9_]*$/.`,
                ...locationContext
            });
        }

        validateValueSource(results, binding.source, project, context, locationContext, `${contextDescription} (Param: ${binding.paramName || 'Unnamed'})`);
    });
}


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
        validateVariableId(results, mod.targetVariableId, mod.targetScope, project, context, locationContext, `${contextDescription} (Modifier #${idx + 1} Target)`);
        validateValueSource(results, mod.source, project, context, locationContext, `${contextDescription} (Modifier #${idx + 1} Source)`);
    });
}

function validateCondition(
    results: ValidationResult[],
    condition: ConditionExpression | undefined,
    project: ProjectData,
    context: VariableContext,
    locationContext: { objectType: ValidationResult['objectType'], objectId: string, location: string },
    contextDescription: string
) {
    if (!condition) return;

    if (condition.type === 'Comparison') {
        validateValueSource(results, condition.left, project, context, locationContext, `${contextDescription} > Left`);
        validateValueSource(results, condition.right, project, context, locationContext, `${contextDescription} > Right`);
    }

    if (condition.children) {
        condition.children.forEach((child, idx) => {
            validateCondition(results, child, project, context, locationContext, `${contextDescription} > Sub #${idx + 1}`);
        });
    }
    if (condition.operand) {
        validateCondition(results, condition.operand, project, context, locationContext, `${contextDescription} > NOT`);
    }
}

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
 * 校验 Presentation Binding (Collection Phase)
 * 如果绑定了 Graph，则将其上下文记录下来
 */
function validatePresentationBinding(
    results: ValidationResult[],
    binding: PresentationBinding | undefined,
    project: ProjectData,
    context: VariableContext,
    locationContext: { objectType: ValidationResult['objectType'], objectId: string, location: string },
    contextDescription: string,
    graphUsageMap: GraphContextMap // [Changed] Pass map to collect usage
) {
    if (!binding) return;

    // Script Bindings use immediate context validation
    if (binding.type === 'Script') {
        validateParameterBindings(results, binding.parameters, project, context, locationContext, contextDescription);
    }

    // Graph Bindings: Record Context for Validation Phase
    if (binding.type === 'Graph' && binding.graphId) {
        if (!graphUsageMap.has(binding.graphId)) {
            graphUsageMap.set(binding.graphId, []);
        }
        graphUsageMap.get(binding.graphId)!.push(context);
    }
}


// --- 3. Graph Validation Phase Logic ---

/**
 * Propagate contexts to nested graphs (DFS)
 * A -> B -> C: A's contexts should flow to B, and then to C.
 */
function recurseGraphContexts(
    project: ProjectData,
    graphId: string,
    currentContexts: VariableContext[],
    graphUsageMap: GraphContextMap,
    visitedGraphs: Set<string>
) {
    if (visitedGraphs.has(graphId)) return;
    visitedGraphs.add(graphId);

    const graph = project.presentationGraphs[graphId];
    if (!graph) return;

    // Iterate all nodes in this graph to find sub-graph bindings
    Object.values(graph.nodes).forEach(pNode => {
        if (pNode.presentation && pNode.presentation.type === 'Graph') {
            const subGraphId = pNode.presentation.graphId;
            if (!subGraphId) return;

            // Add current contexts to sub-graph
            if (!graphUsageMap.has(subGraphId)) {
                graphUsageMap.set(subGraphId, []);
            }
            const subList = graphUsageMap.get(subGraphId)!;

            // Push only unique contexts (by ref) to avoid explosion
            currentContexts.forEach(ctx => {
                if (!subList.includes(ctx)) {
                    subList.push(ctx);
                }
            });

            // Recurse
            recurseGraphContexts(project, subGraphId, subList, graphUsageMap, visitedGraphs);
        }
    });

    visitedGraphs.delete(graphId); // Allow visiting again from another path? 
    // Actually for strict Context propagation in DAG, we should just traverse. 
    // VariableContexts are accumulative. 
    // Simple approach: Multiple passes or just Propagate from known roots?
    // Since we collected ALL initial usages in the main pass, we just need to propagate those down.
    // The current recursive function pushes contexts downwards. We need to call this for every graph that has 'root' usages.
}

/**
 * Validate a ValueSource inside a Graph against ALL collected contexts
 */
function validateGraphValueSource(
    results: ValidationResult[],
    source: ValueSource | undefined,
    project: ProjectData,
    contexts: VariableContext[],
    graphId: string,
    locationInfo: { contextDesc: string, objectId: string, location: string }
) {
    if (!source || source.type !== 'VariableRef') return;

    const { variableId, scope } = source;
    if (!variableId || !scope) return;
    if (scope === 'Temporary') return;

    // 1. Unused Graph Check (Strict Rules)
    if (contexts.length === 0) {
        if (scope !== 'Global') {
            results.push({
                id: `err-graph-orphaned-local-${graphId}-${variableId}`,
                level: 'error',
                message: `${locationInfo.contextDesc} uses ${scope} Variable '${variableId}', but Graph is UNUSED (no context). Local variables require a valid binding context.`,
                objectType: 'PRESENTATION_GRAPH',
                objectId: graphId,
                location: locationInfo.location
            });
        } else {
            // Validating Global in unused graph is fine, just check global existence
            const check = checkVariableId(variableId, scope, project, {});
            if (!check.valid) {
                results.push({
                    id: `err-graph-global-missing-${graphId}-${variableId}`,
                    level: 'error',
                    message: `${locationInfo.contextDesc} references missing Global variable: ${variableId}`,
                    objectType: 'PRESENTATION_GRAPH',
                    objectId: graphId,
                    location: locationInfo.location
                });
            }
        }
        return;
    }

    // 2. Used Graph Check (Intersection)
    // Variable must exist in ALL contexts
    for (const ctx of contexts) {
        const check = checkVariableId(variableId, scope, project, ctx);
        if (!check.valid) {
            const ctxName = ctx.node ? `Node: ${ctx.node.name}` : (ctx.stage ? `Stage: ${ctx.stage.name}` : 'Unknown Context');
            results.push({
                id: `err-graph-var-ctx-fail-${graphId}-${variableId}-${ctx.node?.id || ctx.stage?.id}`,
                level: 'error',
                message: `${locationInfo.contextDesc} references ${scope} variable '${check.variable?.name || variableId}' which is missing or invalid in usage context: ${ctxName}`,
                objectType: 'PRESENTATION_GRAPH',
                objectId: graphId,
                location: locationInfo.location
            });
            // Fail fast per variable to avoid spamming errors for every context
            return;
        }
    }
}


// =========================================================================

export const validateVariables = (project: ProjectData): ValidationResult[] => {
    const results: ValidationResult[] = [];
    const graphUsageMap: GraphContextMap = new Map();

    // --- 1. Stage Tree (Collection Phase) ---
    Object.values(project.stageTree.stages).forEach(stage => {
        const stageContext = { objectType: 'STAGE' as const, objectId: stage.id, location: `Stage: ${stage.name}` };
        const varContext: VariableContext = { stage };

        validateCondition(results, stage.unlockCondition, project, varContext, stageContext, 'Unlock Condition');
        validatePresentationBinding(results, stage.onEnterPresentation, project, varContext, stageContext, 'OnEnter Presentation', graphUsageMap);
        validatePresentationBinding(results, stage.onExitPresentation, project, varContext, stageContext, 'OnExit Presentation', graphUsageMap);
        validateEventListeners(results, stage.eventListeners, project, varContext, stageContext);
    });

    // --- 2. Nodes (Collection Phase) ---
    Object.values(project.nodes).forEach(node => {
        const nodeContext = { objectType: 'NODE' as const, objectId: node.id, location: `Node: ${node.name}` };
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
                    validatePresentationBinding(results, trans.presentation, project, varContext, transContext, 'Presentation', graphUsageMap);
                    validateParameterModifiers(results, trans.parameterModifiers, project, varContext, transContext, 'Parameter Modifiers');
                });
            });
        }
    });

    // --- 3. Presentation Graphs (Propagation & Validation Phase) ---
    if (project.presentationGraphs) {

        // 3.1 Propagate Contexts (Iterative approach to ensure depth)
        // Since graphs can form a DAG (or cycle), we propagate.
        // Simple propagation: Just iterate keys and recurse. 
        // Note: graphUsageMap keys grow as we find nested bindings.
        // We use a safe copy of keys to start.
        const initialGraphIds = Array.from(graphUsageMap.keys());
        initialGraphIds.forEach(gid => {
            recurseGraphContexts(project, gid, graphUsageMap.get(gid)!, graphUsageMap, new Set());
        });

        // 3.2 Validate All Graphs
        Object.values(project.presentationGraphs).forEach(graph => {
            const contexts = graphUsageMap.get(graph.id) || [];

            // Warnings for Unused Graphs (Optional UX polish: Warning only if it's NOT checking Local vars. 
            // If it uses Local Vars, it will error below, so warning is redundant but helpful).
            if (contexts.length === 0) {
                results.push({
                    id: `warn-graph-unused-${graph.id}`,
                    level: 'warning', // Warning: Orphaned
                    message: `Presentation Graph "${graph.name}" is not used anywhere (Orphaned).`,
                    objectType: 'PRESENTATION_GRAPH',
                    objectId: graph.id,
                    location: `Graph: ${graph.name}`
                });
            }

            // Iterate nodes and validate
            Object.values(graph.nodes || {}).forEach(pNode => {
                const locationInfo = {
                    contextDesc: `Presentation Node '${pNode.name || pNode.id}'`,
                    objectId: graph.id,
                    location: `Graph: ${graph.name} > Node: ${pNode.name || pNode.id}`
                };

                // Validate Binding Parameters
                if (pNode.presentation && pNode.presentation.type === 'Script') {
                    pNode.presentation.parameters?.forEach(param => {
                        validateGraphValueSource(results, param.source, project, contexts, graph.id, {
                            ...locationInfo,
                            contextDesc: `Param '${param.paramName}'`
                        });
                    });
                }

                // Validate Branch Condition
                if (pNode.condition && pNode.condition.type === 'Comparison') {
                    validateGraphValueSource(results, pNode.condition.left, project, contexts, graph.id, {
                        ...locationInfo,
                        contextDesc: `Condition Left`
                    });
                    validateGraphValueSource(results, pNode.condition.right, project, contexts, graph.id, {
                        ...locationInfo,
                        contextDesc: `Condition Right`
                    });
                }
            });
        });
    }

    return results;
};
