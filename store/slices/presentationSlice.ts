/**
 * Presentation Graph (演出子图) Reducer 切片
 * 处理所有与演出节点和连线相关的操作
 */

import { EditorState, Action } from '../types';
import { PresentationNode, PresentationGraph } from '../../types/presentation';

// ========== Presentation 相关 Actions 类型定义 ==========
export type PresentationAction =
    | { type: 'ADD_PRESENTATION_NODE'; payload: { graphId: string; node: PresentationNode } }
    | { type: 'DELETE_PRESENTATION_NODE'; payload: { graphId: string; nodeId: string } }
    | { type: 'UPDATE_PRESENTATION_NODE'; payload: { graphId: string; nodeId: string; data: Partial<PresentationNode> } }
    | { type: 'LINK_PRESENTATION_NODES'; payload: { graphId: string; fromNodeId: string; toNodeId: string } }
    | { type: 'UNLINK_PRESENTATION_NODES'; payload: { graphId: string; fromNodeId: string; toNodeId: string } };

// ========== 类型守卫：判断是否为 Presentation Action ==========
export const isPresentationAction = (action: Action): action is PresentationAction => {
    const presentationActionTypes = [
        'ADD_PRESENTATION_NODE', 'DELETE_PRESENTATION_NODE', 'UPDATE_PRESENTATION_NODE',
        'LINK_PRESENTATION_NODES', 'UNLINK_PRESENTATION_NODES'
    ];
    return presentationActionTypes.includes(action.type);
};

// ========== Presentation Reducer ==========
export const presentationReducer = (state: EditorState, action: PresentationAction): EditorState => {
    switch (action.type) {
        case 'ADD_PRESENTATION_NODE': {
            const { graphId, node } = action.payload;
            const graph = state.project.presentationGraphs[graphId];
            if (!graph) return state;

            return {
                ...state,
                project: {
                    ...state.project,
                    presentationGraphs: {
                        ...state.project.presentationGraphs,
                        [graphId]: {
                            ...graph,
                            nodes: { ...graph.nodes, [node.id]: node }
                        }
                    }
                }
            };
        }

        case 'DELETE_PRESENTATION_NODE': {
            const { graphId, nodeId } = action.payload;
            const graph = state.project.presentationGraphs[graphId];
            if (!graph) return state;

            const newNodes = { ...graph.nodes };
            delete newNodes[nodeId];

            // 清理其他节点的 nextIds 引用
            Object.values(newNodes).forEach(n => {
                n.nextIds = n.nextIds.filter(id => id !== nodeId);
            });

            // 更新选择状态
            let newSelection = state.ui.selection;
            if (state.ui.selection.type === 'PRESENTATION_NODE' && state.ui.selection.id === nodeId) {
                newSelection = { type: 'PRESENTATION_GRAPH', id: graphId, contextId: state.ui.selection.contextId };
            }

            return {
                ...state,
                ui: { ...state.ui, selection: newSelection },
                project: {
                    ...state.project,
                    presentationGraphs: {
                        ...state.project.presentationGraphs,
                        [graphId]: { ...graph, nodes: newNodes }
                    }
                }
            };
        }

        case 'UPDATE_PRESENTATION_NODE': {
            const { graphId, nodeId, data } = action.payload;
            const graph = state.project.presentationGraphs[graphId];
            if (!graph || !graph.nodes[nodeId]) return state;

            return {
                ...state,
                project: {
                    ...state.project,
                    presentationGraphs: {
                        ...state.project.presentationGraphs,
                        [graphId]: {
                            ...graph,
                            nodes: {
                                ...graph.nodes,
                                [nodeId]: { ...graph.nodes[nodeId], ...data }
                            }
                        }
                    }
                }
            };
        }

        case 'LINK_PRESENTATION_NODES': {
            const { graphId, fromNodeId, toNodeId } = action.payload;
            const graph = state.project.presentationGraphs[graphId];
            if (!graph || !graph.nodes[fromNodeId] || !graph.nodes[toNodeId]) return state;

            const fromNode = graph.nodes[fromNodeId];
            if (fromNode.nextIds.includes(toNodeId)) return state; // 避免重复连接

            return {
                ...state,
                project: {
                    ...state.project,
                    presentationGraphs: {
                        ...state.project.presentationGraphs,
                        [graphId]: {
                            ...graph,
                            nodes: {
                                ...graph.nodes,
                                [fromNodeId]: {
                                    ...fromNode,
                                    nextIds: [...fromNode.nextIds, toNodeId]
                                }
                            }
                        }
                    }
                }
            };
        }

        case 'UNLINK_PRESENTATION_NODES': {
            const { graphId, fromNodeId, toNodeId } = action.payload;
            const graph = state.project.presentationGraphs[graphId];
            if (!graph || !graph.nodes[fromNodeId]) return state;

            const fromNode = graph.nodes[fromNodeId];
            if (!fromNode.nextIds.includes(toNodeId)) return state;

            return {
                ...state,
                project: {
                    ...state.project,
                    presentationGraphs: {
                        ...state.project.presentationGraphs,
                        [graphId]: {
                            ...graph,
                            nodes: {
                                ...graph.nodes,
                                [fromNodeId]: {
                                    ...fromNode,
                                    nextIds: fromNode.nextIds.filter(id => id !== toNodeId)
                                }
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
