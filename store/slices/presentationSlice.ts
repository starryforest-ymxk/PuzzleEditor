/**
 * Presentation Graph (演出子图) Reducer 切片
 * 处理所有与演出图及其节点和连线相关的操作
 */

import { EditorState, Action } from '../types';
import { PresentationNode, PresentationGraph } from '../../types/presentation';
import { normalizePresentationNode } from '../../utils/presentation';

// ========== Presentation 相关 Actions 类型定义 ==========
export type PresentationAction =
    | { type: 'ADD_PRESENTATION_GRAPH'; payload: { graph: PresentationGraph } }
    | { type: 'UPDATE_PRESENTATION_GRAPH'; payload: { graphId: string; data: Partial<PresentationGraph> } }
    | { type: 'DELETE_PRESENTATION_GRAPH'; payload: { graphId: string } }
    | { type: 'ADD_PRESENTATION_NODE'; payload: { graphId: string; node: PresentationNode } }
    | { type: 'DELETE_PRESENTATION_NODE'; payload: { graphId: string; nodeId: string } }
    | { type: 'UPDATE_PRESENTATION_NODE'; payload: { graphId: string; nodeId: string; data: Partial<PresentationNode> } }
    | { type: 'LINK_PRESENTATION_NODES'; payload: { graphId: string; fromNodeId: string; toNodeId: string } }
    | { type: 'UNLINK_PRESENTATION_NODES'; payload: { graphId: string; fromNodeId: string; toNodeId: string } };

// ========== 类型守卫：判断是否为 Presentation Action ==========
export const isPresentationAction = (action: { type: string }): action is PresentationAction => {
    const presentationActionTypes = [
        'ADD_PRESENTATION_GRAPH', 'UPDATE_PRESENTATION_GRAPH', 'DELETE_PRESENTATION_GRAPH',
        'ADD_PRESENTATION_NODE', 'DELETE_PRESENTATION_NODE', 'UPDATE_PRESENTATION_NODE',
        'LINK_PRESENTATION_NODES', 'UNLINK_PRESENTATION_NODES'
    ];
    return presentationActionTypes.includes(action.type);
};

// ========== Presentation Reducer ==========
export const presentationReducer = (state: EditorState, action: PresentationAction): EditorState => {
    switch (action.type) {
        // ========== 演出图级别操作 ==========
        case 'ADD_PRESENTATION_GRAPH': {
            const { graph } = action.payload;
            return {
                ...state,
                project: {
                    ...state.project,
                    presentationGraphs: {
                        ...state.project.presentationGraphs,
                        [graph.id]: graph
                    }
                }
            };
        }

        case 'UPDATE_PRESENTATION_GRAPH': {
            const { graphId, data } = action.payload;
            const graph = state.project.presentationGraphs[graphId];
            if (!graph) return state;

            return {
                ...state,
                project: {
                    ...state.project,
                    presentationGraphs: {
                        ...state.project.presentationGraphs,
                        [graphId]: { ...graph, ...data }
                    }
                }
            };
        }

        case 'DELETE_PRESENTATION_GRAPH': {
            const { graphId } = action.payload;
            const { [graphId]: deleted, ...remaining } = state.project.presentationGraphs;

            // 更新选择状态
            let newSelection = state.ui.selection;
            if (
                (state.ui.selection.type === 'PRESENTATION_GRAPH' && state.ui.selection.id === graphId) ||
                (state.ui.selection.type === 'PRESENTATION_NODE' && state.ui.selection.contextId === graphId)
            ) {
                newSelection = { type: 'NONE', id: null };
            }

            // 如果删除的是当前正在编辑的演出图，导航回上一个界面
            let newUi = { ...state.ui, selection: newSelection };
            if (state.ui.currentGraphId === graphId) {
                if (state.ui.navStack.length > 0) {
                    // 有历史记录，使用 NAVIGATE_BACK 的逻辑
                    const previous = state.ui.navStack[state.ui.navStack.length - 1];
                    const nextStack = state.ui.navStack.slice(0, -1);
                    newUi = {
                        ...newUi,
                        currentStageId: previous.stageId,
                        currentNodeId: previous.nodeId,
                        currentGraphId: previous.graphId,
                        navStack: nextStack,
                        view: 'EDITOR'
                    };
                } else {
                    // 没有历史记录，清空当前演出图
                    newUi = {
                        ...newUi,
                        currentGraphId: null
                    };
                }
            }

            return {
                ...state,
                ui: newUi,
                project: {
                    ...state.project,
                    presentationGraphs: remaining
                }
            };
        }

        // ========== 演出节点级别操作 ==========
        case 'ADD_PRESENTATION_NODE': {
            const { graphId, node } = action.payload;
            const graph = state.project.presentationGraphs[graphId];
            if (!graph) return state;

            const normalized = normalizePresentationNode(node);

            return {
                ...state,
                project: {
                    ...state.project,
                    presentationGraphs: {
                        ...state.project.presentationGraphs,
                        [graphId]: {
                            ...graph,
                            nodes: { ...graph.nodes, [normalized.id]: normalized }
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
            Object.keys(newNodes).forEach(id => {
                const n = newNodes[id];
                newNodes[id] = { ...n, nextIds: n.nextIds.filter(next => next !== nodeId) };
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

            const updated = normalizePresentationNode({ ...graph.nodes[nodeId], ...data });

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
                                [nodeId]: updated
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
