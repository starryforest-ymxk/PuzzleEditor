/**
 * utils/validation/rules/validateStructure.ts
 * 校验 Stage Tree, Puzzle Node, FSM, Presentation Graph 的结构完整性
 */

import { ValidationResult } from '../../../store/types';
import { ProjectData } from '../../../types/project';

export const validateStructure = (project: ProjectData): ValidationResult[] => {
    const results: ValidationResult[] = [];

    // --- 0. Root Stage Initial Check ---
    const rootId = project.stageTree.rootId;
    const rootStage = project.stageTree.stages[rootId];
    if (rootStage && !rootStage.isInitial) {
        results.push({
            id: `err-root-not-initial-${rootId}`,
            level: 'error',
            message: `Root Stage "${rootStage.name}" must be marked as Initial.`,
            objectType: 'STAGE',
            objectId: rootId,
            location: `Stage: ${rootStage.name}`
        });
    }

    // --- 1. Puzzle Node & FSM Check ---
    Object.values(project.nodes).forEach(node => {
        const fsm = project.stateMachines[node.stateMachineId];
        if (!fsm) {
            // Should not happen if data integrity is kept, but good to check
            results.push({
                id: `err-node-no-fsm-${node.id}`,
                level: 'error',
                message: `Puzzle Node "${node.name}" references missing FSM: ${node.stateMachineId}.`,
                objectType: 'NODE',
                objectId: node.id,
                location: `Node: ${node.name}`
            });
            return;
        }

        // FSM Initial State Check
        const hasStates = Object.keys(fsm.states || {}).length > 0;
        if (hasStates && !fsm.initialStateId) {
            results.push({
                id: `err-node-no-init-${node.id}`,
                level: 'error',
                message: `Puzzle Node "${node.name}" has states but no Initial State set.`,
                objectType: 'NODE',
                objectId: node.id,
                location: `Node: ${node.name}`
            });
        }
    });

    // --- 2. Presentation Graph Check ---
    Object.values(project.presentationGraphs).forEach(graph => {
        if (Object.keys(graph.nodes).length > 0) {
            if (!graph.startNodeId) {
                results.push({
                    id: `err-graph-no-start-${graph.id}`,
                    level: 'error',
                    message: `Presentation Graph "${graph.name}" has nodes but no Start Node.`,
                    objectType: 'PRESENTATION_GRAPH',
                    objectId: graph.id,
                    location: `Graph: ${graph.name}`
                });
            } else if (!graph.nodes[graph.startNodeId]) {
                results.push({
                    id: `err-graph-dangling-start-${graph.id}`,
                    level: 'error',
                    message: `Presentation Graph "${graph.name}" start node references missing node: ${graph.startNodeId}`,
                    objectType: 'PRESENTATION_GRAPH',
                    objectId: graph.id,
                    location: `Graph: ${graph.name}`
                });
            }
        }
    });

    // 2. State Machine Checks
    // 2.1 Initial State
    Object.values(project.stateMachines || {}).forEach(fsm => {
        // Skip if FSM has no states (empty FSM might be valid or WIP)
        const stateCount = Object.keys(fsm.states || {}).length;
        if (stateCount > 0) {
            if (!fsm.initialStateId) {
                // Find which node uses this FSM for better error context
                const ownerNode = Object.values(project.nodes).find(n => n.stateMachineId === fsm.id);
                const location = ownerNode ? `Node: ${ownerNode.name}` : `FSM: ${fsm.id}`;

                results.push({
                    id: `err-fsm-no-initial-${fsm.id}`,
                    level: 'error',
                    message: `State Machine has states but no Initial State set.`,
                    objectType: 'NODE',
                    objectId: ownerNode?.id || fsm.id,
                    contextId: fsm.id,
                    location: location
                });
            } else if (!fsm.states[fsm.initialStateId]) {
                const ownerNode = Object.values(project.nodes).find(n => n.stateMachineId === fsm.id);
                const location = ownerNode ? `Node: ${ownerNode.name}` : `FSM: ${fsm.id}`;

                results.push({
                    id: `err-fsm-dangling-initial-${fsm.id}`,
                    level: 'error',
                    message: `State Machine Initial State references missing state: ${fsm.initialStateId}`,
                    objectType: 'NODE',
                    objectId: ownerNode?.id || fsm.id,
                    contextId: fsm.id,
                    location: location
                });
            }
            // 注：FSM State 没有 ResourceState，不支持软删除检查
        }
    });

    // 3. Stage Tree Integrity
    Object.values(project.stageTree.stages).forEach(stage => {
        // Check Children Refs
        stage.childrenIds?.forEach(childId => {
            const childStage = project.stageTree.stages[childId];
            if (!childStage) {
                results.push({
                    id: `err-stage-child-missing-${stage.id}-${childId}`,
                    level: 'error',
                    message: `Stage "${stage.name}" references missing child stage: ${childId}`,
                    objectType: 'STAGE',
                    objectId: stage.id,
                    location: `Stage: ${stage.name}`
                });
            }
            // 注：StageNode 没有 ResourceState，不支持软删除检查
        });

        // Check Unlock Triggers (Non-Initial Stage must have triggers)
        if (!stage.isInitial && (!stage.unlockTriggers || stage.unlockTriggers.length === 0)) {
            results.push({
                id: `err-stage-no-unlock-trigger-${stage.id}`,
                level: 'error',
                message: `Stage "${stage.name}" is not initial but has no Unlock Triggers. It will never be unlocked.`,
                objectType: 'STAGE',
                objectId: stage.id,
                location: `Stage: ${stage.name}`
            });
        }
    });

    // 4. Node Ownership Integrity
    Object.values(project.nodes).forEach(node => {
        if (node.stageId) {
            const parentStage = project.stageTree.stages[node.stageId];
            if (!parentStage) {
                results.push({
                    id: `err-node-stage-missing-${node.id}`,
                    level: 'error',
                    message: `Puzzle Node "${node.name}" belongs to missing stage: ${node.stageId}`,
                    objectType: 'NODE',
                    objectId: node.id,
                    location: `Node: ${node.name}`
                });
            }
            // 注：StageNode 没有 ResourceState，不支持软删除检查
        }
    });

    // 5. Structure & Transition Logic Check
    Object.values(project.stateMachines || {}).forEach(fsm => {
        // Calculate in-degrees for FSM
        const inDegrees = new Map<string, number>();
        Object.keys(fsm.states || {}).forEach(id => inDegrees.set(id, 0));
        Object.values(fsm.transitions || {}).forEach(trans => {
            if (trans.toStateId && inDegrees.has(trans.toStateId)) {
                inDegrees.set(trans.toStateId, (inDegrees.get(trans.toStateId) || 0) + 1);
            }
        });

        // Check Unreachable States
        Object.values(fsm.states || {}).forEach(state => {
            if (state.id !== fsm.initialStateId && (inDegrees.get(state.id) || 0) === 0) {
                const ownerNode = Object.values(project.nodes).find(n => n.stateMachineId === fsm.id);
                const location = ownerNode ? `Node: ${ownerNode.name} > State: ${state.name}` : `FSM: ${fsm.id} > State: ${state.name}`;
                results.push({
                    id: `warn-fsm-unreachable-${fsm.id}-${state.id}`,
                    level: 'warning',
                    message: `State "${state.name}" is unreachable (no incoming transitions).`,
                    objectType: 'NODE', // FSM States are part of Node logic
                    objectId: ownerNode?.id || state.id,
                    contextId: fsm.id,
                    location: location
                });
            }
        });

        Object.values(fsm.transitions || {}).forEach(trans => {
            if (!trans.triggers || trans.triggers.length === 0) {
                // Try to resolve context for better error message
                const ownerNode = Object.values(project.nodes).find(n => n.stateMachineId === fsm.id);
                const fromState = fsm.states[trans.fromStateId];
                const fromStateName = fromState ? fromState.name : trans.fromStateId;
                const location = ownerNode
                    ? `Node: ${ownerNode.name} > State: ${fromStateName} > Transition`
                    : `FSM: ${fsm.id} > Transition: ${trans.id}`;

                results.push({
                    id: `err-trans-no-trigger-${trans.id}`,
                    level: 'error',
                    message: `Transition details: State "${fromStateName}" -> Target has no Triggers. It will never evaluate.`,
                    objectType: 'TRANSITION',
                    objectId: trans.id,
                    contextId: fsm.id,
                    location: location
                });
            }
        });
    });

    // 6. Presentation Graph Edge Integrity
    Object.values(project.presentationGraphs || {}).forEach(graph => {
        // Calculate in-degrees for Graph
        const inDegrees = new Map<string, number>();
        Object.keys(graph.nodes || {}).forEach(id => inDegrees.set(id, 0));
        Object.values(graph.nodes || {}).forEach(node => {
            node.nextIds.forEach(targetId => {
                if (targetId && inDegrees.has(targetId)) {
                    inDegrees.set(targetId, (inDegrees.get(targetId) || 0) + 1);
                }
            });
        });

        Object.values(graph.nodes || {}).forEach(pNode => {
            // Check Unreachable Nodes
            if (pNode.id !== graph.startNodeId && (inDegrees.get(pNode.id) || 0) === 0) {
                results.push({
                    id: `warn-pres-unreachable-${graph.id}-${pNode.id}`,
                    level: 'warning',
                    message: `Presentation Node "${pNode.name || pNode.id}" is unreachable (no incoming connections).`,
                    objectType: 'PRESENTATION_GRAPH',
                    objectId: graph.id,
                    location: `Graph: ${graph.name || graph.id} > Node: ${pNode.name || pNode.id}`
                });
            }

            // Check Multiple Outgoing Edges for non-Branch/Parallel
            if (pNode.type !== 'Branch' && pNode.type !== 'Parallel') {
                const validOutputs = pNode.nextIds?.filter(id => !!id) || [];
                if (validOutputs.length > 1) {
                    results.push({
                        id: `warn-pres-multi-out-${graph.id}-${pNode.id}`,
                        level: 'warning',
                        message: `Node "${pNode.name || pNode.id}" has multiple outgoing edges. Only the first will be executed.`,
                        objectType: 'PRESENTATION_GRAPH',
                        objectId: graph.id,
                        location: `Graph: ${graph.name || graph.id} > Node: ${pNode.name || pNode.id}`
                    });
                }
            }

            // Logic Integrity: Branch Node must have condition
            if (pNode.type === 'Branch' && !pNode.condition) {
                results.push({
                    id: `warn-pres-branch-no-cond-${graph.id}-${pNode.id}`,
                    level: 'warning',
                    message: `Branch Node "${pNode.name || pNode.id}" has no condition defined (defaults to True).`,
                    objectType: 'PRESENTATION_GRAPH',
                    objectId: graph.id,
                    location: `Graph: ${graph.name || graph.id} > Node: ${pNode.name || pNode.id}`
                });
            }
            // Graph Nodes generally don't have separate state from the graph def in this editor, but 'nextIds' point to other nodes in same graph
            pNode.nextIds?.forEach(nextId => {
                const targetNode = graph.nodes[nextId];
                if (!targetNode) {
                    results.push({
                        id: `err-pres-edge-missing-${graph.id}-${pNode.id}-${nextId}`,
                        level: 'error',
                        message: `Presentation Node "${pNode.name || pNode.id}" connects to missing node: ${nextId}`,
                        objectType: 'PRESENTATION_GRAPH',
                        objectId: graph.id,
                        location: `Graph: ${graph.name || graph.id} > Node: ${pNode.name || pNode.id}`
                    });
                }
            });
        });
    });

    return results;
};
