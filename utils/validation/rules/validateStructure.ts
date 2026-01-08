/**
 * utils/validation/rules/validateStructure.ts
 * 校验 Stage Tree, Puzzle Node, FSM, Presentation Graph 的结构完整性
 */

import { ValidationResult } from '../../../store/types';
import { ProjectData } from '../../../types/project';

export const validateStructure = (project: ProjectData): ValidationResult[] => {
    const results: ValidationResult[] = [];

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
                    objectType: 'STATE_MACHINE',
                    objectId: fsm.id,
                    contextId: ownerNode?.id,
                    location: location
                });
            } else if (!fsm.states[fsm.initialStateId]) {
                const ownerNode = Object.values(project.nodes).find(n => n.stateMachineId === fsm.id);
                const location = ownerNode ? `Node: ${ownerNode.name}` : `FSM: ${fsm.id}`;

                results.push({
                    id: `err-fsm-dangling-initial-${fsm.id}`,
                    level: 'error',
                    message: `State Machine Initial State references missing state: ${fsm.initialStateId}`,
                    objectType: 'STATE_MACHINE',
                    objectId: fsm.id,
                    contextId: ownerNode?.id,
                    location: location
                });
            } else if (fsm.states[fsm.initialStateId].state === 'MarkedForDelete') {
                const ownerNode = Object.values(project.nodes).find(n => n.stateMachineId === fsm.id);
                const location = ownerNode ? `Node: ${ownerNode.name}` : `FSM: ${fsm.id}`;

                results.push({
                    id: `err-fsm-del-initial-${fsm.id}`,
                    level: 'error',
                    message: `State Machine Initial State references state marked for delete: ${fsm.states[fsm.initialStateId].name}`,
                    objectType: 'STATE_MACHINE',
                    objectId: fsm.id,
                    contextId: ownerNode?.id,
                    location: location
                });
            }
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
            } else if (childStage.state === 'MarkedForDelete') {
                results.push({
                    id: `err-stage-child-del-${stage.id}-${childId}`,
                    level: 'error',
                    message: `Stage "${stage.name}" references child stage marked for delete: ${childStage.name}`,
                    objectType: 'STAGE',
                    objectId: stage.id,
                    location: `Stage: ${stage.name}`
                });
            }
        });
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
            } else if (parentStage.state === 'MarkedForDelete') {
                results.push({
                    id: `err-node-stage-del-${node.id}`,
                    level: 'error',
                    message: `Puzzle Node "${node.name}" belongs to stage marked for delete: ${parentStage.name}`,
                    objectType: 'NODE',
                    objectId: node.id,
                    location: `Node: ${node.name}`
                });
            }
        }
    });

    // 5. Presentation Graph Edge Integrity
    Object.values(project.presentationGraphs || {}).forEach(graph => {
        Object.values(graph.nodes || {}).forEach(pNode => {
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
                // Nodes inside graph structure usually don't have individual 'MarkedForDelete', they are just present or not. 
                // If the design adds soft-delete for nodes, check here. Assuming 'Entity' has no state, or we check common type.
                // PresentationNode extends Entity, Entity doesn't have 'state'. ResourceState is on Resource types.
                // So we skip MarkedForDelete check for internal graph nodes for now unless schemas change.
            });
        });
    });

    return results;
};
