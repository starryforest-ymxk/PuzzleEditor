/**
 * utils/validation/rules/validateStructure.ts
 * 校验 Stage Tree, Puzzle Node, FSM, Presentation Graph 的结构完整性
 * 
 * 对应后端校验规则：
 * #9-#14: StageTree 结构校验
 * #15-#18: Node 关联校验
 * #19-#25: FSM 结构校验
 * #26-#32: 演出图结构校验
 */

import { ValidationResult } from '../../../store/types';
import { ProjectData } from '../../../types/project';
import { findNodeByFsmId } from '../../puzzleNodeUtils';

export const validateStructure = (project: ProjectData): ValidationResult[] => {
    const results: ValidationResult[] = [];

    // =========================================================================
    // 0. Root Stage Initial Check (前端额外校验)
    // =========================================================================
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

    // =========================================================================
    // 1. Stage Tree Integrity — 后端 #8-#14
    // =========================================================================

    // #9: StageTree has no stages
    const allStages = Object.values(project.stageTree.stages);
    if (allStages.length === 0) {
        results.push({
            id: 'err-stagetree-no-stages',
            level: 'error',
            message: 'StageTree has no stages.',
            objectType: 'STAGE',
            objectId: 'stageTree',
            location: 'StageTree'
        });
    }

    // #10: StageTree rootId is empty
    if (!project.stageTree.rootId) {
        results.push({
            id: 'err-stagetree-no-rootid',
            level: 'error',
            message: 'StageTree rootId is empty.',
            objectType: 'STAGE',
            objectId: 'stageTree',
            location: 'StageTree'
        });
    }

    // #11: rootId 指向不存在的 Stage
    if (project.stageTree.rootId && !project.stageTree.stages[project.stageTree.rootId]) {
        results.push({
            id: `err-stagetree-root-missing-${project.stageTree.rootId}`,
            level: 'error',
            message: `StageTree rootId '${project.stageTree.rootId}' not found in stages.`,
            objectType: 'STAGE',
            objectId: project.stageTree.rootId,
            location: 'StageTree'
        });
    }

    // 遍历每个 Stage 做结构检查
    allStages.forEach(stage => {
        // #12: parentId 指向不存在的 Stage
        if (stage.parentId && !project.stageTree.stages[stage.parentId]) {
            results.push({
                id: `err-stage-parent-missing-${stage.id}`,
                level: 'error',
                message: `Stage "${stage.name}" references missing parent stage: ${stage.parentId}`,
                objectType: 'STAGE',
                objectId: stage.id,
                location: `Stage: ${stage.name}`
            });
        }

        // #13: childrenIds 中不存在的 Stage
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
        });

        // 前端额外：非 Initial Stage 必须有 Unlock Triggers
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

    // #14: Stage 树循环检测（从 rootId 开始 DFS）
    if (project.stageTree.rootId && project.stageTree.stages[project.stageTree.rootId]) {
        const visited = new Set<string>();
        const inStack = new Set<string>();
        let cycleFound = false;

        const detectStageCycle = (stageId: string) => {
            if (cycleFound) return;
            if (inStack.has(stageId)) {
                cycleFound = true;
                results.push({
                    id: `err-stagetree-cycle-${stageId}`,
                    level: 'error',
                    message: `Cycle detected in stage tree at stage: ${project.stageTree.stages[stageId]?.name || stageId}`,
                    objectType: 'STAGE',
                    objectId: stageId,
                    location: 'StageTree'
                });
                return;
            }
            if (visited.has(stageId)) return;

            visited.add(stageId);
            inStack.add(stageId);

            const stage = project.stageTree.stages[stageId];
            if (stage?.childrenIds) {
                for (const childId of stage.childrenIds) {
                    if (project.stageTree.stages[childId]) {
                        detectStageCycle(childId);
                    }
                }
            }
            inStack.delete(stageId);
        };

        detectStageCycle(project.stageTree.rootId);
    }

    // =========================================================================
    // 2. Puzzle Node & FSM Check — 后端 #15-#21
    // =========================================================================
    Object.values(project.nodes).forEach(node => {
        // #15: Node 缺少 stageId
        if (!node.stageId) {
            results.push({
                id: `err-node-no-stageid-${node.id}`,
                level: 'error',
                message: `Puzzle Node "${node.name}" has no stageId.`,
                objectType: 'NODE',
                objectId: node.id,
                location: `Node: ${node.name}`
            });
        }

        // #16: Node stageId 指向不存在的 Stage
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
        }

        // #17: Node 没有关联状态机（Warning）
        if (!node.stateMachineId) {
            results.push({
                id: `warn-node-no-fsm-${node.id}`,
                level: 'warning',
                message: `Puzzle Node "${node.name}" has no stateMachineId.`,
                objectType: 'NODE',
                objectId: node.id,
                location: `Node: ${node.name}`
            });
            return;
        }

        // #18: FSM 不存在
        const fsm = project.stateMachines[node.stateMachineId];
        if (!fsm) {
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

        // FSM Initial State Check（在 Node 上下文中显示）
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

    // =========================================================================
    // 3. State Machine Checks — 后端 #19-#25
    // =========================================================================
    Object.values(project.stateMachines || {}).forEach(fsm => {
        const stateCount = Object.keys(fsm.states || {}).length;
        const ownerNode = findNodeByFsmId(project.nodes, fsm.id);
        const fsmLocation = ownerNode ? `Node: ${ownerNode.name}` : `FSM: ${fsm.id}`;

        // #19: FSM has no states（跳过空 FSM，仅当有状态时继续后续校验）

        if (stateCount > 0) {
            // #20: FSM 缺少 initialStateId
            if (!fsm.initialStateId) {
                results.push({
                    id: `err-fsm-no-initial-${fsm.id}`,
                    level: 'error',
                    message: `State Machine has states but no Initial State set.`,
                    objectType: 'NODE',
                    objectId: ownerNode?.id || fsm.id,
                    contextId: fsm.id,
                    location: fsmLocation
                });
            } else if (!fsm.states[fsm.initialStateId]) {
                // #21: initialStateId 指向不存在的状态
                results.push({
                    id: `err-fsm-dangling-initial-${fsm.id}`,
                    level: 'error',
                    message: `State Machine Initial State references missing state: ${fsm.initialStateId}`,
                    objectType: 'NODE',
                    objectId: ownerNode?.id || fsm.id,
                    contextId: fsm.id,
                    location: fsmLocation
                });
            }
        }

        // Transition 校验
        Object.values(fsm.transitions || {}).forEach(trans => {
            const fromState = fsm.states[trans.fromStateId];
            const fromStateName = fromState ? fromState.name : trans.fromStateId;
            const transLocation = ownerNode
                ? `Node: ${ownerNode.name} > State: ${fromStateName} > Transition`
                : `FSM: ${fsm.id} > Transition: ${trans.id}`;

            // #22: Transition 缺少 fromStateId
            if (!trans.fromStateId) {
                results.push({
                    id: `err-trans-no-from-${trans.id}`,
                    level: 'error',
                    message: `Transition has no fromStateId.`,
                    objectType: 'TRANSITION',
                    objectId: trans.id,
                    contextId: fsm.id,
                    location: transLocation
                });
            }

            // #23: fromState 不存在
            if (trans.fromStateId && !fsm.states[trans.fromStateId]) {
                results.push({
                    id: `err-trans-from-missing-${trans.id}`,
                    level: 'error',
                    message: `Transition fromState '${trans.fromStateId}' not found.`,
                    objectType: 'TRANSITION',
                    objectId: trans.id,
                    contextId: fsm.id,
                    location: transLocation
                });
            }

            // #24: Transition 缺少 toStateId
            if (!trans.toStateId) {
                results.push({
                    id: `err-trans-no-to-${trans.id}`,
                    level: 'error',
                    message: `Transition has no toStateId.`,
                    objectType: 'TRANSITION',
                    objectId: trans.id,
                    contextId: fsm.id,
                    location: transLocation
                });
            }

            // 前端额外：Transition 没有触发器
            if (!trans.triggers || trans.triggers.length === 0) {
                results.push({
                    id: `err-trans-no-trigger-${trans.id}`,
                    level: 'error',
                    message: `Transition details: State "${fromStateName}" -> Target has no Triggers. It will never evaluate.`,
                    objectType: 'TRANSITION',
                    objectId: trans.id,
                    contextId: fsm.id,
                    location: transLocation
                });
            }
        });

        // 前端额外：计算入度，检测不可达状态
        const inDegrees = new Map<string, number>();
        Object.keys(fsm.states || {}).forEach(id => inDegrees.set(id, 0));
        Object.values(fsm.transitions || {}).forEach(trans => {
            if (trans.toStateId && inDegrees.has(trans.toStateId)) {
                inDegrees.set(trans.toStateId, (inDegrees.get(trans.toStateId) || 0) + 1);
            }
        });

        Object.values(fsm.states || {}).forEach(state => {
            if (state.id !== fsm.initialStateId && (inDegrees.get(state.id) || 0) === 0) {
                const location = ownerNode ? `Node: ${ownerNode.name} > State: ${state.name}` : `FSM: ${fsm.id} > State: ${state.name}`;
                results.push({
                    id: `warn-fsm-unreachable-${fsm.id}-${state.id}`,
                    level: 'warning',
                    message: `State "${state.name}" is unreachable (no incoming transitions).`,
                    objectType: 'NODE',
                    objectId: ownerNode?.id || state.id,
                    contextId: fsm.id,
                    location: location
                });
            }
        });
    });

    // =========================================================================
    // 4. Presentation Graph Check — 后端 #26-#32
    // =========================================================================
    Object.values(project.presentationGraphs || {}).forEach(graph => {
        const nodeCount = Object.keys(graph.nodes || {}).length;

        // #26: 演出图没有节点（Warning）
        if (nodeCount === 0) {
            results.push({
                id: `warn-graph-no-nodes-${graph.id}`,
                level: 'warning',
                message: `Presentation Graph "${graph.name}" has no nodes.`,
                objectType: 'PRESENTATION_GRAPH',
                objectId: graph.id,
                location: `Graph: ${graph.name}`
            });
        }

        if (nodeCount > 0) {
            // #27: 缺少 startNodeId
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
                // #28: startNodeId 指向不存在的节点
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

        // 计算入度
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
            const nodeLocation = `Graph: ${graph.name || graph.id} > Node: ${pNode.name || pNode.id}`;

            // #29: 节点缺少 type
            if (!pNode.type) {
                results.push({
                    id: `err-pres-node-no-type-${graph.id}-${pNode.id}`,
                    level: 'error',
                    message: `Presentation Node "${pNode.name || pNode.id}" has no type.`,
                    objectType: 'PRESENTATION_GRAPH',
                    objectId: graph.id,
                    location: nodeLocation
                });
            }

            // #30: nextIds 中引用不存在的节点
            pNode.nextIds?.forEach(nextId => {
                if (nextId && !graph.nodes[nextId]) {
                    results.push({
                        id: `err-pres-edge-missing-${graph.id}-${pNode.id}-${nextId}`,
                        level: 'error',
                        message: `Presentation Node "${pNode.name || pNode.id}" connects to missing node: ${nextId}`,
                        objectType: 'PRESENTATION_GRAPH',
                        objectId: graph.id,
                        location: nodeLocation
                    });
                }
            });

            // #31: Branch 节点的 nextIds 不足 2（Warning）
            if (pNode.type === 'Branch') {
                const validNextIds = pNode.nextIds?.filter(id => !!id) || [];
                if (validNextIds.length < 2) {
                    results.push({
                        id: `warn-pres-branch-few-nexts-${graph.id}-${pNode.id}`,
                        level: 'warning',
                        message: `Branch Node "${pNode.name || pNode.id}" should have 2 nextIds (true/false branches), but has ${validNextIds.length}.`,
                        objectType: 'PRESENTATION_GRAPH',
                        objectId: graph.id,
                        location: nodeLocation
                    });
                }
            }

            // 前端额外：不可达节点
            if (pNode.id !== graph.startNodeId && (inDegrees.get(pNode.id) || 0) === 0) {
                results.push({
                    id: `warn-pres-unreachable-${graph.id}-${pNode.id}`,
                    level: 'warning',
                    message: `Presentation Node "${pNode.name || pNode.id}" is unreachable (no incoming connections).`,
                    objectType: 'PRESENTATION_GRAPH',
                    objectId: graph.id,
                    location: nodeLocation
                });
            }

            // 前端额外：非 Branch/Parallel 多出边
            if (pNode.type !== 'Branch' && pNode.type !== 'Parallel') {
                const validOutputs = pNode.nextIds?.filter(id => !!id) || [];
                if (validOutputs.length > 1) {
                    results.push({
                        id: `warn-pres-multi-out-${graph.id}-${pNode.id}`,
                        level: 'warning',
                        message: `Node "${pNode.name || pNode.id}" has multiple outgoing edges. Only the first will be executed.`,
                        objectType: 'PRESENTATION_GRAPH',
                        objectId: graph.id,
                        location: nodeLocation
                    });
                }
            }

            // 前端额外：Branch 节点无条件
            if (pNode.type === 'Branch' && !pNode.condition) {
                results.push({
                    id: `warn-pres-branch-no-cond-${graph.id}-${pNode.id}`,
                    level: 'warning',
                    message: `Branch Node "${pNode.name || pNode.id}" has no condition defined (defaults to True).`,
                    objectType: 'PRESENTATION_GRAPH',
                    objectId: graph.id,
                    location: nodeLocation
                });
            }
        });

        // #32: 演出图循环检测（Warning）
        if (nodeCount > 0 && graph.startNodeId && graph.nodes[graph.startNodeId]) {
            const visited = new Set<string>();
            const inStack = new Set<string>();
            let cycleDetected = false;

            const detectGraphCycle = (nodeId: string) => {
                if (cycleDetected) return;
                if (inStack.has(nodeId)) {
                    cycleDetected = true;
                    return;
                }
                if (visited.has(nodeId)) return;

                visited.add(nodeId);
                inStack.add(nodeId);

                const node = graph.nodes[nodeId];
                if (node?.nextIds) {
                    for (const nextId of node.nextIds) {
                        if (nextId && graph.nodes[nextId]) {
                            detectGraphCycle(nextId);
                        }
                    }
                }
                inStack.delete(nodeId);
            };

            detectGraphCycle(graph.startNodeId);

            if (cycleDetected) {
                results.push({
                    id: `warn-graph-cycle-${graph.id}`,
                    level: 'warning',
                    message: `Cycle detected in Presentation Graph "${graph.name}" (may be intentional for looping animations).`,
                    objectType: 'PRESENTATION_GRAPH',
                    objectId: graph.id,
                    location: `Graph: ${graph.name}`
                });
            }
        }
    });

    return results;
};
