/**
 * Project Reducer 切片
 * 处理与项目数据相关的基础操作：Stage 树更新、Node 更新、Stage CRUD
 */

import { EditorState, Action } from '../types';
import { StageTreeData, StageNode } from '../../types/stage';
import { PuzzleNode } from '../../types/puzzleNode';
import { VariableDefinition } from '../../types/blackboard';
import { StageId, VariableId } from '../../types/common';
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
    | { type: 'DELETE_STAGE_VARIABLE'; payload: { stageId: StageId; varId: VariableId } };

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
        'DELETE_STAGE_VARIABLE'
    ];
    return projectActionTypes.includes(action.type);
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

            return {
                ...state,
                project: {
                    ...state.project,
                    stageTree: {
                        ...state.project.stageTree,
                        stages: {
                            ...state.project.stageTree.stages,
                            [parentId]: { ...parent, childrenIds: newChildrenIds },
                            [stage.id]: { ...stage, parentId }
                        }
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
            if (parentStage) {
                newStages[stage.parentId] = {
                    ...parentStage,
                    childrenIds: parentStage.childrenIds.filter(id => id !== stageId)
                };
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
                        stages: newStages
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

            return {
                ...state,
                project: {
                    ...state.project,
                    stageTree: {
                        ...state.project.stageTree,
                        stages: {
                            ...state.project.stageTree.stages,
                            [stageId]: { ...stage, ...data }
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

            return {
                ...state,
                project: {
                    ...state.project,
                    stageTree: {
                        ...state.project.stageTree,
                        stages: {
                            ...state.project.stageTree.stages,
                            [stage.parentId]: { ...parent, childrenIds: newChildrenIds }
                        }
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

            return {
                ...state,
                project: {
                    ...state.project,
                    stageTree: {
                        ...state.project.stageTree,
                        stages: {
                            ...state.project.stageTree.stages,
                            [stageId]: { ...stage, parentId: newParentId },
                            [oldParent.id]: { ...oldParent, childrenIds: oldChildrenIds },
                            [newParentId]: { ...newParent, childrenIds: newChildrenIds }
                        }
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

        default:
            return state;
    }
};
