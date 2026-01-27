/**
 * Project Reducer 切片
 * 处理与项目数据相关的基础操作：Stage 树更新、Node 更新、Stage CRUD
 */

import { EditorState, Action } from '../types';
import { StageTreeData, StageNode } from '../../types/stage';
import { PuzzleNode } from '../../types/puzzleNode';
import { StateMachine } from '../../types/stateMachine';
import { VariableDefinition } from '../../types/blackboard';
import { StageId, VariableId, PuzzleNodeId, StateMachineId } from '../../types/common';
import { getDescendantStageIds, getStageNodeIds } from '../../utils/stageTreeUtils';

// ========== Project 相关 Actions 类型定义 ==========
export type ProjectAction =
    // 原有的整树更新和节点更新
    | { type: 'UPDATE_STAGE_TREE'; payload: StageTreeData }
    | { type: 'UPDATE_NODE'; payload: { nodeId: string; data: Partial<PuzzleNode> } }
    // Stage CRUD 操作
    | { type: 'ADD_STAGE'; payload: { parentId: StageId; afterStageId?: StageId; stage: StageNode } }
    | { type: 'DELETE_STAGE'; payload: { stageId: StageId } }
    | { type: 'UPDATE_STAGE'; payload: { stageId: StageId; data: Partial<StageNode> } }
    | { type: 'REORDER_STAGE'; payload: { stageId: StageId; newIndex: number } }
    | { type: 'MOVE_STAGE'; payload: { stageId: StageId; newParentId: StageId; insertIndex?: number } }
    // Stage Local Variable 操作
    | { type: 'ADD_STAGE_VARIABLE'; payload: { stageId: StageId; variable: VariableDefinition } }
    | { type: 'UPDATE_STAGE_VARIABLE'; payload: { stageId: StageId; varId: VariableId; data: Partial<VariableDefinition> } }
    | { type: 'DELETE_STAGE_VARIABLE'; payload: { stageId: StageId; varId: VariableId } }
    // PuzzleNode CRUD 操作 (P4-T03)
    | { type: 'ADD_PUZZLE_NODE'; payload: { stageId: StageId; node: PuzzleNode; stateMachine: StateMachine } }
    | { type: 'DELETE_PUZZLE_NODE'; payload: { nodeId: PuzzleNodeId } }
    | { type: 'REORDER_PUZZLE_NODES'; payload: { stageId: StageId; nodeIds: PuzzleNodeId[] } }
    // 外部分件同步 (P4-T06)
    | { type: 'SYNC_RESOURCE_STATES'; payload: import('../../types/project').ProjectData };

// ========== 类型守卫：判断是否为 Project Action ==========
export const isProjectAction = (action: Action): action is ProjectAction => {
    const projectActionTypes = [
        'UPDATE_STAGE_TREE',
        'UPDATE_NODE',
        'ADD_STAGE',
        'DELETE_STAGE',
        'UPDATE_STAGE',
        'REORDER_STAGE',
        'MOVE_STAGE',
        'ADD_STAGE_VARIABLE',
        'UPDATE_STAGE_VARIABLE',
        'DELETE_STAGE_VARIABLE',
        // PuzzleNode CRUD (P4-T03)
        'ADD_PUZZLE_NODE',
        'DELETE_PUZZLE_NODE',
        'REORDER_PUZZLE_NODES',
        'SYNC_RESOURCE_STATES'
    ];
    return projectActionTypes.includes(action.type);
};

// ========== Helper Functions ==========

/**
 * 助手函数：更新父节点下的一组子节点的初始状态
 * 约束：父节点的第一个子节点必须是 Initial Stage，且没有解锁条件；其他子节点非 Initial。
 * 返回更新后的 stages 对象（如果不需更新则返回原对象）
 */
const updateInitialStatusByParent = (
    stages: Record<string, StageNode>,
    parentId: StageId
): Record<string, StageNode> => {
    const parent = stages[parentId];
    if (!parent || parent.childrenIds.length === 0) return stages;

    let hasChanges = false;
    const newStages = { ...stages };

    // 遍历所有子节点
    parent.childrenIds.forEach((childId, index) => {
        const child = newStages[childId];
        if (!child) return;

        if (index === 0) {
            // 第一个子节点：必须是 isInitial=true，且无解锁条件
            if (!child.isInitial || (child.unlockTriggers && child.unlockTriggers.length > 0) || child.unlockCondition) {
                newStages[childId] = {
                    ...child,
                    isInitial: true,
                    unlockTriggers: [],
                    unlockCondition: undefined
                };
                hasChanges = true;
            }
        } else {
            // 其他子节点：必须是 isInitial=false
            if (child.isInitial) {
                newStages[childId] = {
                    ...child,
                    isInitial: false
                };
                hasChanges = true;
            }
        }
    });

    return hasChanges ? newStages : stages;
};

// ========== Project Reducer ==========
export const projectReducer = (state: EditorState, action: ProjectAction): EditorState => {
    switch (action.type) {
        // 整树更新（兼容旧逻辑）
        case 'UPDATE_STAGE_TREE':
            return {
                ...state,
                project: { ...state.project, stageTree: action.payload }
            };

        // 更新单个 PuzzleNode
        case 'UPDATE_NODE': {
            const node = state.project.nodes[action.payload.nodeId];
            if (!node) return state;
            return {
                ...state,
                project: {
                    ...state.project,
                    nodes: {
                        ...state.project.nodes,
                        [action.payload.nodeId]: { ...node, ...action.payload.data }
                    }
                }
            };
        }

        // ========== Stage CRUD ==========

        // 添加新 Stage
        case 'ADD_STAGE': {
            const { parentId, afterStageId, stage } = action.payload;
            const parent = state.project.stageTree.stages[parentId];
            if (!parent) return state;

            // 计算插入位置
            let newChildrenIds = [...parent.childrenIds];
            if (afterStageId) {
                const afterIndex = newChildrenIds.indexOf(afterStageId);
                if (afterIndex !== -1) {
                    newChildrenIds.splice(afterIndex + 1, 0, stage.id);
                } else {
                    newChildrenIds.push(stage.id);
                }
            } else {
                newChildrenIds.push(stage.id);
            }

            const intermediateStages = {
                ...state.project.stageTree.stages,
                [parentId]: { ...parent, childrenIds: newChildrenIds },
                [stage.id]: { ...stage, parentId }
            };

            const finalStages = updateInitialStatusByParent(intermediateStages, parentId);

            return {
                ...state,
                project: {
                    ...state.project,
                    stageTree: {
                        ...state.project.stageTree,
                        stages: finalStages
                    }
                }
            };
        }

        // 删除 Stage（递归删除子 Stage 和相关 PuzzleNode）
        case 'DELETE_STAGE': {
            const { stageId } = action.payload;
            const stage = state.project.stageTree.stages[stageId];
            if (!stage || !stage.parentId) return state; // 不允许删除根节点

            // 获取所有需要删除的 Stage（包括后代）
            const descendantIds = getDescendantStageIds(state.project.stageTree, stageId);
            const allStageIdsToDelete = [stageId, ...descendantIds];

            // 获取所有需要删除的 PuzzleNode
            const nodeIdsToDelete: string[] = [];
            allStageIdsToDelete.forEach(sid => {
                const nodeIds = getStageNodeIds(state.project.nodes, sid);
                nodeIdsToDelete.push(...nodeIds);
            });

            // 获取所有需要删除的 StateMachine
            const fsmIdsToDelete: string[] = [];
            nodeIdsToDelete.forEach(nodeId => {
                const node = state.project.nodes[nodeId];
                if (node?.stateMachineId) {
                    fsmIdsToDelete.push(node.stateMachineId);
                }
            });

            // 创建新的 stages 对象，移除所有待删除的 Stage
            const newStages = { ...state.project.stageTree.stages };
            allStageIdsToDelete.forEach(id => {
                delete newStages[id];
            });

            // 更新父节点的 childrenIds
            const parentStage = newStages[stage.parentId];
            let finalStages = newStages;

            if (parentStage) {
                newStages[stage.parentId] = {
                    ...parentStage,
                    childrenIds: parentStage.childrenIds.filter(id => id !== stageId)
                };
                // 更新父节点的子节点初始状态
                finalStages = updateInitialStatusByParent(newStages, stage.parentId);
            }

            // 创建新的 nodes 对象，移除所有待删除的 PuzzleNode
            const newNodes = { ...state.project.nodes };
            nodeIdsToDelete.forEach(id => {
                delete newNodes[id];
            });

            // 创建新的 stateMachines 对象，移除所有待删除的 FSM
            const newStateMachines = { ...state.project.stateMachines };
            fsmIdsToDelete.forEach(id => {
                delete newStateMachines[id];
            });

            // 计算新的 UI 状态：如果当前选中的是被删除的 Stage 或其后代，需要切换到父节点
            const currentStageId = state.ui.currentStageId;
            const currentNodeId = state.ui.currentNodeId;
            const needsNavUpdate = currentStageId && allStageIdsToDelete.includes(currentStageId as StageId);
            const needsNodeClear = currentNodeId && nodeIdsToDelete.includes(currentNodeId);
            const needsSelectionClear =
                (state.ui.selection.type === 'STAGE' && state.ui.selection.id && allStageIdsToDelete.includes(state.ui.selection.id as StageId)) ||
                (state.ui.selection.type === 'NODE' && state.ui.selection.id && nodeIdsToDelete.includes(state.ui.selection.id));

            return {
                ...state,
                project: {
                    ...state.project,
                    stageTree: {
                        ...state.project.stageTree,
                        stages: finalStages
                    },
                    nodes: newNodes,
                    stateMachines: newStateMachines
                },
                ui: {
                    ...state.ui,
                    // 如果当前导航到的 Stage 被删除了，回退到父节点
                    currentStageId: needsNavUpdate ? stage.parentId : state.ui.currentStageId,
                    currentNodeId: needsNodeClear ? null : state.ui.currentNodeId,
                    // 如果当前选中的对象被删除了，切换选中到父节点
                    selection: needsSelectionClear
                        ? { type: 'STAGE' as const, id: stage.parentId, contextId: null }
                        : state.ui.selection
                }
            };
        }

        // 更新单个 Stage 属性
        case 'UPDATE_STAGE': {
            const { stageId, data } = action.payload;
            const stage = state.project.stageTree.stages[stageId];
            if (!stage) return state;

            // 确保 Initial Stage 没有任何解锁条件
            const updates = { ...data };
            if (updates.isInitial) {
                updates.unlockTriggers = [];
                updates.unlockCondition = undefined;
            }

            return {
                ...state,
                project: {
                    ...state.project,
                    stageTree: {
                        ...state.project.stageTree,
                        stages: {
                            ...state.project.stageTree.stages,
                            [stageId]: { ...stage, ...updates }
                        }
                    }
                }
            };
        }

        // 在同一父节点下调整 Stage 顺序
        case 'REORDER_STAGE': {
            const { stageId, newIndex } = action.payload;
            const stage = state.project.stageTree.stages[stageId];
            if (!stage || !stage.parentId) return state;

            const parent = state.project.stageTree.stages[stage.parentId];
            if (!parent) return state;

            const oldIndex = parent.childrenIds.indexOf(stageId);
            if (oldIndex === -1 || oldIndex === newIndex) return state;

            // 重新排序 childrenIds
            const newChildrenIds = [...parent.childrenIds];
            newChildrenIds.splice(oldIndex, 1);
            newChildrenIds.splice(newIndex, 0, stageId);

            const intermediateStages = {
                ...state.project.stageTree.stages,
                [stage.parentId]: { ...parent, childrenIds: newChildrenIds }
            };

            const finalStages = updateInitialStatusByParent(intermediateStages, stage.parentId);

            return {
                ...state,
                project: {
                    ...state.project,
                    stageTree: {
                        ...state.project.stageTree,
                        stages: finalStages
                    }
                }
            };
        }

        // 移动 Stage 到新的父节点
        case 'MOVE_STAGE': {
            const { stageId, newParentId, insertIndex } = action.payload;
            const stage = state.project.stageTree.stages[stageId];
            const oldParent = stage?.parentId ? state.project.stageTree.stages[stage.parentId] : null;
            const newParent = state.project.stageTree.stages[newParentId];

            if (!stage || !oldParent || !newParent) return state;
            if (stage.parentId === newParentId) return state; // 已在目标父节点下

            // 从旧父节点移除
            const oldChildrenIds = oldParent.childrenIds.filter(id => id !== stageId);

            // 添加到新父节点
            const newChildrenIds = [...newParent.childrenIds];
            if (insertIndex !== undefined && insertIndex >= 0) {
                newChildrenIds.splice(insertIndex, 0, stageId);
            } else {
                newChildrenIds.push(stageId);
            }

            const intermediateStages = {
                ...state.project.stageTree.stages,
                [stageId]: { ...stage, parentId: newParentId },
                [oldParent.id]: { ...oldParent, childrenIds: oldChildrenIds },
                [newParentId]: { ...newParent, childrenIds: newChildrenIds }
            };

            // 同时检查旧父节点（首节点可能变化）和新父节点
            let finalStages = updateInitialStatusByParent(intermediateStages, oldParent.id);
            finalStages = updateInitialStatusByParent(finalStages, newParentId);

            return {
                ...state,
                project: {
                    ...state.project,
                    stageTree: {
                        ...state.project.stageTree,
                        stages: finalStages
                    }
                }
            };
        }

        // ========== Stage Local Variable CRUD ==========

        // 添加 Stage 局部变量
        case 'ADD_STAGE_VARIABLE': {
            const { stageId, variable } = action.payload;
            const stage = state.project.stageTree.stages[stageId];
            if (!stage) return state;

            return {
                ...state,
                project: {
                    ...state.project,
                    stageTree: {
                        ...state.project.stageTree,
                        stages: {
                            ...state.project.stageTree.stages,
                            [stageId]: {
                                ...stage,
                                localVariables: {
                                    ...stage.localVariables,
                                    [variable.id]: variable
                                }
                            }
                        }
                    }
                }
            };
        }

        // 更新 Stage 局部变量
        case 'UPDATE_STAGE_VARIABLE': {
            const { stageId, varId, data } = action.payload;
            const stage = state.project.stageTree.stages[stageId];
            const variable = stage?.localVariables?.[varId];
            if (!stage || !variable) return state;

            return {
                ...state,
                project: {
                    ...state.project,
                    stageTree: {
                        ...state.project.stageTree,
                        stages: {
                            ...state.project.stageTree.stages,
                            [stageId]: {
                                ...stage,
                                localVariables: {
                                    ...stage.localVariables,
                                    [varId]: { ...variable, ...data }
                                }
                            }
                        }
                    }
                }
            };
        }

        // 删除 Stage 局部变量
        case 'DELETE_STAGE_VARIABLE': {
            const { stageId, varId } = action.payload;
            const stage = state.project.stageTree.stages[stageId];
            if (!stage || !stage.localVariables?.[varId]) return state;

            const { [varId]: removed, ...remainingVars } = stage.localVariables;

            return {
                ...state,
                project: {
                    ...state.project,
                    stageTree: {
                        ...state.project.stageTree,
                        stages: {
                            ...state.project.stageTree.stages,
                            [stageId]: {
                                ...stage,
                                localVariables: remainingVars
                            }
                        }
                    }
                }
            };
        }

        // ========== PuzzleNode CRUD (P4-T03) ==========

        // 添加新 PuzzleNode（同时添加关联的 StateMachine）
        case 'ADD_PUZZLE_NODE': {
            const { stageId, node, stateMachine } = action.payload;
            // 验证 Stage 存在
            if (!state.project.stageTree.stages[stageId]) return state;

            return {
                ...state,
                project: {
                    ...state.project,
                    nodes: {
                        ...state.project.nodes,
                        [node.id]: node
                    },
                    stateMachines: {
                        ...state.project.stateMachines,
                        [stateMachine.id]: stateMachine
                    }
                }
            };
        }

        // 删除 PuzzleNode（同时删除关联的 StateMachine）
        case 'DELETE_PUZZLE_NODE': {
            const { nodeId } = action.payload;
            const node = state.project.nodes[nodeId];
            if (!node) return state;

            // 获取关联的 StateMachine ID
            const fsmId = node.stateMachineId;

            // 创建新的 nodes 对象，移除目标节点
            const { [nodeId]: removedNode, ...remainingNodes } = state.project.nodes;

            // 创建新的 stateMachines 对象，移除关联的 FSM
            const newStateMachines = { ...state.project.stateMachines };
            if (fsmId && newStateMachines[fsmId]) {
                delete newStateMachines[fsmId];
            }

            // 计算新的 UI 状态
            const needsNodeClear = state.ui.currentNodeId === nodeId;
            const needsSelectionClear =
                state.ui.selection.type === 'NODE' && state.ui.selection.id === nodeId;

            return {
                ...state,
                project: {
                    ...state.project,
                    nodes: remainingNodes,
                    stateMachines: newStateMachines
                },
                ui: {
                    ...state.ui,
                    // 如果当前导航到该节点，回退到其所属 Stage
                    currentNodeId: needsNodeClear ? null : state.ui.currentNodeId,
                    // 如果当前选中该节点，切换到其所属 Stage
                    selection: needsSelectionClear
                        ? { type: 'STAGE' as const, id: node.stageId, contextId: null }
                        : state.ui.selection
                }
            };
        }

        // 重新排序 PuzzleNodes（更新 displayOrder）
        case 'REORDER_PUZZLE_NODES': {
            const { stageId, nodeIds } = action.payload;
            // 验证 Stage 存在
            if (!state.project.stageTree.stages[stageId]) return state;

            // 更新每个节点的 displayOrder
            const updatedNodes = { ...state.project.nodes };
            nodeIds.forEach((id, index) => {
                const node = updatedNodes[id as PuzzleNodeId];
                if (node && node.stageId === stageId) {
                    updatedNodes[id as PuzzleNodeId] = { ...node, displayOrder: index };
                }
            });

            return {
                ...state,
                project: {
                    ...state.project,
                    nodes: updatedNodes
                }
            };
        }

        // 同步外部资源状态 (P4-T06)
        case 'SYNC_RESOURCE_STATES': {
            const externalData = action.payload; // ProjectData
            const currentProject = state.project;

            // 1. 同步脚本状态
            const newScripts = { ...currentProject.scripts.scripts };
            let hasChanges = false;
            Object.keys(externalData.scripts.scripts).forEach((id) => {
                const scriptId = id as import('../../types/common').ScriptId;
                if (newScripts[scriptId] && newScripts[scriptId].state !== externalData.scripts.scripts[scriptId].state) {
                    newScripts[scriptId] = {
                        ...newScripts[scriptId],
                        state: externalData.scripts.scripts[scriptId].state
                    };
                    hasChanges = true;
                }
            });

            // 2. 同步全局变量状态
            const newGlobalVars = { ...currentProject.blackboard.globalVariables };
            Object.keys(externalData.blackboard.globalVariables).forEach((id) => {
                const varId = id as VariableId;
                if (newGlobalVars[varId] && newGlobalVars[varId].state !== externalData.blackboard.globalVariables[varId].state) {
                    newGlobalVars[varId] = {
                        ...newGlobalVars[varId],
                        state: externalData.blackboard.globalVariables[varId].state
                    };
                    hasChanges = true;
                }
            });

            // 3. 同步全局事件状态
            const newEvents = { ...currentProject.blackboard.events };
            Object.keys(externalData.blackboard.events).forEach((id) => {
                const evtId = id as import('../../types/common').EventId;
                if (newEvents[evtId] && newEvents[evtId].state !== externalData.blackboard.events[evtId].state) {
                    newEvents[evtId] = {
                        ...newEvents[evtId],
                        state: externalData.blackboard.events[evtId].state
                    };
                    hasChanges = true;
                }
            });

            // 4. 同步 Stage 局部变量状态
            const newStages = { ...currentProject.stageTree.stages };
            Object.keys(externalData.stageTree.stages).forEach((sId) => {
                const stageId = sId as StageId;
                const externalStage = externalData.stageTree.stages[stageId];
                const localStage = newStages[stageId];

                if (externalStage && localStage && externalStage.localVariables) {
                    const newLocalVars = { ...localStage.localVariables };
                    let stageChanged = false;

                    Object.keys(externalStage.localVariables).forEach((vId) => {
                        const varId = vId as VariableId;
                        if (newLocalVars[varId] && newLocalVars[varId].state !== externalStage.localVariables[varId].state) {
                            newLocalVars[varId] = {
                                ...newLocalVars[varId],
                                state: externalStage.localVariables[varId].state
                            };
                            stageChanged = true;
                            hasChanges = true;
                        }
                    });

                    if (stageChanged) {
                        newStages[stageId] = { ...localStage, localVariables: newLocalVars };
                    }
                }
            });

            // 5. 同步 Node 局部变量状态
            const newNodes = { ...currentProject.nodes };
            Object.keys(externalData.nodes).forEach((nId) => {
                const nodeId = nId as PuzzleNodeId;
                const externalNode = externalData.nodes[nodeId];
                const localNode = newNodes[nodeId];

                if (externalNode && localNode && externalNode.localVariables) {
                    const newLocalVars = { ...localNode.localVariables };
                    let nodeChanged = false;

                    Object.keys(externalNode.localVariables).forEach((vId) => {
                        const varId = vId as VariableId;
                        if (newLocalVars[varId] && newLocalVars[varId].state !== externalNode.localVariables[varId].state) {
                            newLocalVars[varId] = {
                                ...newLocalVars[varId],
                                state: externalNode.localVariables[varId].state
                            };
                            nodeChanged = true;
                            hasChanges = true;
                        }
                    });

                    if (nodeChanged) {
                        newNodes[nodeId] = { ...localNode, localVariables: newLocalVars };
                    }
                }
            });

            if (!hasChanges) return state;

            return {
                ...state,
                project: {
                    ...state.project,
                    scripts: { ...state.project.scripts, scripts: newScripts },
                    blackboard: {
                        ...state.project.blackboard,
                        globalVariables: newGlobalVars,
                        events: newEvents
                    },
                    stageTree: { ...state.project.stageTree, stages: newStages },
                    nodes: newNodes
                }
            };
        }

        default:
            return state;
    }
};
