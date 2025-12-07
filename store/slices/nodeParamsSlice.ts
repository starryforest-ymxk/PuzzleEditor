/**
 * Node Parameters (节点局部参数) Reducer 切片
 * 处理所有与 PuzzleNode 本地黑板变量相关的操作
 */

import { EditorState, Action } from '../types';
import { BlackboardVariable } from '../../types/blackboard';

// ========== Node Params 相关 Actions 类型定义 ==========
export type NodeParamsAction =
    | { type: 'ADD_NODE_PARAM'; payload: { nodeId: string; variable: BlackboardVariable } }
    | { type: 'UPDATE_NODE_PARAM'; payload: { nodeId: string; varId: string; data: Partial<BlackboardVariable> } }
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

            return {
                ...state,
                project: {
                    ...state.project,
                    nodes: {
                        ...state.project.nodes,
                        [nodeId]: {
                            ...node,
                            localBlackboard: {
                                ...node.localBlackboard,
                                [variable.id]: variable
                            }
                        }
                    }
                }
            };
        }

        case 'UPDATE_NODE_PARAM': {
            const { nodeId, varId, data } = action.payload;
            const node = state.project.nodes[nodeId];
            if (!node || !node.localBlackboard[varId]) return state;

            return {
                ...state,
                project: {
                    ...state.project,
                    nodes: {
                        ...state.project.nodes,
                        [nodeId]: {
                            ...node,
                            localBlackboard: {
                                ...node.localBlackboard,
                                [varId]: { ...node.localBlackboard[varId], ...data }
                            }
                        }
                    }
                }
            };
        }

        case 'DELETE_NODE_PARAM': {
            const { nodeId, varId } = action.payload;
            const node = state.project.nodes[nodeId];
            if (!node) return state;

            const newBlackboard = { ...node.localBlackboard };
            delete newBlackboard[varId];

            return {
                ...state,
                project: {
                    ...state.project,
                    nodes: {
                        ...state.project.nodes,
                        [nodeId]: {
                            ...node,
                            localBlackboard: newBlackboard
                        }
                    }
                }
            };
        }

        default:
            return state;
    }
};
