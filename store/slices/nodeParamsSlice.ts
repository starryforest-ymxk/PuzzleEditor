/**
 * Node Parameters (节点局部参数) Reducer 切片
 * 处理所有与 PuzzleNode 局部变量相关的操作
 */

import { EditorState, Action } from '../types';
import { VariableDefinition } from '../../types/blackboard';
import { normalizeResourceStateUpdate, resolveDeleteAction } from '../../utils/resourceLifecycle';
import { withScope } from '../../utils/variableScope';

// ========== Node Params 相关 Actions 类型定义 ==========
export type NodeParamsAction =
    | { type: 'ADD_NODE_PARAM'; payload: { nodeId: string; variable: VariableDefinition } }
    | { type: 'UPDATE_NODE_PARAM'; payload: { nodeId: string; varId: string; data: Partial<VariableDefinition> } }
    | { type: 'DELETE_NODE_PARAM'; payload: { nodeId: string; varId: string } };

// ========== 类型守卫：判断是否为 Node Params Action ==========
export const isNodeParamsAction = (action: Action): action is NodeParamsAction => {
    const nodeParamsActionTypes = ['ADD_NODE_PARAM', 'UPDATE_NODE_PARAM', 'DELETE_NODE_PARAM'];
    return nodeParamsActionTypes.includes(action.type);
};

// ========== Node Params Reducer ==========
export const nodeParamsReducer = (state: EditorState, action: NodeParamsAction): EditorState => {
    switch (action.type) {
        case 'ADD_NODE_PARAM': {
            const { nodeId, variable } = action.payload;
            const node = state.project.nodes[nodeId];
            if (!node) return state;

            const variableWithScope = withScope(variable, 'NodeLocal');

            return {
                ...state,
                project: {
                    ...state.project,
                    nodes: {
                        ...state.project.nodes,
                        [nodeId]: {
                            ...node,
                            localVariables: {
                                ...node.localVariables,
                                [variable.id]: variableWithScope
                            }
                        }
                    }
                }
            };
        }

        case 'UPDATE_NODE_PARAM': {
            const { nodeId, varId, data } = action.payload;
            const node = state.project.nodes[nodeId];
            const variable = node?.localVariables[varId];
            if (!node || !variable) return state;

            // 仅允许合法的状态跳转；非法跳转保持原状态
            const nextState = normalizeResourceStateUpdate(variable.state, data.state);
            const mergedData = { ...data, state: nextState };

            return {
                ...state,
                project: {
                    ...state.project,
                    nodes: {
                        ...state.project.nodes,
                        [nodeId]: {
                            ...node,
                            localVariables: {
                                ...node.localVariables,
                                [varId]: { ...variable, ...mergedData }
                            }
                        }
                    }
                }
            };
        }

        case 'DELETE_NODE_PARAM': {
            const { nodeId, varId } = action.payload;
            const node = state.project.nodes[nodeId];
            const variable = node?.localVariables[varId];
            if (!node || !variable) return state;

            const newLocalVariables = { ...node.localVariables };

            // 软删除逻辑：Implemented -> MarkedForDelete；Draft/Marked -> 物理删除
            const deleteResolution = resolveDeleteAction(variable.state);
            if (deleteResolution.shouldRemove) {
                delete newLocalVariables[varId];
            } else {
                newLocalVariables[varId] = { ...variable, state: deleteResolution.nextState };
            }

            return {
                ...state,
                project: {
                    ...state.project,
                    nodes: {
                        ...state.project.nodes,
                        [nodeId]: {
                            ...node,
                            localVariables: newLocalVariables
                        }
                    }
                }
            };
        }

        default:
            return state;
    }
};
