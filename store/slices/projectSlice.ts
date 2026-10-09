/**
 * Project Reducer 切片
 * 处理与项目数据相关的基础操作：Stage 树更新、Node 更新、Stage CRUD
 */

import { isActionForDomain, type ActionForDomain } from '../actionPolicy';
import { EditorState, Action } from '../types';
import { StageId, VariableId, PuzzleNodeId } from '../../types/common';
import { canMoveStage, updateInitialStatusByParent } from '../../utils/stageTreeUtils';
import { planHierarchyDeletion } from '../../utils/hierarchyDeletion';
import { reconcileHistoryUi } from '../historyUi';

// ========== Project 相关 Actions 类型定义 ==========
export type ProjectAction = ActionForDomain<'project'>;

// ========== 类型守卫：判断是否为 Project Action ==========
export const isProjectAction = (action: Action): action is ProjectAction => isActionForDomain(action, 'project');

// ========== Helper Functions ==========

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

            // 防重复：快速连续点击时闭包快照可能生成相同 ID，若已存在则跳过
            if (state.project.stageTree.stages[stage.id]) return state;

            // 计算插入位置
            const newChildrenIds = [...parent.childrenIds];
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

        // 层级删除只消费共用计划；确认后重新计算，拒绝失效结构与外部 FSM 所有者。
        case 'DELETE_STAGE':
        case 'DELETE_PUZZLE_NODE': {
            const target = action.type === 'DELETE_STAGE'
                ? { type: 'stage' as const, id: action.payload.stageId, cascade: true }
                : { type: 'puzzle' as const, id: action.payload.nodeId };
            const deletion = planHierarchyDeletion(state.project, target);
            if (!deletion.ok) return state;
            const { stageIds, puzzleIds, parentId, project } = deletion;
            const selectionRemoved = (state.ui.selection.type === 'STAGE' && stageIds.includes(state.ui.selection.id ?? ''))
                || (state.ui.selection.type === 'NODE' && puzzleIds.includes(state.ui.selection.id ?? ''));
            return {
                ...state, project,
                ui: reconcileHistoryUi({
                    ...state.ui,
                    currentStageId: stageIds.includes(state.ui.currentStageId ?? '') ? parentId : state.ui.currentStageId,
                    currentNodeId: puzzleIds.includes(state.ui.currentNodeId ?? '') ? null : state.ui.currentNodeId,
                    selection: selectionRemoved ? { type: 'STAGE', id: parentId, contextId: null } : state.ui.selection
                }, project)
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
            // 共用移动保护：UI 与无界面命令均不能制造阶段环。
            if (!canMoveStage(state.project.stageTree, stageId, newParentId)) return state;
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

            const { [varId]: _removed, ...remainingVars } = stage.localVariables;

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

            // 安全防护：外部数据结构不完整时跳过同步
            if (!externalData || !externalData.scripts?.scripts || !externalData.blackboard) {
                console.warn('[SYNC_RESOURCE_STATES] Invalid external data structure, skipping sync.');
                return state;
            }

            // 1. 同步脚本状态
            const newScripts = { ...currentProject.scripts.scripts };
            let hasChanges = false;
            Object.keys(externalData.scripts.scripts || {}).forEach((id) => {
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
            Object.keys(externalData.blackboard?.globalVariables || {}).forEach((id) => {
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
            Object.keys(externalData.blackboard?.events || {}).forEach((id) => {
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
            Object.keys(externalData.stageTree?.stages || {}).forEach((sId) => {
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
            Object.keys(externalData.nodes || {}).forEach((nId) => {
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
